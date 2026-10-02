import React from 'react';
import { 
  FileCheck, 
  Download, 
  RotateCcw,
  Sliders,
  Layers
} from 'lucide-react';
import { BusinessCardTemplate } from '../types';

interface HeaderProps {
  activeTab: 'personalize' | 'template' | 'preflight';
  setActiveTab: (tab: 'personalize' | 'template' | 'preflight') => void;
  templates?: BusinessCardTemplate[];
  selectedTemplate?: BusinessCardTemplate;
  onSelectTemplate?: (template: BusinessCardTemplate) => void;
  onOpenUpload?: () => void;
  onOpenVCard?: () => void;
  onExportPdf: () => void;
  isExporting: boolean;
  activeSide: 'front' | 'back';
  setActiveSide: (side: 'front' | 'back') => void;
  viewMode: 'composite' | 'uv_shine' | 'uv_mask' | 'dtp_marks';
  setViewMode: (mode: 'composite' | 'uv_shine' | 'uv_mask' | 'dtp_marks') => void;
  preflightIssueCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExportPdf,
  isExporting,
  preflightIssueCount,
}) => {
  return (
    <header className="bg-neutral-900/90 border-b border-neutral-800 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* App Title */}
        <div className="flex items-center w-full md:w-auto justify-between md:justify-start shrink-0">
          <div className="flex items-center">
            <span className="font-bold tracking-tight text-white font-['Rajdhani'] text-lg uppercase">
              Wizytownik
            </span>
          </div>
        </div>

        {/* Navigation Tabs and Pobierz PDF Produkcyjny side-by-side */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 gap-1">
            <button
              onClick={() => setActiveTab('personalize')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'personalize'
                  ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#13A3E5]" />
              <span>Personalizacja</span>
            </button>

            <button
              onClick={() => setActiveTab('preflight')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                activeTab === 'preflight'
                  ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Preflight DTP</span>
              {preflightIssueCount > 0 && (
                <span className="w-4 h-4 bg-amber-500/80 text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                  {preflightIssueCount}
                </span>
              )}
            </button>
          </div>

          {/* Przycisk "pobierz PDF produkcyjny" obok "preflight dtp" */}
          <button
            onClick={onExportPdf}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#13A3E5] hover:bg-[#0e8ec9] active:scale-95 transition-all rounded-xl flex items-center gap-2 shadow-lg shadow-[#13A3E5]/25 border border-[#13A3E5]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isExporting ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Pobierz PDF Produkcyjny (4 strony)</span>
          </button>
        </div>

        {/* Ikonę ustawienia całkiem na prawą krawędź ekranu, za przyciskiem pobierz pdf */}
        <div className="flex items-center justify-end shrink-0">
          <button
            onClick={() => setActiveTab('template')}
            aria-label="Ustawienia"
            title="Ustawienia"
            className={`p-2 rounded-xl transition-all ${
              activeTab === 'template'
                ? 'bg-neutral-800 text-[#13A3E5] border border-neutral-700/60 shadow-sm opacity-90'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40 opacity-25 hover:opacity-80'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

