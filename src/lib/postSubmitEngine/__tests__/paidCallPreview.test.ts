import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEdrafterEsignStatus,
  getEdrafterStampStatus,
  postEdrafterEsign,
  postEdrafterStampOrder,
  postPdfMerge,
} from '../../../services/toolsClient';
import { esignEnabled, fetchEsignStatus, sendEsign } from '../esignFlow';
import {
  fetchStampStatus,
  mergeSigningPack,
  placeStampOrder,
  stampOrderEnabled,
} from '../stampFlow';

vi.mock('../../../services/toolsClient', () => ({
  postEdrafterStampOrder: vi.fn(),
  getEdrafterStampStatus: vi.fn(),
  postPdfMerge: vi.fn(),
  postEdrafterEsign: vi.fn(),
  getEdrafterEsignStatus: vi.fn(),
}));

describe('paid call preview while flags are off', () => {
  beforeEach(() => {
    vi.mocked(postEdrafterStampOrder).mockReset();
    vi.mocked(getEdrafterStampStatus).mockReset();
    vi.mocked(postPdfMerge).mockReset();
    vi.mocked(postEdrafterEsign).mockReset();
    vi.mocked(getEdrafterEsignStatus).mockReset();
  });

  it('shows the order and send actions and returns a success without calling the paid tools', async () => {
    expect(stampOrderEnabled()).toBe(true);
    expect(esignEnabled()).toBe(true);

    const ordered = await placeStampOrder({
      groupId: 'SF1',
      orders: [{ refId: 'SF1-S1' }, { refId: 'SF1-S2' }, { refId: 'SF1-S3' }],
    });
    expect(postEdrafterStampOrder).not.toHaveBeenCalled();
    expect(ordered.status).toBe(200);
    expect(ordered.data).toMatchObject({ ok: true });

    const status = await fetchStampStatus('preview-key', 'SF1');
    expect(getEdrafterStampStatus).not.toHaveBeenCalled();
    expect(status.status).toBe(200);
    const body = status.data as {
      summary: { allCompleted: boolean };
      orders: Array<{ canDownload: boolean; stamps: Array<{ pdfUrl: string }> }>;
    };
    expect(body.summary.allCompleted).toBe(true);
    expect(body.orders).toHaveLength(3);
    expect(body.orders.every((order) => order.canDownload && order.stamps[0].pdfUrl.startsWith('https://'))).toBe(
      true
    );

    const merged = await mergeSigningPack({
      fileId: 'SF1',
      stampPdfUrls: [
        'https://preview.invalid/s1.pdf',
        'https://preview.invalid/s2.pdf',
        'https://preview.invalid/s3.pdf',
      ],
      sanctionLetter: 'https://files.example/s.pdf',
      loanAgreement: 'https://files.example/a.pdf',
      ckyc: 'https://files.example/c.pdf',
    });
    expect(postPdfMerge).not.toHaveBeenCalled();
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.url.startsWith('https://')).toBe(true);
      expect(merged.esignReady).toBe(true);
    }

    const sent = await sendEsign({ refId: 'SF1-SIGN1' });
    expect(postEdrafterEsign).not.toHaveBeenCalled();
    expect(sent.status).toBe(200);
    expect(sent.data).toMatchObject({ ok: true, documentId: expect.any(String) });

    const signed = await fetchEsignStatus('SF1-SIGN1');
    expect(getEdrafterEsignStatus).not.toHaveBeenCalled();
    expect(signed.status).toBe(200);
    expect(signed.data).toMatchObject({
      stage: 'signed',
      signedUrl: expect.stringMatching(/^https:\/\//),
    });
  });
});
