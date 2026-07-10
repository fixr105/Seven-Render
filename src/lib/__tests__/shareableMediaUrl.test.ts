import { describe, expect, it } from 'vitest';
import { canEmbedMediaAsImage, getExternalMediaUrl } from '../shareableMediaUrl';

describe('shareableMediaUrl', () => {
  it('normalizes https image URLs', () => {
    expect(getExternalMediaUrl('https://cdn.example.com/photo.jpg')).toBe(
      'https://cdn.example.com/photo.jpg'
    );
    expect(canEmbedMediaAsImage('https://cdn.example.com/photo.jpg')).toBe(true);
  });

  it('does not embed sharepoint sharing pages as images', () => {
    const url = 'https://tenant.sharepoint.com/:i:/g/file.jpg';
    expect(canEmbedMediaAsImage(url)).toBe(false);
    expect(getExternalMediaUrl(url)).toBe(url);
  });
});
