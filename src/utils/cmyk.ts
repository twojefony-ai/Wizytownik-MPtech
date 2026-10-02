import { CMYKColor } from '../types';

export const MM_TO_PT = 2.8346457;
export const PT_TO_MM = 1 / MM_TO_PT;
export const DPI_300_SCALE = 11.8110236; // 300 DPI / 25.4 mm

/**
 * Converts CMYK (0-100 values) to sRGB string for HTML/CSS preview
 */
export function cmykToRgbString(cmyk: CMYKColor): string {
  const [c, m, y, k] = cmyk.map((v) => Math.max(0, Math.min(100, v)) / 100);

  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Returns hex color from CMYK
 */
export function cmykToHex(cmyk: CMYKColor): string {
  const [c, m, y, k] = cmyk.map((v) => Math.max(0, Math.min(100, v)) / 100);

  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));

  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Total Area Coverage (TAC) / Suma nafarbienia
 */
export function calculateTAC(cmyk: CMYKColor): number {
  return cmyk[0] + cmyk[1] + cmyk[2] + cmyk[3];
}

/**
 * Predefined popular printing CMYK presets
 */
export const CMYK_PRESETS: Array<{ name: string; color: CMYKColor; label: string }> = [
  { name: 'K100 (Czerń czysta)', color: [0, 0, 0, 100], label: 'Teksty / Pismo' },
  { name: 'Rich Black (Głęboka czerń)', color: [40, 30, 30, 100], label: 'Aple / Tła' },
  { name: 'Super Rich Black', color: [60, 40, 40, 100], label: 'Aple kryjące' },
  { name: 'Biel / Papier', color: [0, 0, 0, 0], label: '0% krycia' },
  { name: 'Szary 50%', color: [0, 0, 0, 50], label: 'Subtelny szary' },
  { name: 'Granat Korporacyjny', color: [100, 85, 30, 40], label: 'Corporate Navy' },
  { name: 'Cyjan Czysty (C:100)', color: [100, 0, 0, 0], label: 'Procesowy Cyjan' },
  { name: 'Magenta Czysta (M:100)', color: [0, 100, 0, 0], label: 'Maska lakieru UV' },
  { name: 'Żółty (Y:100)', color: [0, 0, 100, 0], label: 'Procesowy Żółty' },
  { name: 'Złoty DTP (Złocenie)', color: [20, 35, 90, 10], label: 'Warm Gold' },
  { name: 'Szmaragd / Butelkowa zieleń', color: [85, 25, 75, 45], label: 'Deep Emerald' },
  { name: 'Czerwień Ciepła', color: [0, 95, 90, 0], label: 'Warm Red' },
];
