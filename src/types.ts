export type CardSide = 'front' | 'back';

export type TextAlignment = 'left' | 'center' | 'right';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export type CMYKColor = [number, number, number, number]; // [C, M, Y, K] in 0-100%

export interface TextFieldConfig {
  id: string;
  name: string;
  type: 'text';
  side: CardSide;
  defaultValue: string;
  bindKey?: string; // e.g. 'fullName', 'jobTitle', 'company', etc.
  x: number; // in mm from top-left of netto area
  y: number; // in mm from top-left of netto area
  w: number; // in mm
  h: number; // in mm
  fontFamily: string; // e.g. 'Montserrat', 'Rajdhani', 'Proxima Nova'
  fontWeight: FontWeight;
  fontSize: number; // in pt
  lineHeight: number; // multiplier e.g. 1.2
  letterSpacing?: number; // in pt
  align: TextAlignment;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  colorCMYK: CMYKColor;
  useUV: boolean; // Spot UV layer M=100
  isStatic?: boolean;
}

export interface QRCodeFieldConfig {
  id: string;
  name: string;
  type: 'qr';
  side: CardSide;
  x: number; // in mm
  y: number; // in mm
  w: number; // in mm
  h: number; // in mm
  useUV: boolean; // Spot UV mask
  source: 'vcard' | 'custom_url' | 'custom_text' | 'custom_image';
  customData?: string;
  customImageUrl?: string;
  customFileName?: string;
  darkColorCMYK: CMYKColor;
  lightColorCMYK?: CMYKColor;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export interface ShapeFieldConfig {
  id: string;
  name: string;
  type: 'shape';
  side: CardSide;
  x: number;
  y: number;
  w: number;
  h: number;
  shapeType: 'rectangle' | 'circle' | 'line' | 'rounded';
  borderRadius?: number; // mm
  fillCMYK?: CMYKColor;
  strokeCMYK?: CMYKColor;
  strokeWidth?: number; // mm
  useUV: boolean;
}

export type CardField = TextFieldConfig | QRCodeFieldConfig | ShapeFieldConfig;

export interface ContactData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  office?: string;
  phone: string;
  phoneMobile?: string;
  email: string;
  website: string;
  street: string;
  houseNumber?: string;
  zip: string;
  city: string;
  country: string;
  nip?: string;
  address?: string;
  notes?: string;
  customQrImage?: string;
  customQrFileName?: string;
  useCustomQr?: boolean;
}

export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image' | 'pdf';
  colorCMYK?: CMYKColor;
  gradientCSS?: string;
  imageUrl?: string;
  pdfPageNumber?: number;
}

export interface BusinessCardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  widthNetto: number; // in mm, standard 90 or 85
  heightNetto: number; // in mm, standard 50 or 55
  bleedMm: number; // standard 2mm
  safeZoneMm: number; // standard 2.5mm
  showBaselines?: boolean; // toggle baseline guides
  frontBg: BackgroundConfig;
  backBg: BackgroundConfig;
  fields: CardField[];
  masterPdfFileName?: string;
  masterPdfPageCount?: number;
  masterPdfPreviews?: {
    front?: string;
    frontUv?: string;
    back?: string;
    backUv?: string;
  };
}

export interface ExportSettings {
  useBleed: boolean;
  bleedMm: number;
  addCropMarks: boolean;
  addUVPage: boolean;
  dpi: number;
}

export interface PreflightCheckResult {
  passed: boolean;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    fieldId?: string;
  }>;
  uvCoverageFront: number; // percentage
  uvCoverageBack: number;
  totalTacMax: number; // Total Area Coverage C+M+Y+K
  elementsCount: number;
}

export interface SavedConfigFile {
  fileName: string;
  name: string;
  savedAt: string;
  sizeBytes?: number;
  templateName?: string;
  cardSize?: string;
  previewSummary?: string;
  fileExt?: string;
}

export interface FullConfigPayload {
  version: string;
  savedAt: string;
  name: string;
  description?: string;
  template: BusinessCardTemplate;
  contactData: ContactData;
  exportSettings?: ExportSettings;
}

export interface BatchItem {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phone: string;
  email: string;
  // Predefined/overridden company parameters
  company?: string;
  office?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  nip?: string;
  website?: string;
  isValid: boolean;
  validationError?: string;
}

