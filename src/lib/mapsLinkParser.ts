export type MapsParseResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: string };

const SHORT_LINK_MESSAGE =
  "Short links cannot be read. Tap 'Use my current location', or open the link and copy the coordinates.";

const OUTSIDE_INDIA_MESSAGE = 'This location is not in India. Check the link.';

function isInIndia(lat: number, lng: number): boolean {
  return lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
}

export function indiaLocationError(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInIndia(lat, lng)) {
    return OUTSIDE_INDIA_MESSAGE;
  }
  return null;
}

function isShortMapsLink(text: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(text);
}

export function parseMapsLinkOrCoords(input: string): MapsParseResult {
  const text = String(input || '').trim();
  if (!text) {
    return { ok: false, error: 'Paste a Google Maps link or coordinates.' };
  }

  const patterns: RegExp[] = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!isInIndia(lat, lng)) {
      return { ok: false, error: OUTSIDE_INDIA_MESSAGE };
    }
    return { ok: true, lat, lng };
  }

  if (isShortMapsLink(text)) {
    return { ok: false, error: SHORT_LINK_MESSAGE };
  }

  return { ok: false, error: 'Could not read coordinates from that link.' };
}

export { SHORT_LINK_MESSAGE, OUTSIDE_INDIA_MESSAGE };
