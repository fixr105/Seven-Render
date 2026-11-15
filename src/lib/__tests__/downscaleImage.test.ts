import { describe, expect, it } from 'vitest';
import { downscaleImageFile } from '../downscaleImage';

describe('downscaleImageFile', () => {
  it('redraws a 6 MB image as a smaller jpg and leaves a 6 MB PDF unchanged', async () => {
    const image = new File([new Uint8Array(6 * 1024 * 1024)], 'camera.png', { type: 'image/png' });
    const pdf = new File([new Uint8Array(6 * 1024 * 1024)], 'statement.pdf', { type: 'application/pdf' });

    const scaled = await downscaleImageFile(image, {
      decode: async () => ({
        width: 4000,
        height: 3000,
        draw() {
          return undefined;
        },
      }),
      toJpegBlob: async (width, height) => {
        expect(width).toBe(2000);
        expect(height).toBe(1500);
        return new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
      },
    });

    expect(scaled).not.toBe(image);
    expect(scaled.name).toBe('camera.jpg');
    expect(scaled.type).toBe('image/jpeg');
    expect(scaled.size).toBeLessThan(image.size);

    const untouched = await downscaleImageFile(pdf, {
      decode: async () => {
        throw new Error('pdf must not be decoded');
      },
      toJpegBlob: async () => new Blob(),
    });
    expect(untouched).toBe(pdf);
  });
});
