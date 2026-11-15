/** Sanitize filename for Documents string: replace `,` and `|` with `_`. */
export function sanitizeDocumentFilename(filename: string): string {
  return String(filename || '')
    .trim()
    .replace(/[,|]/g, '_');
}

/** Build `fieldId:url|filename` entries joined by commas. */
export function formatDocumentsFieldEntries(
  entries: Array<{ fieldId: string; url: string; filename: string }>
): string {
  return entries
    .filter((e) => e.fieldId && e.url)
    .map((e) => `${e.fieldId}:${e.url}|${sanitizeDocumentFilename(e.filename)}`)
    .join(',');
}

export function parseDocumentsField(raw: unknown): Array<{
  fieldId: string;
  url: string;
  filename: string;
}> {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) return [];
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(':');
      if (colon < 0) return null;
      const fieldId = part.slice(0, colon).trim();
      const rest = part.slice(colon + 1);
      const pipe = rest.indexOf('|');
      const url = (pipe >= 0 ? rest.slice(0, pipe) : rest).trim();
      const filename = (pipe >= 0 ? rest.slice(pipe + 1) : '').trim();
      if (!fieldId || !url) return null;
      return { fieldId, url, filename };
    })
    .filter((e): e is { fieldId: string; url: string; filename: string } => Boolean(e));
}

export function upsertDocumentsFieldEntry(
  existing: unknown,
  entry: { fieldId: string; url: string; filename: string }
): string {
  const list = parseDocumentsField(existing).filter((e) => e.fieldId !== entry.fieldId);
  list.push(entry);
  return formatDocumentsFieldEntries(list);
}
