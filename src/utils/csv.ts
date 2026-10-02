import { BatchItem, ContactData } from '../types';

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
 * Normalizes header string to match standard keys
 */
function normalizeHeaderKey(header: string): string {
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
  if (['telefon', 'phone', 'tel', 'komorka', 'komórka', 'mobile', 'telefonkomorkowy'].includes(clean)) {
    return 'phone';
  }
  if (['mail', 'email', 'email', 'e-mail', 'adresmail', 'adresemail'].includes(clean)) {
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
 * Parses CSV and maps into structured BatchItem array
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
    const email = itemData.email || '';

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
      email,
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
 * Converts a BatchItem into full ContactData record merged with base company defaults
 */
export function batchItemToContactData(item: BatchItem, baseCompanyData: ContactData): ContactData {
  return {
    ...baseCompanyData,
    firstName: item.firstName,
    lastName: item.lastName,
    jobTitle: item.jobTitle,
    phone: item.phone,
    email: item.email,
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
