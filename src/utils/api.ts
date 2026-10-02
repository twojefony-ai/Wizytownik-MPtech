/**
 * Safe fetch helper that protects against non-JSON responses (HTML error pages, 502/504, 413, etc.)
 * preventing "JSON.parse: unexpected character" / "Unexpected token < in JSON" crashes.
 */
export async function safeFetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (netErr: any) {
    throw new Error(`Błąd połączenia z serwerem: ${netErr.message || 'Brak odpowiedzi'}`);
  }

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : {};
  } catch (parseErr) {
    // If not JSON, format a meaningful message without crashing on JSON.parse
    if (!res.ok) {
      // Remove HTML tags if present
      const cleanSnippet = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 150);
      throw new Error(`Błąd serwera (${res.status}): ${cleanSnippet || res.statusText || 'Nieprawidłowa odpowiedź'}`);
    }
    throw new Error('Odpowiedź serwera ma nieprawidłowy format danych (oczekiwano JSON).');
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Żądanie nie powiodło się (${res.status})`);
  }

  if (data && data.success === false) {
    throw new Error(data.error || data.message || 'Wystąpił błąd podczas przetwarzania operacji.');
  }

  return data as T;
}
