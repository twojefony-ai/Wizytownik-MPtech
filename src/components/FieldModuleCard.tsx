import React from 'react';
import { 
  Type, 
  QrCode, 
  Copy, 
  Trash2, 
  ChevronDown, 
  Sparkles, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Move,
  Eye,
  Sliders,
  Maximize2
} from 'lucide-react';
import { CardField, TextFieldConfig, QRCodeFieldConfig, CMYKColor, FontWeight, TextAlignment } from '../types';
import { CMYK_PRESETS, cmykToHex } from '../utils/cmyk';

interface FieldModuleCardProps {
  field: CardField;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onUpdate: (updates: Partial<CardField>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  templateWidth: number;
  templateHeight: number;
}

export const FieldModuleCard: React.FC<FieldModuleCardProps> = ({
  field,
  isSelected,
  isExpanded,
  onToggleExpand,
  onSelect,
  onUpdate,
  onDuplicate,
  onRemove,
  templateWidth,
  templateHeight,
}) => {
  const isText = field.type === 'text';
  const textField = isText ? (field as TextFieldConfig) : null;
  const qrField = !isText ? (field as QRCodeFieldConfig) : null;

  const getBindingLabel = (key?: string) => {
    switch (key) {
      case 'fullName': return 'Imię i Nazwisko';
      case 'firstName': return 'Imię';
      case 'lastName': return 'Nazwisko';
      case 'jobTitle': return 'Stanowisko';
      case 'company': return 'Firma';
      case 'phone': return 'Telefon';
      case 'phoneMobile': return 'Komórka';
      case 'email': return 'E-mail';
      case 'website': return 'WWW';
      case 'street': return 'Ulica';
      case 'city': return 'Miasto';
      case 'notes': return 'Notatki / NIP';
      default: return null;
    }
  };

  const bindingLabel = isText ? getBindingLabel(textField?.bindKey) : 'vCard 3.0';

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'bg-neutral-900 border-[#13A3E5] shadow-lg shadow-[#13A3E5]/15 ring-1 ring-[#13A3E5]/50'
          : isExpanded
          ? 'bg-neutral-900/90 border-neutral-700 shadow-md'
          : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50'
      }`}
    >
      {/* Module Header (Clicking anywhere on the bar toggles expand/collapse) */}
      <div
        onClick={() => {
          onSelect();
          onToggleExpand();
        }}
        className="p-3 flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors hover:bg-neutral-800/40"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Module Type Icon */}
          <div
            className={`p-2 rounded-lg border shrink-0 transition-colors ${
              isText
                ? 'bg-blue-950/50 text-[#13A3E5] border-blue-800/40'
                : 'bg-cyan-950/50 text-cyan-400 border-cyan-800/40'
            }`}
          >
            {isText ? <Type className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
          </div>

          {/* Module Title & Quick Meta Badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white truncate">
                {field.name || (isText ? 'Pole tekstowe' : 'Kod QR')}
              </span>
              {bindingLabel && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {bindingLabel}
                </span>
              )}
              {field.useUV && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-950/70 text-fuchsia-400 border border-fuchsia-800/60 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>UV M=100</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
              <span>X: {field.x.toFixed(1)}mm</span>
              <span>•</span>
              <span>Y: {field.y.toFixed(1)}mm</span>
              <span>•</span>
              <span>{field.w.toFixed(1)}×{field.h.toFixed(1)}mm</span>
              {isText && textField && (
                <>
                  <span>•</span>
                  <span>{textField.fontSize}pt</span>
                  <span
                    style={{ backgroundColor: cmykToHex(textField.colorCMYK) }}
                    className="w-2.5 h-2.5 rounded-full border border-neutral-600 inline-block"
                    title={`CMYK: ${textField.colorCMYK.join(', ')}`}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions and Chevron */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplikuj moduł"
            className="p-1.5 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Usuń moduł"
            className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/70 rounded-lg border border-red-900/50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              onToggleExpand();
            }}
            title={isExpanded ? 'Zwiń moduł' : 'Rozwiń moduł do edycji'}
            className="p-1.5 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#13A3E5]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded Inline Editor Body */}
      {isExpanded && (
        <div className="p-4 pt-2 border-t border-neutral-800/80 bg-neutral-950/60 space-y-3.5 text-xs">
          {/* Row 1: Nazwa pola & Wiązanie z danymi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1">Nazwa pola (identyfikator)</label>
              <input
                type="text"
                value={field.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#13A3E5] transition-colors"
              />
            </div>

            {isText && (
              <div>
                <label className="text-neutral-400 block mb-1">Wiązanie z danymi wizytówki</label>
                <select
                  value={textField?.bindKey || ''}
                  onChange={(e) => onUpdate({ bindKey: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white cursor-pointer focus:outline-none focus:border-[#13A3E5] transition-colors"
                >
                  <option value="">-- Tekst statyczny (bez wiązania) --</option>
                  <option value="fullName">Imię i Nazwisko (Połączone)</option>
                  <option value="firstName">Imię</option>
                  <option value="lastName">Nazwisko</option>
                  <option value="jobTitle">Stanowisko / Tytuł</option>
                  <option value="company">Nazwa Firmy</option>
                  <option value="phone">Telefon Główny</option>
                  <option value="phoneMobile">Telefon Komórkowy</option>
                  <option value="email">Adres E-mail</option>
                  <option value="website">Adres WWW</option>
                  <option value="street">Ulica i Numer</option>
                  <option value="city">Miasto i Kod pocztowy</option>
                  <option value="notes">Notatki / NIP</option>
                </select>
              </div>
            )}
          </div>

          {/* Row 2: Default Value (for text fields) */}
          {isText && (
            <div>
              <label className="text-neutral-400 block mb-1">Treść domyślna tekstu</label>
              <input
                type="text"
                value={textField?.defaultValue || ''}
                onChange={(e) => onUpdate({ defaultValue: e.target.value })}
                placeholder="Wpisz domyślny tekst..."
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#13A3E5] transition-colors"
              />
            </div>
          )}

          {/* Coordinates in Millimeters X, Y, W, H */}
          <div className="bg-neutral-900/90 p-3 rounded-lg border border-neutral-800">
            <label className="text-neutral-300 font-bold block mb-2 text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-[#13A3E5]" />
                <span>Pozycja i wymiary netto (mm)</span>
              </span>
              <span className="text-neutral-500 font-mono text-[10px]">0,0 = Lewy Górny Róg</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">X (mm)</span>
                <input
                  type="number"
                  step="0.5"
                  value={field.x}
                  onChange={(e) => onUpdate({ x: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">Y (mm)</span>
                <input
                  type="number"
                  step="0.5"
                  value={field.y}
                  onChange={(e) => onUpdate({ y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">Szerokość W (mm)</span>
                <input
                  type="number"
                  step="0.5"
                  value={field.w}
                  onChange={(e) => onUpdate({ w: Math.max(1, parseFloat(e.target.value) || 1) })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">Wysokość H (mm)</span>
                <input
                  type="number"
                  step="0.5"
                  value={field.h}
                  onChange={(e) => onUpdate({ h: Math.max(1, parseFloat(e.target.value) || 1) })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* QR Field Specific Settings (Scaling, Fitting, Source) */}
          {!isText && qrField && (
            <div className="bg-neutral-900/90 p-3 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-300 font-bold block text-[11px] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#13A3E5]" />
                  <span>Dopasowanie i Skalowanie Kodu QR</span>
                </span>
                <span className="text-[#13A3E5] font-mono text-[11px] font-bold">
                  {qrField.qrScale ?? 100}%
                </span>
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={qrField.qrScale ?? 100}
                  onChange={(e) => onUpdate({ qrScale: parseInt(e.target.value) || 100 })}
                  className="flex-1 h-1.5 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-[#13A3E5]"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdate({ qrScale: 100 })}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                      (qrField.qrScale ?? 100) === 100
                        ? 'bg-[#13A3E5] text-white'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    100% (Wypełnij)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ qrScale: 90 })}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                      qrField.qrScale === 90
                        ? 'bg-[#13A3E5] text-white'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    90%
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400">
                Domyślnie kod QR wypełnia całą ramkę (100%). Użyj suwaka, aby zmienić margines wewnętrzny.
              </p>
            </div>
          )}

          {/* Typography Section for Text Fields */}
          {isText && textField && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-neutral-400 block mb-1">Krój czcionki</label>
                  <select
                    value={textField.fontFamily}
                    onChange={(e) => onUpdate({ fontFamily: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white cursor-pointer"
                  >
                    <option value="Montserrat">Montserrat</option>
                    <option value="Rajdhani">Rajdhani</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="Proxima Nova">Proxima Nova</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Grubość (Weight)</label>
                  <select
                    value={textField.fontWeight}
                    onChange={(e) => onUpdate({ fontWeight: e.target.value as FontWeight })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white cursor-pointer"
                  >
                    <option value="regular">Regular (400)</option>
                    <option value="medium">Medium (500)</option>
                    <option value="semibold">SemiBold (600)</option>
                    <option value="bold">Bold (700)</option>
                    <option value="extrabold">ExtraBold (800)</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Rozmiar (pt)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={textField.fontSize}
                    onChange={(e) => onUpdate({ fontSize: parseFloat(e.target.value) || 8 })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Alignment */}
                <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded p-0.5">
                  {(['left', 'center', 'right'] as TextAlignment[]).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => onUpdate({ align })}
                      className={`p-1.5 rounded transition-colors ${
                        textField.align === align
                          ? 'bg-neutral-800 text-white'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                      {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                      {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>

                {/* Text Transform */}
                <select
                  value={textField.textTransform || 'none'}
                  onChange={(e) => onUpdate({ textTransform: e.target.value as any })}
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white text-[11px]"
                >
                  <option value="none">Standardowy zapis (Aa)</option>
                  <option value="uppercase">WIELKIE LITERY (AA)</option>
                  <option value="capitalize">Każdy Wyraz Wielką (Aa)</option>
                </select>
              </div>
            </div>
          )}

          {/* CMYK Color Picker */}
          <div className="bg-neutral-900/90 p-3 rounded-lg border border-neutral-800">
            <label className="text-neutral-300 font-bold block mb-2 text-[11px] flex items-center justify-between">
              <span>Kolor CMYK (Druk procesowy)</span>
              {isText && textField && (
                <span
                  style={{ backgroundColor: cmykToHex(textField.colorCMYK) }}
                  className="w-4 h-4 rounded border border-neutral-600 inline-block shadow-sm"
                />
              )}
            </label>

            {isText && textField && (
              <div className="grid grid-cols-4 gap-2 mb-2 font-mono">
                {['C', 'M', 'Y', 'K'].map((channel, idx) => (
                  <div key={channel}>
                    <span className="text-[10px] text-neutral-400 block mb-0.5">{channel} (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={textField.colorCMYK[idx]}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        const newColor = [...textField.colorCMYK] as CMYKColor;
                        newColor[idx] = val;
                        onUpdate({ colorCMYK: newColor });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Swatches preset list */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-800/80">
              {CMYK_PRESETS.slice(0, 6).map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    if (isText) {
                      onUpdate({ colorCMYK: preset.color });
                    } else if (qrField) {
                      onUpdate({ darkColorCMYK: preset.color });
                    }
                  }}
                  title={`${preset.name}: C:${preset.color[0]} M:${preset.color[1]} Y:${preset.color[2]} K:${preset.color[3]}`}
                  className="px-2 py-0.5 text-[10px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded flex items-center gap-1 text-neutral-300 transition-colors"
                >
                  <span
                    style={{ backgroundColor: cmykToHex(preset.color) }}
                    className="w-2.5 h-2.5 rounded-sm border border-neutral-600 inline-block"
                  />
                  <span>{preset.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selective Spot UV Toggle (Lakier UV wybiórczy M=100) */}
          <div className="p-3 bg-fuchsia-950/30 border border-fuchsia-500/40 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-fuchsia-600/30 text-fuchsia-400 rounded">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white block">Lakier UV Wybiórczy (M=100)</span>
                <span className="text-[11px] text-fuchsia-300/80">
                  Generuje element na masce UV (Spot Magenta 100%)
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={field.useUV}
                onChange={(e) => onUpdate({ useUV: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#13A3E5]"></div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
