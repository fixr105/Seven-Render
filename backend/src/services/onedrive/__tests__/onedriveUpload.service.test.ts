import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { uploadToOneDrive } from '../onedriveUpload.service.js';

describe('uploadToOneDrive', () => {
  const originalEnv = process.env.ONEDRIVE_UPLOAD_URL;
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.ONEDRIVE_UPLOAD_URL = 'https://example.com/webhook/upload';
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            shareLink: 'https://cdn.example.com/geo.jpg',
            fileId: 'file-1',
            webUrl: 'https://cdn.example.com/geo.jpg',
          },
        }),
    } as never);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.ONEDRIVE_UPLOAD_URL = originalEnv;
    fetchMock.mockReset();
  });

  it('uploads file and returns share link metadata', async () => {
    const result = await uploadToOneDrive({
      buffer: Buffer.from('jpeg-bytes'),
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fieldId: 'withSupportPerson',
      loanApplicationId: 'draft-1',
      clientId: 'CL001',
    });

    expect(result.shareLink).toBe('https://cdn.example.com/geo.jpg');
    expect(result.fieldId).toBe('withSupportPerson');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/webhook/upload',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when ONEDRIVE_UPLOAD_URL is missing', async () => {
    delete process.env.ONEDRIVE_UPLOAD_URL;

    await expect(
      uploadToOneDrive({
        buffer: Buffer.from('x'),
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fieldId: 'withVehicle',
      })
    ).rejects.toThrow('ONEDRIVE_UPLOAD_URL missing');
  });
});
