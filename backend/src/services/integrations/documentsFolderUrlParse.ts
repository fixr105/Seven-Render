/**
 * Parse n8n createfolder webhook responses (no side-effect imports; safe for unit tests).
 */

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Best-effort parse of n8n response into a single folder URL (flexible shapes).
 */
export function extractFolderUrlFromResponse(body: unknown, rawText: string): string | null {
  const trimmed = rawText.trim();
  if (isHttpUrl(trimmed)) return trimmed;

  if (typeof body === 'string' && isHttpUrl(body)) return body.trim();

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const candidates = [
      o.folderUrl,
      o.url,
      o.link,
      o.webUrl,
      o.web_url,
      (o.data && typeof o.data === 'object' && o.data !== null
        ? [
            (o.data as Record<string, unknown>).folderUrl,
            (o.data as Record<string, unknown>).url,
            (o.data as Record<string, unknown>).link,
          ]
        : []),
    ].flat();

    for (const c of candidates) {
      if (typeof c === 'string' && isHttpUrl(c)) return c.trim();
    }

    const msg = o.message;
    if (typeof msg === 'string' && isHttpUrl(msg)) return msg.trim();
  }

  if (Array.isArray(body) && body.length > 0) {
    const first = body[0];
    if (typeof first === 'string' && isHttpUrl(first)) return first.trim();
    if (first && typeof first === 'object') {
      return extractFolderUrlFromResponse(first, '');
    }
  }

  return null;
}
