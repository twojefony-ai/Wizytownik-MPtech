import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Check, 
  AlertCircle, 
  RotateCcw,
  Type,
  FolderOpen
} from 'lucide-react';
import { BusinessCardTemplate } from '../types';
import { safeFetchJson } from '../utils/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: BusinessCardTemplate;
  onUpdateTemplate: (template: BusinessCardTemplate) => void;
  onNotify?: (message: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  template,
  onUpdateTemplate,
  onNotify,
}) => {
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);
    setStatusMessage(null);

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

      const pagesDesc = data.pageCount >= 4
        ? '4 strony: Awers CMYK, Awers UV, Rewers CMYK, Rewers UV'
        : `${data.pageCount} ${data.pageCount === 1 ? 'strona' : 'strony'}`;

      onUpdateTemplate({
        ...template,
        bleedMm: 3,
        masterPdfFileName: data.fileName,
        masterPdfPageCount: data.pageCount,
        masterPdfPreviews: data.previewUrls,
      });

      const successMsg = data.message || `Szablon wczytany pomyślnie! Wykryto ${pagesDesc}. Podgląd wizytówki został zaktualizowany.`;
      setStatusMessage({
        type: 'success',
        text: successMsg,
      });

      if (onNotify) {
        onNotify(successMsg);
      }

      // Auto close after 1.2s to smoothly reveal updated canvas
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Wystąpił problem podczas przetwarzania pliku PDF' });
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleUploadFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFont(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('fontFile', file);

    try {
      const data = await safeFetchJson<{
        success: boolean;
        fileName: string;
        message?: string;
      }>('/api/upload-font', {
        method: 'POST',
        body: formData,
      });

      setStatusMessage({
        type: 'success',
        text: data.message || `Plik czcionki "${file.name}" został zainstalowany w silniku typograficznym backendu.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Wystąpił problem z wgraniem czcionki' });
    } finally {
      setIsUploadingFont(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg bg-neutral-800"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-[#13A3E5]" />
          <span>Wgraj Szablon Master PDF i Czcionki</span>
        </h3>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
          Możesz wgrać 4-stronicowy plik Master PDF (1: Awers CMYK, 2: Awers UV, 3: Rewers CMYK, 4: Rewers UV) lub 2-stronicowy plik, a także własne pliki czcionek (.ttf / .otf).
        </p>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-300'
                : 'bg-red-950/40 border border-red-500/50 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Master PDF Upload */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#13A3E5]" />
                <span>1. Plik Master PDF (2 Strony: Przód, Tył)</span>
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mb-3">
              Wgraj plik PDF z grafiką tła. Silnik automatycznie osadzi stronę 1 na awersie i stronę 2 na rewersie.
            </p>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 hover:border-[#13A3E5] rounded-xl p-4 cursor-pointer bg-neutral-900/50 transition-colors">
              {isUploadingPdf ? (
                <RotateCcw className="w-6 h-6 animate-spin text-[#13A3E5]" />
              ) : (
                <>
                  <UploadCloud className="w-6 h-6 text-neutral-400 mb-1" />
                  <span className="text-xs font-medium text-neutral-200">Wybierz lub przeciągnij plik PDF</span>
                  <span className="text-[10px] text-neutral-500">Maks. 50 MB, format .pdf</span>
                </>
              )}
              <input
                type="file"
                accept=".pdf"
                onChange={handleUploadPdf}
                disabled={isUploadingPdf}
                className="hidden"
              />
            </label>

            {template.masterPdfFileName && (
              <div className="mt-2 text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Aktywny Master: {template.masterPdfFileName}</span>
              </div>
            )}
          </div>

          {/* Font TTF/OTF Upload */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Type className="w-4 h-4 text-[#13A3E5]" />
                <span>2. Pliki Czcionek (.TTF / .OTF)</span>
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mb-3">
              Wgraj odmiany kroju (np. ProximaNova-Bold.ttf, Rajdhani.ttf), aby osadzić je wektorowo w pliku PDF.
            </p>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 hover:border-[#13A3E5] rounded-xl p-4 cursor-pointer bg-neutral-900/50 transition-colors">
              {isUploadingFont ? (
                <RotateCcw className="w-6 h-6 animate-spin text-[#13A3E5]" />
              ) : (
                <>
                  <FolderOpen className="w-6 h-6 text-neutral-400 mb-1" />
                  <span className="text-xs font-medium text-neutral-200">Wgraj czcionkę TrueType / OpenType</span>
                  <span className="text-[10px] text-neutral-500">Formaty: .ttf, .otf</span>
                </>
              )}
              <input
                type="file"
                accept=".ttf,.otf"
                onChange={handleUploadFont}
                disabled={isUploadingFont}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-lg"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
