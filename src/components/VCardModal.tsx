import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Download, 
  ShieldCheck,
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileDown,
  Image as ImageIcon
} from 'lucide-react';
import { ContactData } from '../types';
import { buildVCard3 } from '../utils/vcard';
import { downloadQrAsCmykPdf, downloadQrAsSvg, downloadQrAsPng } from '../utils/qrExport';

interface VCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactData: ContactData;
  onChangeContactData?: (data: ContactData) => void;
  onNotify?: (message: string) => void;
}

export const VCardModal: React.FC<VCardModalProps> = ({
  isOpen,
  onClose,
  contactData,
  onChangeContactData,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'vcard' | 'custom'>('vcard');
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vCardText = buildVCard3(contactData);

  // If user already has custom QR active, default to custom tab on open
  useEffect(() => {
    if (isOpen) {
      if (contactData.useCustomQr && contactData.customQrImage) {
        setActiveTab('custom');
      }
    }
  }, [isOpen, contactData.useCustomQr, contactData.customQrImage]);

  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(vCardText, {
      margin: 1,
      width: 400,
      errorCorrectionLevel: 'H',
    }).then(setQrUrl).catch(console.error);
  }, [vCardText, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(vCardText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadVcf = () => {
    const blob = new Blob([vCardText], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contactData.firstName || 'Kontakt'}_${contactData.lastName || 'Wizytowka'}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processFile = async (file: File) => {
    setUploadError(null);
    const validExtensions = ['.pdf', '.svg', '.jpg', '.jpeg', '.png'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      setUploadError(`Niedozwolony format (${ext}). Dozwolone są pliki: PDF, SVG, JPG, PNG.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('Rozmiar pliku nie może przekraczać 25 MB.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('qrFile', file);

      const response = await fetch('/api/upload-qr', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Wystąpił błąd podczas przetwarzania pliku');
      }

      if (onChangeContactData) {
        onChangeContactData({
          ...contactData,
          customQrImage: result.dataUrl || result.fileUrl,
          customQrFileName: result.originalName || file.name,
          useCustomQr: true,
        });
      }

      if (onNotify) {
        onNotify(`Własny kod QR (${file.name}) został pomyślnie załadowany i włączony na wizytówce!`);
      }
    } catch (err: any) {
      console.error('Upload QR error:', err);
      // Fallback: If network upload fails, read locally with FileReader for JPG/PNG/SVG
      if (ext !== '.pdf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (onChangeContactData && dataUrl) {
            onChangeContactData({
              ...contactData,
              customQrImage: dataUrl,
              customQrFileName: file.name,
              useCustomQr: true,
            });
            if (onNotify) {
              onNotify(`Wczytano lokalnie kod QR (${file.name})`);
            }
          }
        };
        reader.readAsDataURL(file);
      } else {
        setUploadError(err.message || 'Nie udało się przetworzyć pliku PDF z kodem QR.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveCustomQr = () => {
    if (onChangeContactData) {
      onChangeContactData({
        ...contactData,
        customQrImage: undefined,
        customQrFileName: undefined,
        useCustomQr: false,
      });
    }
    if (onNotify) {
      onNotify('Usunięto własny plik QR. Przywrócono automatyczny generator vCard 3.0.');
    }
  };

  const handleToggleUseCustom = (useCustom: boolean) => {
    if (onChangeContactData) {
      onChangeContactData({
        ...contactData,
        useCustomQr: useCustom,
      });
    }
  };

  const hasCustomQr = Boolean(contactData.customQrImage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <span>Kod QR Wizytówki: vCard 3.0 & Własny Plik</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Wybierz czy chcesz używać automatycznie generowanego kodu vCard 3.0 ze standardem RFC 2426, czy wgrać własny przygotowany kod QR jako plik wektorowy lub rastrowy.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 p-1 bg-neutral-950 border border-neutral-800 rounded-xl mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('vcard')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'vcard'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>Generator vCard 3.0</span>
            {!contactData.useCustomQr && (
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800">
                Aktywny
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'custom'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Upload className="w-4 h-4 text-[#13A3E5]" />
            <span>Wgraj Własny QR (PDF, SVG, JPG, PNG)</span>
            {contactData.useCustomQr && hasCustomQr && (
              <span className="text-[10px] bg-[#13A3E5]/20 text-[#13A3E5] px-1.5 py-0.2 rounded border border-[#13A3E5]/40 font-medium">
                Aktywny
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: vCard Generator */}
        {activeTab === 'vcard' && (
          <div className="space-y-4">
            {contactData.useCustomQr && hasCustomQr && (
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Obecnie na wizytówce wyświetlany jest Twój <strong>własny plik QR</strong>.</span>
                </div>
                <button
                  onClick={() => handleToggleUseCustom(false)}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg transition-colors whitespace-nowrap text-[11px]"
                >
                  Użyj tego vCard na wizytówce
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* QR Code Preview Box */}
              <div className="flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl p-5 text-center">
                {qrUrl ? (
                  <div className="p-3 bg-white rounded-xl shadow-lg mb-3">
                    <img src={qrUrl} alt="Kod QR vCard" className="w-44 h-44 object-contain" />
                  </div>
                ) : (
                  <div className="w-44 h-44 bg-neutral-800 animate-pulse rounded-xl mb-3" />
                )}

                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Poziom korekcji błędów: H (30%)</span>
                </div>
                <p className="text-[11px] text-neutral-400 mb-3">
                  Kod QR 300 DPI gotowy do druku i uszlachetnienia lakierem UV
                </p>

                {/* QR Quick Download Buttons */}
                <div className="w-full pt-3 border-t border-neutral-800 space-y-1.5 text-left">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
                    Pobierz sam kod QR (DTP & Wektor):
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const prefix = `QR_${contactData.firstName || 'Wizytowka'}_${contactData.lastName || 'vCard'}`.replace(/\s+/g, '_');
                        downloadQrAsCmykPdf(vCardText, prefix, 50);
                        if (onNotify) onNotify('Pobrano QR w formacie PDF (CMYK 0,0,0,100)');
                      }}
                      className="px-2 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-red-500/50 rounded-lg text-neutral-200 text-[11px] font-medium transition-colors flex flex-col items-center gap-1 text-center"
                    >
                      <FileDown className="w-3.5 h-3.5 text-red-400" />
                      <span className="font-bold">PDF CMYK</span>
                      <span className="text-[9px] text-neutral-400 font-mono">0,0,0,100</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const prefix = `QR_${contactData.firstName || 'Wizytowka'}_${contactData.lastName || 'vCard'}`.replace(/\s+/g, '_');
                        downloadQrAsSvg(vCardText, prefix);
                        if (onNotify) onNotify('Pobrano QR w formacie wektorowym SVG');
                      }}
                      className="px-2 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-amber-500/50 rounded-lg text-neutral-200 text-[11px] font-medium transition-colors flex flex-col items-center gap-1 text-center"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold">SVG</span>
                      <span className="text-[9px] text-neutral-400">Wektor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const prefix = `QR_${contactData.firstName || 'Wizytowka'}_${contactData.lastName || 'vCard'}`.replace(/\s+/g, '_');
                        downloadQrAsPng(vCardText, prefix);
                        if (onNotify) onNotify('Pobrano QR w formacie PNG (1600×1600 px, 300 DPI)');
                      }}
                      className="px-2 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-emerald-500/50 rounded-lg text-neutral-200 text-[11px] font-medium transition-colors flex flex-col items-center gap-1 text-center"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold">PNG</span>
                      <span className="text-[9px] text-neutral-400 font-mono">300 DPI</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* vCard 3.0 Raw Text Breakdown */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-neutral-300">
                    Struktura tekstowa vCard 3.0:
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-[11px] text-[#13A3E5] hover:text-[#48bbf0] flex items-center gap-1 bg-[#13A3E5]/15 px-2 py-0.5 rounded border border-[#13A3E5]/30 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Skopiowano!' : 'Kopiuj'}</span>
                  </button>
                </div>

                <pre className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-[11px] text-cyan-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 md:max-h-60">
                  {vCardText}
                </pre>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleDownloadVcf}
                    className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-neutral-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Pobierz plik .vcf</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Custom QR Upload (PDF, SVG, JPG, PNG) */}
        {activeTab === 'custom' && (
          <div className="space-y-4">
            {uploadError && (
              <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 flex items-center gap-2 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {hasCustomQr ? (
              /* Already has custom QR uploaded */
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative group shrink-0">
                    <div className="w-40 h-40 bg-white p-2.5 rounded-xl shadow-lg flex items-center justify-center border border-neutral-700">
                      <img
                        src={contactData.customQrImage}
                        alt="Własny kod QR"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-2.5">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="text-xs font-bold text-white">
                        {contactData.customQrFileName || 'Własny plik QR'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800">
                        {contactData.customQrFileName?.split('.').pop()?.toUpperCase() || 'QR'}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Ten plik zostanie umieszczony dokładnie na warstwie kodu QR na wizytówce i zsynchronizowany z eksportem produkcyjnym DTP PDF.
                    </p>

                    {/* Active toggle button */}
                    <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                      <button
                        onClick={() => handleToggleUseCustom(!contactData.useCustomQr)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          contactData.useCustomQr
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/50'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{contactData.useCustomQr ? 'Aktywny na wizytówce' : 'Kliknij, aby aktywować'}</span>
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-neutral-700"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Zmień plik</span>
                      </button>

                      <button
                        onClick={handleRemoveCustomQr}
                        className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-red-800/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Usuń</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Dropzone for Uploading */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#13A3E5] bg-[#13A3E5]/10 shadow-xl'
                    : 'border-neutral-700 bg-neutral-950 hover:border-[#13A3E5]/60 hover:bg-neutral-900/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.svg,.jpg,.jpeg,.png,image/png,image/jpeg,image/svg+xml,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {isUploading ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <RefreshCw className="w-8 h-8 text-[#13A3E5] animate-spin mb-3" />
                    <span className="text-sm font-semibold text-white">
                      Przetwarzanie i konwersja kodu QR (DTP 600 DPI)...
                    </span>
                    <span className="text-xs text-neutral-400 mt-1">
                      Dla plików PDF i wektorów SVG przygotowujemy raster najwyższej jakości
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="w-12 h-12 rounded-full bg-[#13A3E5]/15 border border-[#13A3E5]/40 flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6 text-[#13A3E5]" />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      Upuść plik z kodem QR lub kliknij, aby wybrać
                    </h4>
                    <p className="text-xs text-neutral-400 max-w-md mb-4">
                      Obsługiwane formaty: <strong>PDF</strong>, <strong>SVG</strong>, <strong>JPG</strong>, <strong>PNG</strong> (do 25 MB)
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-neutral-300">
                      <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">.PDF (Wektor)</span>
                      <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">.SVG (Wektor)</span>
                      <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">.PNG (Raster)</span>
                      <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">.JPG (Raster)</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hidden file input for 'Zmień plik' when custom QR exists */}
            {hasCustomQr && (
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.svg,.jpg,.jpeg,.png,image/png,image/jpeg,image/svg+xml,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            )}

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-400 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-[#13A3E5]" />
                <span>Informacja dla druku poligraficznego:</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                Pliki wektorowe (PDF, SVG) zachowują idealną ostrożność krawędzi modułów QR przy naświetlaniu CTP. Jeśli na polu kodu w szablonie włączony jest lakier wybiórczy UV, obrys kodu QR zostanie automatycznie dodany do maski lakieru.
              </p>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>
              Stan: {contactData.useCustomQr && hasCustomQr ? (
                <span className="text-[#13A3E5] font-medium">Aktywny własny plik QR</span>
              ) : (
                <span className="text-emerald-300 font-medium">Aktywny automatyczny vCard 3.0</span>
              )}
            </span>
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition-colors border border-neutral-700"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
};

