/**
 * POSTfull webhooks return either an array of result objects or a single object.
 * Accept both; take the link from the first matching key that is a clean https URL.
 */

const URL_KEYS = [
  'pdf_url',
  'url',
  'fileUrl',
  'file_url',
  'link',
  'publicUrl',
  'public_url',
  'href',
] as const;

function isCleanHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('https://')) return false;
  if (trimmed.includes(',')) return false;
  return true;
}

function urlFromRecord(record: Record<string, unknown>): string {
  for (const key of URL_KEYS) {
    const candidate = record[key];
    if (isCleanHttpsUrl(candidate)) return candidate.trim();
  }
  // Nested data.url (legacy Engine shape)
  const nested = record.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const nestedUrl = (nested as Record<string, unknown>).url;
    if (isCleanHttpsUrl(nestedUrl)) return nestedUrl.trim();
  }
  return '';
}

/** Extract a usable filled-document URL from a POSTfull response body. */
export function extractFilledDocUrl(data: unknown): string {
  if (data == null) return '';
  if (Array.isArray(data)) {
    const first = data[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return urlFromRecord(first as Record<string, unknown>);
    }
    return '';
  }
  if (typeof data === 'object') {
    return urlFromRecord(data as Record<string, unknown>);
  }
  return '';
}
