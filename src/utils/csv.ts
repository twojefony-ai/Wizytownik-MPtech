import JSZip from 'jszip';
import { BatchItem, ContactData } from '../types';
import { buildVCard3 } from './vcard';
import { generateQrCmykPdfBytes } from './qrExport';

/**
 * Robust CSV parser that handles quotes, commas, semicolons, and various newline formats
 */
export function parseCSV(rawText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Normalize line endings
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Detect delimiter: check first line for comma vs semicolon vs tab
  const firstLine = text.split('\n')[0] || '';
  let delimiter = ',';
  if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push last cell/row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes header string to match standard keys, including Adobe InDesign @QR_Code and tel2
 */
function normalizeHeaderKey(header: string): string {
  const rawLower = header.toLowerCase().trim();
  
  // Specific Adobe InDesign Image / QR field (@QR_Code or \@QR_Code)
  if (rawLower.includes('@qr_code') || rawLower.includes('@qr') || rawLower.includes('qrcode') || rawLower === 'qr' || rawLower.includes('qr_code')) {
    return 'qrFileName';
  }
  if (['tel2', 'telefon2', 'phone2', 'komorka2', 'komórka2', 'mobile2', 'phone_mobile', 'phonemobile'].includes(rawLower.replace(/[^a-z0-9]/g, ''))) {
    return 'phoneMobile';
  }

  const clean = header.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż_]/g, '');
  if (['imieinazwisko', 'imięinazwisko', 'imienazwisko', 'imięnazwisko', 'fullname', 'name', 'osoba'].includes(clean)) {
    return 'fullName';
  }
  if (['imie', 'imię', 'firstname'].includes(clean)) {
    return 'firstName';
  }
  if (['nazwisko', 'lastname', 'surname'].includes(clean)) {
    return 'lastName';
  }
  if (['stanowisko', 'position', 'title', 'jobtitle', 'funkcja'].includes(clean)) {
    return 'jobTitle';
  }
  if (['telefon', 'phone', 'tel', 'komorka', 'komórka', 'mobile', 'telefonkomorkowy', 'tel1'].includes(clean)) {
    return 'phone';
  }
  if (['mail', 'email', 'e-mail', 'adresmail', 'adresemail'].includes(clean)) {
    return 'email';
  }
  if (['firma', 'company', 'nazwafirmy'].includes(clean)) {
    return 'company';
  }
  if (['biuro', 'office', 'oddzial', 'oddział'].includes(clean)) {
    return 'office';
  }
  if (['ulica', 'street', 'adres', 'address'].includes(clean)) {
    return 'street';
  }
  if (['kod', 'kodpocztowy', 'zip', 'zipcode'].includes(clean)) {
    return 'zip';
  }
  if (['miasto', 'city', 'miejscowosc', 'miejscowość'].includes(clean)) {
    return 'city';
  }
  if (['kraj', 'country'].includes(clean)) {
    return 'country';
  }
  if (['nip', 'vat', 'taxid'].includes(clean)) {
    return 'nip';
  }
  if (['strona', 'website', 'www', 'url'].includes(clean)) {
    return 'website';
  }
  return clean;
}

/**
 * Parses CSV and maps into structured BatchItem array (supports standard & Adobe InDesign CSV)
 */
export function parseBatchCSV(csvText: string, baseCompanyData: Partial<ContactData> = {}): {
  items: BatchItem[];
  errors: string[];
  totalRows: number;
} {
  const rows = parseCSV(csvText);
  const errors: string[] = [];

  if (rows.length < 2) {
    return {
      items: [],
      errors: ['Plik CSV musi zawierać wiersz nagłówka oraz co najmniej jeden wiersz z danymi pracowników.'],
      totalRows: 0,
    };
  }

  const rawHeaders = rows[0];
  const headerMap: { [colIndex: number]: string } = {};

  rawHeaders.forEach((h, idx) => {
    headerMap[idx] = normalizeHeaderKey(h);
  });

  const items: BatchItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const itemData: any = {};

    row.forEach((val, colIdx) => {
      const key = headerMap[colIdx];
      if (key) {
        itemData[key] = val;
      }
    });

    let fullName = itemData.fullName || '';
    let firstName = itemData.firstName || '';
    let lastName = itemData.lastName || '';

    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName} ${lastName}`.trim();
    } else if (fullName && (!firstName || !lastName)) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    const jobTitle = itemData.jobTitle || '';
    const phone = itemData.phone || '';
    const phoneMobile = itemData.phoneMobile || '';
    const email = itemData.email || '';
    let qrFileName = itemData.qrFileName || '';

    // If QR file name is empty or not formatted, generate default InDesign standard path
    if (!qrFileName && fullName) {
      const safe = fullName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      qrFileName = `QR/${safe}.pdf`;
    }

    const validationErrors: string[] = [];
    if (!fullName) validationErrors.push('Brak imienia i nazwiska');
    if (!jobTitle) validationErrors.push('Brak stanowiska');
    if (!phone) validationErrors.push('Brak numeru telefonu');
    if (!email) validationErrors.push('Brak adresu e-mail');

    const isValid = validationErrors.length === 0;

    items.push({
      id: `batch_${r}_${Date.now()}`,
      fullName,
      firstName,
      lastName,
      jobTitle,
      phone,
      phoneMobile,
      email,
      qrFileName,
      company: itemData.company || baseCompanyData.company,
      office: itemData.office || baseCompanyData.office,
      street: itemData.street || baseCompanyData.street,
      zip: itemData.zip || baseCompanyData.zip,
      city: itemData.city || baseCompanyData.city,
      country: itemData.country || baseCompanyData.country || 'Polska',
      nip: itemData.nip || baseCompanyData.nip,
      website: itemData.website || baseCompanyData.website,
      isValid,
      validationError: validationErrors.length > 0 ? validationErrors.join(', ') : undefined,
    });
  }

  return {
    items,
    errors,
    totalRows: rows.length - 1,
  };
}

/**
 * Generates standardized corporate email address from Polish first and last name:
 * imie.nazwisko@mptech.eu or imie.nazwisko-nazwisko@mptech.eu for compound surnames
 */
export function generateCompanyEmail(firstName: string, lastName: string, domain: string = 'mptech.eu'): string {
  const polishMap: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'a', 'Ć': 'c', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o', 'Ś': 's', 'Ź': 'z', 'Ż': 'z',
  };

  const cleanString = (str: string) => {
    return str
      .split('')
      .map((char) => polishMap[char] || char)
      .join('')
      .toLowerCase()
      .trim();
  };

  const cleanFirst = cleanString(firstName).replace(/[^a-z0-9]/g, '');
  const cleanLast = cleanString(lastName)
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!cleanFirst && !cleanLast) return '';
  if (!cleanFirst) return `${cleanLast}@${domain}`;
  if (!cleanLast) return `${cleanFirst}@${domain}`;
  return `${cleanFirst}.${cleanLast}@${domain}`;
}

/**
 * Converts a BatchItem into full ContactData record merged with base company defaults
 */
export function batchItemToContactData(item: BatchItem, baseCompanyData: ContactData): ContactData {
  return {
    ...baseCompanyData,
    firstName: item.firstName,
    lastName: item.lastName,
    jobTitle: item.jobTitle,
    phone: item.phone,
    phoneMobile: item.phoneMobile || baseCompanyData.phoneMobile,
    email: item.email || generateCompanyEmail(item.firstName, item.lastName),
    customQrImage: item.customQrImage,
    customQrFileName: item.qrFileName,
    useCustomQr: Boolean(item.useCustomQr && item.customQrImage),
    company: item.company || baseCompanyData.company,
    office: item.office || baseCompanyData.office,
    street: item.street || baseCompanyData.street,
    zip: item.zip || baseCompanyData.zip,
    city: item.city || baseCompanyData.city,
    country: item.country || baseCompanyData.country,
    nip: item.nip || baseCompanyData.nip,
    website: item.website || baseCompanyData.website,
  };
}

/**
 * Generates Adobe InDesign Data Merge CSV format:
 * @QR_Code,Imie Nazwisko,Stanowisko,tel,mail,tel2
 */
export function generateInDesignCSV(items: BatchItem[]): string {
  const header = '@QR_Code,Imie Nazwisko,Stanowisko,tel,mail,tel2';
  const escapeCell = (str?: string) => {
    if (!str) return '""';
    const clean = str.replace(/"/g, '""');
    return `"${clean}"`;
  };

  const lines = [header];
  items.forEach((item, idx) => {
    let qrPath = item.qrFileName;
    if (!qrPath || !qrPath.toLowerCase().endsWith('.pdf')) {
      const safe = (item.fullName || `osoba_${idx + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      qrPath = `QR/${idx + 1}_${safe}.pdf`;
    }
    // Ensure format starts with QR/
    if (!qrPath.startsWith('QR/') && !qrPath.startsWith('QR\\')) {
      qrPath = `QR/${qrPath}`;
    }

    const row = [
      escapeCell(qrPath),
      escapeCell(item.fullName || `${item.firstName} ${item.lastName}`.trim()),
      escapeCell(item.jobTitle),
      escapeCell(item.phone),
      escapeCell(item.email),
      escapeCell(item.phoneMobile || ''),
    ].join(',');
    lines.push(row);
  });

  return lines.join('\r\n');
}

/**
 * Downloads a simple string as a file
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }); // Add BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Downloads Adobe InDesign CSV file
 */
export function downloadInDesignCSV(items: BatchItem[], filename: string = 'indesign_data_merge.csv') {
  const csvText = generateInDesignCSV(items);
  downloadTextFile(csvText, filename);
}

/**
 * Generates complete InDesign Data Merge ZIP Package:
 * 1. indesign_data_merge.csv
 * 2. QR/*.pdf - Vector CMYK (0,0,0,100) PDFs for every record
 * 3. Instrukcja_InDesign.txt
 */
export async function downloadInDesignDataMergeZip(
  items: BatchItem[],
  baseCompanyData: ContactData,
  zipFileName: string = 'InDesign_DataMerge_Package.zip',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const qrFolder = zip.folder('QR');

  const validItems = items.filter((it) => it.isValid);
  if (validItems.length === 0) {
    throw new Error('Brak poprawnych rekordów w tabeli batch do wygenerowania paczki InDesign.');
  }

  // 1. Generate individual QR Vector PDFs in pure CMYK 0,0,0,100
  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    if (onProgress) onProgress(i + 1, validItems.length);

    const contact = batchItemToContactData(item, baseCompanyData);
    const vCardText = buildVCard3(contact);

    let qrFileNameOnly = '';
    if (item.qrFileName) {
      qrFileNameOnly = item.qrFileName.replace(/^QR[\/\\]/i, '');
    }
    if (!qrFileNameOnly || !qrFileNameOnly.toLowerCase().endsWith('.pdf')) {
      const safe = (item.fullName || `osoba_${i + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      qrFileNameOnly = `${i + 1}_${safe}.pdf`;
      item.qrFileName = `QR/${qrFileNameOnly}`;
    }

    const pdfBytes = await generateQrCmykPdfBytes(vCardText, item.fullName || 'QR Code', 50);
    qrFolder?.file(qrFileNameOnly, pdfBytes);
  }

  // 2. Generate and add CSV file
  const csvContent = generateInDesignCSV(validItems);
  zip.file('indesign_data_merge.csv', '\uFEFF' + csvContent);

  // 3. Add Instruction file
  const instructions = `================================================================================
          INSTRUKCJA SCALANIA DANYCH W ADOBE INDESIGN (DATA MERGE)
================================================================================

Zawartość paczki:
1. indesign_data_merge.csv   - Plik ze strukturą pól (@QR_Code, Imie Nazwisko, Stanowisko, tel, mail, tel2)
2. Katalog QR/               - Wektorowe pliki PDF kodów QR w 100% czerni CMYK (0, 0, 0, 100)

KROKI WCZYTANIA W ADOBE INDESIGN:
1. Rozpakuj zawartość tego archiwum ZIP do jednego folderu na swoim dysku.
   (Upewnij się, że plik 'indesign_data_merge.csv' oraz podfolder 'QR' znajdują się w tym samym katalogu).
2. Otwórz swój dokument szablonu wizytówki w programie Adobe InDesign.
3. W menu głównym InDesign wybierz:
   Okno -> Narzędzia -> Scalanie danych (Window -> Utilities -> Data Merge).
4. W prawym górnym rogu panelu Scalanie danych kliknij ikonę menu i wybierz 'Wybierz źródło danych...' (Select Data Source...).
5. Wskaż plik 'indesign_data_merge.csv'.
6. W panelu pojawią się dostępne pola:
   - @QR_Code (ikona obrazu/pliku) -> przeciągnij do ramki graficznej przeznaczonej na kod QR
   - Imie Nazwisko -> przeciągnij do ramki tekstowej z imieniem i nazwiskiem
   - Stanowisko -> przeciągnij do ramki stanowiska
   - tel -> przeciągnij do pola telefonu
   - mail -> przeciągnij do pola adresu e-mail
   - tel2 -> pole telefonu komórkowego / drugiego telefonu (opcjonalne)
7. Włącz 'Podgląd' (Preview) w panelu, aby sprawdzić dopasowanie.
8. Kliknij ikonę 'Utwórz scalony dokument' (Create Merged Document), aby wygenerować kompletny plik produkcyjny dla wszystkich osób!

Wygenerowano przez: Generator Wizytówek DTP Pro
`;
  zip.file('INSTRUKCJA_INDESIGN.txt', instructions);

  // Generate and download zip blob
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
