import React, { useState, useRef } from 'react';
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
  Info, 
  Archive, 
  FolderDown, 
  Check, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  QrCode,
  FileDown,
  Image as ImageIcon,
  UserCheck,
  RefreshCw,
  X
} from 'lucide-react';
import { BusinessCardTemplate, ContactData, ExportSettings, BatchItem } from '../types';
import { 
  parseBatchCSV, 
  batchItemToContactData, 
  downloadInDesignCSV, 
  downloadInDesignDataMergeZip,
  generateInDesignCSV 
} from '../utils/csv';
import { buildVCard3 } from '../utils/vcard';
import { downloadQrAsCmykPdf, downloadQrAsSvg, downloadQrAsPng } from '../utils/qrExport';

interface BatchProcessorProps {
  template: BusinessCardTemplate;
  baseContactData: ContactData;
  exportSettings?: ExportSettings;
  onPreviewPerson: (contactData: ContactData) => void;
  onNotify?: (message: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  template,
  baseContactData,
  exportSettings = { useBleed: true, bleedMm: 2, addCropMarks: false, addUVPage: true, dpi: 300 },
  onPreviewPerson,
  onNotify,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const toggleOpen = onToggleOpen || (() => setInternalIsOpen(!internalIsOpen));

  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPackagingZip, setIsPackagingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);

  // Individual Row QR Download Menu state
  const [openQrDownloadRowId, setOpenQrDownloadRowId] = useState<string | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const rowFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
      // Auto-preview first person
      const firstPerson = result.items[0];
      setSelectedPreviewId(firstPerson.id);
      const fullContact = batchItemToContactData(firstPerson, baseContactData);
      onPreviewPerson(fullContact);

      if (onNotify) {
        onNotify(`Wczytano ${result.items.length} rekordów z pliku ${sourceName || 'CSV'}. Podgląd pierwszej osoby jest aktywny.`);
      }
    }
  };

  const handleApplyPasted = () => {
    if (!pastedText.trim()) return;
    setCsvFileName('Wklejony_tekst.csv');
    processRawCSV(pastedText, 'Wklejony tekst');
    setPasteMode(false);
  };

  const handleLoadSample = async (type: 'standard' | 'indesign' = 'indesign') => {
    try {
      const path = type === 'indesign' ? '/sample_indesign.csv' : '/sample_batch.csv';
      const res = await fetch(path);
      if (res.ok) {
        const text = await res.text();
        const fileName = type === 'indesign' ? 'sample_indesign.csv' : 'sample_batch.csv';
        setCsvFileName(fileName);
        processRawCSV(text, fileName);
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
      onNotify(`Wizytownik wyświetla teraz podgląd dla: ${item.fullName || `${item.firstName} ${item.lastName}`}`);
    }
  };

  // Switch person using Previous / Next Arrows
  const handleNavigatePerson = (direction: 'prev' | 'next') => {
    if (batchItems.length === 0) return;
    const currentIndex = batchItems.findIndex((it) => it.id === selectedPreviewId);
    let nextIndex = 0;
    if (direction === 'prev') {
      nextIndex = currentIndex <= 0 ? batchItems.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex >= batchItems.length - 1 ? 0 : currentIndex + 1;
    }
    const nextItem = batchItems[nextIndex];
    if (nextItem) {
      handlePreview(nextItem);
    }
  };

  const handleDeleteItem = (id: string) => {
    setBatchItems((prev) => {
      const remaining = prev.filter((it) => it.id !== id);
      if (selectedPreviewId === id && remaining.length > 0) {
        handlePreview(remaining[0]);
      }
      return remaining;
    });
  };

  // Download QR code specifically for one employee in the batch list
  const handleDownloadSingleQR = async (item: BatchItem, format: 'pdf' | 'svg' | 'png') => {
    const contact = batchItemToContactData(item, baseContactData);
    const vcard = buildVCard3(contact);
    const safeName = (item.fullName || `${item.firstName}_${item.lastName}` || 'Wizytowka')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
    const prefix = `QR_${safeName}`;

    try {
      if (format === 'pdf') {
        await downloadQrAsCmykPdf(vcard, prefix, 50);
        if (onNotify) onNotify(`Pobrano kod QR w formacie PDF (CMYK 0,0,0,100) dla: ${item.fullName}`);
      } else if (format === 'svg') {
        await downloadQrAsSvg(vcard, prefix);
        if (onNotify) onNotify(`Pobrano kod QR w formacie SVG dla: ${item.fullName}`);
      } else if (format === 'png') {
        await downloadQrAsPng(vcard, prefix);
        if (onNotify) onNotify(`Pobrano kod QR w formacie PNG (1600×1600, 300 DPI) dla: ${item.fullName}`);
      }
      setOpenQrDownloadRowId(null);
    } catch (e: any) {
      alert(`Błąd pobierania QR: ${e.message}`);
    }
  };

  // Upload custom QR specifically for one employee in the batch list
  const handleCustomQrUploadForPerson = async (item: BatchItem, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingRowId(item.id);
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
        const updatedItems = batchItems.map((it) => {
          if (it.id === item.id) {
            return {
              ...it,
              customQrImage: previewUrl,
              useCustomQr: true,
              qrFileName: `QR/${file.name}`,
            };
          }
          return it;
        });
        setBatchItems(updatedItems);

        // If this person is currently being previewed, update live preview immediately
        if (selectedPreviewId === item.id) {
          const updatedPerson = updatedItems.find((it) => it.id === item.id);
          if (updatedPerson) {
            onPreviewPerson(batchItemToContactData(updatedPerson, baseContactData));
          }
        }

        if (onNotify) {
          onNotify(`Wczytano indywidualny kod QR (${file.name}) dla: ${item.fullName}`);
        }
      } else {
        throw new Error(result.error || 'Błąd przetwarzania pliku QR');
      }
    } catch (err: any) {
      // Local client fallback
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.pdf') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (dataUrl) {
            const updatedItems = batchItems.map((it) => {
              if (it.id === item.id) {
                return {
                  ...it,
                  customQrImage: dataUrl,
                  useCustomQr: true,
                  qrFileName: `QR/${file.name}`,
                };
              }
              return it;
            });
            setBatchItems(updatedItems);
            if (selectedPreviewId === item.id) {
              const updatedPerson = updatedItems.find((it) => it.id === item.id);
              if (updatedPerson) {
                onPreviewPerson(batchItemToContactData(updatedPerson, baseContactData));
              }
            }
          }
        };
        reader.readAsDataURL(file);
      } else {
        alert(`Błąd uploadu pliku QR: ${err.message}`);
      }
    } finally {
      setUploadingRowId(null);
      e.target.value = '';
    }
  };

  // Revert custom QR to auto-generated vCard QR for this employee
  const handleRemoveCustomQrForPerson = (item: BatchItem) => {
    const updatedItems = batchItems.map((it) => {
      if (it.id === item.id) {
        return {
          ...it,
          customQrImage: undefined,
          useCustomQr: false,
          qrFileName: undefined,
        };
      }
      return it;
    });
    setBatchItems(updatedItems);

    if (selectedPreviewId === item.id) {
      const updatedPerson = updatedItems.find((it) => it.id === item.id);
      if (updatedPerson) {
        onPreviewPerson(batchItemToContactData(updatedPerson, baseContactData));
      }
    }

    if (onNotify) {
      onNotify(`Przywrócono automatycznie generowany kod QR vCard dla: ${item.fullName}`);
    }
  };

  const handleDownloadInDesignCSV = () => {
    const validItems = batchItems.filter((it) => it.isValid);
    if (validItems.length === 0) {
      alert('Brak poprawnych rekordów do wyeksportowania.');
      return;
    }
    downloadInDesignCSV(validItems, `InDesign_DataMerge_${validItems.length}_osob.csv`);
    if (onNotify) {
      onNotify('Pobrano plik CSV zgodny z Adobe InDesign Data Merge (@QR_Code,Imie Nazwisko,Stanowisko,tel,mail,tel2).');
    }
  };

  const handleDownloadInDesignZipPackage = async () => {
    const validItems = batchItems.filter((it) => it.isValid);
    if (validItems.length === 0) {
      alert('Brak poprawnych rekordów w tabeli batch do wygenerowania paczki InDesign.');
      return;
    }

    setIsPackagingZip(true);
    setZipProgress({ current: 0, total: validItems.length });
    try {
      await downloadInDesignDataMergeZip(
        validItems,
        baseContactData,
        `InDesign_DataMerge_Paczka_${validItems.length}_osob.zip`,
        (current, total) => {
          setZipProgress({ current, total });
        }
      );
      if (onNotify) {
        onNotify(`Pomyślnie utworzono paczkę InDesign (CSV + podfolder QR z ${validItems.length} plikami PDF CMYK 0,0,0,100).`);
      }
    } catch (err: any) {
      alert(`Błąd generowania paczki ZIP: ${err.message}`);
    } finally {
      setIsPackagingZip(false);
      setZipProgress(null);
    }
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
  const currentPreviewIndex = batchItems.findIndex((it) => it.id === selectedPreviewId);
  const currentPreviewPerson = currentPreviewIndex >= 0 ? batchItems[currentPreviewIndex] : batchItems[0];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 transition-all">
      {/* Collapsible Header */}
      <div 
        onClick={toggleOpen}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-[#13A3E5]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Generator Seryjny & Adobe InDesign CSV
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {batchItems.length > 0 && (
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
              {validCount} / {batchItems.length} osób
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-4 animate-in fade-in">
          
          {/* Top Quick Navigation Bar with Arrows (When CSV is loaded with multiple users) */}
          {batchItems.length > 0 && (
            <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-[#13A3E5]/15 text-[#13A3E5] rounded-lg border border-[#13A3E5]/30 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5 truncate">
                    <span>Podgląd na wizytówce:</span>
                    <span className="text-[#13A3E5] font-semibold">
                      {currentPreviewPerson?.fullName || 'Wybierz osobę'}
                    </span>
                    {currentPreviewPerson?.jobTitle && (
                      <span className="text-[10px] text-neutral-400 font-normal">
                        ({currentPreviewPerson.jobTitle})
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>Osoba {currentPreviewIndex >= 0 ? currentPreviewIndex + 1 : 1} z {batchItems.length}</span>
                    {currentPreviewPerson?.useCustomQr && (
                      <span className="text-pink-400 bg-pink-950/60 border border-pink-800/60 px-1 py-0.2 rounded text-[9px]">
                        Własny QR
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation Arrows Controls (Side-by-side without text) */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {/* Direct Dropdown Switcher */}
                <select
                  value={selectedPreviewId || ''}
                  onChange={(e) => {
                    const found = batchItems.find((it) => it.id === e.target.value);
                    if (found) handlePreview(found);
                  }}
                  className="bg-neutral-900 border border-neutral-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#13A3E5] font-mono cursor-pointer max-w-[140px] sm:max-w-[190px]"
                >
                  {batchItems.map((item, idx) => (
                    <option key={item.id} value={item.id}>
                      {idx + 1}. {item.fullName || item.email}
                    </option>
                  ))}
                </select>

                {/* Side-by-side Arrows */}
                <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-700">
                  <button
                    type="button"
                    onClick={() => handleNavigatePerson('prev')}
                    title="Poprzednia osoba na podglądzie wizytówki (←)"
                    className="p-1.5 rounded hover:bg-neutral-800 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-[#13A3E5]" />
                  </button>
                  <div className="w-[1px] h-4 bg-neutral-700" />
                  <button
                    type="button"
                    onClick={() => handleNavigatePerson('next')}
                    title="Następna osoba na podglądzie wizytówki (→)"
                    className="p-1.5 rounded hover:bg-neutral-800 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-[#13A3E5]" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-[11px] text-neutral-400">
              Obsługuje format standardowy oraz <strong className="text-[#13A3E5]">Adobe InDesign Data Merge</strong>: <code className="text-neutral-300 font-mono text-[10px]">@QR_Code,Imie Nazwisko,Stanowisko,tel,mail,tel2</code>
            </p>

            {/* Action Buttons: InDesign Sample & Demo */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
              <a
                href="/sample_indesign.csv"
                download="sample_indesign.csv"
                title="Pobierz wzorcowy plik CSV dla Adobe InDesign"
                className="px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#13A3E5]" />
                <span>Wzorzec InDesign CSV</span>
              </a>

              <button
                type="button"
                onClick={() => handleLoadSample('indesign')}
                title="Wczytaj przykładowe dane testowe InDesign z pliku sample_indesign.csv"
                className="px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#13A3E5]" />
                <span>Wczytaj Demo InDesign</span>
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
                Zgodny z Adobe InDesign (@QR_Code, Imie Nazwisko, Stanowisko, tel, mail, tel2)
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
                  <span className="text-xs font-semibold text-neutral-300">Wklej tekst CSV (lub z Excela)</span>
                  <button
                    type="button"
                    onClick={() => setPasteMode(!pasteMode)}
                    className="text-[11px] text-[#13A3E5] hover:underline cursor-pointer"
                  >
                    {pasteMode ? 'Zwiń pole tekstowe' : 'Otwórz edytor tekstu'}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400">
                  Możesz skopiować kolumny bezpośrednio z arkusza kalkulacyjnego i wkleić poniżej.
                </p>
              </div>

              {pasteMode ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="@QR_Code,Imie Nazwisko,Stanowisko,tel,mail,tel2&#10;QR/1.pdf,Jan Kowalski,Dyrektor,+48 601 234 567,j.kowalski@mptech.pl,+48 71 325 55 55"
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#13A3E5]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPasted}
                    className="w-full py-1.5 rounded-lg bg-[#13A3E5] hover:bg-[#0e8ec9] text-white text-xs font-semibold cursor-pointer"
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

          {/* Batch Data Table & Export Buttons */}
          {batchItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Rekordy ({validCount} z {batchItems.length} poprawnych)
                  </span>
                  {csvFileName && (
                    <span className="text-[10px] font-mono text-[#13A3E5] bg-[#13A3E5]/15 px-2 py-0.5 rounded border border-[#13A3E5]/30">
                      {csvFileName}
                    </span>
                  )}
                </div>

                {/* InDesign and Batch PDF Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Export InDesign CSV */}
                  <button
                    type="button"
                    onClick={handleDownloadInDesignCSV}
                    disabled={validCount === 0}
                    title="Pobierz plik CSV z nagłówkiem @QR_Code,Imie Nazwisko,Stanowisko,tel,mail,tel2"
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#13A3E5]" />
                    <span>Zapisz InDesign CSV</span>
                  </button>

                  {/* Download Full InDesign ZIP Package */}
                  <button
                    type="button"
                    onClick={handleDownloadInDesignZipPackage}
                    disabled={isPackagingZip || validCount === 0}
                    title="Pobierz paczkę ZIP zawierającą plik CSV oraz folder QR z wektorowymi plikami PDF CMYK dla każdego pracownika"
                    className="px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-700/60 text-indigo-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isPackagingZip ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Pakowanie {zipProgress ? `${zipProgress.current}/${zipProgress.total}` : 'ZIP...'}</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Paczka InDesign ZIP (CSV + QR/*.pdf)</span>
                      </>
                    )}
                  </button>

                  {/* Main Batch PDF Action Button */}
                  <button
                    type="button"
                    onClick={handleGenerateBatchPdf}
                    disabled={isGenerating || validCount === 0}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isGenerating ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>Generuj BATCH PDF ({validCount} × 4 str.)</span>
                  </button>
                </div>
              </div>

              {/* Enhanced Table with Individual QR Upload/Download for Each User */}
              <div className="max-h-80 overflow-y-auto border border-neutral-800 rounded-xl bg-neutral-950 custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-900 sticky top-0 z-10 text-[11px] text-neutral-400 border-b border-neutral-800">
                    <tr>
                      <th className="py-2 px-3 font-semibold w-8">#</th>
                      <th className="py-2 px-3 font-semibold">Imię i Nazwisko</th>
                      <th className="py-2 px-3 font-semibold">Stanowisko</th>
                      <th className="py-2 px-3 font-semibold">Telefon</th>
                      <th className="py-2 px-3 font-semibold">E-mail</th>
                      <th className="py-2 px-3 font-semibold">Kod QR Wizytówki</th>
                      <th className="py-2 px-3 font-semibold text-right w-36">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900 font-sans">
                    {batchItems.map((item, idx) => {
                      const isSelected = selectedPreviewId === item.id;
                      const isQrMenuOpen = openQrDownloadRowId === item.id;
                      const isUploadingThis = uploadingRowId === item.id;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-neutral-900/60 transition-colors ${
                            !item.isValid ? 'bg-red-950/20' : isSelected ? 'bg-[#13A3E5]/10' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-neutral-500 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#13A3E5] animate-pulse" />
                              )}
                              <span>{item.fullName || `${item.firstName} ${item.lastName}` || <span className="text-red-400 italic">Brak</span>}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-300 whitespace-nowrap">
                            {item.jobTitle || (
                              <span className="text-red-400 italic">Brak</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-300 font-mono text-[11px] whitespace-nowrap">
                            {item.phone || (
                              <span className="text-red-400 italic">Brak</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                            {item.email || (
                              <span className="text-red-400 italic">Brak</span>
                            )}
                          </td>

                          {/* Individual QR Code Column with Upload & Download capabilities */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* Hidden file input for this specific user */}
                              <input
                                ref={(el) => (rowFileInputRefs.current[item.id] = el)}
                                type="file"
                                accept=".pdf,.svg,.png,.jpg,.jpeg"
                                onChange={(e) => handleCustomQrUploadForPerson(item, e)}
                                className="hidden"
                              />

                              {/* Upload QR icon button for this person */}
                              <button
                                type="button"
                                onClick={() => rowFileInputRefs.current[item.id]?.click()}
                                disabled={isUploadingThis}
                                title="Wczytaj indywidualny plik QR dla tej osoby (PDF, SVG, PNG, JPG)"
                                className={`p-1.5 rounded border transition-colors cursor-pointer ${
                                  item.useCustomQr
                                    ? 'bg-pink-950/60 text-pink-300 border-pink-700/60 hover:bg-pink-900/60'
                                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                                }`}
                              >
                                {isUploadingThis ? (
                                  <RotateCcw className="w-3 h-3 animate-spin text-[#13A3E5]" />
                                ) : (
                                  <Upload className="w-3 h-3 text-[#13A3E5]" />
                                )}
                              </button>

                              {/* Download QR icon dropdown button for this person */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenQrDownloadRowId(isQrMenuOpen ? null : item.id)}
                                  title="Pobierz sam kod QR dla tej osoby (PDF CMYK, SVG, PNG)"
                                  className="p-1.5 rounded bg-neutral-900 text-emerald-400 hover:text-emerald-300 border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                </button>

                                {/* Dropdown menu for downloading this person's QR */}
                                {isQrMenuOpen && (
                                  <div className="absolute left-0 top-full mt-1 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 text-xs backdrop-blur-md animate-in fade-in">
                                    <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800">
                                      Pobierz QR: {item.fullName || 'Wizytówka'}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadSingleQR(item, 'pdf')}
                                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-800 text-white flex items-center justify-between cursor-pointer"
                                    >
                                      <span>PDF (CMYK 0,0,0,100)</span>
                                      <span className="text-[9px] text-pink-400 font-mono">DTP</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadSingleQR(item, 'svg')}
                                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-800 text-white flex items-center justify-between cursor-pointer"
                                    >
                                      <span>SVG (Wektor)</span>
                                      <span className="text-[9px] text-amber-400 font-mono">SVG</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadSingleQR(item, 'png')}
                                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-800 text-white flex items-center justify-between cursor-pointer"
                                    >
                                      <span>PNG (1600×1600 300DPI)</span>
                                      <span className="text-[9px] text-cyan-400 font-mono">PNG</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Status Badge */}
                              {item.useCustomQr ? (
                                <div className="flex items-center gap-1 bg-pink-950/60 border border-pink-800/60 px-1.5 py-0.5 rounded text-[10px] text-pink-300 font-mono">
                                  <span>Plik</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCustomQrForPerson(item)}
                                    title="Usuń wczytany plik i przywróć automatyczny kod QR vCard"
                                    className="hover:text-white ml-0.5 cursor-pointer"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-neutral-500 font-mono text-[10px]">
                                  vCard Auto
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Row Actions: Live Preview on Canvas & Delete */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Live preview on canvas button */}
                              <button
                                type="button"
                                onClick={() => handlePreview(item)}
                                title="Wyświetl tę osobę na podglądzie wizytówki"
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#13A3E5] text-white shadow-sm shadow-[#13A3E5]/30'
                                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800'
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                <span>{isSelected ? 'Aktywny' : 'Podgląd'}</span>
                              </button>

                              {/* Delete row */}
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                title="Usuń z listy batch"
                                className="p-1 rounded-lg bg-neutral-900 hover:bg-red-950 text-neutral-500 hover:text-red-400 border border-neutral-800 transition-colors cursor-pointer"
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

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-400 bg-neutral-950 px-3 py-2 rounded-lg border border-neutral-800">
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-[#13A3E5] shrink-0" />
                  <span>
                    Kody QR generują się automatycznie na podstawie danych z pliku .CSV lub można wgrać własny plik dla każdej osoby z osobna.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBatchItems([])}
                  className="text-neutral-500 hover:text-red-400 text-[10px] underline self-end sm:self-auto shrink-0 cursor-pointer"
                >
                  Wyczyść listę
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
