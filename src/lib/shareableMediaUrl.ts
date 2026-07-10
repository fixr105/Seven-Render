function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function getExternalMediaUrl(url: unknown): string {
  const trimmed = readString(url);
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

export function canEmbedMediaAsImage(url: unknown): boolean {
  const trimmed = getExternalMediaUrl(url);
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;

  const lower = trimmed.toLowerCase();
  if (lower.includes('sharepoint.com') && lower.includes('/:')) return false;
  if (lower.includes('1drv.ms/')) return false;
  if (lower.includes('onedrive.live.com/')) return false;

  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(trimmed) || lower.includes('cdn.');
}
