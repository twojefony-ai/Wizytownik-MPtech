import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Eye, 
  FileText,
  RotateCcw,
  Sparkles,
  Layers,
  Plus,
  Info
} from 'lucide-react';
import { BusinessCardTemplate, ContactData, ExportSettings, BatchItem } from '../types';
import { parseBatchCSV, batchItemToContactData } from '../utils/csv';

interface BatchProcessorProps {
  template: BusinessCardTemplate;
  baseContactData: ContactData;
  exportSettings?: ExportSettings;
  onPreviewPerson: (contactData: ContactData) => void;
  onNotify?: (message: string) => void;
}

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  template,
  baseContactData,
  exportSettings = { useBleed: true, bleedMm: 2, addCropMarks: true, addUVPage: true, dpi: 300 },
  onPreviewPerson,
  onNotify,
}) => {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      processRawCSV(content, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processRawCSV = (csvContent: string, sourceName?: string) => {
    const result = parseBatchCSV(csvContent, baseContactData);
    setBatchItems(result.items);
    setParseErrors(result.errors);

    if (result.items.length > 0) {
      if (onNotify) {
        onNotify(`Wczytano ${result.items.length} rekordów z pliku ${sourceName || 'CSV'}.`);
      }
    }
  };

  const handleApplyPasted = () => {
    if (!pastedText.trim()) return;
    setCsvFileName('Wklejony_tekst.csv');
    processRawCSV(pastedText, 'Wklejony tekst');
    setPasteMode(false);
  };

  const handleLoadSample = async () => {
    try {
      const res = await fetch('/sample_batch.csv');
      if (res.ok) {
        const text = await res.text();
        setCsvFileName('sample_batch.csv');
        processRawCSV(text, 'sample_batch.csv');
      } else {
        alert('Nie udało się pobrać przykładowego pliku CSV');
      }
    } catch (e: any) {
      alert(`Błąd: ${e.message}`);
    }
  };

  const handlePreview = (item: BatchItem) => {
    setSelectedPreviewId(item.id);
    const fullContact = batchItemToContactData(item, baseContactData);
    onPreviewPerson(fullContact);
    if (onNotify) {
      onNotify(`Wizytownik wyświetla teraz podgląd dla: ${item.fullName}`);
    }
  };

  const handleDeleteItem = (id: string) => {
    setBatchItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleGenerateBatchPdf = async () => {
    const validItems = batchItems.filter((it) => it.isValid);
    if (validItems.length === 0) {
      alert('Brak poprawnych rekordów w tabeli batch. Upewnij się, że wypełniono: imię i nazwisko, stanowisko, telefon, mail.');
      return;
    }

    setIsGenerating(true);
    try {
      const recordsToSend = validItems.map((item) => batchItemToContactData(item, baseContactData));

      const response = await fetch('/api/generate-batch-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          records: recordsToSend,
          baseCompanyData: baseContactData,
          settings: exportSettings,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Błąd serwera (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Wizytowki_BATCH_${validItems.length}_osob_${template.widthNetto}x${template.heightNetto}mm_UV.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      if (onNotify) {
        onNotify(`Pomyślnie wygenerowano zbiorczy plik PDF dla ${validItems.length} osób (${validItems.length * 4} stron: Awers, Awers UV, Rewers, Rewers UV).`);
      }
    } catch (err: any) {
      alert(`Błąd generowania Batch PDF: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const validCount = batchItems.filter((i) => i.isValid).length;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#13A3E5]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Generator Seryjny (Batch CSV)
            </h3>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Wczytaj plik CSV z listą pracowników. Wymagane kolumny: <strong className="text-neutral-200">imie i nazwisko, stanowisko, telefon, mail</strong>.
          </p>
        </div>

        {/* Action Buttons: Sample & Paste */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <a
            href="/sample_batch.csv"
            download="sample_batch.csv"
            title="Pobierz gotowy wzorcowy szablon CSV"
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pobierz wzorzec CSV</span>
          </a>

          <button
            type="button"
            onClick={handleLoadSample}
            title="Wczytaj przykładowe dane testowe z pliku sample_batch.csv"
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#13A3E5]" />
            <span>Wczytaj Demo</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* File Drag/Drop */}
        <label className="border-2 border-dashed border-neutral-800 hover:border-[#13A3E5]/60 hover:bg-neutral-950/60 transition-all rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer group">
          <Upload className="w-6 h-6 text-neutral-500 group-hover:text-[#13A3E5] mb-2 transition-colors" />
          <span className="text-xs font-semibold text-neutral-200 group-hover:text-white">
            Wybierz lub przeciągnij plik .CSV
          </span>
          <span className="text-[10px] text-neutral-500 mt-0.5">
            Kodowanie UTF-8, separator: przecinek (,) lub średnik (;)
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Manual Paste Box Toggle */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-neutral-300">Wklej tekst CSV lub z Excela</span>
              <button
                type="button"
                onClick={() => setPasteMode(!pasteMode)}
                className="text-[11px] text-[#13A3E5] hover:underline"
              >
                {pasteMode ? 'Zwiń pole tekstowe' : 'Otwórz edytor tekstu'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">
              Możesz skopiować kolumny bezpośrednio z arkusza Excel / Google Sheets i wkleić poniżej.
            </p>
          </div>

          {pasteMode ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="imie i nazwisko,stanowisko,telefon,mail&#10;Jan Kowalski,Dyrektor,+48 601 234 567,j.kowalski@firma.pl"
                rows={3}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#13A3E5]"
              />
              <button
                type="button"
                onClick={handleApplyPasted}
                className="w-full py-1.5 rounded-lg bg-[#13A3E5] hover:bg-[#0e8ec9] text-white text-xs font-semibold"
              >
                Zastosuj wklejone dane
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 bg-neutral-900/60 px-2.5 py-1.5 rounded-lg border border-neutral-800">
              <span>Firma bazowa: <strong>{baseContactData.company || 'Domyślna'}</strong></span>
              <span>NIP: <strong>{baseContactData.nip || 'Brak'}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Parse errors if any */}
      {parseErrors.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 text-amber-200 p-3 rounded-lg text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {parseErrors.map((err, idx) => (
              <p key={idx}>{err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Batch Data Table */}
      {batchItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                Lista Rekordów do Wygenerowania ({validCount} z {batchItems.length} poprawnych)
              </span>
              {csvFileName && (
                <span className="text-[10px] font-mono text-[#13A3E5] bg-[#13A3E5]/15 px-2 py-0.5 rounded border border-[#13A3E5]/30">
                  {csvFileName}
                </span>
              )}
            </div>

            {/* Main Batch PDF Action Button */}
            <button
              type="button"
              onClick={handleGenerateBatchPdf}
              disabled={isGenerating || validCount === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>Generuj BATCH PDF ({validCount} osób × 4 strony)</span>
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto border border-neutral-800 rounded-xl bg-neutral-950 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-900 sticky top-0 z-10 text-[11px] text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="py-2 px-3 font-semibold w-8">#</th>
                  <th className="py-2 px-3 font-semibold">Imię i Nazwisko</th>
                  <th className="py-2 px-3 font-semibold">Stanowisko</th>
                  <th className="py-2 px-3 font-semibold">Telefon</th>
                  <th className="py-2 px-3 font-semibold">E-mail</th>
                  <th className="py-2 px-3 font-semibold text-center w-24">QR vCard</th>
                  <th className="py-2 px-3 font-semibold text-right w-28">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 font-sans">
                {batchItems.map((item, idx) => {
                  const isSelected = selectedPreviewId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-900/60 transition-colors ${
                        !item.isValid ? 'bg-red-950/20' : isSelected ? 'bg-[#13A3E5]/10' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-neutral-500 font-mono text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                        {item.fullName || (
                          <span className="text-red-400 italic">Brak</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-neutral-300 whitespace-nowrap">
                        {item.jobTitle || (
                          <span className="text-red-400 italic">Brak</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-neutral-300 font-mono text-[11px] whitespace-nowrap">
                        {item.phone || (
                          <span className="text-red-400 italic">Brak</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                        {item.email || (
                          <span className="text-red-400 italic">Brak</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {item.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Auto vCard
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-950/60 border border-red-800/60 px-1.5 py-0.5 rounded font-mono" title={item.validationError}>
                            Błąd
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Live preview in canvas */}
                          <button
                            type="button"
                            onClick={() => handlePreview(item)}
                            title="Wyświetl tę osobę na podglądzie wizytówki"
                            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                              isSelected
                                ? 'bg-[#13A3E5] text-white'
                                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>Podgląd</span>
                          </button>

                          {/* Delete from batch */}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Usuń z listy batch"
                            className="p-1 rounded bg-neutral-900 hover:bg-red-950 text-neutral-500 hover:text-red-400 border border-neutral-800"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 bg-neutral-950 px-3 py-2 rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#13A3E5]" />
              <span>Każdy pracownik otrzyma 4 dedykowane strony: <strong>Awers, Awers UV, Rewers, Rewers UV</strong>. Kod QR vCard zostanie wygenerowany automatycznie.</span>
            </div>
            <button
              type="button"
              onClick={() => setBatchItems([])}
              className="text-neutral-500 hover:text-red-400 text-[10px] underline ml-2 shrink-0"
            >
              Wyczyść listę
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
