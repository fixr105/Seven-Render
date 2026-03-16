/**
 * NBFC Tools Storage Service
 * Uploads report PDFs to Vercel Blob storage.
 */

import { put } from '@vercel/blob';

export const nbfcToolsStorage = {
  /**
   * Upload a report PDF to Vercel Blob storage.
   * @param buffer - PDF content as Buffer
   * @param filename - Filename for the blob (e.g. raad-job123.pdf)
   * @returns The public blob URL
   */
  async uploadReport(buffer: Buffer, filename: string): Promise<string> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error(
        'BLOB_READ_WRITE_TOKEN is required for report uploads. Add it to your environment.',
      );
    }

    const blob = await put(filename, buffer, {
      access: 'public',
      token,
    });

    return blob.url;
  },
};
