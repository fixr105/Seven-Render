import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { uploadGeoPhotoToWebhook } from '../geoPhotoUpload.service.js';

describe('uploadGeoPhotoToWebhook', () => {
  const originalEnv = {
    N8N_BASE_URL: process.env.N8N_BASE_URL,
    N8N_GEO_UPLOAD_UPL1_URL: process.env.N8N_GEO_UPLOAD_UPL1_URL,
    N8N_GEO_UPLOAD_UPL2_URL: process.env.N8N_GEO_UPLOAD_UPL2_URL,
    N8N_GEO_UPLOAD_UPL3_URL: process.env.N8N_GEO_UPLOAD_UPL3_URL,
  };
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.N8N_BASE_URL = 'https://fixrrahul.app.n8n.cloud';
    delete process.env.N8N_GEO_UPLOAD_UPL1_URL;
    delete process.env.N8N_GEO_UPLOAD_UPL2_URL;
    delete process.env.N8N_GEO_UPLOAD_UPL3_URL;
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.N8N_BASE_URL = originalEnv.N8N_BASE_URL;
    if (originalEnv.N8N_GEO_UPLOAD_UPL1_URL) {
      process.env.N8N_GEO_UPLOAD_UPL1_URL = originalEnv.N8N_GEO_UPLOAD_UPL1_URL;
    } else {
      delete process.env.N8N_GEO_UPLOAD_UPL1_URL;
    }
    if (originalEnv.N8N_GEO_UPLOAD_UPL2_URL) {
      process.env.N8N_GEO_UPLOAD_UPL2_URL = originalEnv.N8N_GEO_UPLOAD_UPL2_URL;
    } else {
      delete process.env.N8N_GEO_UPLOAD_UPL2_URL;
    }
    if (originalEnv.N8N_GEO_UPLOAD_UPL3_URL) {
      process.env.N8N_GEO_UPLOAD_UPL3_URL = originalEnv.N8N_GEO_UPLOAD_UPL3_URL;
    } else {
      delete process.env.N8N_GEO_UPLOAD_UPL3_URL;
    }
  });

  it('posts to UPL1 for withSupportPerson slot', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => 'https://cdn.example.com/geo-1.jpg',
    } as never);

    const result = await uploadGeoPhotoToWebhook({
      buffer: Buffer.from('jpeg-bytes'),
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fieldId: 'withSupportPerson',
      loanApplicationId: 'draft-1',
    });

    expect(result.shareLink).toBe('https://cdn.example.com/geo-1.jpg');
    expect(result.fieldId).toBe('withSupportPerson');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://fixrrahul.app.n8n.cloud/webhook/UPL1',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('posts to UPL2 for withVehicle slot', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ url: 'https://cdn.example.com/geo-2.jpg' }),
    } as never);

    const result = await uploadGeoPhotoToWebhook({
      buffer: Buffer.from('jpeg-bytes'),
      fileName: 'vehicle.jpg',
      mimeType: 'image/jpeg',
      fieldId: 'withVehicle',
    });

    expect(result.shareLink).toBe('https://cdn.example.com/geo-2.jpg');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://fixrrahul.app.n8n.cloud/webhook/UPL2',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('posts to UPL3 for atResidence slot', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          data: { shareLink: 'https://cdn.example.com/geo-3.jpg' },
        }),
    } as never);

    const result = await uploadGeoPhotoToWebhook({
      buffer: Buffer.from('jpeg-bytes'),
      fileName: 'residence.jpg',
      mimeType: 'image/jpeg',
      fieldId: 'atResidence',
    });

    expect(result.shareLink).toBe('https://cdn.example.com/geo-3.jpg');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://fixrrahul.app.n8n.cloud/webhook/UPL3',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses env override URL when set', async () => {
    process.env.N8N_GEO_UPLOAD_UPL1_URL = 'https://custom.example.com/upload-one';
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => 'https://cdn.example.com/custom.jpg',
    } as never);

    await uploadGeoPhotoToWebhook({
      buffer: Buffer.from('jpeg-bytes'),
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fieldId: 'withSupportPerson',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom.example.com/upload-one',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('parses uploadtourl array response from n8n webhook', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          {
            id: '632d70e9-b79b-4982-ab45-8b549f6d5419',
            url: 'https://cdn.uploadtourl.com/5205686d-bb3a-472d-8288-96cc03370814_geo-test.jpg',
            status: 'success',
            filename: 'geo-test.jpg',
            size: 5,
            credits_remaining: 984,
            expires_at: '2026-07-14T11:20:17.412265+00:00',
          },
        ]),
    } as never);

    const result = await uploadGeoPhotoToWebhook({
      buffer: Buffer.from('jpeg-bytes'),
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fieldId: 'withSupportPerson',
    });

    expect(result.shareLink).toBe(
      'https://cdn.uploadtourl.com/5205686d-bb3a-472d-8288-96cc03370814_geo-test.jpg'
    );
    expect(result.fileName).toBe('geo-test.jpg');
    expect(result.fileId).toBe('632d70e9-b79b-4982-ab45-8b549f6d5419');
  });

  it('throws when webhook returns non-URL body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => 'not-a-url',
    } as never);

    await expect(
      uploadGeoPhotoToWebhook({
        buffer: Buffer.from('jpeg-bytes'),
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fieldId: 'withSupportPerson',
      })
    ).rejects.toThrow('unrecognised response');
  });
});
