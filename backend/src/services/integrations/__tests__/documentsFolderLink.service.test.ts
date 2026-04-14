import { describe, expect, it } from '@jest/globals';
import { extractFolderUrlFromResponse } from '../documentsFolderUrlParse.js';

describe('extractFolderUrlFromResponse', () => {
  it('returns plain https URL from rawText', () => {
    expect(extractFolderUrlFromResponse({}, 'https://drive.google.com/drive/folders/abc')).toBe(
      'https://drive.google.com/drive/folders/abc'
    );
  });

  it('returns top-level folderUrl', () => {
    expect(
      extractFolderUrlFromResponse(
        { folderUrl: 'https://onedrive.live.com/foo' },
        '{}'
      )
    ).toBe('https://onedrive.live.com/foo');
  });

  it('returns url, link, webUrl', () => {
    expect(extractFolderUrlFromResponse({ url: 'https://a.com/x' }, '')).toBe('https://a.com/x');
    expect(extractFolderUrlFromResponse({ link: 'https://b.com/y' }, '')).toBe('https://b.com/y');
    expect(extractFolderUrlFromResponse({ webUrl: 'https://c.com/z' }, '')).toBe('https://c.com/z');
  });

  it('returns nested data.url', () => {
    expect(
      extractFolderUrlFromResponse({ data: { url: 'https://nested.example/f' } }, '')
    ).toBe('https://nested.example/f');
  });

  it('returns message when it is a URL (non-JSON n8n path)', () => {
    expect(
      extractFolderUrlFromResponse({ message: 'https://drive.google.com/x' }, '')
    ).toBe('https://drive.google.com/x');
  });

  it('returns string body', () => {
    expect(extractFolderUrlFromResponse('https://plain.string/', '')).toBe('https://plain.string/');
  });

  it('returns null when no URL found', () => {
    expect(extractFolderUrlFromResponse({ foo: 'bar' }, 'not a url')).toBeNull();
  });
});
