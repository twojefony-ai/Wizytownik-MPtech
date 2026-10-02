import React, { useState, useEffect } from 'react';
import { 
  FolderDown, 
  Save, 
  Trash2, 
  Download, 
  Upload, 
  FileText, 
  Check, 
  Clock, 
  RotateCcw,
  Sparkles,
  Layers,
  FileCheck
} from 'lucide-react';
import { BusinessCardTemplate, ContactData, ExportSettings, SavedConfigFile, FullConfigPayload } from '../types';

interface SavedConfigsManagerProps {
  currentTemplate: BusinessCardTemplate;
  currentContactData: ContactData;
  currentExportSettings?: ExportSettings;
  onLoadConfig: (config: { template: BusinessCardTemplate; contactData: ContactData; exportSettings?: ExportSettings }) => void;
  onNotify?: (message: string) => void;
}

export const SavedConfigsManager: React.FC<SavedConfigsManagerProps> = ({
  currentTemplate,
  currentContactData,
  currentExportSettings,
  onLoadConfig,
  onNotify,
}) => {
  const [configs, setConfigs] = useState<SavedConfigFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [justSavedFile, setJustSavedFile] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/saved-configs');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.configs)) {
          setConfigs(data.configs);
        }
      }
    } catch (e) {
      console.error('Failed to fetch saved configs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = (presetName.trim() || `${currentTemplate.name}_${currentContactData.lastName || 'Ustawienia'}`).trim();
    setIsSaving(true);

    try {
      const res = await fetch('/api/saved-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          description: presetDesc.trim(),
          template: currentTemplate,
          contactData: currentContactData,
          exportSettings: currentExportSettings,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setJustSavedFile(data.fileName);
        setPresetName('');
        setPresetDesc('');
        fetchConfigs();
        if (onNotify) {
          onNotify(`Zapisano konfigurację do pliku: ${data.fileName} w katalogu saved_configs.`);
        }
        setTimeout(() => setJustSavedFile(null), 4000);
      } else {
        alert(`Błąd zapisu: ${data.error || 'Nieznany błąd'}`);
      }
    } catch (err: any) {
      alert(`Błąd połączenia: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFile = async (fileName: string) => {
    try {
      const res = await fetch(`/api/saved-configs/${encodeURIComponent(fileName)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          const cfg = data.config;
          onLoadConfig({
            template: cfg.template,
            contactData: cfg.contactData,
            exportSettings: cfg.exportSettings,
          });
          if (onNotify) {
            onNotify(`Wczytano konfigurację z pliku: ${fileName}`);
          }
        }
      } else {
        alert('Nie udało się wczytać pliku konfiguracji.');
      }
    } catch (err: any) {
      alert(`Błąd wczytywania: ${err.message}`);
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!window.confirm(`Czy na pewno usunąć plik ${fileName} z katalogu saved_configs?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/saved-configs/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConfigs((prev) => prev.filter((c) => c.fileName !== fileName));
        if (onNotify) {
          onNotify(`Plik ${fileName} został usunięty.`);
        }
      }
    } catch (e: any) {
      alert(`Błąd usuwania: ${e.message}`);
    }
  };

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let parsed: any = null;

        if (file.name.endsWith('.json')) {
          parsed = JSON.parse(content);
        } else {
          const match = content.match(/<!--\s*JSON_START([\s\S]*?)JSON_END\s*-->/);
          if (match && match[1]) {
            parsed = JSON.parse(match[1].trim());
          } else {
            parsed = JSON.parse(content);
          }
        }

        if (parsed && parsed.template && parsed.contactData) {
          onLoadConfig({
            template: parsed.template,
            contactData: parsed.contactData,
            exportSettings: parsed.exportSettings,
          });
          if (onNotify) {
            onNotify(`Wczytano konfigurację z pliku lokalnego: ${file.name}`);
          }
        } else {
          alert('Wybrany plik nie zawiera poprawnej struktury szablonu wizytówki.');
        }
      } catch (parseErr) {
        alert('Nie udało się odczytać struktury konfiguracji z wybranego pliku.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderDown className="w-4 h-4 text-[#13A3E5]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Zapisywanie i Wczytywanie Konfiguracji (Katalog /saved_configs)
            </h3>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Zapisuje do osobnego pliku tekstowego (.txt) pozycje ramek, szablon, dane kontaktowe i parametry QR.
          </p>
        </div>

        {/* Upload local file button */}
        <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-center shrink-0">
          <Upload className="w-3.5 h-3.5 text-[#13A3E5]" />
          <span>Wczytaj z dysku (.txt/.json)</span>
          <input
            type="file"
            accept=".txt,.json,.md"
            onChange={handleLocalFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Save Current State Form */}
      <form onSubmit={handleSaveCurrent} className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            Zapisz bieżący stan jako nowy plik konfiguracji
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">Format: .txt z czytelnym podglądem</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder={`Nazwa pliku np. ${currentTemplate.name}_${currentContactData.lastName || '2026'}`}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#13A3E5]"
            />
          </div>
          <div className="sm:col-span-4">
            <input
              type="text"
              placeholder="Opcjonalny opis / notatka..."
              value={presetDesc}
              onChange={(e) => setPresetDesc(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#13A3E5]"
            />
          </div>
          <div className="sm:col-span-2 flex">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Zapisz plik</span>
            </button>
          </div>
        </div>
      </form>

      {/* List of Saved Files */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <span className="font-semibold text-neutral-300">Zapisane pliki w katalogu ({configs.length}):</span>
          <button
            type="button"
            onClick={fetchConfigs}
            disabled={isLoading}
            className="text-[11px] text-[#13A3E5] hover:underline flex items-center gap-1"
          >
            <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież listę
          </button>
        </div>

        {configs.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-neutral-800 rounded-lg text-xs text-neutral-500">
            Brak zapisanych plików konfiguracji w katalogu <code className="text-neutral-400">/saved_configs</code>.
            <br />
            Wpisz nazwę powyżej i kliknij <strong>Zapisz plik</strong>, aby utrwalić bieżący szablon i dane.
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {configs.map((cfg) => {
              const dateObj = new Date(cfg.savedAt);
              const formattedDate = isNaN(dateObj.getTime())
                ? cfg.savedAt
                : dateObj.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

              return (
                <div
                  key={cfg.fileName}
                  className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 hover:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[#13A3E5] shrink-0" />
                      <span className="text-xs font-bold text-white truncate">{cfg.name}</span>
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 shrink-0">
                        .{cfg.fileExt || 'txt'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-neutral-400">
                      {cfg.templateName && <span>Szablon: <strong className="text-neutral-300">{cfg.templateName}</strong></span>}
                      {cfg.cardSize && <span>Rozmiar: <strong className="text-neutral-300">{cfg.cardSize}</strong></span>}
                      <span className="flex items-center gap-1 text-neutral-500 font-mono text-[10px]">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                      </span>
                    </div>

                    {cfg.previewSummary && (
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5 font-mono">
                        {cfg.previewSummary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Load config */}
                    <button
                      type="button"
                      onClick={() => handleLoadFile(cfg.fileName)}
                      title="Wczytaj tę konfigurację do edytora"
                      className="px-2.5 py-1 rounded bg-[#13A3E5]/15 hover:bg-[#13A3E5] text-[#13A3E5] hover:text-white border border-[#13A3E5]/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Wczytaj</span>
                    </button>

                    {/* Download file */}
                    <a
                      href={`/api/saved-configs/${encodeURIComponent(cfg.fileName)}/download`}
                      download={cfg.fileName}
                      title="Pobierz plik tekstowy na dysk"
                      className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs transition-colors flex items-center justify-center"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    {/* Delete file */}
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(cfg.fileName)}
                      title="Usuń plik z serwera"
                      className="p-1 rounded bg-neutral-900 hover:bg-red-950 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-900/50 text-xs transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
