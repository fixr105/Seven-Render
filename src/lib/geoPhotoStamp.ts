export type StampTextLines = {
  coordsLine: string;
  timeLine: string;
  fileLine: string;
};

export function buildStampTextLines(input: {
  lat: number;
  lng: number;
  fileId: string;
  slotLabel: string;
  capturedAt?: Date;
}): StampTextLines {
  const at = input.capturedAt || new Date();
  const coordsLine = `Lat ${input.lat.toFixed(6)}, Long ${input.lng.toFixed(6)}`;
  const timeLine = formatIstStamp(at);
  const fileLine = `File ${input.fileId} · ${input.slotLabel}`;
  return { coordsLine, timeLine, fileLine };
}

export function formatIstStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod').toUpperCase();
  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} IST`;
}

/**
 * Draw stamped JPEG on a canvas. Returns blob + the three strings passed to fillText
 * (useful for tests).
 */
export async function stampGeoPhoto(input: {
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  lat: number;
  lng: number;
  fileId: string;
  slotLabel: string;
  capturedAt?: Date;
  fillText?: (text: string, x: number, y: number) => void;
}): Promise<{ blob: Blob; lines: StampTextLines }> {
  const lines = buildStampTextLines({
    lat: input.lat,
    lng: input.lng,
    fileId: input.fileId,
    slotLabel: input.slotLabel,
    capturedAt: input.capturedAt,
  });

  const maxLong = 1600;
  const longSide = Math.max(input.sourceWidth, input.sourceHeight);
  const scale = longSide > maxLong ? maxLong / longSide : 1;
  const w = Math.max(1, Math.round(input.sourceWidth * scale));
  const h = Math.max(1, Math.round(input.sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.drawImage(input.image, 0, 0, w, h);

  const stripH = Math.max(72, Math.round(h * 0.14));
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - stripH, w, stripH);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.max(12, Math.round(stripH / 5.5))}px Inter, sans-serif`;
  ctx.textBaseline = 'top';
  const padX = 12;
  const lineGap = Math.round(stripH / 4.2);
  const startY = h - stripH + Math.round(stripH * 0.18);
  const texts = [lines.coordsLine, lines.timeLine, lines.fileLine];
  texts.forEach((text, i) => {
    const x = padX;
    const y = startY + i * lineGap;
    if (input.fillText) input.fillText(text, x, y);
    ctx.fillText(text, x, y);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to export stamped photo'))),
      'image/jpeg',
      0.85
    );
  });

  return { blob, lines };
}
