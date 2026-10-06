import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Type, 
  QrCode, 
  Move, 
  Palette, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Copy,
  ChevronDown, 
  ChevronUp,
  Layers, 
  Save, 
  Check, 
  RotateCcw, 
  Globe, 
  MapPin, 
  Building2, 
  LayoutTemplate, 
  UploadCloud, 
  FileSpreadsheet, 
  FolderDown, 
  Settings,
  Sliders,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { BusinessCardTemplate, CardField, TextFieldConfig, QRCodeFieldConfig, CMYKColor, FontWeight, TextAlignment, ContactData, ExportSettings } from '../types';
import { BatchProcessor } from './BatchProcessor';
import { SavedConfigsManager } from './SavedConfigsManager';
import { FieldModuleCard } from './FieldModuleCard';

interface TemplateEditorProps {
  template: BusinessCardTemplate;
  onUpdateTemplate: (template: BusinessCardTemplate, customMsg?: string) => void;
  templates?: BusinessCardTemplate[];
  onSelectTemplate?: (template: BusinessCardTemplate) => void;
  onOpenUpload?: () => void;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  activeSide: 'front' | 'back';
  onSaveTemplate?: () => void;
  onResetTemplate?: () => void;
  onNotify?: (message: string) => void;
  contactData?: ContactData;
  onChangeContactData?: (data: ContactData) => void;
  exportSettings?: ExportSettings;
  onLoadFullConfig?: (config: { template: BusinessCardTemplate; contactData: ContactData; exportSettings?: ExportSettings }) => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onUpdateTemplate,
  templates,
  onSelectTemplate,
  onOpenUpload,
  selectedFieldId,
  onSelectField,
  activeSide,
  onSaveTemplate,
  onResetTemplate,
  onNotify,
  contactData,
  onChangeContactData,
  exportSettings,
  onLoadFullConfig,
}) => {
  const [justSaved, setJustSaved] = useState(false);
  
  // Default states: All modules collapsed except Company Data (Dane stałe firmy)
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isSavedConfigsOpen, setIsSavedConfigsOpen] = useState(false);
  const [expandedFieldIds, setExpandedFieldIds] = useState<string[]>([]);
  const [isTemplateInfoOpen, setIsTemplateInfoOpen] = useState(false);
  const [isDimensionsOpen, setIsDimensionsOpen] = useState(false);
  const [isCompanyDataOpen, setIsCompanyDataOpen] = useState(true);

  const currentFields = template.fields.filter((f) => f.side === activeSide);

  // When selectedFieldId changes from external sources (e.g. clicking canvas), auto-expand that module
  useEffect(() => {
    if (selectedFieldId && !expandedFieldIds.includes(selectedFieldId)) {
      setExpandedFieldIds((prev) => [...prev, selectedFieldId]);
    }
  }, [selectedFieldId]);

  const toggleFieldExpand = (fieldId: string) => {
    setExpandedFieldIds((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const expandAllModules = () => {
    setExpandedFieldIds(currentFields.map((f) => f.id));
    setIsBatchOpen(true);
    setIsSavedConfigsOpen(true);
    setIsCompanyDataOpen(true);
    setIsDimensionsOpen(true);
    setIsTemplateInfoOpen(true);
  };

  const collapseAllModules = () => {
    setExpandedFieldIds([]);
    setIsBatchOpen(false);
    setIsSavedConfigsOpen(false);
    setIsCompanyDataOpen(false);
    setIsDimensionsOpen(false);
    setIsTemplateInfoOpen(false);
  };

  const handleManualSave = () => {
    if (onSaveTemplate) {
      onSaveTemplate();
    } else {
      onUpdateTemplate({ ...template });
      if (onNotify) {
        onNotify('Ustawienia szablonu zostały zapisane w pamięci i będą wczytywane przy każdym starcie.');
      }
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  // Add new Text field
  const handleAddTextField = () => {
    const newField: TextFieldConfig = {
      id: `text_${Date.now()}`,
      name: 'Nowe pole tekstowe',
      type: 'text',
      side: activeSide,
      defaultValue: 'Nowy tekst',
      bindKey: '',
      x: 10,
      y: 10 + currentFields.length * 6,
      w: 40,
      h: 5,
      fontFamily: 'Montserrat',
      fontWeight: 'medium',
      fontSize: 8,
      lineHeight: 1.2,
      align: 'left',
      colorCMYK: [0, 0, 0, 100],
      useUV: false,
    };
    onUpdateTemplate({
      ...template,
      fields: [...template.fields, newField],
    });
    onSelectField(newField.id);
    setExpandedFieldIds((prev) => [...prev, newField.id]);
  };

  // Add new QR Code field
  const handleAddQrField = () => {
    const newField: QRCodeFieldConfig = {
      id: `qr_${Date.now()}`,
      name: 'Kod QR vCard',
      type: 'qr',
      side: activeSide,
      x: template.widthNetto - 25,
      y: template.heightNetto - 25,
      w: 18,
      h: 18,
      useUV: true,
      source: 'vcard',
      qrScale: 100,
      darkColorCMYK: [0, 0, 0, 100],
      lightColorCMYK: [0, 0, 0, 0],
      errorCorrection: 'H',
    };
    onUpdateTemplate({
      ...template,
      fields: [...template.fields, newField],
    });
    onSelectField(newField.id);
    setExpandedFieldIds((prev) => [...prev, newField.id]);
  };

  // Update specific field properties
  const handleUpdateField = (fieldId: string, updates: Partial<CardField>) => {
    const updatedFields = template.fields.map((f) => {
      if (f.id === fieldId) {
        return { ...f, ...updates } as CardField;
      }
      return f;
    });
    onUpdateTemplate({
      ...template,
      fields: updatedFields,
    });
  };

  // Remove field
  const handleRemoveField = (fieldId: string) => {
    const updatedFields = template.fields.filter((f) => f.id !== fieldId);
    onUpdateTemplate({
      ...template,
      fields: updatedFields,
    });
    if (selectedFieldId === fieldId) {
      onSelectField(null);
    }
    setExpandedFieldIds((prev) => prev.filter((id) => id !== fieldId));
  };

  // Duplicate field
  const handleDuplicateField = (field: CardField) => {
    const newField: CardField = {
      ...field,
      id: `${field.type}_${Date.now()}`,
      name: `${field.name} (Kopia)`,
      x: Math.min(template.widthNetto - field.w, field.x + 2),
      y: Math.min(template.heightNetto - field.h, field.y + 2),
    };
    onUpdateTemplate({
      ...template,
      fields: [...template.fields, newField],
    });
    onSelectField(newField.id);
    setExpandedFieldIds((prev) => [...prev, newField.id]);
  };

  return (
    <div className="space-y-4">
      {/* 0. Top Global Module Controls */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#13A3E5]" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Narzędzia Modułów
          </span>
        </div>

        {/* Global Expand & Collapse All Modules Buttons at top of Settings tab */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={collapseAllModules}
            title="Zwiń wszystkie moduły w ustawieniach"
            className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Minimize2 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Zwiń moduły</span>
          </button>

          <button
            type="button"
            onClick={expandAllModules}
            title="Rozwiń wszystkie moduły w ustawieniach"
            className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#13A3E5]" />
            <span>Rozwiń moduły</span>
          </button>
        </div>
      </div>

      {/* 1. Generator Seryjny (Batch CSV & Adobe InDesign) - Zwijany moduł */}
      <BatchProcessor
        template={template}
        baseContactData={contactData || {
          firstName: '',
          lastName: '',
          jobTitle: '',
          company: 'MPTech Sp. z o.o.',
          office: 'Biuro / Office',
          phone: '+48 71 325 55 55',
          email: 'kontakt@mptech.pl',
          website: 'www.mptech.pl',
          street: 'ul. Krakowska 119',
          zip: '50-428',
          city: 'Wrocław',
          country: 'Polska',
          nip: '899-273-12-88',
        }}
        exportSettings={exportSettings}
        isOpen={isBatchOpen}
        onToggleOpen={() => setIsBatchOpen(!isBatchOpen)}
        onPreviewPerson={(personData) => {
          if (onChangeContactData) {
            onChangeContactData(personData);
          }
        }}
        onNotify={onNotify}
      />

      {/* 2. Zapisywanie Konfiguracji (Katalog saved_configs) - Zwijany moduł */}
      <SavedConfigsManager
        currentTemplate={template}
        currentContactData={contactData || {
          firstName: '',
          lastName: '',
          jobTitle: '',
          company: 'MPTech Sp. z o.o.',
          phone: '+48 71 325 55 55',
          email: 'kontakt@mptech.pl',
          website: 'www.mptech.pl',
          street: 'ul. Krakowska 119',
          zip: '50-428',
          city: 'Wrocław',
          country: 'Polska',
        }}
        currentExportSettings={exportSettings}
        isOpen={isSavedConfigsOpen}
        onToggleOpen={() => setIsSavedConfigsOpen(!isSavedConfigsOpen)}
        onLoadConfig={(fullCfg) => {
          if (onLoadFullConfig) {
            onLoadFullConfig(fullCfg);
          } else {
            if (fullCfg.template) onUpdateTemplate(fullCfg.template, 'Wczytano szablon z pliku konfiguracyjnego.');
            if (fullCfg.contactData && onChangeContactData) onChangeContactData(fullCfg.contactData);
          }
        }}
        onNotify={onNotify}
      />

      {/* 3. Dane Kontaktowe i Stałe Firmy (Siedziba, NIP, WWW) - Domyślnie ROZWINIĘTE */}
      {contactData && onChangeContactData && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 transition-all">
          <div 
            onClick={() => setIsCompanyDataOpen(!isCompanyDataOpen)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-pink-400" />
              <span>Dane Kontaktowe i Stałe Firmy (Siedziba, NIP, WWW)</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
                Wyłączne miejsce edycji NIP i adresu
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isCompanyDataOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {isCompanyDataOpen && (
            <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-3 text-xs animate-in fade-in">
              {/* Website & NIP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-indigo-400" />
                    <span>Adres Strony WWW</span>
                  </label>
                  <input
                    type="text"
                    value={contactData.website}
                    onChange={(e) => onChangeContactData({ ...contactData, website: e.target.value })}
                    placeholder="www.mptech.eu"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">NIP Firmy</label>
                  <input
                    type="text"
                    value={contactData.nip || ''}
                    onChange={(e) => onChangeContactData({ ...contactData, nip: e.target.value })}
                    placeholder="8951845043"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
              </div>

              {/* Address Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Dział / Biuro (Office)</label>
                  <input
                    type="text"
                    value={contactData.office || ''}
                    onChange={(e) => onChangeContactData({ ...contactData, office: e.target.value })}
                    placeholder="Biuro/Office:"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Kraj</label>
                  <input
                    type="text"
                    value={contactData.country}
                    onChange={(e) => onChangeContactData({ ...contactData, country: e.target.value })}
                    placeholder="Poland"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Kod i Miasto</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={contactData.zip}
                      onChange={(e) => onChangeContactData({ ...contactData, zip: e.target.value })}
                      placeholder="50-428"
                      className="w-20 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-pink-500 transition-colors"
                    />
                    <input
                      type="text"
                      value={contactData.city}
                      onChange={(e) => onChangeContactData({ ...contactData, city: e.target.value })}
                      placeholder="Wrocław"
                      className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-pink-400" />
                  <span>Ulica i numer</span>
                </label>
                <input
                  type="text"
                  value={contactData.street}
                  onChange={(e) => onChangeContactData({ ...contactData, street: e.target.value })}
                  placeholder="ul. Krakowska 119"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1 flex items-center justify-between">
                  <span>Sformatowany blok adresu (wieloliniowy na wizytówce)</span>
                  <span className="text-[10px] text-neutral-500 font-mono">Przejścia do nowej linii zachowane</span>
                </label>
                <textarea
                  rows={2}
                  value={contactData.address || ''}
                  onChange={(e) => onChangeContactData({ ...contactData, address: e.target.value })}
                  placeholder="Biuro/Office:&#10;ul. Krakowska 119, 50-428 Wrocław, Poland"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Moduły i Warstwy do edycji */}
      <div className="space-y-3">
        {/* Field Actions Toolbar */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#13A3E5]" />
              <span>
                Moduły i Ramki: <span className="text-white">{activeSide === 'front' ? 'Awers (Przód)' : 'Rewers (Tył)'}</span> ({currentFields.length})
              </span>
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Kliknij moduł, aby rozwinąć jego szczegółowe pola edycji.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddTextField}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium border border-neutral-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#13A3E5]" />
              <span>Dodaj Tekst</span>
            </button>
            <button
              type="button"
              onClick={handleAddQrField}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium border border-neutral-700 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#13A3E5]" />
              <span>Dodaj QR vCard</span>
            </button>
          </div>
        </div>

        {/* Expandable Field Modules List */}
        {currentFields.length === 0 ? (
          <div className="p-8 text-center bg-neutral-950 border border-neutral-800/80 rounded-xl text-neutral-400 text-xs">
            <Layers className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-neutral-300">Brak modułów na tej stronie ({activeSide === 'front' ? 'Awers' : 'Rewers'})</p>
            <p className="text-[11px] text-neutral-500 mt-1">Użyj przycisków powyżej, aby dodać pole tekstowe lub kod QR vCard.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {currentFields.map((field) => (
              <FieldModuleCard
                key={field.id}
                field={field}
                isSelected={field.id === selectedFieldId}
                isExpanded={expandedFieldIds.includes(field.id)}
                onToggleExpand={() => toggleFieldExpand(field.id)}
                onSelect={() => onSelectField(field.id)}
                onUpdate={(updates) => handleUpdateField(field.id, updates)}
                onDuplicate={() => handleDuplicateField(field)}
                onRemove={() => handleRemoveField(field.id)}
                templateWidth={template.widthNetto}
                templateHeight={template.heightNetto}
              />
            ))}
          </div>
        )}
      </div>

      {/* 5. Template Selection & Info Card (Zwijany moduł) */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 transition-all">
        <div 
          onClick={() => setIsTemplateInfoOpen(!isTemplateInfoOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5 text-[#13A3E5]" />
            <span>Szablon Wizytówki i Podkład Master PDF</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#13A3E5] bg-[#13A3E5]/15 border border-[#13A3E5]/30 px-2 py-0.5 rounded font-mono font-medium">
              {template.category || 'Oficjalny szablon'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isTemplateInfoOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {isTemplateInfoOpen && (
          <div className="mt-3 pt-3 border-t border-neutral-800/80 animate-in fade-in">
            {templates && templates.length > 1 ? (
              <div className="space-y-2">
                <select
                  value={template.id}
                  onChange={(e) => {
                    const found = templates.find((t) => t.id === e.target.value);
                    if (found && onSelectTemplate) onSelectTemplate(found);
                  }}
                  className="w-full bg-neutral-950 border border-neutral-700 text-xs text-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#13A3E5] cursor-pointer font-medium"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.widthNetto}×{t.heightNetto} mm)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-400">{template.description}</p>
              </div>
            ) : (
              <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-sm text-white block">{template.name}</span>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{template.description}</p>
                  {template.masterPdfFileName && (
                    <div className="mt-2 text-[10px] text-neutral-400 flex items-center gap-1.5 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Podkład Master: {template.masterPdfFileName} ({template.masterPdfPageCount || 4} str.)</span>
                    </div>
                  )}
                </div>
                {onOpenUpload && (
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    title="Wgraj nowy plik szablonu Master PDF lub czcionki"
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 shrink-0 self-start sm:self-center transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#13A3E5]" />
                    <span>Wgraj PDF/Font</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Template Dimensions & Baseline Settings (Zwijany moduł) */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 transition-all">
        <div
          onClick={() => setIsDimensionsOpen(!isDimensionsOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#13A3E5]" />
            <span>Wymiary Netto, Spady i Linie Bazowe</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#13A3E5] bg-[#13A3E5]/15 px-2 py-0.5 rounded border border-[#13A3E5]/30 font-medium">
              {template.widthNetto}×{template.heightNetto} mm
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isDimensionsOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {isDimensionsOpen && (
          <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-3 animate-in fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Szerokość (mm)</label>
                <input
                  type="number"
                  value={template.widthNetto}
                  onChange={(e) =>
                    onUpdateTemplate({ ...template, widthNetto: parseFloat(e.target.value) || 90 })
                  }
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#13A3E5]"
                />
              </div>
              <div>
                <label className="text-neutral-400 block mb-1">Wysokość (mm)</label>
                <input
                  type="number"
                  value={template.heightNetto}
                  onChange={(e) =>
                    onUpdateTemplate({ ...template, heightNetto: parseFloat(e.target.value) || 50 })
                  }
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#13A3E5]"
                />
              </div>
              <div>
                <label className="text-neutral-400 block mb-1">Spad drukarski (mm)</label>
                <input
                  type="number"
                  value={template.bleedMm}
                  onChange={(e) =>
                    onUpdateTemplate({ ...template, bleedMm: parseFloat(e.target.value) || 3 })
                  }
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#13A3E5]"
                />
              </div>
              <div>
                <label className="text-neutral-400 block mb-1">Strefa bezpieczna (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={template.safeZoneMm}
                  onChange={(e) =>
                    onUpdateTemplate({ ...template, safeZoneMm: parseFloat(e.target.value) || 2.5 })
                  }
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#13A3E5]"
                />
              </div>
            </div>

            {/* Quick format presets */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
              <span className="text-[11px] text-neutral-500 self-center">Formaty standardowe:</span>
              <button
                type="button"
                onClick={() => onUpdateTemplate({ ...template, widthNetto: 90, heightNetto: 50 })}
                className={`px-2.5 py-1 text-xs rounded border transition-all cursor-pointer ${
                  template.widthNetto === 90 && template.heightNetto === 50
                    ? 'bg-[#13A3E5]/20 text-[#13A3E5] border-[#13A3E5]'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                90 × 50 mm (PL Standard)
              </button>
              <button
                type="button"
                onClick={() => onUpdateTemplate({ ...template, widthNetto: 85, heightNetto: 55 })}
                className={`px-2.5 py-1 text-xs rounded border transition-all cursor-pointer ${
                  template.widthNetto === 85 && template.heightNetto === 55
                    ? 'bg-[#13A3E5]/20 text-[#13A3E5] border-[#13A3E5]'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                85 × 55 mm (Euro Standard)
              </button>
            </div>

            {/* Text baseline guides option */}
            <div className="pt-3 mt-3 border-t border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${template.showBaselines ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-neutral-600'}`} />
                <div>
                  <span className="text-xs font-semibold text-neutral-200">Podgląd linii bazowej tekstu (Baseline Guides)</span>
                  <p className="text-[11px] text-neutral-400">Rysuj zieloną linię na szerokość całej strony dla ramek tekstowych</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!template.showBaselines}
                  onChange={(e) =>
                    onUpdateTemplate({ ...template, showBaselines: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 7. Save Settings & Persistence Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Ustawienia Bieżące
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
              Pamięć przeglądarki
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Wprowadzone pozycje i warstwy UV są zapamiętywane i wczytywane przy każdym uruchomieniu.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onResetTemplate && (
            <button
              type="button"
              onClick={onResetTemplate}
              title="Przywróć domyślne parametry szablonu"
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Domyślny</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleManualSave}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
              justSaved
                ? 'bg-emerald-600 text-white shadow-emerald-900/50'
                : 'bg-[#13A3E5] hover:bg-[#0e8ec9] text-white shadow-[#13A3E5]/25 border border-[#13A3E5]/40'
            }`}
          >
            {justSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Zapisano!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Zapisz ustawienia</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
