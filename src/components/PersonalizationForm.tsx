import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  QrCode, 
  RotateCcw, 
  Sliders, 
  Download, 
  FileDown, 
  ChevronDown, 
  Check, 
  Sparkles, 
  Layers, 
  Image as ImageIcon, 
  Lock, 
  Building2, 
  MapPin, 
  Globe 
} from 'lucide-react';
import { ContactData, ExportSettings } from '../types';
import { DEFAULT_CONTACT_DATA } from '../data/sampleTemplates';
import { buildVCard3 } from '../utils/vcard';
import { downloadQrAsCmykPdf, downloadQrAsSvg, downloadQrAsPng } from '../utils/qrExport';
import { generateCompanyEmail } from '../utils/csv';

interface PersonalizationFormProps {
  contactData: ContactData;
  onChangeContactData: (data: ContactData) => void;
  exportSettings: ExportSettings;
  onChangeExportSettings: (settings: ExportSettings) => void;
  onOpenVCard: () => void;
  onNotify?: (message: string) => void;
}

export const PersonalizationForm: React.FC<PersonalizationFormProps> = ({
  contactData,
  onChangeContactData,
  exportSettings,
  onChangeExportSettings,
  onOpenVCard,
  onNotify,
}) => {
  const [isQrMenuOpen, setIsQrMenuOpen] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const qrMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (qrMenuRef.current && !qrMenuRef.current.contains(e.target as Node)) {
        setIsQrMenuOpen(false);
      }
    };
    if (isQrMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isQrMenuOpen]);

  const handleDownloadQR = async (format: 'pdf' | 'svg' | 'png') => {
    const vcard = buildVCard3(contactData);
    const prefix = `QR_${(contactData.firstName || 'Wizytowka')}_${(contactData.lastName || 'vCard')}`.replace(/\s+/g, '_');
    setDownloadingFormat(format);
    try {
      if (format === 'pdf') {
        await downloadQrAsCmykPdf(vcard, prefix, 50);
        if (onNotify) onNotify('Pobrano kod QR w formacie PDF (CMYK 0,0,0,100, wektor DTP 300 DPI)');
      } else if (format === 'svg') {
        await downloadQrAsSvg(vcard, prefix);
        if (onNotify) onNotify('Pobrano kod QR w formacie wektorowym SVG');
      } else if (format === 'png') {
        await downloadQrAsPng(vcard, prefix);
        if (onNotify) onNotify('Pobrano kod QR w formacie PNG (1600×1600 px, 300 DPI)');
      }
      setIsQrMenuOpen(false);
    } catch (e: any) {
      alert(`Błąd pobierania QR: ${e.message}`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const updateField = (key: keyof ContactData, value: string) => {
    onChangeContactData({
      ...contactData,
      [key]: value,
    });
  };

  // Auto-generate email immediately when typing firstName or lastName
  const handleFirstNameChange = (newFirst: string) => {
    const newEmail = generateCompanyEmail(newFirst, contactData.lastName);
    onChangeContactData({
      ...contactData,
      firstName: newFirst,
      email: newEmail || contactData.email,
    });
  };

  const handleLastNameChange = (newLast: string) => {
    const newEmail = generateCompanyEmail(contactData.firstName, newLast);
    onChangeContactData({
      ...contactData,
      lastName: newLast,
      email: newEmail || contactData.email,
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Dane osobowe i kontaktowe pracownika */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#13A3E5]" />
            <span>Dane Personalne Pracownika</span>
          </h3>
          <button
            type="button"
            onClick={() => onChangeContactData(DEFAULT_CONTACT_DATA)}
            title="Przywróć domyślne dane: Jan Kowalski"
            className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-[#13A3E5]" />
            <span>Domyślnie: Jan Kowalski</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-neutral-400 block mb-1">Imię</label>
            <input
              type="text"
              value={contactData.firstName}
              onChange={(e) => handleFirstNameChange(e.target.value)}
              placeholder="np. Jan"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#13A3E5] transition-colors"
            />
          </div>
          <div>
            <label className="text-neutral-400 block mb-1">Nazwisko</label>
            <input
              type="text"
              value={contactData.lastName}
              onChange={(e) => handleLastNameChange(e.target.value)}
              placeholder="np. Kowalski"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#13A3E5] transition-colors"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-neutral-400 block mb-1">Stanowisko / Tytuł zawodowy</label>
            <input
              type="text"
              value={contactData.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
              placeholder="np. Dyrektor Handlowy"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#13A3E5] transition-colors"
            />
          </div>

          {/* Bezpośrednie kanały kontaktu */}
          <div>
            <label className="text-neutral-400 block mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3 text-emerald-400" />
              <span>Telefon Główny (tel)</span>
            </label>
            <input
              type="text"
              value={contactData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+48 601 234 567"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#13A3E5] transition-colors"
            />
          </div>
          <div>
            <label className="text-neutral-400 block mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3 text-teal-400" />
              <span>Telefon Komórkowy (tel2)</span>
            </label>
            <input
              type="text"
              value={contactData.phoneMobile || ''}
              onChange={(e) => updateField('phoneMobile', e.target.value)}
              placeholder="+48 71 325 55 55"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#13A3E5] transition-colors"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-neutral-400 flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#13A3E5]" />
                <span>Adres E-mail</span>
              </label>
              <span className="text-[10px] text-neutral-500 font-mono">
                Auto: imie.nazwisko@mptech.eu
              </span>
            </div>
            <input
              type="email"
              value={contactData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="jan.kowalski@mptech.eu"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#13A3E5] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 2. Zablokowane Dane Stałe Firmy i NIP (Subtelna kłódka bez krzykliwych napisów) */}
      <div className="bg-neutral-950/80 border border-neutral-850 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-300">
              Dane Stałe Firmy & NIP
            </span>
          </div>
          <div title="Edycja w zakładce Ustawienia" className="text-neutral-500 hover:text-neutral-400 transition-colors p-1">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-400 bg-neutral-900/50 p-2.5 rounded-lg border border-neutral-800/60 font-mono">
          <div>
            <span className="text-neutral-500 block text-[10px]">Firma:</span>
            <span className="text-neutral-300 font-medium truncate block">{contactData.company || 'Brak'}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">NIP:</span>
            <span className="text-neutral-300 font-medium truncate block">{contactData.nip || 'Brak'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-neutral-500 block text-[10px]">Adres:</span>
            <span className="text-neutral-400 truncate block">
              {contactData.address || `${contactData.street || ''}, ${contactData.zip || ''} ${contactData.city || ''}`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Moduł Podgląd vCard 3.0 / Kod QR z opcją pobrania */}
      <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#13A3E5]/15 text-[#13A3E5] rounded-lg border border-[#13A3E5]/30 shrink-0">
            <QrCode className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-white block">vCard 3.0 Skompilowany</span>
            <span className="text-[11px] text-neutral-400 font-mono truncate block">
              {contactData.firstName} {contactData.lastName} | {contactData.phone || contactData.email}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* Przycisk Podgląd vCard */}
          <button
            type="button"
            onClick={onOpenVCard}
            className="px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>Podgląd vCard</span>
          </button>

          {/* Przycisk i menu Pobierz QR */}
          <div className="relative" ref={qrMenuRef}>
            <button
              type="button"
              onClick={() => setIsQrMenuOpen(!isQrMenuOpen)}
              title="Pobierz sam kod QR w wybranym formacie (PDF CMYK, SVG, PNG)"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#13A3E5] hover:bg-[#0e8ec9] border border-[#13A3E5]/40 rounded-lg transition-all cursor-pointer shadow-sm shadow-[#13A3E5]/25 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pobierz QR</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isQrMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isQrMenuOpen && (
              <div className="absolute right-0 bottom-full sm:bottom-auto sm:top-full mb-1 sm:mb-0 sm:mt-1.5 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 backdrop-blur-md">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 mb-1">
                  Formaty pliku kodu QR:
                </div>

                {/* 1. PDF (CMYK 0,0,0,100) */}
                <button
                  type="button"
                  onClick={() => handleDownloadQR('pdf')}
                  disabled={downloadingFormat !== null}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-start gap-2.5 text-xs cursor-pointer group"
                >
                  <div className="p-1.5 bg-red-950/60 border border-red-800/60 text-red-400 rounded group-hover:border-red-600 shrink-0 mt-0.5">
                    <FileDown className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>PDF (CMYK 0,0,0,100)</span>
                      <span className="text-[9px] bg-neutral-800 text-neutral-300 font-mono px-1 py-0.2 rounded">DTP</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                      Czysta czerń 100% K, wektor, 300 DPI, gotowy do druku i DTP
                    </p>
                  </div>
                </button>

                {/* 2. SVG Vector */}
                <button
                  type="button"
                  onClick={() => handleDownloadQR('svg')}
                  disabled={downloadingFormat !== null}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-start gap-2.5 text-xs cursor-pointer group"
                >
                  <div className="p-1.5 bg-amber-950/60 border border-amber-800/60 text-amber-400 rounded group-hover:border-amber-600 shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>SVG (Wektor)</span>
                      <span className="text-[9px] bg-neutral-800 text-neutral-300 font-mono px-1 py-0.2 rounded">Vector</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                      Nieskończone skalowanie, idealne do programów graficznych
                    </p>
                  </div>
                </button>

                {/* 3. PNG (1600x1600, 300 DPI) */}
                <button
                  type="button"
                  onClick={() => handleDownloadQR('png')}
                  disabled={downloadingFormat !== null}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-start gap-2.5 text-xs cursor-pointer group"
                >
                  <div className="p-1.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 rounded group-hover:border-emerald-600 shrink-0 mt-0.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>PNG (1600×1600 px)</span>
                      <span className="text-[9px] bg-neutral-800 text-neutral-300 font-mono px-1 py-0.2 rounded">300 DPI</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                      Ultra wysoka rozdzielczość z metadanymi 300 DPI
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Opcje Eksportu Produkcyjnego PDF */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
          Opcje Eksportu Produkcyjnego PDF
        </h3>

        <div className="space-y-2.5 text-xs">
          {/* Bleed 3mm */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportSettings.useBleed}
              onChange={(e) =>
                onChangeExportSettings({ ...exportSettings, useBleed: e.target.checked })
              }
              className="w-4 h-4 rounded text-[#13A3E5] accent-[#13A3E5] focus:ring-[#13A3E5] bg-neutral-950 border-neutral-700 cursor-pointer"
            />
            <span className="text-white font-medium">Dodaj spady 3 mm (wymiary powiększone o +6 mm na format brutto)</span>
          </label>

          {/* 4 pages UV */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportSettings.addUVPage}
              onChange={(e) =>
                onChangeExportSettings({ ...exportSettings, addUVPage: e.target.checked })
              }
              className="w-4 h-4 rounded text-[#13A3E5] accent-[#13A3E5] focus:ring-[#13A3E5] bg-neutral-950 border-neutral-700 cursor-pointer"
            />
            <span className="text-neutral-300">
              Generuj 4 strony PDF (Strona 1-2: Druk CMYK, Strona 3-4: Maska UV M=100)
            </span>
          </label>

          {/* Crop marks */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportSettings.addCropMarks}
              onChange={(e) =>
                onChangeExportSettings({ ...exportSettings, addCropMarks: e.target.checked })
              }
              className="w-4 h-4 rounded text-[#13A3E5] accent-[#13A3E5] focus:ring-[#13A3E5] bg-neutral-950 border-neutral-700 cursor-pointer"
            />
            <span className="text-neutral-300">Dodaj pasery i znaczniki cięcia na krawędziach spadów</span>
          </label>
        </div>
      </div>
    </div>
  );
};
