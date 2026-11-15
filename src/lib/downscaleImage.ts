const TWO_MB = 2 * 1024 * 1024;
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export type DecodedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close?: () => void;
};

export type DownscaleDeps = {
  decode: (file: File) => Promise<DecodedImage>;
  toJpegBlob: (width: number, height: number, draw: DecodedImage['draw']) => Promise<Blob>;
};

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name);
}

function jpgName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return `${base || 'photo'}.jpg`;
}

async function defaultDecode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function defaultToJpegBlob(
  width: number,
  height: number,
  draw: DecodedImage['draw']
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  draw(ctx, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', JPEG_QUALITY);
  });
  if (!blob) throw new Error('jpeg encode failed');
  return blob;
}

const defaultDeps: DownscaleDeps = {
  decode: defaultDecode,
  toJpegBlob: defaultToJpegBlob,
};

/**
 * Images over 2 MB are redrawn as JPEG, long side at most 2000 px, quality 0.85.
 * PDFs and images the browser cannot decode are returned unchanged.
 */
export async function downscaleImageFile(
  file: File,
  deps: DownscaleDeps = defaultDeps
): Promise<File> {
  if (!isImage(file) || isPdf(file) || file.size <= TWO_MB) return file;

  let decoded: DecodedImage;
  try {
    decoded = await deps.decode(file);
  } catch {
    return file;
  }

  try {
    const longSide = Math.max(decoded.width, decoded.height);
    const scale = longSide > MAX_EDGE ? MAX_EDGE / longSide : 1;
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const blob = await deps.toJpegBlob(width, height, decoded.draw);
    return new File([blob], jpgName(file.name), { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    decoded.close?.();
  }
}
