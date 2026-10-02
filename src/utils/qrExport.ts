import QRCode from 'qrcode';
import { PDFDocument, cmyk } from 'pdf-lib';

/**
 * Adds 300 DPI pHYs chunk to PNG binary data so DTP and graphics software recognize 300 DPI
 */
function setPngDpi(blob: Blob, dpi: number = 300): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);

      // 300 DPI = 300 dots per inch = 300 / 0.0254 = 11811 dots per meter
      const dpm = Math.round((dpi / 25.4) * 1000); // 11811

      // Create pHYs chunk
      // Chunk length: 9 bytes
      // Chunk type: "pHYs"
      // Data: 4 bytes X dpm, 4 bytes Y dpm, 1 byte unit (1 = meters)
      // CRC: 4 bytes CRC
      const physChunk = new Uint8Array(12 + 9);
      const view = new DataView(physChunk.buffer);

      // Length = 9
      view.setUint32(0, 9);
      // "pHYs" = 0x70 0x48 0x59 0x73
      physChunk[4] = 0x70;
      physChunk[5] = 0x48;
      physChunk[6] = 0x59;
      physChunk[7] = 0x73;
      // X dpm
      view.setUint32(8, dpm);
      // Y dpm
      view.setUint32(12, dpm);
      // Unit = 1 (meter)
      physChunk[16] = 1;

      // Calculate CRC for pHYs chunk
      let crc = 0xffffffff;
      const crcTable: number[] = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
          if (c & 1) c = 0xedb88320 ^ (c >>> 1);
          else c = c >>> 1;
        }
        crcTable[n] = c;
      }

      for (let i = 4; i < 17; i++) {
        crc = crcTable[(crc ^ physChunk[i]) & 0xff] ^ (crc >>> 8);
      }
      crc = crc ^ 0xffffffff;
      view.setUint32(17, crc);

      // Insert pHYs chunk right after IHDR chunk (starts at byte 8, IHDR is 12 + 13 bytes = 25 bytes => index 33)
      // PNG header (8) + IHDR length (4) + 'IHDR' (4) + IHDR data (13) + CRC (4) = 33 bytes
      const newBytes = new Uint8Array(bytes.length + physChunk.length);
      newBytes.set(bytes.subarray(0, 33), 0);
      newBytes.set(physChunk, 33);
      newBytes.set(bytes.subarray(33), 33 + physChunk.length);

      resolve(new Blob([newBytes], { type: 'image/png' }));
    };
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Downloads a Blob with given filename
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export 1: High-Resolution 1600x1600 px PNG with 300 DPI metadata
 */
export async function downloadQrAsPng(text: string, filenamePrefix: string = 'QR_vCard') {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1600;

  await QRCode.toCanvas(canvas, text, {
    width: 1600,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return new Promise<void>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const dpiBlob = await setPngDpi(blob, 300);
      downloadBlob(dpiBlob, `${filenamePrefix}_1600x1600_300dpi.png`);
      resolve();
    }, 'image/png');
  });
}

/**
 * Export 2: Pure Vector SVG
 */
export async function downloadQrAsSvg(text: string, filenamePrefix: string = 'QR_vCard') {
  const svgString = await QRCode.toString(text, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${filenamePrefix}_vector.svg`);
}

/**
 * Export 3: Pure CMYK (0, 0, 0, 100) Vector PDF
 * Page dimensions: 50x50 mm (141.73 pt x 141.73 pt) at 300 DPI scale
 * Black modules are drawn as pure CMYK 0,0,0,1 rectangles for prepress / DTP
 */
export async function downloadQrAsCmykPdf(text: string, filenamePrefix: string = 'QR_vCard', sizeMm: number = 50) {
  // Generate QR module matrix
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const moduleCount = qr.modules.size;
  const moduleData = qr.modules.data; // Uint8Array of module values

  const pdfDoc = await PDFDocument.create();

  // 1 mm = 72 / 25.4 points = ~2.83465 pt
  const ptPerMm = 72 / 25.4;
  const pageSizePt = sizeMm * ptPerMm;

  const page = pdfDoc.addPage([pageSizePt, pageSizePt]);

  // Set TrimBox, BleedBox, MediaBox
  page.setMediaBox(0, 0, pageSizePt, pageSizePt);
  page.setCropBox(0, 0, pageSizePt, pageSizePt);
  page.setBleedBox(0, 0, pageSizePt, pageSizePt);
  page.setTrimBox(0, 0, pageSizePt, pageSizePt);

  // Background: Pure White CMYK (0, 0, 0, 0)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageSizePt,
    height: pageSizePt,
    color: cmyk(0, 0, 0, 0),
  });

  // Calculate margin and module size
  const marginModules = 2;
  const totalGridSize = moduleCount + marginModules * 2;
  const moduleSizePt = pageSizePt / totalGridSize;
  const offsetPt = marginModules * moduleSizePt;

  // Pure CMYK Black: C=0, M=0, Y=0, K=1 (100% K)
  const cmykBlack = cmyk(0, 0, 0, 1);

  // Draw each dark module
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      const isDark = moduleData[row * moduleCount + col] === 1;
      if (isDark) {
        // In PDF coordinate system, Y=0 is bottom
        const x = offsetPt + col * moduleSizePt;
        const y = pageSizePt - offsetPt - (row + 1) * moduleSizePt;

        page.drawRectangle({
          x,
          y,
          width: moduleSizePt + 0.05, // Slight overlap prevents hairline gaps in renderers
          height: moduleSizePt + 0.05,
          color: cmykBlack,
        });
      }
    }
  }

  // Metadata
  pdfDoc.setTitle(`${filenamePrefix} - CMYK 100% K Vector QR Code`);
  pdfDoc.setAuthor('Generator Wizytówek DTP');
  pdfDoc.setSubject('Vector QR Code vCard 3.0 CMYK 0,0,0,100');
  pdfDoc.setProducer('DTP Engine 300 DPI');
  pdfDoc.setCreationDate(new Date());

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  downloadBlob(blob, `${filenamePrefix}_CMYK_0_0_0_100.pdf`);
}
