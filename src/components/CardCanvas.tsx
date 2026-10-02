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
  AlignLeft
} from 'lucide-react';
import { BusinessCardTemplate, ContactData, CardField, TextFieldConfig, QRCodeFieldConfig, CardSide } from '../types';
import { cmykToRgbString, cmykToHex } from '../utils/cmyk';
import { buildVCard3 } from '../utils/vcard';
import { safeFetchJson } from '../utils/api';
import { calculateFieldBaselinesMm } from '../utils/typography';

interface CardCanvasProps {
  template: BusinessCardTemplate;
  contactData: ContactData;
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
}

export const CardCanvas: React.FC<CardCanvasProps> = ({
  template,
  contactData,
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
}) => {
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [hoveredGuide, setHoveredGuide] = useState<'uv' | 'cut' | 'bleed' | 'safe' | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isRefreshingPreviews, setIsRefreshingPreviews] = useState(false);
  const [previewTimestamp, setPreviewTimestamp] = useState<number>(() => Date.now());
  const cardRef = useRef<HTMLDivElement>(null);

  const { widthNetto, heightNetto, bleedMm, safeZoneMm } = template;

  // Visual scale factor: mm to CSS pixels on standard display (e.g. 6.5 px per mm for a large, clear preview)
  const SCALE = 6.2; // 90mm * 6.2 = 558px, 50mm * 6.2 = 310px

  const widthNettoPx = widthNetto * SCALE;
  const heightNettoPx = heightNetto * SCALE;

  const bleedPx = (useBleed ? bleedMm : 0) * SCALE;
  const safeZonePx = safeZoneMm * SCALE;

  const totalWidthPx = widthNettoPx + bleedPx * 2;
  const totalHeightPx = heightNettoPx + bleedPx * 2;

  // Generate QR codes for all QR fields in this template
  useEffect(() => {
    const qrFields = template.fields.filter((f) => f.type === 'qr') as QRCodeFieldConfig[];
    qrFields.forEach(async (qrField) => {
      try {
        // If custom uploaded QR exists and is active, use it directly
        if ((contactData.useCustomQr || qrField.source === 'custom_image') && (contactData.customQrImage || qrField.customImageUrl)) {
          const customUrl = contactData.customQrImage || qrField.customImageUrl;
          setQrCodeUrls((prev) => ({ ...prev, [qrField.id]: customUrl! }));
          return;
        }

        let content = '';
        if (qrField.source === 'vcard') {
          content = buildVCard3(contactData);
        } else {
          content = qrField.customData || contactData.website || 'https://example.com';
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

  // Background color calculation
  let backgroundStyle: React.CSSProperties = {};
  if (viewMode === 'uv_mask') {
    // In UV Mask page (Page 2 & 4), background is clean white
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

  const handleRefreshPreviews = async () => {
    setIsRefreshingPreviews(true);
    try {
      if (template.masterPdfFileName) {
        const res = await safeFetchJson<{ success: boolean; previewUrls: any; pageCount?: number }>(
          `/api/template-previews/${template.masterPdfFileName}?t=${Date.now()}`
        );
        if (res.success && res.previewUrls && onUpdateTemplate) {
          onUpdateTemplate({
            ...template,
            masterPdfPreviews: res.previewUrls,
            masterPdfPageCount: res.pageCount || template.masterPdfPageCount,
          });
        }
      }
      setPreviewTimestamp(Date.now());
      if (onNotify) {
        onNotify('Podgląd zaktualizowany z najnowszego pliku szablonu.');
      }
    } catch (err: any) {
      console.error('Błąd odświeżania podglądu:', err);
    } finally {
      setIsRefreshingPreviews(false);
    }
  };

  const uploadPdfFile = async (file: File) => {
    setIsUploadingPdf(true);
    const formData = new FormData();
    formData.append('masterPdf', file);
    try {
      const data = await safeFetchJson<{
        success: boolean;
        fileName: string;
        pageCount: number;
        previewUrls: any;
        message?: string;
      }>('/api/upload-template-pdf', {
        method: 'POST',
        body: formData,
      });

      if (onUpdateTemplate) {
        onUpdateTemplate({
          ...template,
          bleedMm: 3,
          masterPdfFileName: data.fileName,
          masterPdfPageCount: data.pageCount,
          masterPdfPreviews: data.previewUrls,
        });
      }
      setPreviewTimestamp(Date.now());
      if (onNotify) {
        onNotify(data.message || 'Szablon wczytany pomyślnie! Podgląd wizytówki został zaktualizowany.');
      }
    } catch (err: any) {
      alert('Błąd wczytywania szablonu PDF: ' + (err.message || 'Brak odpowiedzi serwera'));
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      await uploadPdfFile(file);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Visual Controls Bar */}
      <div className="w-full max-w-2xl flex flex-wrap items-center justify-between gap-2 mb-4 bg-neutral-900/90 border border-neutral-800 p-2 rounded-xl text-xs">
        {/* Side Toggle: Front / Back */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          <button
            onClick={() => setActiveSide('front')}
            className={`px-3 py-1 rounded font-medium transition-all ${
              activeSide === 'front'
                ? 'bg-[#13A3E5] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Awers (Przód)
          </button>
          <button
            onClick={() => setActiveSide('back')}
            className={`px-3 py-1 rounded font-medium transition-all ${
              activeSide === 'back'
                ? 'bg-[#13A3E5] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Rewers (Tył)
          </button>
        </div>

        {/* View Mode Switcher with Left-Aligned "Podgląd Update" Refresh Button */}
        <div className="flex items-center gap-1.5">
          {/* Refresh Preview Icon Button ("Podgląd Update") */}
          <button
            type="button"
            onClick={handleRefreshPreviews}
            disabled={isRefreshingPreviews}
            title="Podgląd Update"
            aria-label="Podgląd Update"
            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
              isRefreshingPreviews
                ? 'bg-neutral-800 text-[#13A3E5] border-neutral-700'
                : 'bg-neutral-950 text-neutral-400 hover:text-[#13A3E5] hover:bg-neutral-800 border-neutral-800'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshingPreviews ? 'animate-spin text-[#13A3E5]' : ''}`} />
          </button>

          {/* View Mode Buttons */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setViewMode('composite')}
              title="Widok CMYK + Połysk lakieru UV"
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
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
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                viewMode === 'uv_mask'
                  ? 'bg-neutral-800 text-magenta-400 border border-neutral-700 text-pink-400'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              <span className="font-semibold">Maska M=100</span>
            </button>

            <button
              onClick={() => setViewMode('dtp_marks')}
              title="Linie cięcia, spady 2mm i strefa bezpieczna 3mm"
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                viewMode === 'dtp_marks'
                  ? 'bg-neutral-800 text-cyan-400 border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Linie DTP</span>
            </button>

            {/* Baseline Guides Toggle Button */}
            <button
              onClick={() => {
                if (onUpdateTemplate) {
                  onUpdateTemplate({
                    ...template,
                    showBaselines: !template.showBaselines,
                  });
                }
              }}
              title="Włącz/wyłącz podgląd linii bazowych dla ramek tekstowych (zielone linie horyzontalne)"
              className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                template.showBaselines
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/60 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Linie bazowe</span>
            </button>
          </div>
        </div>

        {/* Master PDF status indicator */}
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
          /* Card Size Dimensions Badge */
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-950 text-neutral-400 border border-neutral-800 rounded-lg text-[11px] font-mono">
            <span>Netto: {widthNetto}×{heightNetto}mm</span>
            {useBleed && <span className="text-pink-400">| Spady: +{bleedMm}mm</span>}
          </div>
        )}
      </div>

      {/* Main Canvas Workstation Area with Drag and Drop */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex items-center justify-center p-8 bg-neutral-900/40 border transition-all duration-200 rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl min-h-[380px] ${
          isDraggingFile
            ? 'border-[#13A3E5] bg-[#13A3E5]/10 scale-[1.01]'
            : 'border-neutral-800/80'
        }`}
        onClick={() => onSelectField(null)}
      >
        {/* Background Grid Lines Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* Drag & Drop Feedback Overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6 pointer-events-none border-2 border-dashed border-[#13A3E5] rounded-2xl animate-in fade-in">
            <Sparkles className="w-12 h-12 text-[#13A3E5] mb-3 animate-bounce" />
            <p className="text-base font-semibold text-white">Upuść plik PDF szablonu tutaj</p>
            <p className="text-xs text-neutral-400 mt-1">Automatycznie wczyta 4 strony (Awers, Awers UV, Rewers, Rewers UV) i zaktualizuje podgląd</p>
          </div>
        )}

        {/* Uploading Spinner Overlay */}
        {isUploadingPdf && (
          <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6 pointer-events-none rounded-2xl animate-in fade-in">
            <div className="w-10 h-10 border-2 border-[#13A3E5] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-semibold text-white">Wczytywanie szablonu PDF...</p>
            <p className="text-xs text-neutral-400 mt-1">Generowanie podglądów CMYK i maski UV w 300 DPI</p>
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
          className={`relative select-none transition-shadow duration-300 rounded-[2px] overflow-hidden ${
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

          {/* UV Specular Reflection from Master PDF Mask */}
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
          {/* UV Global Hover Highlight Banner */}
          {hoveredGuide === 'uv' && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-fuchsia-950/95 border border-fuchsia-400 text-fuchsia-200 text-[10px] font-mono font-bold px-3 py-1 rounded-full shadow-2xl flex items-center gap-1.5 animate-pulse pointer-events-none">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Warstwa lakieru wybiórczego UV (M:100 Spot)</span>
            </div>
          )}

          {/* Bleed Zone Guide (Shown in dtp_marks mode OR when hovered in legend) */}
          {(hoveredGuide === 'bleed' || (useBleed && viewMode === 'dtp_marks')) && (
            <div 
              style={{
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              }}
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

          {/* Net Cut Line (Obszar Netto) Boundary */}
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

          {/* Safe Zone (Strefa bezpieczna 3mm) Boundary */}
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

          {/* Text Frame Baseline Guides (Horizontal green line across full width of page) */}
          {template.showBaselines && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-35"
              style={{ overflow: 'visible' }}
              viewBox={`0 0 ${totalWidthPx} ${totalHeightPx}`}
            >
              {currentSideFields
                .filter((f): f is TextFieldConfig => f.type === 'text')
                .map((textField) => {
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

                  const lines = text.split('\n');
                  const baselines = calculateFieldBaselinesMm(textField, lines);
                  const isSelected = selectedFieldId === textField.id;

                  return baselines.map((info, lineIdx) => {
                    const baselineYPx = bleedPx + info.baselineFromNettoTopMm * SCALE;
                    return (
                      <g key={`${textField.id}-baseline-${lineIdx}`} className="transition-opacity">
                        {/* Full width horizontal green baseline guide */}
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
                        {/* Subtle baseline badge on left edge */}
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
              const isUv = field.useUV;

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
                    onSelectField(field.id);
                  }}
                  style={{
                    left: `${fieldLeftPx}px`,
                    top: `${fieldTopPx}px`,
                    width: `${fieldWidthPx}px`,
                    height: `${fieldHeightPx}px`,
                  }}
                  className={`absolute cursor-pointer transition-all duration-150 group ${
                    isSelected
                      ? 'ring-2 ring-fuchsia-500 ring-offset-1 ring-offset-black/50 z-30'
                      : hoveredGuide === 'uv' && isUv
                      ? 'ring-2 ring-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.9)] z-30 bg-fuchsia-500/15 animate-pulse'
                      : 'hover:ring-1 hover:ring-neutral-400/60'
                  }`}
                >
                  {/* Field content rendering */}
                  {field.type === 'text' && (
                    <RenderTextField
                      field={field}
                      contactData={contactData}
                      viewMode={viewMode}
                      mousePos={mousePos}
                      isHovered={isHovered}
                      SCALE={SCALE}
                    />
                  )}

                  {field.type === 'qr' && (
                    <RenderQRField
                      field={field}
                      qrCodeUrl={qrCodeUrls[field.id]}
                      viewMode={viewMode}
                      mousePos={mousePos}
                      isHovered={isHovered}
                    />
                  )}

                  {/* UV Badge / Label on hover or selected */}
                  {isUv && viewMode !== 'uv_mask' && (
                    <div className="absolute -top-3 -right-2 bg-fuchsia-600 text-white text-[8px] font-bold px-1 rounded-full shadow-md pointer-events-none flex items-center gap-0.5 opacity-90 group-hover:opacity-100">
                      <Sparkles className="w-2 h-2" />
                      <span>UV</span>
                    </div>
                  )}

                  {/* Field Name on selection */}
                  {isSelected && (
                    <div className="absolute -bottom-4 left-0 bg-neutral-900 text-[#13A3E5] border border-neutral-700 text-[9px] font-mono px-1 rounded whitespace-nowrap pointer-events-none z-40">
                      {field.name} ({field.x.toFixed(1)}, {field.y.toFixed(1)}mm)
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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

// Sub-component to render QR Code field
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
  return (
    <div className="w-full h-full relative flex items-center justify-center">
      {qrCodeUrl ? (
        <img
          src={qrCodeUrl}
          alt="Kod QR vCard 3.0"
          className={`w-full h-full object-contain ${
            field.useUV && viewMode === 'composite'
              ? 'drop-shadow-[0_2px_4px_rgba(255,0,255,0.3)]'
              : ''
          }`}
        />
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
