import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  RotateCw, 
  Sparkles, 
  Eye, 
  Layers, 
  Maximize2, 
  CheckCircle2, 
  Crosshair, 
  ShieldCheck, 
  Zap, 
  Info, 
  AlignLeft, 
  Upload, 
  Download, 
  Sliders, 
  Check, 
  Edit3, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Lock 
} from 'lucide-react';
import { BusinessCardTemplate, ContactData, CardField, TextFieldConfig, QRCodeFieldConfig, CardSide } from '../types';
import { cmykToRgbString, cmykToHex } from '../utils/cmyk';
import { buildVCard3 } from '../utils/vcard';
import { safeFetchJson } from '../utils/api';
import { calculateFieldBaselinesMm } from '../utils/typography';
import { downloadQrAsCmykPdf, downloadQrAsSvg, downloadQrAsPng } from '../utils/qrExport';
import { generateCompanyEmail } from '../utils/csv';

interface CardCanvasProps {
  template: BusinessCardTemplate;
  contactData: ContactData;
  onChangeContactData?: (data: ContactData) => void;
  activeSide: CardSide;
  setActiveSide: (side: CardSide) => void;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  viewMode: 'composite' | 'uv_shine' | 'uv_mask' | 'dtp_marks';
  setViewMode: (mode: 'composite' | 'uv_shine' | 'uv_mask' | 'dtp_marks') => void;
  useBleed: boolean;
  onUpdateFieldPosition?: (id: string, x: number, y: number) => void;
  onUpdateTemplate?: (template: BusinessCardTemplate) => void;
  onNotify?: (message: string) => void;
  isInSettingsTab?: boolean;
}

export const CardCanvas: React.FC<CardCanvasProps> = ({
  template,
  contactData,
  onChangeContactData,
  activeSide,
  setActiveSide,
  selectedFieldId,
  onSelectField,
  viewMode,
  setViewMode,
  useBleed,
  onUpdateFieldPosition,
  onUpdateTemplate,
  onNotify,
  isInSettingsTab = false,
}) => {
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [hoveredGuide, setHoveredGuide] = useState<'uv' | 'cut' | 'bleed' | 'safe' | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [previewTimestamp, setPreviewTimestamp] = useState<number>(() => Date.now());
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isQrDownloadOpen, setIsQrDownloadOpen] = useState(false);
  const [unlockedLockedFieldIds, setUnlockedLockedFieldIds] = useState<string[]>([]);
  const [confirmingField, setConfirmingField] = useState<TextFieldConfig | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const qrFileInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const { widthNetto, heightNetto, bleedMm, safeZoneMm } = template;

  // Visual scale factor: mm to CSS pixels on standard display (6.2 px per mm)
  const SCALE = 6.2; // 90mm * 6.2 = 558px, 50mm * 6.2 = 310px

  const widthNettoPx = widthNetto * SCALE;
  const heightNettoPx = heightNetto * SCALE;

  const bleedPx = (useBleed ? bleedMm : 0) * SCALE;
  const safeZonePx = safeZoneMm * SCALE;

  const totalWidthPx = widthNettoPx + bleedPx * 2;
  const totalHeightPx = heightNettoPx + bleedPx * 2;

  // Company fields that cannot be selected or edited directly on the canvas outside Settings
  const isCompanyLockedField = (field: CardField): boolean => {
    if (field.type !== 'text') return false;
    const textField = field as TextFieldConfig;
    const lockedKeys = ['address', 'nip', 'street', 'office', 'zip', 'city', 'country', 'website', 'company'];
    return Boolean(textField.bindKey && lockedKeys.includes(textField.bindKey));
  };

  // Generate QR codes for all QR fields in this template
  useEffect(() => {
    const qrFields = template.fields.filter((f) => f.type === 'qr') as QRCodeFieldConfig[];
    qrFields.forEach(async (qrField) => {
      try {
        // If this specific contact explicitly has and uses a custom uploaded QR image
        if (contactData.useCustomQr && contactData.customQrImage) {
          setQrCodeUrls((prev) => ({ ...prev, [qrField.id]: contactData.customQrImage! }));
          return;
        }

        // Generate distinct vCard 3.0 QR code for this specific contact record
        let content = '';
        if ((qrField.source === 'custom_url' || qrField.source === 'custom_text') && qrField.customData) {
          content = qrField.customData;
        } else {
          content = buildVCard3(contactData);
        }

        const darkHex = cmykToHex(qrField.darkColorCMYK || [0, 0, 0, 100]);
        const lightHex = qrField.lightColorCMYK ? cmykToHex(qrField.lightColorCMYK) : '#00000000';

        const url = await QRCode.toDataURL(content, {
          margin: 0,
          errorCorrectionLevel: qrField.errorCorrection || 'H',
          color: {
            dark: viewMode === 'uv_mask' && qrField.useUV ? '#ff00ff' : darkHex,
            light: viewMode === 'uv_mask' ? '#ffffff' : lightHex,
          },
          width: Math.round(qrField.w * SCALE * 2), // High-res
        });

        setQrCodeUrls((prev) => ({ ...prev, [qrField.id]: url }));
      } catch (err) {
        console.error('QR generation error:', err);
      }
    });
  }, [template, contactData, viewMode]);

  // Focus inline input when editingFieldId changes
  useEffect(() => {
    if (editingFieldId) {
      const timer = setTimeout(() => {
        if (inlineInputRef.current) {
          inlineInputRef.current.focus();
          if ('select' in inlineInputRef.current) {
            inlineInputRef.current.select();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editingFieldId]);

  // Track mouse coordinates for realistic glossy UV specular reflection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  };

  const activeBg = activeSide === 'front' ? template.frontBg : template.backBg;
  const currentSideFields = template.fields.filter((f) => f.side === activeSide);
  const selectedField = template.fields.find((f) => f.id === selectedFieldId);

  // Helper to get text for a field based on bindings
  const getFieldText = (textField: TextFieldConfig): string => {
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
    return text;
  };

  // Start inline editing of text field (if not locked to Settings)
  const handleStartInlineEdit = (field: TextFieldConfig) => {
    const isLocked = isCompanyLockedField(field) && !unlockedLockedFieldIds.includes(field.id);
    if (isLocked) {
      if (isInSettingsTab) {
        setConfirmingField(field);
      } else if (onNotify) {
        onNotify('Dane stałe firmy (NIP, adres siedziby) konfiguruje się w zakładce Ustawienia.');
      }
      return;
    }
    setEditingFieldId(field.id);
    setEditingText(getFieldText(field));
  };

  // Commit inline text changes to contactData (and template if static)
  const handleCommitInlineText = (field: TextFieldConfig, newText: string) => {
    const isLocked = !isInSettingsTab && isCompanyLockedField(field) && !unlockedLockedFieldIds.includes(field.id);
    if (isLocked) return;

    if (field.bindKey && onChangeContactData) {
      if (field.bindKey === 'fullName') {
        const parts = newText.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        const newEmail = generateCompanyEmail(firstName, lastName);
        onChangeContactData({
          ...contactData,
          firstName,
          lastName,
          email: newEmail || contactData.email,
        });
      } else if (field.bindKey === 'firstName') {
        const newEmail = generateCompanyEmail(newText, contactData.lastName);
        onChangeContactData({
          ...contactData,
          firstName: newText,
          email: newEmail || contactData.email,
        });
      } else if (field.bindKey === 'lastName') {
        const newEmail = generateCompanyEmail(contactData.firstName, newText);
        onChangeContactData({
          ...contactData,
          lastName: newText,
          email: newEmail || contactData.email,
        });
      } else if (field.bindKey === 'jobTitle') {
        onChangeContactData({ ...contactData, jobTitle: newText });
      } else if (field.bindKey === 'phone') {
        onChangeContactData({ ...contactData, phone: newText });
      } else if (field.bindKey === 'phoneMobile') {
        onChangeContactData({ ...contactData, phoneMobile: newText });
      } else if (field.bindKey === 'email') {
        onChangeContactData({ ...contactData, email: newText });
      } else if (field.bindKey === 'address') {
        onChangeContactData({ ...contactData, address: newText });
      } else if (field.bindKey === 'nip') {
        onChangeContactData({ ...contactData, nip: newText });
      } else if (field.bindKey === 'street') {
        onChangeContactData({ ...contactData, street: newText });
      } else if (field.bindKey === 'company') {
        onChangeContactData({ ...contactData, company: newText });
      } else if (field.bindKey === 'office') {
        onChangeContactData({ ...contactData, office: newText });
      } else if (field.bindKey === 'website') {
        onChangeContactData({ ...contactData, website: newText });
      } else {
        onChangeContactData({
          ...contactData,
          [field.bindKey]: newText,
        });
      }
    } else if (onUpdateTemplate) {
      const updatedFields = template.fields.map((f) => (f.id === field.id ? { ...f, defaultValue: newText } : f));
      onUpdateTemplate({ ...template, fields: updatedFields as CardField[] });
    }
  };

  // Handle custom QR upload from canvas with instant high-res visual preview
  const handleCustomQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingQr(true);
    try {
      const formData = new FormData();
      formData.append('qrFile', file);
      
      const response = await fetch('/api/upload-qr', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const previewUrl = result.dataUrl || result.fileUrl;
        
        if (onChangeContactData) {
          onChangeContactData({
            ...contactData,
            useCustomQr: true,
            customQrImage: previewUrl,
            customQrFileName: result.originalName || file.name,
          });
        }

        if (selectedField?.type === 'qr' && onUpdateTemplate) {
          const updatedFields = template.fields.map((f) =>
            f.id === selectedField.id
              ? {
                  ...f,
                  source: 'custom_image',
                  customImageUrl: previewUrl,
                  customFileName: file.name,
                  qrScale: (f as QRCodeFieldConfig).qrScale || 100,
                }
              : f
          );
          onUpdateTemplate({ ...template, fields: updatedFields as CardField[] });
        }

        if (selectedField) {
          setQrCodeUrls((prev) => ({ ...prev, [selectedField.id]: previewUrl }));
        }

        if (onNotify) {
          onNotify(`Wczytano kod QR: ${file.name}. Podgląd jest aktywny na wizytówce.`);
        }
      } else {
        throw new Error(result.error || 'Błąd przetwarzania pliku QR');
      }
    } catch (err: any) {
      // Local fallback for png/jpg/svg
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.pdf') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (dataUrl) {
            if (onChangeContactData) {
              onChangeContactData({
                ...contactData,
                useCustomQr: true,
                customQrImage: dataUrl,
                customQrFileName: file.name,
              });
            }
            if (selectedField?.type === 'qr' && onUpdateTemplate) {
              const updatedFields = template.fields.map((f) =>
                f.id === selectedField.id
                  ? {
                      ...f,
                      source: 'custom_image',
                      customImageUrl: dataUrl,
                      customFileName: file.name,
                      qrScale: (f as QRCodeFieldConfig).qrScale || 100,
                    }
                  : f
              );
              onUpdateTemplate({ ...template, fields: updatedFields as CardField[] });
            }
            if (selectedField) {
              setQrCodeUrls((prev) => ({ ...prev, [selectedField.id]: dataUrl }));
            }
            if (onNotify) {
              onNotify(`Wczytano kod QR (${file.name})`);
            }
          }
        };
        reader.readAsDataURL(file);
      } else {
        alert(`Błąd wczytywania pliku PDF z kodem QR: ${err.message}`);
      }
    } finally {
      setIsUploadingQr(false);
      e.target.value = '';
    }
  };

  // QR Scale change handler
  const handleQrScaleChange = (scale: number) => {
    if (selectedField?.type === 'qr' && onUpdateTemplate) {
      const updatedFields = template.fields.map((f) =>
        f.id === selectedField.id ? { ...f, qrScale: scale } : f
      );
      onUpdateTemplate({ ...template, fields: updatedFields as CardField[] });
    }
  };

  // QR Download handler
  const handleDownloadQrFormat = async (format: 'pdf' | 'svg' | 'png') => {
    const vcardText = buildVCard3(contactData);
    const prefix = `QR_${contactData.lastName || 'vCard'}`;
    if (format === 'pdf') {
      await downloadQrAsCmykPdf(vcardText, prefix, 50);
      if (onNotify) onNotify('Pobrano wektorowy kod QR w formacie PDF (CMYK 0,0,0,100)');
    } else if (format === 'svg') {
      await downloadQrAsSvg(vcardText, prefix);
      if (onNotify) onNotify('Pobrano kod QR w wektorowym formacie SVG');
    } else {
      await downloadQrAsPng(vcardText, prefix);
      if (onNotify) onNotify('Pobrano kod QR w formacie PNG 1600×1600 px (300 DPI)');
    }
    setIsQrDownloadOpen(false);
  };

  // Background color calculation
  let backgroundStyle: React.CSSProperties = {};
  if (viewMode === 'uv_mask') {
    backgroundStyle = { backgroundColor: '#ffffff' };
  } else if (activeBg.colorCMYK) {
    backgroundStyle = { backgroundColor: cmykToRgbString(activeBg.colorCMYK) };
  } else {
    backgroundStyle = { backgroundColor: '#171717' };
  }

  // Resolve Master PDF background preview URL
  let bgImageUrl: string | null = null;
  let uvMaskImageUrl: string | null = null;

  if (template.masterPdfPreviews) {
    if (activeSide === 'front') {
      bgImageUrl = viewMode === 'uv_mask' ? (template.masterPdfPreviews.frontUv || null) : (template.masterPdfPreviews.front || null);
      uvMaskImageUrl = template.masterPdfPreviews.frontUv || null;
    } else {
      bgImageUrl = viewMode === 'uv_mask' ? (template.masterPdfPreviews.backUv || null) : (template.masterPdfPreviews.back || null);
      uvMaskImageUrl = template.masterPdfPreviews.backUv || null;
    }
  } else if (template.masterPdfFileName) {
    const clean = template.masterPdfFileName.replace(/\.pdf$/i, '');
    if (activeSide === 'front') {
      bgImageUrl = viewMode === 'uv_mask' ? `/uploads/previews/${clean}_page_2.png` : `/uploads/previews/${clean}_page_1.png`;
      uvMaskImageUrl = `/uploads/previews/${clean}_page_2.png`;
    } else {
      bgImageUrl = viewMode === 'uv_mask' ? `/uploads/previews/${clean}_page_4.png` : `/uploads/previews/${clean}_page_3.png`;
      uvMaskImageUrl = `/uploads/previews/${clean}_page_4.png`;
    }
  }

  if (bgImageUrl && !bgImageUrl.startsWith('data:')) {
    bgImageUrl = `${bgImageUrl}${bgImageUrl.includes('?') ? '&' : '?'}t=${previewTimestamp}`;
  }
  if (uvMaskImageUrl && !uvMaskImageUrl.startsWith('data:')) {
    uvMaskImageUrl = `${uvMaskImageUrl}${uvMaskImageUrl.includes('?') ? '&' : '?'}t=${previewTimestamp}`;
  }

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };
  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Proszę upuścić plik w formacie PDF (.pdf)');
      return;
    }

    setIsUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('masterPdf', file);
      const res = await fetch('/api/upload-master-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd wgrywania PDF');

      if (onUpdateTemplate) {
        onUpdateTemplate({
          ...template,
          masterPdfFileName: data.fileName,
          masterPdfPreviews: data.previewUrls,
          masterPdfPageCount: data.pageCount || 4,
        });
      }
      setPreviewTimestamp(Date.now());
      if (onNotify) {
        onNotify(`Wgrano szablon PDF: ${file.name}. Podglądy 4 stron zaktualizowane.`);
      }
    } catch (err: any) {
      alert(`Błąd: ${err.message}`);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  return (
    <div className="flex flex-col items-center select-none w-full">
      {/* Top Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between w-full max-w-3xl gap-2 mb-3 px-1">
        {/* Side switcher: Awers / Rewers */}
        <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800 shadow-sm">
          <button
            onClick={() => {
              setActiveSide('front');
              setEditingFieldId(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSide === 'front'
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>Awers (Przód)</span>
          </button>
          <button
            onClick={() => {
              setActiveSide('back');
              setEditingFieldId(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSide === 'back'
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>Rewers (Tył)</span>
          </button>
        </div>

        {/* View Mode controls */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-neutral-900/90 p-1 rounded-xl border border-neutral-800 shadow-sm text-xs">
            <button
              onClick={() => setViewMode('composite')}
              title="Realistyczny podgląd z połyskiem lakieru UV"
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'composite'
                  ? 'bg-neutral-800 text-[#13A3E5] border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Podgląd z UV</span>
            </button>

            <button
              onClick={() => setViewMode('uv_mask')}
              title="Dedykowana maska lakieru UV (Magenta 100% / M=100)"
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'uv_mask'
                  ? 'bg-neutral-800 text-pink-400 border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              <span className="font-semibold">Maska M=100</span>
            </button>

            <button
              onClick={() => setViewMode('dtp_marks')}
              title="Linie cięcia, spady 2mm i strefa bezpieczna"
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'dtp_marks'
                  ? 'bg-neutral-800 text-cyan-400 border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Linie DTP</span>
            </button>

            {/* Baseline toggle */}
            <button
              onClick={() => {
                if (onUpdateTemplate) {
                  onUpdateTemplate({
                    ...template,
                    showBaselines: !template.showBaselines,
                  });
                }
              }}
              title="Podgląd linii bazowych dla ramek tekstowych"
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                template.showBaselines
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/60'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Linie bazowe</span>
            </button>
          </div>
        </div>

        {/* Master PDF status badge */}
        {template.masterPdfFileName ? (
          <div 
            title={`Plik szablonu: ${template.masterPdfFileName}`}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-mono"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {activeSide === 'front' 
                ? (viewMode === 'uv_mask' ? 'Awers UV (Str. 2/4)' : 'Awers CMYK (Str. 1/4)')
                : (viewMode === 'uv_mask' ? 'Rewers UV (Str. 4/4)' : 'Rewers CMYK (Str. 3/4)')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-950 text-neutral-400 border border-neutral-800 rounded-lg text-[11px] font-mono">
            <span>Netto: {widthNetto}×{heightNetto}mm</span>
            {useBleed && <span className="text-pink-400">| Spady: +{bleedMm}mm</span>}
          </div>
        )}
      </div>

      {/* Main Canvas Workstation Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex items-center justify-center p-8 bg-neutral-900/40 border transition-all duration-200 rounded-2xl shadow-2xl overflow-visible w-full max-w-3xl min-h-[380px] ${
          isDraggingFile
            ? 'border-[#13A3E5] bg-[#13A3E5]/10 scale-[1.01]'
            : 'border-neutral-800/80'
        }`}
        onClick={() => {
          if (editingFieldId) {
            setEditingFieldId(null);
          }
          onSelectField(null);
          setIsQrDownloadOpen(false);
        }}
      >
        {/* Background Grid Lines Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none rounded-2xl" />

        {/* Drag & Drop Feedback Overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6 pointer-events-none border-2 border-dashed border-[#13A3E5] rounded-2xl">
            <Sparkles className="w-12 h-12 text-[#13A3E5] mb-3 animate-bounce" />
            <p className="text-base font-semibold text-white">Upuść plik PDF szablonu tutaj</p>
            <p className="text-xs text-neutral-400 mt-1">Automatycznie wczyta 4 strony i wygeneruje podglądy CMYK + UV</p>
          </div>
        )}

        {/* Uploading Spinner Overlay */}
        {(isUploadingPdf || isUploadingQr) && (
          <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6 pointer-events-none rounded-2xl">
            <div className="w-10 h-10 border-2 border-[#13A3E5] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-semibold text-white">
              {isUploadingPdf ? 'Wczytywanie szablonu PDF...' : 'Generowanie podglądu kodu QR...'}
            </p>
            <p className="text-xs text-neutral-400 mt-1">Przetwarzanie grafiki w wysokiej rozdzielczości 300 DPI</p>
          </div>
        )}

        {/* Interactive Business Card Box */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            width: `${totalWidthPx}px`,
            height: `${totalHeightPx}px`,
            ...backgroundStyle,
          }}
          className={`relative select-none transition-shadow duration-300 rounded-[2px] overflow-visible ${
            viewMode === 'uv_mask'
              ? 'border border-neutral-300 shadow-xl'
              : 'shadow-2xl shadow-black/80 ring-1 ring-neutral-700/50'
          }`}
        >
          {/* Master PDF Background Graphic */}
          {bgImageUrl && (
            <img
              src={bgImageUrl}
              alt="Master PDF Graphic"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
              style={{
                position: 'absolute',
                left: useBleed ? 0 : `-${bleedPx}px`,
                top: useBleed ? 0 : `-${bleedPx}px`,
                width: `${widthNettoPx + bleedPx * 2}px`,
                height: `${heightNettoPx + bleedPx * 2}px`,
                objectFit: 'fill',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 1,
              }}
            />
          )}

          {/* UV Specular Sheen Reflection from Master PDF Mask */}
          {uvMaskImageUrl && viewMode !== 'uv_mask' && (
            <div
              style={{
                position: 'absolute',
                left: useBleed ? 0 : `-${bleedPx}px`,
                top: useBleed ? 0 : `-${bleedPx}px`,
                width: `${widthNettoPx + bleedPx * 2}px`,
                height: `${heightNettoPx + bleedPx * 2}px`,
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 15,
                opacity: isHovered || viewMode === 'uv_shine' ? 0.75 : 0.25,
                mixBlendMode: 'screen',
                maskImage: `url(${uvMaskImageUrl})`,
                WebkitMaskImage: `url(${uvMaskImageUrl})`,
                maskSize: '100% 100%',
                WebkitMaskSize: '100% 100%',
                background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.3) 30%, transparent 60%)`,
                transition: 'opacity 0.2s ease',
              }}
            />
          )}

          {/* Bleed Zone Guide */}
          {(hoveredGuide === 'bleed' || (useBleed && viewMode === 'dtp_marks')) && (
            <div 
              style={{ left: 0, top: 0, right: 0, bottom: 0 }}
              className={`absolute pointer-events-none z-30 transition-all ${
                hoveredGuide === 'bleed'
                  ? 'border-2 border-red-500 shadow-[0_0_22px_rgba(239,68,68,0.85)] bg-red-500/10 ring-2 ring-red-500/50'
                  : 'border border-red-500/70'
              }`}
            >
              <span className={`absolute top-1 left-1.5 text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shadow ${
                hoveredGuide === 'bleed' ? 'bg-red-950 border border-red-500 text-red-200' : 'text-red-400 bg-black/70'
              }`}>
                Spad {bleedMm}mm (Brutto: {widthNetto + bleedMm * 2}×{heightNetto + bleedMm * 2}mm)
              </span>
            </div>
          )}

          {/* Net Cut Line Boundary */}
          {(hoveredGuide === 'cut' || viewMode === 'dtp_marks') && (
            <div
              style={{
                left: `${bleedPx}px`,
                top: `${bleedPx}px`,
                width: `${widthNettoPx}px`,
                height: `${heightNettoPx}px`,
              }}
              className={`absolute pointer-events-none z-30 transition-all ${
                hoveredGuide === 'cut'
                  ? 'border-2 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.9)] bg-amber-400/10 ring-2 ring-amber-400/50'
                  : 'border border-dashed border-amber-400/90'
              }`}
            >
              <span className={`absolute bottom-1 left-1.5 text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shadow ${
                hoveredGuide === 'cut' ? 'bg-amber-950 border border-amber-400 text-amber-200' : 'text-amber-400 bg-black/70'
              }`}>
                Linia cięcia ({widthNetto}×{heightNetto}mm)
              </span>
            </div>
          )}

          {/* Safe Zone Boundary */}
          {(hoveredGuide === 'safe' || viewMode === 'dtp_marks') && (
            <div
              style={{
                left: `${bleedPx + safeZonePx}px`,
                top: `${bleedPx + safeZonePx}px`,
                width: `${widthNettoPx - safeZonePx * 2}px`,
                height: `${heightNettoPx - safeZonePx * 2}px`,
              }}
              className={`absolute pointer-events-none z-30 transition-all ${
                hoveredGuide === 'safe'
                  ? 'border-2 border-dashed border-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.85)] bg-emerald-400/10 ring-2 ring-emerald-400/50'
                  : 'border border-dotted border-emerald-500/70'
              }`}
            >
              <span className={`absolute top-1 right-1.5 text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shadow ${
                hoveredGuide === 'safe' ? 'bg-emerald-950 border border-emerald-400 text-emerald-200' : 'text-emerald-400 bg-black/70'
              }`}>
                Strefa bezpieczna ({safeZoneMm}mm)
              </span>
            </div>
          )}

          {/* Text Frame Baseline Guides */}
          {template.showBaselines && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-35"
              style={{ overflow: 'visible' }}
              viewBox={`0 0 ${totalWidthPx} ${totalHeightPx}`}
            >
              {currentSideFields
                .filter((f): f is TextFieldConfig => f.type === 'text')
                .map((textField) => {
                  const text = getFieldText(textField);
                  const lines = text.split('\n');
                  const baselines = calculateFieldBaselinesMm(textField, lines);
                  const isSelected = selectedFieldId === textField.id;

                  return baselines.map((info, lineIdx) => {
                    const baselineYPx = bleedPx + info.baselineFromNettoTopMm * SCALE;
                    return (
                      <g key={`${textField.id}-baseline-${lineIdx}`}>
                        <line
                          x1={0}
                          y1={baselineYPx}
                          x2={totalWidthPx}
                          y2={baselineYPx}
                          stroke="#22c55e"
                          strokeWidth={isSelected ? 1.5 : 1}
                          strokeDasharray={isSelected ? 'none' : '4 2'}
                          opacity={isSelected ? 1 : 0.85}
                        />
                        <rect
                          x={2}
                          y={baselineYPx - 7}
                          width={44}
                          height={14}
                          rx={2}
                          fill={isSelected ? '#15803d' : '#052e16'}
                          stroke="#22c55e"
                          strokeWidth={0.8}
                          opacity={0.9}
                        />
                        <text
                          x={4}
                          y={baselineYPx + 3.5}
                          fill="#86efac"
                          fontSize="8.5"
                          fontFamily="monospace"
                          fontWeight="700"
                        >
                          {info.baselineFromNettoTopMm.toFixed(1)}mm
                        </text>
                      </g>
                    );
                  });
                })}
            </svg>
          )}

          {/* Dynamic Rendered Fields Container */}
          <div
            style={{
              left: `${bleedPx}px`,
              top: `${bleedPx}px`,
              width: `${widthNettoPx}px`,
              height: `${heightNettoPx}px`,
            }}
            className="absolute z-20"
          >
            {currentSideFields.map((field) => {
              const isSelected = selectedFieldId === field.id;
              const isEditing = editingFieldId === field.id;
              const isUv = field.useUV;
              const isCompanyLocked = field.type === 'text' && isCompanyLockedField(field as TextFieldConfig) && !unlockedLockedFieldIds.includes(field.id);

              // Hide non-UV fields when viewing pure UV mask mode!
              if (viewMode === 'uv_mask' && !isUv) {
                return null;
              }

              const fieldLeftPx = field.x * SCALE;
              const fieldTopPx = field.y * SCALE;
              const fieldWidthPx = field.w * SCALE;
              const fieldHeightPx = field.h * SCALE;

              return (
                <div
                  key={field.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCompanyLocked) {
                      if (isInSettingsTab) {
                        setConfirmingField(field as TextFieldConfig);
                      }
                      return;
                    }
                    if (selectedFieldId !== field.id) {
                      onSelectField(field.id);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (isCompanyLocked) {
                      if (isInSettingsTab) {
                        setConfirmingField(field as TextFieldConfig);
                      }
                      return;
                    }
                    onSelectField(field.id);
                    if (field.type === 'text') {
                      handleStartInlineEdit(field as TextFieldConfig);
                    }
                  }}
                  style={{
                    left: `${fieldLeftPx}px`,
                    top: `${fieldTopPx}px`,
                    width: `${fieldWidthPx}px`,
                    height: `${fieldHeightPx}px`,
                  }}
                  className={`absolute transition-all duration-150 group ${
                    isCompanyLocked
                      ? (isInSettingsTab ? 'cursor-pointer' : 'cursor-default select-none')
                      : 'cursor-pointer'
                  } ${
                    !isCompanyLocked && isEditing
                      ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] z-40 bg-black/40 rounded'
                      : !isCompanyLocked && isSelected
                      ? 'ring-2 ring-fuchsia-500 ring-offset-1 ring-offset-black/50 z-30'
                      : hoveredGuide === 'uv' && isUv
                      ? 'ring-2 ring-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.9)] z-30 bg-fuchsia-500/15 animate-pulse'
                      : isCompanyLocked && isInSettingsTab
                      ? 'hover:ring-1 hover:ring-amber-400/60'
                      : !isCompanyLocked
                      ? 'hover:ring-1 hover:ring-neutral-400/60'
                      : ''
                  }`}
                >
                  {/* Subtle Lock Icon for Locked Company Fields - Centered on right edge */}
                  {isCompanyLocked && (
                    <div 
                      title={isInSettingsTab ? "Pole stałe firmy - kliknij, aby edytować po potwierdzeniu" : "Pole stałe firmy - konfiguracja w Ustawieniach"}
                      className="absolute top-1/2 -translate-y-1/2 -right-3.5 text-neutral-500 hover:text-neutral-400 p-0.5 rounded pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center"
                    >
                      <Lock className="w-2.5 h-2.5" />
                    </div>
                  )}
                  {/* Text Field with Inline Direct Typing Capability */}
                  {field.type === 'text' && (
                    <>
                      {!isCompanyLocked && isEditing ? (
                        <textarea
                          ref={inlineInputRef as any}
                          value={editingText}
                          onChange={(e) => {
                            setEditingText(e.target.value);
                            handleCommitInlineText(field as TextFieldConfig, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              setEditingFieldId(null);
                            } else if (e.key === 'Escape') {
                              setEditingFieldId(null);
                            }
                          }}
                          onBlur={() => {
                            setEditingFieldId(null);
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            fontFamily: field.fontFamily === 'Rajdhani' ? "'Rajdhani', sans-serif" : field.fontFamily === 'Montserrat' ? "'Montserrat', sans-serif" : "'Space Grotesk', sans-serif",
                            fontSize: `${(field.fontSize || 10) * (SCALE / (72 / 25.4))}px`,
                            fontWeight: field.fontWeight === 'extrabold' ? 800 : field.fontWeight === 'bold' ? 700 : field.fontWeight === 'semibold' ? 600 : field.fontWeight === 'medium' ? 500 : 400,
                            textAlign: field.align || 'left',
                            color: cmykToRgbString(field.colorCMYK),
                            lineHeight: field.lineHeight || 1.2,
                          }}
                          className="bg-transparent border-0 p-0 m-0 resize-none outline-none leading-tight selection:bg-pink-500 selection:text-white"
                        />
                      ) : (
                        <RenderTextField
                          field={field}
                          contactData={contactData}
                          viewMode={viewMode}
                          mousePos={mousePos}
                          isHovered={isHovered}
                          SCALE={SCALE}
                        />
                      )}
                    </>
                  )}

                  {/* QR Field with Scaling & Full Frame Fit */}
                  {field.type === 'qr' && (
                    <RenderQRField
                      field={field as QRCodeFieldConfig}
                      qrCodeUrl={qrCodeUrls[field.id]}
                      viewMode={viewMode}
                      mousePos={mousePos}
                      isHovered={isHovered}
                    />
                  )}

                  {/* UV Badge */}
                  {isUv && viewMode !== 'uv_mask' && (
                    <div className="absolute -top-3 -right-2 bg-fuchsia-600 text-white text-[8px] font-bold px-1 rounded-full shadow-md pointer-events-none flex items-center gap-0.5 opacity-90 group-hover:opacity-100 z-30">
                      <Sparkles className="w-2 h-2" />
                      <span>UV</span>
                    </div>
                  )}

                  {/* Text field Quick Direct Edit Pencil (Only for user editable fields) */}
                  {!isCompanyLocked && isSelected && field.type === 'text' && !isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartInlineEdit(field as TextFieldConfig);
                      }}
                      title="Kliknij, aby edytować tekst bezpośrednio na wizytówce"
                      className="absolute -top-3 -left-2 bg-[#13A3E5] hover:bg-[#0e8ec9] text-white p-1 rounded-full shadow-lg z-40 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* QR Code Action Overlay on Canvas (Upload & Download & Scale Toolbar) */}
                  {isSelected && field.type === 'qr' && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-neutral-950/95 border border-neutral-700 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-top-2"
                    >
                      {/* Hidden File Input for QR Upload */}
                      <input
                        ref={qrFileInputRef}
                        type="file"
                        accept=".pdf,.svg,.png,.jpg,.jpeg"
                        onChange={handleCustomQrFileChange}
                        className="hidden"
                      />

                      {/* Upload QR Button */}
                      <button
                        type="button"
                        onClick={() => qrFileInputRef.current?.click()}
                        title="Wczytaj własny plik graficzny lub PDF z kodem QR (automatyczny podgląd)"
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#13A3E5]" />
                        <span>Wczytaj</span>
                      </button>

                      {/* Download QR Dropdown / Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsQrDownloadOpen(!isQrDownloadOpen)}
                          title="Pobierz sam kod QR (PDF CMYK 0,0,0,100, SVG, PNG)"
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Pobierz QR</span>
                        </button>

                        {isQrDownloadOpen && (
                          <div className="absolute top-full mt-1.5 left-0 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1.5 w-56 z-50 text-xs">
                            <button
                              type="button"
                              onClick={() => handleDownloadQrFormat('pdf')}
                              className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-white flex items-center justify-between cursor-pointer"
                            >
                              <span className="font-semibold">PDF (CMYK 0,0,0,100)</span>
                              <span className="text-[10px] text-pink-400 font-mono">DTP</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadQrFormat('svg')}
                              className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>SVG (Wektor)</span>
                              <span className="text-[10px] text-emerald-400 font-mono">SVG</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadQrFormat('png')}
                              className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>PNG (1600×1600 300DPI)</span>
                              <span className="text-[10px] text-cyan-400 font-mono">PNG</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* QR Scale Controls */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-800">
                        <Sliders className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="text-[11px] text-neutral-400">Skala:</span>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          step="5"
                          value={(field as QRCodeFieldConfig).qrScale ?? 100}
                          onChange={(e) => handleQrScaleChange(parseInt(e.target.value) || 100)}
                          className="w-16 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#13A3E5]"
                          title="Przesuń, aby przeskalować kod QR wewnątrz ramki"
                        />
                        <span className="text-[10px] font-mono text-[#13A3E5] font-bold w-8 text-right">
                          {(field as QRCodeFieldConfig).qrScale ?? 100}%
                        </span>

                        <button
                          type="button"
                          onClick={() => handleQrScaleChange(100)}
                          title="Wypełnij ramkę w 100% (Domyślnie)"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            ((field as QRCodeFieldConfig).qrScale ?? 100) === 100
                              ? 'bg-[#13A3E5] text-white'
                              : 'bg-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          Wypełnij
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Field Name & Dimension on selection */}
                  {!isCompanyLocked && isSelected && (
                    <div className="absolute -bottom-4 left-0 bg-neutral-900 text-[#13A3E5] border border-neutral-700 text-[9px] font-mono px-1 rounded whitespace-nowrap pointer-events-none z-30 flex items-center gap-1">
                      <span>{field.name} ({field.x.toFixed(1)}, {field.y.toFixed(1)}mm)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Confirmation Dialog Overlay when attempting to edit company locked fields */}
          {confirmingField && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center rounded-xl animate-in fade-in zoom-in-95 border border-amber-500/40 shadow-2xl"
            >
              <div className="p-3 bg-amber-950/70 border border-amber-600/50 text-amber-400 rounded-full mb-3 shadow-lg shadow-amber-950/50 animate-bounce">
                <Lock className="w-6 h-6" />
              </div>
              
              <h4 className="text-sm font-bold text-white mb-1">
                Zmieniasz dane: {confirmingField.name}
              </h4>
              <p className="text-xs text-neutral-300 mb-5 max-w-xs leading-relaxed">
                Czy na pewno chcesz edytować dane stałe firmy bezpośrednio na wizytówce?
              </p>

              <div className="flex items-center gap-3">
                {/* Przycisk Tak */}
                <button
                  type="button"
                  onClick={() => {
                    const target = confirmingField;
                    setUnlockedLockedFieldIds((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]));
                    setConfirmingField(null);
                    onSelectField(target.id);
                    setEditingFieldId(target.id);
                    setEditingText(getFieldText(target));
                  }}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
                >
                  Tak
                </button>

                {/* Przycisk Nie - Domyślnie podświetlony */}
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setConfirmingField(null);
                  }}
                  className="px-6 py-2 rounded-lg bg-[#13A3E5] hover:bg-[#0e8ec9] text-white text-xs font-bold shadow-lg shadow-[#13A3E5]/30 ring-2 ring-[#13A3E5]/60 ring-offset-2 ring-offset-neutral-950 transition-all transform hover:scale-105 cursor-pointer"
                >
                  Nie
                </button>
              </div>
            </div>
          )}

          {/* Interactive UV Gloss Light Beam Effect across the whole card */}
          {viewMode === 'composite' && isHovered && (
            <div
              style={{
                background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 30%, transparent 60%)`,
              }}
              className="absolute inset-0 pointer-events-none z-25 transition-opacity duration-150"
            />
          )}
        </div>
      </div>

      {/* Interactive Guides Legend with Hover Highlight */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-3 text-xs">
        <button
          type="button"
          onMouseEnter={() => setHoveredGuide('uv')}
          onMouseLeave={() => setHoveredGuide(null)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            hoveredGuide === 'uv'
              ? 'bg-fuchsia-950/90 border-fuchsia-400 text-fuchsia-200 shadow-md shadow-fuchsia-900/50 scale-105'
              : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
          title="Najedź myszką, aby podświetlić elementy z lakierem UV na podglądzie"
        >
          <span className={`w-2.5 h-2.5 rounded-full bg-fuchsia-500 inline-block transition-transform ${hoveredGuide === 'uv' ? 'scale-125 shadow-sm shadow-fuchsia-400 ring-2 ring-fuchsia-400/60' : ''}`} />
          <span>Lakier UV (M:100 Spot)</span>
        </button>

        <button
          type="button"
          onMouseEnter={() => setHoveredGuide('cut')}
          onMouseLeave={() => setHoveredGuide(null)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            hoveredGuide === 'cut'
              ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-md shadow-amber-900/50 scale-105'
              : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
          title="Najedź myszką, aby podświetlić linię cięcia na podglądzie"
        >
          <span className={`w-2.5 h-2.5 rounded-full bg-amber-400 inline-block transition-transform ${hoveredGuide === 'cut' ? 'scale-125 shadow-sm shadow-amber-400 ring-2 ring-amber-400/60' : ''}`} />
          <span>Linia cięcia ({widthNetto}×{heightNetto}mm)</span>
        </button>

        <button
          type="button"
          onMouseEnter={() => setHoveredGuide('bleed')}
          onMouseLeave={() => setHoveredGuide(null)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            hoveredGuide === 'bleed'
              ? 'bg-red-950/90 border-red-400 text-red-200 shadow-md shadow-red-900/50 scale-105'
              : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
          title="Najedź myszką, aby podświetlić spad drukarski na podglądzie"
        >
          <span className={`w-2.5 h-2.5 rounded-full bg-red-400 inline-block transition-transform ${hoveredGuide === 'bleed' ? 'scale-125 shadow-sm shadow-red-400 ring-2 ring-red-400/60' : ''}`} />
          <span>Spad zewnętrzny ({bleedMm}mm)</span>
        </button>

        <button
          type="button"
          onMouseEnter={() => setHoveredGuide('safe')}
          onMouseLeave={() => setHoveredGuide(null)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            hoveredGuide === 'safe'
              ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-900/50 scale-105'
              : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
          title="Najedź myszką, aby podświetlić margines bezpieczeństwa na podglądzie"
        >
          <span className={`w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block transition-transform ${hoveredGuide === 'safe' ? 'scale-125 shadow-sm shadow-emerald-400 ring-2 ring-emerald-400/60' : ''}`} />
          <span>Margines bezpieczeństwa ({safeZoneMm}mm)</span>
        </button>
      </div>
    </div>
  );
};

// Sub-component to render Text Field with exact styling & UV reflection
interface RenderTextFieldProps {
  field: TextFieldConfig;
  contactData: ContactData;
  viewMode: 'composite' | 'uv_shine' | 'uv_mask' | 'dtp_marks';
  mousePos: { x: number; y: number };
  isHovered: boolean;
  SCALE: number;
}

const RenderTextField: React.FC<RenderTextFieldProps> = ({
  field,
  contactData,
  viewMode,
  mousePos,
  isHovered,
  SCALE,
}) => {
  let text = field.defaultValue || '';
  if (field.bindKey && contactData) {
    if (field.bindKey === 'fullName') {
      text = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || field.defaultValue;
    } else if (field.bindKey === 'address') {
      if (contactData.address) {
        text = contactData.address;
      } else {
        const officePart = contactData.office ? `${contactData.office}\n` : '';
        const streetPart = contactData.street || '';
        const cityPart = `${contactData.zip || ''} ${contactData.city || ''}`.trim();
        const countryPart = contactData.country || '';
        text = `${officePart}${streetPart}, ${cityPart}, ${countryPart}`.trim() || field.defaultValue;
      }
    } else if (field.bindKey === 'nip') {
      text = contactData.nip ? (contactData.nip.startsWith('NIP') ? contactData.nip : `NIP: ${contactData.nip}`) : field.defaultValue;
    } else if (contactData[field.bindKey as keyof ContactData]) {
      text = String(contactData[field.bindKey as keyof ContactData]);
    }
  }

  // Text Transform
  let formattedText = text;
  if (field.textTransform === 'uppercase') formattedText = text.toUpperCase();
  if (field.textTransform === 'lowercase') formattedText = text.toLowerCase();
  if (field.textTransform === 'capitalize') {
    formattedText = text.replace(/\b\w/g, (l) => l.toUpperCase());
  }

  const isUv = field.useUV;
  const lines = formattedText.split('\n');
  const baselineInfos = calculateFieldBaselinesMm(field, lines);

  // Font Size: 1 pt = (SCALE / (72 / 25.4)) px in preview canvas
  const MM_TO_PT = 72 / 25.4;
  const fontSizePx = (field.fontSize || 10) * (SCALE / MM_TO_PT);

  // Text Color
  let textColor = cmykToRgbString(field.colorCMYK);
  if (viewMode === 'uv_mask') {
    textColor = '#ff00ff'; // Pure Spot Magenta 100%
  }

  // Align
  const textAlign = field.align || 'left';

  // Font family helper
  const fontFamilyStyle =
    field.fontFamily === 'Rajdhani'
      ? "'Rajdhani', sans-serif"
      : field.fontFamily === 'Montserrat'
      ? "'Montserrat', sans-serif"
      : "'Space Grotesk', sans-serif";

  // Font weight
  const fontWeightValue =
    field.fontWeight === 'extrabold'
      ? 800
      : field.fontWeight === 'bold'
      ? 700
      : field.fontWeight === 'semibold'
      ? 600
      : field.fontWeight === 'medium'
      ? 500
      : 400;

  const fieldWidthPx = field.w * SCALE;
  const fieldHeightPx = field.h * SCALE;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'visible',
      }}
      className={`relative ${
        isUv && viewMode === 'composite'
          ? 'drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]'
          : ''
      }`}
    >
      <svg
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
        viewBox={`0 0 ${fieldWidthPx} ${fieldHeightPx}`}
      >
        {baselineInfos.map((info) => {
          let x = 0;
          let anchor: 'start' | 'middle' | 'end' = 'start';
          if (textAlign === 'center') {
            x = fieldWidthPx / 2;
            anchor = 'middle';
          } else if (textAlign === 'right') {
            x = fieldWidthPx;
            anchor = 'end';
          }
          const y = info.baselineFromBoxTopMm * SCALE;

          return (
            <text
              key={info.lineIndex}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="alphabetic"
              fill={textColor}
              fontFamily={fontFamilyStyle}
              fontSize={`${fontSizePx}px`}
              fontWeight={fontWeightValue}
              letterSpacing={field.letterSpacing ? `${field.letterSpacing * (SCALE / MM_TO_PT)}px` : undefined}
            >
              {info.text}
            </text>
          );
        })}
      </svg>

      {/* UV Specular Sheen Effect over text */}
      {isUv && viewMode === 'composite' && isHovered && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%)',
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </div>
  );
};

// Sub-component to render QR Code field with frame filling and scale
interface RenderQRFieldProps {
  field: QRCodeFieldConfig;
  qrCodeUrl?: string;
  viewMode: 'composite' | 'uv_shine' | 'uv_mask' | 'dtp_marks';
  mousePos: { x: number; y: number };
  isHovered: boolean;
}

const RenderQRField: React.FC<RenderQRFieldProps> = ({
  field,
  qrCodeUrl,
  viewMode,
  mousePos,
  isHovered,
}) => {
  const scaleMultiplier = ((field.qrScale ?? 100) / 100);

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
      {qrCodeUrl ? (
        <div 
          style={{
            transform: `scale(${scaleMultiplier})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={qrCodeUrl}
            alt="Kod QR vCard"
            className={`w-full h-full object-contain ${
              field.useUV && viewMode === 'composite'
                ? 'drop-shadow-[0_2px_4px_rgba(255,0,255,0.3)]'
                : ''
            }`}
          />
        </div>
      ) : (
        <div className="w-full h-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[8px] text-neutral-400">
          QR
        </div>
      )}

      {/* UV Lacquer Glossy Film Overlay on QR */}
      {field.useUV && viewMode === 'composite' && isHovered && (
        <div
          style={{
            background: `linear-gradient(${135 + mousePos.x * 45}deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)`,
          }}
          className="absolute inset-0 pointer-events-none rounded"
        />
      )}
    </div>
  );
};
