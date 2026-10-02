import { TextFieldConfig } from '../types';

export interface BaselineInfo {
  lineIndex: number;
  text: string;
  baselineFromNettoTopMm: number;
  baselineFromBoxTopMm: number;
  ascentMm: number;
  capHeightMm: number;
  fontSizePt: number;
}

/**
 * Calculates deterministic typographic baseline positions for text fields.
 * This exact math is shared identically between frontend preview (SVG/Canvas)
 * and backend production PDF export (pdf-lib).
 */
export function calculateFieldBaselinesMm(
  field: TextFieldConfig,
  lines: string[]
): BaselineInfo[] {
  const fontSizePt = field.fontSize || 10;
  const isMontserrat = field.fontFamily === 'Montserrat';
  const ascentRatio = isMontserrat ? 0.95 : 0.93;
  const fontFactor = isMontserrat ? 1.22 : 1.276;
  const capHeightRatio = isMontserrat ? 0.70 : 0.643;

  const textHeightPt = fontFactor * fontSizePt;
  const textHeightMm = (textHeightPt * 25.4) / 72;
  const ascentMm = (ascentRatio * fontSizePt * 25.4) / 72;
  const capHeightMm = (capHeightRatio * fontSizePt * 25.4) / 72;

  const hMm = field.h || 5;
  const lineSpacingMm =
    field.lineHeight && field.lineHeight > 3
      ? (field.lineHeight * 25.4) / 72
      : (field.lineHeight ? (field.lineHeight * fontSizePt * 25.4) / 72 : (fontSizePt * 1.15 * 25.4) / 72);

  if (lines.length <= 1) {
    const topMarginMm = Math.max(0, (hMm - textHeightMm) / 2);
    const baselineFromBoxTopMm = topMarginMm + ascentMm;
    const baselineFromNettoTopMm = field.y + baselineFromBoxTopMm;

    return [
      {
        lineIndex: 0,
        text: lines[0] || '',
        baselineFromNettoTopMm,
        baselineFromBoxTopMm,
        ascentMm,
        capHeightMm,
        fontSizePt,
      },
    ];
  } else {
    const totalSpanMm = (lines.length - 1) * lineSpacingMm + textHeightMm;
    const topMarginMm = Math.max(0, (hMm - totalSpanMm) / 2);

    return lines.map((line, idx) => {
      const baselineFromBoxTopMm = topMarginMm + ascentMm + idx * lineSpacingMm;
      const baselineFromNettoTopMm = field.y + baselineFromBoxTopMm;
      return {
        lineIndex: idx,
        text: line,
        baselineFromNettoTopMm,
        baselineFromBoxTopMm,
        ascentMm,
        capHeightMm,
        fontSizePt,
      };
    });
  }
}
