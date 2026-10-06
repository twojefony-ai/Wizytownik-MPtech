import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CardCanvas } from './components/CardCanvas';
import { TemplateEditor } from './components/TemplateEditor';
import { PersonalizationForm } from './components/PersonalizationForm';
import { PreflightInspector } from './components/PreflightInspector';
import { UploadModal } from './components/UploadModal';
import { VCardModal } from './components/VCardModal';
import { SAMPLE_TEMPLATES, DEFAULT_CONTACT_DATA } from './data/sampleTemplates';
import { BusinessCardTemplate, ContactData, ExportSettings, CardSide } from './types';
import { runPreflightCheck } from './utils/preflight';
import { 
  Download, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  RotateCw,
  Printer,
  FileCheck
} from 'lucide-react';

const STORAGE_KEY_TEMPLATES = 'dtp_business_card_templates_v4';
const STORAGE_KEY_SELECTED_ID = 'dtp_selected_template_id_v4';

const loadInitialTemplates = (): BusinessCardTemplate[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => {
          if (t.id === 'mptech-official-90x50') {
            const official = SAMPLE_TEMPLATES.find((st) => st.id === 'mptech-official-90x50');
            if (official) {
              return {
                ...t,
                safeZoneMm: official.safeZoneMm,
                fields: t.fields.map((f) =>
                  f.id === 'f_qr' ? { ...f, y: 2.5, w: 15.5, h: 15.5 } : f
                ),
                masterPdfFileName: official.masterPdfFileName,
                masterPdfPreviews: official.masterPdfPreviews,
                masterPdfPageCount: official.masterPdfPageCount,
              };
            }
          }
          return t;
        });
      }
    }
  } catch (e) {
    console.error('Failed to load templates from localStorage', e);
  }
  return SAMPLE_TEMPLATES;
};

const loadInitialSelectedTemplate = (initialTemplates: BusinessCardTemplate[]): BusinessCardTemplate => {
  try {
    const selectedId = localStorage.getItem(STORAGE_KEY_SELECTED_ID);
    if (selectedId) {
      const found = initialTemplates.find((t) => t.id === selectedId);
      if (found) return found;
    }
  } catch (e) {
    console.error('Failed to load selected template id from localStorage', e);
  }
  return initialTemplates[0];
};

export default function App() {
  const [templates, setTemplates] = useState<BusinessCardTemplate[]>(() => loadInitialTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState<BusinessCardTemplate>(() => {
    const initial = loadInitialTemplates();
    return loadInitialSelectedTemplate(initial);
  });
  const [contactData, setContactData] = useState<ContactData>(() => {
    try {
      const saved = localStorage.getItem('dtp_contact_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CONTACT_DATA;
  });

  useEffect(() => {
    try {
      localStorage.setItem('dtp_contact_data', JSON.stringify(contactData));
    } catch (e) {
      console.error(e);
    }
  }, [contactData]);

  // Update/verify preview images upon startup for templates with Master PDF
  useEffect(() => {
    const refreshStartupPreviews = async () => {
      if (selectedTemplate.masterPdfFileName) {
        try {
          const res = await fetch(`/api/template-previews/${selectedTemplate.masterPdfFileName}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.previewUrls) {
              setSelectedTemplate((prev) => ({
                ...prev,
                masterPdfPreviews: data.previewUrls,
                masterPdfPageCount: data.pageCount || prev.masterPdfPageCount,
              }));
            }
          }
        } catch (e) {
          console.error('Failed to update startup previews', e);
        }
      }
    };
    refreshStartupPreviews();
  }, []);

  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    useBleed: true,
    bleedMm: 3,
    addCropMarks: false, // Odznaczone domyślnie
    addUVPage: true,
    dpi: 300,
  });

  const [activeTab, setActiveTab] = useState<'personalize' | 'template' | 'preflight'>('personalize');
  const [activeSide, setActiveSide] = useState<CardSide>('front');
  const [viewMode, setViewMode] = useState<'composite' | 'uv_shine' | 'uv_mask' | 'dtp_marks'>('composite');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVCardOpen, setIsVCardOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  const showNotification = (message: string) => {
    setNotification({ type: 'success', message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 3000);
  };

  const preflightReport = runPreflightCheck(selectedTemplate, contactData);
  const issueCount = preflightReport.issues.filter((i) => i.type === 'error' || i.type === 'warning').length;

  const handleUpdateTemplate = (updated: BusinessCardTemplate, customMsg?: string) => {
    setSelectedTemplate(updated);
    setTemplates((prev) => {
      const updatedList = prev.map((t) => (t.id === updated.id ? updated : t));
      try {
        localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(updatedList));
        localStorage.setItem(STORAGE_KEY_SELECTED_ID, updated.id);
      } catch (e) {
        console.error('Failed to save templates to localStorage', e);
      }
      return updatedList;
    });
    showNotification(customMsg || 'Ustawienia szablonu zaktualizowane i zapisane w pamięci.');
  };

  const handleSaveTemplate = () => {
    try {
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
      localStorage.setItem(STORAGE_KEY_SELECTED_ID, selectedTemplate.id);
      showNotification('Ustawienia szablonu zostały pomyślnie zapisane! Będą wczytywane przy każdym uruchomieniu.');
    } catch (e) {
      showNotification('Wystąpił błąd podczas zapisu w pamięci przeglądarki.');
    }
  };

  const handleResetTemplate = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_TEMPLATES);
      localStorage.removeItem(STORAGE_KEY_SELECTED_ID);
    } catch (e) {
      console.error(e);
    }
    setTemplates(SAMPLE_TEMPLATES);
    setSelectedTemplate(SAMPLE_TEMPLATES[0]);
    showNotification('Przywrócono domyślne parametry szablonu.');
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setExportSuccessMessage(null);

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate,
          contactData,
          settings: exportSettings,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Błąd serwera (${response.status})`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error) errMsg = parsed.error;
        } catch {
          if (errText) errMsg = errText.replace(/<[^>]*>?/gm, '').trim().slice(0, 150);
        }
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const bleedSuffix = exportSettings.useBleed ? `_spad${exportSettings.bleedMm || selectedTemplate.bleedMm || 3}mm` : '_bezSpadow';
      a.download = `Wizytowka_${selectedTemplate.widthNetto}x${selectedTemplate.heightNetto}mm_${contactData.lastName || 'Produkcja'}${bleedSuffix}_4strony_UV.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportSuccessMessage('Wygenerowano 4-stronicowy produkcyjny plik PDF (CMYK + Maska UV M=100) w 300 DPI.');
      setTimeout(() => setExportSuccessMessage(null), 6000);
    } catch (err: any) {
      alert(`Błąd eksportu: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLoadFullConfig = (cfg: { template: BusinessCardTemplate; contactData: ContactData; exportSettings?: ExportSettings }) => {
    if (cfg.template) {
      setSelectedTemplate(cfg.template);
      setTemplates((prev) => prev.map((t) => (t.id === cfg.template.id ? cfg.template : t)));
    }
    if (cfg.contactData) {
      setContactData(cfg.contactData);
    }
    if (cfg.exportSettings) {
      setExportSettings(cfg.exportSettings);
    }
    setSelectedFieldId(null);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-fuchsia-600 selection:text-white">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportPdf={handleExportPdf}
        isExporting={isExporting}
        activeSide={activeSide}
        setActiveSide={setActiveSide}
        viewMode={viewMode}
        setViewMode={setViewMode}
        preflightIssueCount={issueCount}
      />

      {/* Dynamic Floating Toast Notification Overlay (Never shifts modules/layout) */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-lg w-full px-4 animate-in fade-in slide-in-from-top-3">
          <div className="bg-emerald-950/95 border border-emerald-500/70 text-emerald-200 px-4 py-2.5 text-xs rounded-xl flex items-center justify-between gap-3 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white truncate">{notification.message}</span>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-emerald-400 hover:text-white p-1 rounded hover:bg-emerald-900/60 transition-colors cursor-pointer text-xs shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Export Success Notification Floating Banner */}
      {exportSuccessMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-lg w-full px-4 animate-in fade-in slide-in-from-top-3">
          <div className="bg-emerald-950/95 border border-emerald-500/70 text-emerald-200 px-4 py-2.5 text-xs rounded-xl flex items-center justify-between gap-3 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white truncate">{exportSuccessMessage}</span>
            </div>
            <button 
              onClick={() => setExportSuccessMessage(null)}
              className="text-emerald-400 hover:text-white p-1 rounded hover:bg-emerald-900/60 transition-colors cursor-pointer text-xs shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Column: Live Visual Canvas & DTP Simulation (7 cols) - Sticky so it stays visible while scrolling during text edit */}
        <div className="lg:col-span-7 flex flex-col items-center sticky top-20 z-20">
          <div className="w-full">
            <CardCanvas
              template={selectedTemplate}
              contactData={contactData}
              onChangeContactData={setContactData}
              activeSide={activeSide}
              setActiveSide={setActiveSide}
              selectedFieldId={selectedFieldId}
              onSelectField={setSelectedFieldId}
              viewMode={viewMode}
              setViewMode={setViewMode}
              useBleed={exportSettings.useBleed}
              onUpdateTemplate={handleUpdateTemplate}
              onNotify={showNotification}
              isInSettingsTab={activeTab === 'template'}
            />

            {/* Quick Overview Badges */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-xl">
                <span className="text-[10px] text-neutral-400 uppercase block font-mono">Format Netto</span>
                <span className="font-bold text-white font-mono">
                  {selectedTemplate.widthNetto} × {selectedTemplate.heightNetto} mm
                </span>
              </div>

              <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-xl">
                <span className="text-[10px] text-neutral-400 uppercase block font-mono">Spad Drukarski</span>
                <span className="font-bold text-pink-400 font-mono">
                  {exportSettings.useBleed ? `+${selectedTemplate.bleedMm * 2} mm (${selectedTemplate.bleedMm}mm/bok)` : 'Brak'}
                </span>
              </div>

              <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-xl">
                <span className="text-[10px] text-neutral-400 uppercase block font-mono">Lakier UV Wybiórczy</span>
                <span className="font-bold text-fuchsia-400 font-mono">
                  M=100 (Strona 2 i 4)
                </span>
              </div>

              <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-xl">
                <span className="text-[10px] text-neutral-400 uppercase block font-mono">Kolejność Stron</span>
                <span className="font-bold text-cyan-400 font-mono text-[11px]">
                  Awers, UV, Rewers, UV
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Tab Workstation (5 cols) */}
        <div className="lg:col-span-5">
          {activeTab === 'personalize' && (
            <PersonalizationForm
              contactData={contactData}
              onChangeContactData={setContactData}
              exportSettings={exportSettings}
              onChangeExportSettings={setExportSettings}
              onOpenVCard={() => setIsVCardOpen(true)}
              onNotify={showNotification}
            />
          )}

          {activeTab === 'template' && (
            <TemplateEditor
              template={selectedTemplate}
              onUpdateTemplate={handleUpdateTemplate}
              templates={templates}
              onSelectTemplate={(t) => {
                setSelectedTemplate(t);
                setSelectedFieldId(null);
              }}
              onOpenUpload={() => setIsUploadOpen(true)}
              selectedFieldId={selectedFieldId}
              onSelectField={setSelectedFieldId}
              activeSide={activeSide}
              onSaveTemplate={handleSaveTemplate}
              onResetTemplate={handleResetTemplate}
              onNotify={showNotification}
              contactData={contactData}
              onChangeContactData={setContactData}
              exportSettings={exportSettings}
              onLoadFullConfig={handleLoadFullConfig}
            />
          )}

          {activeTab === 'preflight' && (
            <PreflightInspector
              template={selectedTemplate}
              contactData={contactData}
              exportSettings={exportSettings}
              onExportPdf={handleExportPdf}
              isExporting={isExporting}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        template={selectedTemplate}
        onUpdateTemplate={handleUpdateTemplate}
        onNotify={showNotification}
      />

      <VCardModal
        isOpen={isVCardOpen}
        onClose={() => setIsVCardOpen(false)}
        contactData={contactData}
        onChangeContactData={setContactData}
        onNotify={showNotification}
      />

      {/* Subtle Footer */}
      <footer className="w-full py-4 text-center mt-auto">
        <span className="text-[11px] select-none text-[#181818] tracking-wider font-mono">
          Made by AJEL
        </span>
      </footer>
    </div>
  );
}
