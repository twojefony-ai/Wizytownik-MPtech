import React from 'react';
import { 
  FileCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Layers, 
  Sparkles, 
  FileText, 
  Download, 
  RotateCcw,
  Check,
  ShieldAlert
} from 'lucide-react';
import { BusinessCardTemplate, ContactData, ExportSettings, PreflightCheckResult } from '../types';
import { runPreflightCheck } from '../utils/preflight';

interface PreflightInspectorProps {
  template: BusinessCardTemplate;
  contactData: ContactData;
  exportSettings: ExportSettings;
  onExportPdf: () => void;
  isExporting: boolean;
}

export const PreflightInspector: React.FC<PreflightInspectorProps> = ({
  template,
  contactData,
  exportSettings,
  onExportPdf,
  isExporting,
}) => {
  const result: PreflightCheckResult = runPreflightCheck(template, contactData);

  const useBleed = exportSettings.useBleed;
  const bleedMm = useBleed ? (exportSettings.bleedMm || template.bleedMm || 3) : 0;
  const widthNetto = template.widthNetto || 90;
  const heightNetto = template.heightNetto || 50;
  const widthBrutto = widthNetto + bleedMm * 2;
  const heightBrutto = heightNetto + bleedMm * 2;

  return (
    <div className="space-y-4">
      {/* Preflight Summary Card */}
      <div className={`p-4 rounded-xl border ${
        result.passed
          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
          : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-black/40">
              {result.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {result.passed ? 'Gotowość Produkcyjna DTP: ZATWIERDZONE' : 'Ostrzeżenia DTP do Weryfikacji'}
              </h3>
              <p className="text-xs opacity-80">
                Weryfikacja spadów, rozdzielczości 300 DPI, normy nafarbienia TAC i maski UV M=100
              </p>
            </div>
          </div>

          <button
            onClick={onExportPdf}
            disabled={isExporting}
            className="px-4 py-2 bg-[#13A3E5] hover:bg-[#0e8ec9] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-lg shadow-[#13A3E5]/25 border border-[#13A3E5]/40 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isExporting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Eksportuj 4 Strony PDF</span>
          </button>
        </div>
      </div>

      {/* 4-Page PDF Architecture Breakdown */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#13A3E5]" />
          <span>Architektura Wyjściowego Pliku PDF (4 Strony Produkcyjne)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Page 1 */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
              <span className="font-bold text-[#13A3E5]">Strona 1</span>
              <span className="text-neutral-500">CMYK 300 DPI</span>
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">Przód (Awers CMYK)</h4>
            <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
              Tło + grafiki procesowe CMYK + dynamiczne teksty + wektorowy kod QR.
            </p>
            <div className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
              Wymiar: {widthBrutto}×{heightBrutto} mm
            </div>
          </div>

          {/* Page 2 */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
              <span className="font-bold text-indigo-400">Strona 2</span>
              <span className="text-neutral-500">CMYK 300 DPI</span>
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">Tył (Rewers CMYK)</h4>
            <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
              Tło tyłu + logotyp i elementy dynamiczne rewersu w kolorach procesowych.
            </p>
            <div className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
              Wymiar: {widthBrutto}×{heightBrutto} mm
            </div>
          </div>

          {/* Page 3 */}
          <div className="bg-neutral-950 border border-fuchsia-500/50 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
              <span className="font-bold text-pink-400">Strona 3</span>
              <span className="text-fuchsia-400 bg-fuchsia-950 px-1 rounded">M=100 Spot</span>
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">Maska UV Przód (Awers)</h4>
            <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
              Wyłącznie elementy z włączonym lakierem UV (Magenta 100% C:0, M:100, Y:0, K:0).
            </p>
            <div className="text-[10px] font-mono text-fuchsia-400 bg-fuchsia-950/40 px-2 py-1 rounded border border-fuchsia-900/40">
              Pokrycie: {result.uvCoverageFront}% powierzchni
            </div>
          </div>

          {/* Page 4 */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
              <span className="font-bold text-pink-400">Strona 4</span>
              <span className="text-fuchsia-400 bg-fuchsia-950 px-1 rounded">M=100 Spot</span>
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">Maska UV Tył (Rewers)</h4>
            <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
              Elementy lakierowane na rewersie w kolorze M=100 (lub pusta strona).
            </p>
            <div className="text-[10px] font-mono text-fuchsia-400 bg-fuchsia-950/40 px-2 py-1 rounded border border-fuchsia-900/40">
              Pokrycie: {result.uvCoverageBack}% powierzchni
            </div>
          </div>
        </div>
      </div>

      {/* Technical Parameters Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="text-[11px] text-neutral-400 uppercase font-mono mb-1">Geometria & Spady</div>
          <div className="text-lg font-bold text-white font-mono">{widthNetto} × {heightNetto} mm</div>
          <div className="text-xs text-neutral-400 mt-1">
            Brutto ze spadami: <span className="text-white font-mono">{widthBrutto} × {heightBrutto} mm</span>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="text-[11px] text-neutral-400 uppercase font-mono mb-1">Maksymalne Nafarbienie (TAC)</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">{result.totalTacMax}%</div>
          <div className="text-xs text-neutral-400 mt-1">
            Limit bezpieczny: <span className="text-neutral-300 font-mono">≤ 320% CMYK</span>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="text-[11px] text-neutral-400 uppercase font-mono mb-1">Lakier UV Wybiórczy</div>
          <div className="text-lg font-bold text-fuchsia-400 font-mono">Magenta 100%</div>
          <div className="text-xs text-neutral-400 mt-1">
            Strony 3-4: <span className="text-neutral-300">C:0 M:100 Y:0 K:0</span>
          </div>
        </div>
      </div>

      {/* Issues & Checks Log */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
          Raport Kontrolny Preflight ({result.issues.length})
        </h3>

        <div className="space-y-2">
          {result.issues.map((issue, index) => (
            <div
              key={index}
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                issue.type === 'error'
                  ? 'bg-red-950/30 border-red-800/50 text-red-300'
                  : issue.type === 'warning'
                  ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300'
              }`}
            >
              <span className="mt-0.5">
                {issue.type === 'error' && <ShieldAlert className="w-4 h-4 text-red-400" />}
                {issue.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {issue.type === 'info' && <Check className="w-4 h-4 text-emerald-400" />}
              </span>
              <span className="leading-relaxed">{issue.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
