import { describe, expect, it, vi } from 'vitest';
import {
  buildSevenfinCrmLeadPayload,
  formatLenderFoundTimeline,
  sendSevenfinCrmLeadWithRetry,
  truncate140,
} from '../crm/sevenfinCrmLead';

describe('sevenfinCrmLead', () => {
  it('truncates to 140 and formats timeline', () => {
    expect(truncate140('a'.repeat(200)).length).toBe(140);
    expect(formatLenderFoundTimeline(new Date('2026-11-15T10:00:00Z'))).toMatch(
      /^Lender found \d{2} Nov 2026$/
    );
  });

  it('builds exactly eight A2 fields', () => {
    const payload = buildSevenfinCrmLeadPayload({
      applicantName: 'govind',
      applicantMobile: '+91 7355621712',
      now: new Date('2026-11-15T10:00:00Z'),
    });
    expect(Object.keys(payload)).toHaveLength(8);
    expect(payload.name).toBe('GOVIND');
    expect(payload.phone).toBe('7355621712');
  });

  it('retries once on generic error', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        status: 502,
        data: { ok: false, error_type: 'FRAPPE_ERROR', error_message: 'x' },
      })
      .mockResolvedValueOnce({
        status: 201,
        data: { ok: true, lead_id: 'ok', duplicate: false },
      });
    const result = await sendSevenfinCrmLeadWithRetry({
      applicantName: 'A',
      applicantMobile: '9999999999',
      postLead: post,
      sleep: async () => undefined,
    });
    expect(result.sent).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
  });
});
