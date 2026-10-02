import { ContactData } from '../types';

/**
 * Builds standard RFC 2426 vCard 3.0 format compliant with QR code mobile scanners
 */
export function buildVCard3(data: Partial<ContactData>): string {
  const firstName = (data.firstName || '').trim();
  const lastName = (data.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim() || 'Wizytówka';
  const org = (data.company || '').trim();
  const title = (data.jobTitle || '').trim();
  const phone = (data.phone || data.phoneMobile || '').trim();
  const email = (data.email || '').trim();
  const url = (data.website || '').trim();

  const streetFull = [data.street, data.houseNumber].filter(Boolean).join(' ').trim();
  const city = (data.city || '').trim();
  const zip = (data.zip || '').trim();
  const country = (data.country || 'Polska').trim();

  // Normalize URL with http/https if missing
  let formattedUrl = url;
  if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${fullName}`,
    org ? `ORG:${org}` : '',
    title ? `TITLE:${title}` : '',
    phone ? `TEL;TYPE=CELL:${phone}` : '',
    email ? `EMAIL:${email}` : '',
    formattedUrl ? `URL:${formattedUrl}` : '',
    `ADR;TYPE=WORK:;;${streetFull};${city};;${zip};${country}`,
    data.notes ? `NOTE:${data.notes}` : '',
    'END:VCARD'
  ].filter(Boolean);

  return lines.join('\n');
}
