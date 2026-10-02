import { BusinessCardTemplate, ContactData, PreflightCheckResult } from '../types';
import { calculateTAC } from './cmyk';

let measureCanvas: HTMLCanvasElement | null = null;

export function measureTextWidthMm(
  text: string,
  fontSizePt: number,
  fontFamily: string = 'Rajdhani',
  fontWeight?: string
): number {
  if (!text) return 0;

  if (typeof document !== 'undefined') {
    try {
      if (!measureCanvas) {
        measureCanvas = document.createElement('canvas');
      }
      const ctx = measureCanvas.getContext('2d');
      if (ctx) {
        const weight =
          fontWeight === 'bold' || fontWeight === '700'
            ? 'bold '
            : fontWeight === '600'
            ? '600 '
            : '';
        const fontSizePx = (fontSizePt * 96) / 72;
        ctx.font = `${weight}${fontSizePx}px "${fontFamily}", sans-serif`;
        const metrics = ctx.measureText(text);
        if (metrics && metrics.width > 0) {
          return (metrics.width * 25.4) / 96;
        }
      }
    } catch {
      // fallback if canvas measurement is unavailable
    }
  }

  // Analytical fallback
  const MM_TO_PT = 72 / 25.4;
  let factor = 0.44;
  if (fontFamily === 'Montserrat') factor = 0.53;
  else if (fontFamily === 'Arial') factor = 0.5;

  let totalUnits = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (' ilI.:-+,\''.includes(ch)) {
      totalUnits += 0.26;
    } else if ('mwMWO@%#'.includes(ch)) {
      totalUnits += 0.62;
    } else if (ch >= 'A' && ch <= 'Z') {
      totalUnits += 0.5;
    } else if (ch >= '0' && ch <= '9') {
      totalUnits += 0.42;
    } else {
      totalUnits += 0.4;
    }
  }
  const weightFactor = fontWeight === 'bold' || fontWeight === '700' ? 1.08 : 1.0;
  const widthPt =
    totalUnits * fontSizePt * (fontFamily === 'Montserrat' ? 1.2 : 1.0) * weightFactor;
  return widthPt / MM_TO_PT;
}

export function runPreflightCheck(
  template: BusinessCardTemplate,
  contactData?: ContactData
): PreflightCheckResult {
  const issues: PreflightCheckResult['issues'] = [];
  const safeZone = template.safeZoneMm ?? 2.5;
  const widthNetto = template.widthNetto || 90;
  const heightNetto = template.heightNetto || 50;

  const safeLeft = safeZone;
  const safeTop = safeZone;
  const safeRight = widthNetto - safeZone;
  const safeBottom = heightNetto - safeZone;

  let uvAreaFront = 0;
  let uvAreaBack = 0;
  let maxTac = 0;

  const totalCardArea = widthNetto * heightNetto;

  // Background TAC
  if (template.frontBg.colorCMYK) {
    maxTac = Math.max(maxTac, calculateTAC(template.frontBg.colorCMYK));
  }
  if (template.backBg.colorCMYK) {
    maxTac = Math.max(maxTac, calculateTAC(template.backBg.colorCMYK));
  }

  for (const field of template.fields) {
    if (field.type === 'text') {
      // Determine the actual rendered string
      let rawText = field.defaultValue || '';
      if (
        contactData &&
        field.bindKey &&
        contactData[field.bindKey as keyof ContactData] !== undefined
      ) {
        rawText = String(contactData[field.bindKey as keyof ContactData] || '');
      }

      const tac = calculateTAC(field.colorCMYK);
      maxTac = Math.max(maxTac, tac);

      if (field.fontSize < 5.5) {
        issues.push({
          type: 'warning',
          message: `Rozmiar czcionki w polu "${field.name}" wynosi ${field.fontSize}pt (zalecane min. 5.5pt dla czytelności druku).`,
          fieldId: field.id,
        });
      }

      if (rawText.trim().length > 0) {
        const lines = rawText.split('\n');
        const letterSpacingMm = field.letterSpacing ? (field.letterSpacing * 0.8 * 25.4) / 96 : 0;

        const lineLengthsMm = lines.map(
          (line) =>
            measureTextWidthMm(line, field.fontSize, field.fontFamily, field.fontWeight) +
            (line.length > 1 ? (line.length - 1) * letterSpacingMm : 0)
        );
        const maxLineWidthMm = Math.max(...lineLengthsMm, 0);

        // Horizontal boundaries of actual rendered text
        let actualLeft = field.x;
        let actualRight = field.x + maxLineWidthMm;

        if (field.align === 'center') {
          const centerX = field.x + field.w / 2;
          actualLeft = centerX - maxLineWidthMm / 2;
          actualRight = centerX + maxLineWidthMm / 2;
        } else if (field.align === 'right') {
          actualRight = field.x + field.w;
          actualLeft = field.x + field.w - maxLineWidthMm;
        }

        // Vertical boundaries of actual rendered text
        const textHeightMm = (field.fontSize * 1.22 * 25.4) / 72;
        let actualTop = field.y;
        let actualBottom = field.y + textHeightMm;

        if (lines.length <= 1) {
          const topOffsetMm = Math.max(0, (field.h - textHeightMm) / 2);
          actualTop = field.y + topOffsetMm;
          actualBottom = actualTop + textHeightMm;
        } else {
          const lineHeightMm =
            field.lineHeight && field.lineHeight > 3
              ? (field.lineHeight * 25.4) / 72
              : (field.fontSize * (field.lineHeight || 1.15) * 25.4) / 72;
          const totalTextHeightMm = (lines.length - 1) * lineHeightMm + textHeightMm;
          actualTop = field.y;
          actualBottom = field.y + totalTextHeightMm;
        }

        const tolerance = 0.05; // 0.05 mm numerical tolerance
        if (
          actualLeft < safeLeft - tolerance ||
          actualTop < safeTop - tolerance ||
          actualRight > safeRight + tolerance ||
          actualBottom > safeBottom + tolerance
        ) {
          issues.push({
            type: 'warning',
            message: `Wpisany tekst w polu "${field.name}" przekracza strefę bezpieczną (min. ${safeZone}mm od krawędzi netto).`,
            fieldId: field.id,
          });
        }
      }

      if (field.useUV) {
        const area = field.w * field.h;
        if (field.side === 'front') uvAreaFront += area * 0.45;
        else uvAreaBack += area * 0.45;
      }
    } else if (field.type === 'qr') {
      const tac = calculateTAC(field.darkColorCMYK);
      maxTac = Math.max(maxTac, tac);

      if (field.w < 13 || field.h < 13) {
        issues.push({
          type: 'warning',
          message: `Wymiary kodu QR (${field.w}x${field.h}mm) są mniejsze niż zalecane 15x15mm dla niezawodnego skanowania.`,
          fieldId: field.id,
        });
      }

      // QR position bounds
      const right = field.x + field.w;
      const bottom = field.y + field.h;
      const tolerance = 0.05;

      if (
        field.x < safeLeft - tolerance ||
        field.y < safeTop - tolerance ||
        right > safeRight + tolerance ||
        bottom > safeBottom + tolerance
      ) {
        issues.push({
          type: 'warning',
          message: `Kod QR "${field.name}" narusza strefę bezpieczną (min. ${safeZone}mm od krawędzi netto).`,
          fieldId: field.id,
        });
      }

      if (field.useUV) {
        const area = field.w * field.h;
        if (field.side === 'front') uvAreaFront += area * 0.5;
        else uvAreaBack += area * 0.5;
      }
    } else {
      // General non-text objects
      const right = field.x + field.w;
      const bottom = field.y + field.h;
      const tolerance = 0.05;

      if (
        field.x < safeLeft - tolerance ||
        field.y < safeTop - tolerance ||
        right > safeRight + tolerance ||
        bottom > safeBottom + tolerance
      ) {
        issues.push({
          type: 'warning',
          message: `Element "${field.name}" narusza strefę bezpieczną (min. ${safeZone}mm od krawędzi netto).`,
          fieldId: field.id,
        });
      }
    }
  }

  if (maxTac > 320) {
    issues.push({
      type: 'warning',
      message: `Maksymalne nafarbienie (TAC) wynosi ${maxTac}%. Drukarnie offsetowe zalecają limit 300-320%.`,
    });
  } else {
    issues.push({
      type: 'info',
      message: `Maksymalne nafarbienie (TAC: ${maxTac}%) mieści się w bezpiecznej normie ISO 12647-2.`,
    });
  }

  const uvCoverageFront = Math.min(100, Math.round((uvAreaFront / totalCardArea) * 100));
  const uvCoverageBack = Math.min(100, Math.round((uvAreaBack / totalCardArea) * 100));

  if (uvCoverageFront > 0 || uvCoverageBack > 0) {
    issues.push({
      type: 'info',
      message: `Wykryto elementy lakieru UV wybiórczego: Przód: ${uvCoverageFront}%, Tył: ${uvCoverageBack}%. Przygotowano dedykowane strony maski M=100.`,
    });
  } else {
    issues.push({
      type: 'info',
      message: `Brak elementów z lakierem UV. Strony 3 i 4 maski będą puste lub jednolite.`,
    });
  }

  const hasErrors = issues.some((i) => i.type === 'error');

  return {
    passed: !hasErrors,
    issues,
    uvCoverageFront,
    uvCoverageBack,
    totalTacMax: maxTac,
    elementsCount: template.fields.length,
  };
}
