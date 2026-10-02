import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import multer from 'multer';
import { PDFDocument, cmyk, degrees, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import { BusinessCardTemplate, ContactData, ExportSettings, CardField, TextFieldConfig, QRCodeFieldConfig } from './src/types';
import { buildVCard3 } from './src/utils/vcard';

const app = express();
const PORT = 3000;

const MM_TO_PT = 2.8346457;

// Configure uploads directory
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const FONTS_DIR = path.join(process.cwd(), 'fonts');
const CONFIGS_DIR = path.join(process.cwd(), 'saved_configs');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });
if (!fs.existsSync(CONFIGS_DIR)) fs.mkdirSync(CONFIGS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Wymagany jest plik w formacie PDF (.pdf)'));
    }
  }
});

const fontStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FONTS_DIR),
  filename: (req, file, cb) => {
    cb(null, file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});
const fontUpload = multer({
  storage: fontStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.ttf') || name.endsWith('.otf') || file.mimetype.includes('font')) {
      cb(null, true);
    } else {
      cb(new Error('Wymagany jest plik czcionki TrueType (.ttf) lub OpenType (.otf)'));
    }
  }
});

const qrUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.svg', '.jpg', '.jpeg', '.png'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Dozwolone formaty kodu QR to: PDF, SVG, JPG, PNG'));
    }
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Spot UV Color definition: Magenta 100% (CMYK: 0, 100, 0, 0)
const SPOT_UV_COLOR = cmyk(0, 1, 0, 0);

// Helper to convert 0-100 CMYK array to pdf-lib CMYK
function toPdfCmyk(color?: [number, number, number, number]) {
  if (!color || color.length < 4) return cmyk(0, 0, 0, 1);
  const [c, m, y, k] = color.map((v) => Math.max(0, Math.min(100, v)) / 100);
  return cmyk(c, m, y, k);
}

// Cached embedded fonts per request
async function getFontForField(pdfDoc: PDFDocument, fontFamily: string, fontWeight: string) {
  try {
    const fontFiles = fs.readdirSync(FONTS_DIR);
    let matchedFile = '';

    const familyLower = (fontFamily || '').toLowerCase();
    const weightLower = (fontWeight || '').toLowerCase();

    // Look for matching font file in fonts directory
    if (familyLower.includes('rajdhani')) {
      if (weightLower.includes('bold') || weightLower.includes('extrabold') || weightLower === '700' || weightLower === '800') {
        matchedFile = fontFiles.find((f) => f.toLowerCase().includes('rajdhani-bold')) || '';
      } else if (weightLower.includes('semibold') || weightLower === '600') {
        matchedFile = fontFiles.find((f) => f.toLowerCase().includes('rajdhani-semibold')) || '';
      } else if (weightLower.includes('medium') || weightLower === '500') {
        matchedFile = fontFiles.find((f) => f.toLowerCase().includes('rajdhani-medium')) || '';
      } else {
        matchedFile = fontFiles.find((f) => f.toLowerCase().includes('rajdhani-regular')) || 
                      fontFiles.find((f) => f.toLowerCase().includes('rajdhani')) || '';
      }
    } else if (familyLower.includes('montserrat')) {
      matchedFile = fontFiles.find((f) => f.toLowerCase().includes('montserrat')) || '';
    } else {
      matchedFile = fontFiles.find((f) => f.toLowerCase().includes(familyLower)) || '';
    }

    if (!matchedFile && fontFiles.length > 0) {
      matchedFile = fontFiles[0];
    }

    if (matchedFile) {
      const fontBuffer = fs.readFileSync(path.join(FONTS_DIR, matchedFile));
      return await pdfDoc.embedFont(fontBuffer);
    }
  } catch (err) {
    console.warn('Font loading fallback:', err);
  }

  // Fallback standard Helvetica
  if (fontWeight === 'bold' || fontWeight === 'extrabold') {
    return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  return await pdfDoc.embedFont(StandardFonts.Helvetica);
}

// Draw crop marks (Linie cięcia) on page
function drawCropMarks(page: any, widthBruttoPt: number, heightBruttoPt: number, bleedPt: number) {
  if (bleedPt <= 0) return;
  const markLen = 8; // pt
  const markOffset = 2; // pt distance from trim line
  const lineColor = cmyk(0, 0, 0, 1); // 100% K
  const thickness = 0.5;

  const leftTrim = bleedPt;
  const rightTrim = widthBruttoPt - bleedPt;
  const bottomTrim = bleedPt;
  const topTrim = heightBruttoPt - bleedPt;

  // Top-left
  page.drawLine({ start: { x: leftTrim, y: topTrim + markOffset }, end: { x: leftTrim, y: topTrim + markOffset + markLen }, thickness, color: lineColor });
  page.drawLine({ start: { x: leftTrim - markOffset - markLen, y: topTrim }, end: { x: leftTrim - markOffset, y: topTrim }, thickness, color: lineColor });

  // Top-right
  page.drawLine({ start: { x: rightTrim, y: topTrim + markOffset }, end: { x: rightTrim, y: topTrim + markOffset + markLen }, thickness, color: lineColor });
  page.drawLine({ start: { x: rightTrim + markOffset, y: topTrim }, end: { x: rightTrim + markOffset + markLen, y: topTrim }, thickness, color: lineColor });

  // Bottom-left
  page.drawLine({ start: { x: leftTrim, y: bottomTrim - markOffset }, end: { x: leftTrim, y: bottomTrim - markOffset - markLen }, thickness, color: lineColor });
  page.drawLine({ start: { x: leftTrim - markOffset - markLen, y: bottomTrim }, end: { x: leftTrim - markOffset, y: bottomTrim }, thickness, color: lineColor });

  // Bottom-right
  page.drawLine({ start: { x: rightTrim, y: bottomTrim - markOffset }, end: { x: rightTrim, y: bottomTrim - markOffset - markLen }, thickness, color: lineColor });
  page.drawLine({ start: { x: rightTrim + markOffset, y: bottomTrim }, end: { x: rightTrim + markOffset + markLen, y: bottomTrim }, thickness, color: lineColor });
}

// Render dynamic fields on designated page
async function renderFieldsOnPage(
  pdfDoc: PDFDocument,
  pageCmyk: any,
  pageUv: any | null,
  side: 'front' | 'back',
  fields: CardField[],
  contactData: ContactData,
  settings: {
    bleedOffsetPt: number;
    heightBruttoPt: number;
    renderUV: boolean;
  }
) {
  const { bleedOffsetPt, heightBruttoPt } = settings;

  const sideFields = fields.filter((f) => f.side === side);

  for (const field of sideFields) {
    const xPt = field.x * MM_TO_PT + bleedOffsetPt;
    const wPt = field.w * MM_TO_PT;
    const hPt = field.h * MM_TO_PT;
    // Y PostScript axis: 0 is at bottom
    // Y_pdf = heightBruttoPt - (field.y * MM_TO_PT + bleedOffsetPt) - hPt
    const yPt = heightBruttoPt - (field.y * MM_TO_PT + bleedOffsetPt) - hPt;

    if (field.type === 'text') {
      const textField = field as TextFieldConfig;
      let text = textField.defaultValue || '';

      if (textField.bindKey && contactData) {
        if (textField.bindKey === 'fullName') {
          text = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || textField.defaultValue;
        } else if (textField.bindKey === 'address') {
          if (contactData.address) {
            text = contactData.address;
          } else {
            const officePart = contactData.office ? `${contactData.office}\n` : '';
            const streetPart = contactData.street || '';
            const cityPart = `${contactData.zip || ''} ${contactData.city || ''}`.trim();
            const countryPart = contactData.country || '';
            text = `${officePart}${streetPart}, ${cityPart}, ${countryPart}`.trim() || textField.defaultValue;
          }
        } else if (textField.bindKey === 'nip') {
          text = contactData.nip ? (contactData.nip.startsWith('NIP') ? contactData.nip : `NIP: ${contactData.nip}`) : textField.defaultValue;
        } else if (contactData[textField.bindKey as keyof ContactData]) {
          text = String(contactData[textField.bindKey as keyof ContactData]);
        }
      }

      if (textField.textTransform === 'uppercase') text = text.toUpperCase();
      if (textField.textTransform === 'lowercase') text = text.toLowerCase();
      if (textField.textTransform === 'capitalize') {
        text = text.replace(/\b\w/g, (l) => l.toUpperCase());
      }

      const font = await getFontForField(pdfDoc, textField.fontFamily, textField.fontWeight);
      const fontSize = textField.fontSize || 10;
      
      // Handle multi-line text (e.g. Address with interlinia)
      const lines = text.split('\n');
      
      const isMontserrat = textField.fontFamily === 'Montserrat';
      const ascentRatio = isMontserrat ? 0.95 : 0.93;
      const fontFactor = isMontserrat ? 1.22 : 1.276;

      const textHeightPt = fontFactor * fontSize;
      const textHeightMm = (textHeightPt * 25.4) / 72;
      const ascentMm = (ascentRatio * fontSize * 25.4) / 72;
      const hMm = textField.h || 5;
      const lineSpacingMm = (textField.lineHeight && textField.lineHeight > 3)
        ? (textField.lineHeight * 25.4) / 72
        : (textField.lineHeight ? (textField.lineHeight * fontSize * 25.4) / 72 : (fontSize * 1.15 * 25.4) / 72);

      let topMarginMm: number;
      if (lines.length <= 1) {
        topMarginMm = Math.max(0, (hMm - textHeightMm) / 2);
      } else {
        const totalSpanMm = (lines.length - 1) * lineSpacingMm + textHeightMm;
        topMarginMm = Math.max(0, (hMm - totalSpanMm) / 2);
      }

      lines.forEach((lineText, lineIdx) => {
        const textWidth = font.widthOfTextAtSize(lineText, fontSize);

        // Alignment offset
        let adjustedX = xPt;
        if (textField.align === 'center') {
          adjustedX = xPt + Math.max(0, (wPt - textWidth) / 2);
        } else if (textField.align === 'right') {
          adjustedX = xPt + Math.max(0, wPt - textWidth);
        }

        // Exact typographic baseline matching preview identically
        const baselineFromNettoTopMm = textField.y + topMarginMm + ascentMm + lineIdx * lineSpacingMm;
        const baselineFromNettoTopPt = baselineFromNettoTopMm * MM_TO_PT;
        // Y PostScript axis: 0 is at bottom
        const lineBaselineY = heightBruttoPt - (bleedOffsetPt + baselineFromNettoTopPt);

        // 1. Draw CMYK on main page
        if (pageCmyk) {
          const cmykCol = toPdfCmyk(textField.colorCMYK);
          pageCmyk.drawText(lineText, {
            x: adjustedX,
            y: lineBaselineY,
            size: fontSize,
            font,
            color: cmykCol,
          });
        }

        // 2. Draw on UV Mask page if enabled
        if (pageUv && textField.useUV) {
          pageUv.drawText(lineText, {
            x: adjustedX,
            y: lineBaselineY,
            size: fontSize,
            font,
            color: SPOT_UV_COLOR, // Magenta 100% Spot
          });
        }
      });
    } else if (field.type === 'qr') {
      const qrField = field as QRCodeFieldConfig;
      const customQrSrc = (contactData.useCustomQr || qrField.source === 'custom_image') 
        ? (contactData.customQrImage || qrField.customImageUrl) 
        : null;

      let customEmbedded = false;

      if (customQrSrc) {
        try {
          let imgBuffer: Buffer | null = null;
          let isPng = true;

          if (customQrSrc.startsWith('data:image/')) {
            const matches = customQrSrc.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (matches) {
              const format = matches[1].toLowerCase();
              isPng = format.includes('png') || format.includes('svg');
              imgBuffer = Buffer.from(matches[2], 'base64');
            }
          } else if (customQrSrc.startsWith('/uploads/') || customQrSrc.startsWith('uploads/')) {
            const cleanPath = customQrSrc.startsWith('/') ? customQrSrc.substring(1) : customQrSrc;
            const fullPath = path.join(process.cwd(), cleanPath);
            if (fs.existsSync(fullPath)) {
              imgBuffer = fs.readFileSync(fullPath);
              isPng = !fullPath.toLowerCase().endsWith('.jpg') && !fullPath.toLowerCase().endsWith('.jpeg');
            }
          }

          if (imgBuffer) {
            let embeddedImage;
            try {
              embeddedImage = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
            } catch (embedErr) {
              // Try the other format as fallback
              try {
                embeddedImage = isPng ? await pdfDoc.embedJpg(imgBuffer) : await pdfDoc.embedPng(imgBuffer);
              } catch (e2) {
                console.warn('Could not embed custom QR image directly as PNG/JPG:', e2);
              }
            }

            if (pageCmyk && embeddedImage) {
              pageCmyk.drawImage(embeddedImage, {
                x: xPt,
                y: yPt,
                width: wPt,
                height: hPt,
              });
            }

            if (pageUv && qrField.useUV) {
              pageUv.drawRectangle({
                x: xPt,
                y: yPt,
                width: wPt,
                height: hPt,
                color: SPOT_UV_COLOR, // Magenta 100% Spot
              });
            }
            customEmbedded = true;
          }
        } catch (qrErr) {
          console.error('Błąd osadzania własnego obrazu QR w PDF:', qrErr);
        }
      }

      if (!customEmbedded) {
        let qrContent = '';

        if (qrField.source === 'vcard') {
          qrContent = buildVCard3(contactData);
        } else {
          qrContent = qrField.customData || contactData.website || 'https://example.com';
        }

        // Generate High-Res 300 DPI QR Matrix
        const qrData = QRCode.create(qrContent, {
          errorCorrectionLevel: qrField.errorCorrection || 'H',
        });

        const moduleCount = qrData.modules.size;
        const cellSizeX = wPt / moduleCount;
        const cellSizeY = hPt / moduleCount;

        // Draw vector QR code on CMYK page for crisp print
        if (pageCmyk) {
          const darkCol = toPdfCmyk(qrField.darkColorCMYK || [0, 0, 0, 100]);
          // Draw dark modules as vectors
          for (let r = 0; r < moduleCount; r++) {
            for (let c = 0; c < moduleCount; c++) {
              if (qrData.modules.get(r, c)) {
                pageCmyk.drawRectangle({
                  x: xPt + c * cellSizeX,
                  y: yPt + (moduleCount - 1 - r) * cellSizeY,
                  width: cellSizeX + 0.05,
                  height: cellSizeY + 0.05,
                  color: darkCol,
                });
              }
            }
          }
        }

        // Draw vector Spot UV Mask for QR code
        if (pageUv && qrField.useUV) {
          for (let r = 0; r < moduleCount; r++) {
            for (let c = 0; c < moduleCount; c++) {
              if (qrData.modules.get(r, c)) {
                pageUv.drawRectangle({
                  x: xPt + c * cellSizeX,
                  y: yPt + (moduleCount - 1 - r) * cellSizeY,
                  width: cellSizeX + 0.05,
                  height: cellSizeY + 0.05,
                  color: SPOT_UV_COLOR, // Magenta 100% Spot
                });
              }
            }
          }
        }
      }
    }
  }
}

// API: List available fonts
app.get('/api/fonts', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(FONTS_DIR).filter((f) => f.endsWith('.ttf') || f.endsWith('.otf'));
    res.json({ fonts: files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Upload custom TTF/OTF font
app.post('/api/upload-font', (req: Request, res: Response) => {
  fontUpload.single('fontFile')(req, res, (err: any) => {
    if (err) {
      console.error('Błąd uploadu czcionki:', err);
      return res.status(400).json({ success: false, error: err.message || 'Błąd podczas wgrywania pliku czcionki' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Brak pliku czcionki w żądaniu' });
    }
    return res.json({
      success: true,
      fileName: req.file.filename,
      message: `Czcionka ${req.file.originalname} została pomyślnie załadowana do silnika typograficznego.`,
    });
  });
});

// API: Upload custom QR code file (PDF, SVG, JPG, PNG)
app.post('/api/upload-qr', (req: Request, res: Response) => {
  qrUpload.single('qrFile')(req, res, async (err: any) => {
    if (err) {
      console.error('Błąd uploadu pliku QR:', err);
      return res.status(400).json({ success: false, error: err.message || 'Błąd podczas wgrywania pliku QR' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Brak pliku QR w żądaniu' });
    }

    try {
      const uploadedPath = req.file.path;
      const originalName = req.file.originalname;
      const ext = path.extname(originalName).toLowerCase();
      const baseName = path.basename(uploadedPath, ext);

      let finalRenderPath = uploadedPath;
      let finalUrl = `/uploads/${path.basename(uploadedPath)}`;

      const previewsDir = path.join(UPLOADS_DIR, 'previews');
      if (!fs.existsSync(previewsDir)) fs.mkdirSync(previewsDir, { recursive: true });

      // If PDF, rasterize first page to crisp 600 DPI PNG using Ghostscript
      if (ext === '.pdf') {
        const outPng = path.join(previewsDir, `qr_${baseName}.png`);
        await new Promise<void>((resolve) => {
          exec(
            `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r600 -dFirstPage=1 -dLastPage=1 -sOutputFile="${outPng}" "${uploadedPath}"`,
            { timeout: 20000 },
            (gsErr) => {
              if (gsErr) {
                console.warn('Ghostscript QR PDF convert warning:', gsErr.message);
              }
              if (fs.existsSync(outPng)) {
                finalRenderPath = outPng;
                finalUrl = `/uploads/previews/qr_${baseName}.png`;
              }
              resolve();
            }
          );
        });
      }

      // Read file buffer into base64 data URL for instant client display
      let dataUrl = '';
      if (fs.existsSync(finalRenderPath)) {
        const buf = fs.readFileSync(finalRenderPath);
        let mime = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.svg') mime = 'image/svg+xml';
        dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      }

      return res.json({
        success: true,
        fileUrl: finalUrl,
        dataUrl: dataUrl,
        fileName: path.basename(finalRenderPath),
        originalName,
        ext,
      });
    } catch (processErr: any) {
      console.error('Error processing uploaded QR:', processErr);
      return res.status(500).json({ success: false, error: processErr.message || 'Błąd przetwarzania pliku QR' });
    }
  });
});

// Helper to render high-resolution PNG previews for every page of a PDF using Ghostscript
async function generatePdfPreviews(pdfFilePath: string, baseFileName: string): Promise<{
  pageCount: number;
  previewUrls: { front?: string; frontUv?: string; back?: string; backUv?: string };
}> {
  const previewsDir = path.join(UPLOADS_DIR, 'previews');
  if (!fs.existsSync(previewsDir)) fs.mkdirSync(previewsDir, { recursive: true });

  const cleanBase = baseFileName.replace(/\.pdf$/i, '');
  const outPattern = path.join(previewsDir, `${cleanBase}_page_%d.png`);

  try {
    // Generate crisp 200 DPI PNGs with Ghostscript with timeout and buffer limit
    await new Promise<void>((resolve) => {
      exec(
        `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r200 -sOutputFile="${outPattern}" "${pdfFilePath}"`,
        { timeout: 25000, maxBuffer: 10 * 1024 * 1024 },
        (err) => {
          if (err) {
            console.warn('Ghostscript preview warning:', err.message);
          }
          resolve();
        }
      );
    });
  } catch (e) {
    console.error('Ghostscript preview execution error:', e);
  }

  // Determine page count safely
  let pageCount = 0;
  try {
    const fileBytes = fs.readFileSync(pdfFilePath);
    const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
  } catch (pdfErr) {
    console.warn('Could not read page count via pdf-lib:', pdfErr);
  }

  // Check generated preview files on disk as fallback/validation
  try {
    const generated = fs.readdirSync(previewsDir).filter((f) => f.startsWith(`${cleanBase}_page_`));
    if (generated.length > pageCount) {
      pageCount = generated.length;
    }
  } catch (fsErr) {
    console.warn('Could not scan previews directory:', fsErr);
  }

  if (pageCount === 0) {
    pageCount = 1;
  }

  const previewUrls: { front?: string; frontUv?: string; back?: string; backUv?: string } = {};

  if (pageCount >= 4) {
    previewUrls.front = `/uploads/previews/${cleanBase}_page_1.png`;
    previewUrls.frontUv = `/uploads/previews/${cleanBase}_page_2.png`;
    previewUrls.back = `/uploads/previews/${cleanBase}_page_3.png`;
    previewUrls.backUv = `/uploads/previews/${cleanBase}_page_4.png`;
  } else if (pageCount >= 2) {
    previewUrls.front = `/uploads/previews/${cleanBase}_page_1.png`;
    previewUrls.back = `/uploads/previews/${cleanBase}_page_2.png`;
  } else {
    previewUrls.front = `/uploads/previews/${cleanBase}_page_1.png`;
  }

  return { pageCount, previewUrls };
}

// API: Upload Master Template PDF (4 pages: Front, Front UV, Back, Back UV OR 2 pages)
app.post('/api/upload-template-pdf', (req: Request, res: Response) => {
  upload.single('masterPdf')(req, res, async (err: any) => {
    if (err) {
      console.error('Błąd uploadu PDF:', err);
      return res.status(400).json({ success: false, error: err.message || 'Błąd podczas wgrywania pliku PDF' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Brak pliku PDF szablonu w żądaniu' });
      }

      const filePath = req.file.path;
      const { pageCount, previewUrls } = await generatePdfPreviews(filePath, req.file.filename);

      const pagesDesc = pageCount >= 4
        ? '4 strony: Awers CMYK, Awers UV, Rewers CMYK, Rewers UV'
        : `${pageCount} ${pageCount === 1 ? 'strona' : 'strony'}`;

      return res.json({
        success: true,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        pageCount,
        previewUrls,
        message: `Szablon wczytany pomyślnie (${pagesDesc}). Podgląd wizytówki został zaktualizowany.`,
      });
    } catch (procErr: any) {
      console.error('Błąd przetwarzania pliku PDF:', procErr);
      return res.status(500).json({ success: false, error: 'Błąd przetwarzania pliku PDF: ' + procErr.message });
    }
  });
});

// API: Get preview images for an uploaded template
app.get('/api/template-previews/:fileName', async (req: Request, res: Response) => {
  try {
    const rawFileName = req.params.fileName;
    const baseName = path.basename(rawFileName);
    let filePath = path.join(UPLOADS_DIR, baseName);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', 'assets', baseName);
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Plik szablonu nie istnieje na serwerze' });
    }
    const result = await generatePdfPreviews(filePath, baseName);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: Generate 4-Page Production PDF with CMYK and Spot UV Layer
app.post('/api/generate-pdf', async (req: Request, res: Response) => {
  try {
    const {
      template,
      contactData,
      settings = { useBleed: true, bleedMm: 2, addCropMarks: true, addUVPage: true, dpi: 300 },
    }: {
      template: BusinessCardTemplate;
      contactData: ContactData;
      settings: Partial<ExportSettings>;
    } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Brak definicji szablonu' });
    }

    const useBleed = settings.useBleed !== false;
    const bleedMm = useBleed ? (settings.bleedMm || 2) : 0;
    const bleedPt = bleedMm * MM_TO_PT;

    const widthNetto = template.widthNetto || 90;
    const heightNetto = template.heightNetto || 50;

    const widthNettoPt = widthNetto * MM_TO_PT;
    const heightNettoPt = heightNetto * MM_TO_PT;

    const widthBruttoMm = widthNetto + bleedMm * 2;
    const heightBruttoMm = heightNetto + bleedMm * 2;

    const widthBruttoPt = widthBruttoMm * MM_TO_PT;
    const heightBruttoPt = heightBruttoMm * MM_TO_PT;

    // Create New Output PDF Document
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // If master background PDF exists, load it
    let masterDoc: PDFDocument | null = null;
    if (template.masterPdfFileName) {
      const baseName = path.basename(template.masterPdfFileName);
      let masterPath = path.join(UPLOADS_DIR, baseName);
      if (!fs.existsSync(masterPath)) {
        masterPath = path.join(process.cwd(), 'public', 'assets', baseName);
      }
      if (fs.existsSync(masterPath)) {
        try {
          const masterBytes = fs.readFileSync(masterPath);
          masterDoc = await PDFDocument.load(masterBytes, { ignoreEncryption: true });
        } catch (masterErr) {
          console.warn('Could not load master template PDF:', masterErr);
        }
      }
    }

    // Page 1: Front CMYK (Awers)
    const pageFrontCmyk = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);
    // Page 2: Front UV Mask (Awers Maska UV - Magenta 100%)
    const pageFrontUv = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);
    // Page 3: Back CMYK (Rewers)
    const pageBackCmyk = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);
    // Page 4: Back UV Mask (Rewers Maska UV - Magenta 100%)
    const pageBackUv = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);

    // Set precise PDF Prepress Geometry Boxes according to ISO DTP Standards (Acrobat Netto Trim inspection)
    const allPages = [pageFrontCmyk, pageFrontUv, pageBackCmyk, pageBackUv];
    allPages.forEach((page) => {
      page.setMediaBox(0, 0, widthBruttoPt, heightBruttoPt);
      page.setBleedBox(0, 0, widthBruttoPt, heightBruttoPt);
      page.setCropBox(0, 0, widthBruttoPt, heightBruttoPt);
      page.setTrimBox(bleedPt, bleedPt, widthNettoPt, heightNettoPt);
    });

    // 1. Draw Backgrounds / Master PDF Pages
    if (masterDoc) {
      const pageCount = masterDoc.getPageCount();
      
      if (pageCount >= 4) {
        // 4-page master PDF:
        // Page 0 (Index 0): Front CMYK -> Page 1
        // Page 1 (Index 1): Front UV Mask -> Page 2
        // Page 2 (Index 2): Back CMYK -> Page 3
        // Page 3 (Index 3): Back UV Mask -> Page 4
        const [frontMaster, frontUvMaster, backMaster, backUvMaster] = await pdfDoc.embedPages([
          masterDoc.getPage(0),
          masterDoc.getPage(1),
          masterDoc.getPage(2),
          masterDoc.getPage(3),
        ]);

        pageFrontCmyk.drawPage(frontMaster, { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageFrontUv.drawPage(frontUvMaster, { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageBackCmyk.drawPage(backMaster, { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageBackUv.drawPage(backUvMaster, { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
      } else if (pageCount >= 2) {
        // 2-page master PDF (Front CMYK, Back CMYK)
        const [frontMasterPage, backMasterPage] = await pdfDoc.embedPages([
          masterDoc.getPage(0),
          masterDoc.getPage(1),
        ]);
        pageFrontCmyk.drawPage(frontMasterPage, { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageBackCmyk.drawPage(backMasterPage, { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
      } else if (pageCount === 1) {
        // 1-page master PDF (Front only)
        const [frontMasterPage] = await pdfDoc.embedPages([masterDoc.getPage(0)]);
        pageFrontCmyk.drawPage(frontMasterPage, { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
      }
    } else {
      // Solid CMYK background
      if (template.frontBg?.colorCMYK) {
        pageFrontCmyk.drawRectangle({
          x: 0,
          y: 0,
          width: widthBruttoPt,
          height: heightBruttoPt,
          color: toPdfCmyk(template.frontBg.colorCMYK),
        });
      }
      if (template.backBg?.colorCMYK) {
        pageBackCmyk.drawRectangle({
          x: 0,
          y: 0,
          width: widthBruttoPt,
          height: heightBruttoPt,
          color: toPdfCmyk(template.backBg.colorCMYK),
        });
      }
    }

    // 2. Render Front Elements (CMYK Page 1 & UV Mask Page 2)
    await renderFieldsOnPage(pdfDoc, pageFrontCmyk, pageFrontUv, 'front', template.fields, contactData, {
      bleedOffsetPt: bleedPt,
      heightBruttoPt,
      renderUV: true,
    });

    // 3. Render Back Elements (CMYK Page 3 & UV Mask Page 4)
    await renderFieldsOnPage(pdfDoc, pageBackCmyk, pageBackUv, 'back', template.fields, contactData, {
      bleedOffsetPt: bleedPt,
      heightBruttoPt,
      renderUV: true,
    });

    // 4. Draw Crop Marks if enabled (Awers, Awers UV, Rewers, Rewers UV)
    if (settings.addCropMarks) {
      drawCropMarks(pageFrontCmyk, widthBruttoPt, heightBruttoPt, bleedPt);
      drawCropMarks(pageFrontUv, widthBruttoPt, heightBruttoPt, bleedPt);
      drawCropMarks(pageBackCmyk, widthBruttoPt, heightBruttoPt, bleedPt);
      drawCropMarks(pageBackUv, widthBruttoPt, heightBruttoPt, bleedPt);
    }

    // Set Document Metadata
    pdfDoc.setTitle(`Wizytowka_${contactData.lastName || 'Produkcja'}_${widthNetto}x${heightNetto}mm_UV`);
    pdfDoc.setAuthor('System Kreatora Wizytówek UV & vCard');
    pdfDoc.setProducer('pdf-lib CMYK Prepress Engine (300 DPI)');

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="wizytowka_druk_${widthNetto}x${heightNetto}mm_spad${bleedMm}mm_4strony_UV.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    console.error('Błąd generowania PDF:', err);
    res.status(500).json({ error: 'Błąd generowania PDF: ' + err.message });
  }
});

// API: Generate Merged Batch Production PDF for Multiple Records (4 pages per record: Awers, Awers UV, Rewers, Rewers UV)
app.post('/api/generate-batch-pdf', async (req: Request, res: Response) => {
  try {
    const {
      template,
      records,
      baseCompanyData = {},
      settings = { useBleed: true, bleedMm: 2, addCropMarks: true, addUVPage: true, dpi: 300 },
    }: {
      template: BusinessCardTemplate;
      records: Array<Partial<ContactData>>;
      baseCompanyData?: Partial<ContactData>;
      settings: Partial<ExportSettings>;
    } = req.body;

    if (!template || !records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Brak danych szablonu lub listy rekordów do generowania seryjnego' });
    }

    const useBleed = settings.useBleed !== false;
    const bleedMm = useBleed ? (settings.bleedMm || 2) : 0;
    const bleedPt = bleedMm * MM_TO_PT;

    const widthNetto = template.widthNetto || 90;
    const heightNetto = template.heightNetto || 50;

    const widthNettoPt = widthNetto * MM_TO_PT;
    const heightNettoPt = heightNetto * MM_TO_PT;

    const widthBruttoMm = widthNetto + bleedMm * 2;
    const heightBruttoMm = heightNetto + bleedMm * 2;

    const widthBruttoPt = widthBruttoMm * MM_TO_PT;
    const heightBruttoPt = heightBruttoMm * MM_TO_PT;

    // Create New Output PDF Document
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // If master background PDF exists, load it
    let masterDoc: PDFDocument | null = null;
    if (template.masterPdfFileName) {
      const baseName = path.basename(template.masterPdfFileName);
      let masterPath = path.join(UPLOADS_DIR, baseName);
      if (!fs.existsSync(masterPath)) {
        masterPath = path.join(process.cwd(), 'public', 'assets', baseName);
      }
      if (fs.existsSync(masterPath)) {
        try {
          const masterBytes = fs.readFileSync(masterPath);
          masterDoc = await PDFDocument.load(masterBytes, { ignoreEncryption: true });
        } catch (masterErr) {
          console.warn('Could not load master template PDF for batch:', masterErr);
        }
      }
    }

    // Embed master pages once if available
    let embeddedMasterPages: any[] = [];
    if (masterDoc) {
      const pageCount = masterDoc.getPageCount();
      if (pageCount >= 4) {
        embeddedMasterPages = await pdfDoc.embedPages([
          masterDoc.getPage(0),
          masterDoc.getPage(1),
          masterDoc.getPage(2),
          masterDoc.getPage(3),
        ]);
      } else if (pageCount >= 2) {
        embeddedMasterPages = await pdfDoc.embedPages([
          masterDoc.getPage(0),
          masterDoc.getPage(1),
        ]);
      } else if (pageCount === 1) {
        embeddedMasterPages = await pdfDoc.embedPages([masterDoc.getPage(0)]);
      }
    }

    // Process each person in the batch: generate 4 pages (Awers, Awers UV, Rewers, Rewers UV)
    for (let i = 0; i < records.length; i++) {
      const rawPerson = records[i];
      const mergedContact: ContactData = {
        firstName: rawPerson.firstName || '',
        lastName: rawPerson.lastName || '',
        jobTitle: rawPerson.jobTitle || '',
        company: rawPerson.company || baseCompanyData.company || '',
        office: rawPerson.office || baseCompanyData.office || '',
        phone: rawPerson.phone || baseCompanyData.phone || '',
        phoneMobile: rawPerson.phoneMobile || baseCompanyData.phoneMobile || '',
        email: rawPerson.email || '',
        website: rawPerson.website || baseCompanyData.website || '',
        street: rawPerson.street || baseCompanyData.street || '',
        zip: rawPerson.zip || baseCompanyData.zip || '',
        city: rawPerson.city || baseCompanyData.city || '',
        country: rawPerson.country || baseCompanyData.country || 'Polska',
        nip: rawPerson.nip || baseCompanyData.nip || '',
        address: rawPerson.address || baseCompanyData.address || '',
        customQrImage: rawPerson.customQrImage || baseCompanyData.customQrImage,
        useCustomQr: rawPerson.useCustomQr ?? baseCompanyData.useCustomQr,
      };

      // Page 1: Awers CMYK
      const pageFrontCmyk = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);
      // Page 2: Awers UV Mask
      const pageFrontUv = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);
      // Page 3: Rewers CMYK
      const pageBackCmyk = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);
      // Page 4: Rewers UV Mask
      const pageBackUv = pdfDoc.addPage([widthBruttoPt, heightBruttoPt]);

      // Set Prepress boxes
      const cardPages = [pageFrontCmyk, pageFrontUv, pageBackCmyk, pageBackUv];
      cardPages.forEach((p) => {
        p.setMediaBox(0, 0, widthBruttoPt, heightBruttoPt);
        p.setBleedBox(0, 0, widthBruttoPt, heightBruttoPt);
        p.setCropBox(0, 0, widthBruttoPt, heightBruttoPt);
        p.setTrimBox(bleedPt, bleedPt, widthNettoPt, heightNettoPt);
      });

      // Backgrounds
      if (embeddedMasterPages.length >= 4) {
        pageFrontCmyk.drawPage(embeddedMasterPages[0], { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageFrontUv.drawPage(embeddedMasterPages[1], { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageBackCmyk.drawPage(embeddedMasterPages[2], { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageBackUv.drawPage(embeddedMasterPages[3], { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
      } else if (embeddedMasterPages.length >= 2) {
        pageFrontCmyk.drawPage(embeddedMasterPages[0], { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
        pageBackCmyk.drawPage(embeddedMasterPages[1], { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
      } else if (embeddedMasterPages.length === 1) {
        pageFrontCmyk.drawPage(embeddedMasterPages[0], { x: 0, y: 0, width: widthBruttoPt, height: heightBruttoPt });
      } else {
        if (template.frontBg?.colorCMYK) {
          pageFrontCmyk.drawRectangle({
            x: 0,
            y: 0,
            width: widthBruttoPt,
            height: heightBruttoPt,
            color: toPdfCmyk(template.frontBg.colorCMYK),
          });
        }
        if (template.backBg?.colorCMYK) {
          pageBackCmyk.drawRectangle({
            x: 0,
            y: 0,
            width: widthBruttoPt,
            height: heightBruttoPt,
            color: toPdfCmyk(template.backBg.colorCMYK),
          });
        }
      }

      // Render Dynamic Fields
      await renderFieldsOnPage(pdfDoc, pageFrontCmyk, pageFrontUv, 'front', template.fields, mergedContact, {
        bleedOffsetPt: bleedPt,
        heightBruttoPt,
        renderUV: true,
      });

      await renderFieldsOnPage(pdfDoc, pageBackCmyk, pageBackUv, 'back', template.fields, mergedContact, {
        bleedOffsetPt: bleedPt,
        heightBruttoPt,
        renderUV: true,
      });

      // Crop Marks
      if (settings.addCropMarks) {
        drawCropMarks(pageFrontCmyk, widthBruttoPt, heightBruttoPt, bleedPt);
        drawCropMarks(pageFrontUv, widthBruttoPt, heightBruttoPt, bleedPt);
        drawCropMarks(pageBackCmyk, widthBruttoPt, heightBruttoPt, bleedPt);
        drawCropMarks(pageBackUv, widthBruttoPt, heightBruttoPt, bleedPt);
      }
    }

    pdfDoc.setTitle(`Wizytowki_Batch_${records.length}_osob_${widthNetto}x${heightNetto}mm_UV`);
    pdfDoc.setAuthor('System Kreatora Wizytówek UV & vCard');
    pdfDoc.setProducer(`pdf-lib CMYK Batch Engine (${records.length} osób, ${records.length * 4} stron)`);

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="wizytowki_BATCH_${records.length}_osob_${widthNetto}x${heightNetto}mm_UV.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    console.error('Błąd generowania Batch PDF:', err);
    res.status(500).json({ error: 'Błąd generowania Batch PDF: ' + err.message });
  }
});

// ==========================================
// SAVED CONFIGURATIONS & PRESETS API (/saved_configs)
// ==========================================

// API: List all saved configuration files in saved_configs/
app.get('/api/saved-configs', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(CONFIGS_DIR)) {
      fs.mkdirSync(CONFIGS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(CONFIGS_DIR).filter((f) => f.endsWith('.txt') || f.endsWith('.json') || f.endsWith('.md'));
    const configList = files.map((fileName) => {
      const fullPath = path.join(CONFIGS_DIR, fileName);
      const stat = fs.statSync(fullPath);
      let displayName = fileName.replace(/\.(txt|json|md)$/i, '');
      let templateName = 'Szablon';
      let cardSize = '90 × 50 mm';
      let savedAt = stat.mtime.toISOString();
      let previewSummary = '';

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        let parsed: any = null;
        if (fileName.endsWith('.json')) {
          parsed = JSON.parse(content);
        } else {
          const match = content.match(/<!--\s*JSON_START([\s\S]*?)JSON_END\s*-->/);
          if (match && match[1]) {
            parsed = JSON.parse(match[1].trim());
          }
        }

        if (parsed) {
          if (parsed.name) displayName = parsed.name;
          if (parsed.savedAt) savedAt = parsed.savedAt;
          if (parsed.template?.name) templateName = parsed.template.name;
          if (parsed.template?.widthNetto && parsed.template?.heightNetto) {
            cardSize = `${parsed.template.widthNetto} × ${parsed.template.heightNetto} mm`;
          }
          if (parsed.contactData) {
            const cd = parsed.contactData;
            previewSummary = `${cd.firstName || ''} ${cd.lastName || ''} | ${cd.jobTitle || ''} | ${cd.company || ''}`.trim();
          }
        }
      } catch (parseErr) {
        console.warn(`Could not parse header for saved config ${fileName}:`, parseErr);
      }

      return {
        fileName,
        name: displayName,
        savedAt,
        sizeBytes: stat.size,
        templateName,
        cardSize,
        previewSummary,
        fileExt: path.extname(fileName).replace('.', ''),
      };
    });

    // Sort newest first
    configList.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    res.json({ success: true, configs: configList });
  } catch (err: any) {
    console.error('Błąd pobierania listy zapisanych konfiguracji:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Save new configuration file (.txt with readable header and embedded JSON)
app.post('/api/saved-configs', (req: Request, res: Response) => {
  try {
    const {
      name,
      template,
      contactData,
      exportSettings,
      description = '',
    } = req.body;

    if (!template || !contactData) {
      return res.status(400).json({ success: false, error: 'Brak danych szablonu lub danych kontaktowych' });
    }

    if (!fs.existsSync(CONFIGS_DIR)) {
      fs.mkdirSync(CONFIGS_DIR, { recursive: true });
    }

    const safeName = (name || template.name || 'Konfiguracja_Wizytowki')
      .trim()
      .replace(/[^a-zA-Z0-9_\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]/g, '')
      .replace(/\s+/g, '_');

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${safeName}_${dateStr}.txt`;
    const fullPath = path.join(CONFIGS_DIR, fileName);

    const fullPayload = {
      version: '1.0',
      savedAt: now.toISOString(),
      name: name || template.name || 'Konfiguracja Wizytówki',
      description,
      template,
      contactData,
      exportSettings,
    };

    const textFields = (template.fields || []).filter((f: any) => f.type === 'text');
    const qrFields = (template.fields || []).filter((f: any) => f.type === 'qr');

    // Build beautiful human-readable text document
    const fileContent = `================================================================================
                    WIZYTOWNIK - ZAPISANA KONFIGURACJA DTP
================================================================================
Nazwa zestawu: ${name || template.name}
Data zapisu:   ${now.toLocaleString('pl-PL')}
Szablon:       ${template.name} (${template.widthNetto} × ${template.heightNetto} mm, Spad: ${template.bleedMm || 2} mm, Bezpieczna: ${template.safeZoneMm || 2.5} mm)
Podkład Master PDF: ${template.masterPdfFileName || 'Brak'}
Opis:          ${description || template.description || 'Brak'}

--------------------------------------------------------------------------------
1. DANE KONTAKTOWE I FIRMOWE:
--------------------------------------------------------------------------------
- Imię i Nazwisko: ${contactData.firstName || ''} ${contactData.lastName || ''}
- Stanowisko:      ${contactData.jobTitle || ''}
- Firma:           ${contactData.company || ''}
- Biuro/Oddział:   ${contactData.office || ''}
- Telefon:         ${contactData.phone || ''}
- E-mail:          ${contactData.email || ''}
- Strona WWW:      ${contactData.website || ''}
- Adres:           ${contactData.address || `${contactData.street || ''}, ${contactData.zip || ''} ${contactData.city || ''}`}
- NIP:             ${contactData.nip || ''}
- Kod QR:          ${contactData.useCustomQr ? `Własny plik graficzny (${contactData.customQrFileName || 'Załącznik'})` : 'Dynamiczny vCard 3.0'}

--------------------------------------------------------------------------------
2. ZESTAWIENIE ELEMENTÓW I WARSTW SZABLONU (${template.fields?.length || 0} obiektów):
--------------------------------------------------------------------------------
${textFields.map((f: any, idx: number) => `[Tekst #${idx + 1}] "${f.name}"
  - Strona: ${f.side === 'front' ? 'Awers' : 'Rewers'} | Wiązanie: ${f.bindKey || 'Brak (tekst stały)'}
  - Pozycja netto: X = ${f.x} mm, Y = ${f.y} mm, W = ${f.w} mm, H = ${f.h} mm
  - Krój czcionki: ${f.fontFamily} (${f.fontWeight}), Rozmiar: ${f.fontSize} pt, Interlinia: ${f.lineHeight || 'auto'}
  - Wyrównanie: ${f.align || 'left'}, Kolor CMYK: [${f.colorCMYK?.join(', ')}]
  - Lakier UV Wybiórczy (Spot UV): ${f.useUV ? 'TAK (Maska M=100 na stronie UV)' : 'NIE'}`).join('\n\n')}

${qrFields.map((f: any, idx: number) => `[Kod QR #${idx + 1}] "${f.name}"
  - Strona: ${f.side === 'front' ? 'Awers' : 'Rewers'} | Źródło: ${f.source}
  - Pozycja netto: X = ${f.x} mm, Y = ${f.y} mm, W = ${f.w} mm, H = ${f.h} mm
  - Lakier UV na kodzie QR: ${f.useUV ? 'TAK (Maska M=100)' : 'NIE'}`).join('\n\n')}

--------------------------------------------------------------------------------
3. SPECYFIKACJA DRUKU PDF:
--------------------------------------------------------------------------------
- Kolejność stron w pliku:
    Strona 1: Awers CMYK
    Strona 2: Awers Maska Lakieru UV (Magenta 100%)
    Strona 3: Rewers CMYK
    Strona 4: Rewers Maska Lakieru UV (Magenta 100%)
- Znaczniki cięcia: ${exportSettings?.addCropMarks ? 'Włączone' : 'Wyłączone'}
- Spady drukarskie: ${exportSettings?.useBleed ? `${exportSettings.bleedMm || 2} mm` : 'Brak'}

================================================================================
STRUKTURA DANYCH DO AUTOMATYCZNEGO WCZYTANIA (PROSIMY NIE MODYFIKOWAĆ PONIŻEJ):
<!-- JSON_START
${JSON.stringify(fullPayload, null, 2)}
JSON_END -->
================================================================================
`;

    fs.writeFileSync(fullPath, fileContent, 'utf-8');

    res.json({
      success: true,
      fileName,
      message: `Konfiguracja została zapisana do pliku ${fileName} w katalogu saved_configs.`,
    });
  } catch (err: any) {
    console.error('Błąd zapisu konfiguracji:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Load single configuration file
app.get('/api/saved-configs/:fileName', (req: Request, res: Response) => {
  try {
    const rawName = req.params.fileName;
    const baseName = path.basename(rawName);
    const fullPath = path.join(CONFIGS_DIR, baseName);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Plik konfiguracji nie istnieje na serwerze' });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    let parsed: any = null;

    if (baseName.endsWith('.json')) {
      parsed = JSON.parse(content);
    } else {
      const match = content.match(/<!--\s*JSON_START([\s\S]*?)JSON_END\s*-->/);
      if (match && match[1]) {
        parsed = JSON.parse(match[1].trim());
      } else {
        // Attempt direct json parse as fallback
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error('Nie udało się wyodrębnić danych konfiguracyjnych JSON z pliku tekstowego.');
        }
      }
    }

    res.json({ success: true, fileName: baseName, config: parsed });
  } catch (err: any) {
    console.error('Błąd odczytu konfiguracji:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Delete saved configuration file
app.delete('/api/saved-configs/:fileName', (req: Request, res: Response) => {
  try {
    const rawName = req.params.fileName;
    const baseName = path.basename(rawName);
    const fullPath = path.join(CONFIGS_DIR, baseName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return res.json({ success: true, message: `Plik ${baseName} został usunięty.` });
    } else {
      return res.status(404).json({ success: false, error: 'Plik nie istnieje' });
    }
  } catch (err: any) {
    console.error('Błąd usuwania pliku konfiguracji:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Download saved configuration file directly
app.get('/api/saved-configs/:fileName/download', (req: Request, res: Response) => {
  try {
    const rawName = req.params.fileName;
    const baseName = path.basename(rawName);
    const fullPath = path.join(CONFIGS_DIR, baseName);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Plik nie istnieje' });
    }

    res.download(fullPath, baseName);
  } catch (err: any) {
    console.error('Błąd pobierania pliku konfiguracji:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// API: Generate QR Code vCard as PNG Data URL
app.post('/api/generate-qr', async (req: Request, res: Response) => {
  try {
    const { contactData, options = {} } = req.body;
    const vCard = buildVCard3(contactData || {});
    const dataUrl = await QRCode.toDataURL(vCard, {
      margin: options.margin || 1,
      width: options.width || 600,
      errorCorrectionLevel: options.errorCorrectionLevel || 'H',
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff',
      },
    });
    res.json({ dataUrl, vCardText: vCard });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Global API error handling middleware - ALWAYS return JSON
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Błąd Express API:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Wewnętrzny błąd serwera',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer generatora wizytówek uruchomiony na porcie ${PORT}`);
  });
}

startServer();
