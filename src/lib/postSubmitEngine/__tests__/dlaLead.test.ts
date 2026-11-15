import { describe, expect, it, vi } from 'vitest';
import { fireDlaLead, DLA_NAME } from '../dlaLead';

describe('dlaLead', () => {
  it('posts four fields with stamp_ordered false once', async () => {
    const post = vi.fn().mockResolvedValue({
      status: 201,
      data: { ok: true, request_id: 'R1', lead_id: null },
    });
    const write = vi.fn();
    const next = await fireDlaLead({
      fileId: 'SF1',
      formData: {},
      applicantName: 'GOVIND',
      applicantMobile: '7355621712',
      stampOrdered: false,
      writeFormData: write,
      post,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toEqual({
      applicant_name: 'GOVIND',
      phone: '7355621712',
      dla_name: DLA_NAME,
      stamp_ordered: false,
    });
    const crm = next['_meta.crm'] as { sent: Array<{ id: string }> };
    expect(crm.sent[0].id).toBe('SF1-STAMP_STEP');
  });

  it('posts stamp_ordered true once with STAMP_ORDERED id', async () => {
    const post = vi.fn().mockResolvedValue({
      status: 201,
      data: { ok: true, request_id: 'R2', lead_id: 'L1' },
    });
    const next = await fireDlaLead({
      fileId: 'SF1',
      formData: {},
      applicantName: 'GOVIND',
      applicantMobile: '7355621712',
      stampOrdered: true,
      post,
    });
    expect(post.mock.calls[0][0].stamp_ordered).toBe(true);
    const crm = next['_meta.crm'] as { sent: Array<{ id: string; lead_id?: string }> };
    expect(crm.sent[0].id).toBe('SF1-STAMP_ORDERED');
    expect(crm.sent[0].lead_id).toBe('L1');
  });

  it('does not retry VALIDATION_ERROR; retries 502 once', async () => {
    const bad = vi.fn().mockResolvedValue({
      status: 400,
      data: { ok: false, error_type: 'VALIDATION_ERROR' },
    });
    await fireDlaLead({
      fileId: 'SF1',
      formData: {},
      applicantName: 'A',
      applicantMobile: '9999999999',
      stampOrdered: false,
      post: bad,
    });
    expect(bad).toHaveBeenCalledTimes(1);

    const flaky = vi
      .fn()
      .mockResolvedValueOnce({
        status: 502,
        data: { ok: false, error_type: 'UPSTREAM_ERROR' },
      })
      .mockResolvedValueOnce({
        status: 201,
        data: { ok: true, request_id: 'R3', lead_id: 'L3' },
      });
    await fireDlaLead({
      fileId: 'SF2',
      formData: {},
      applicantName: 'A',
      applicantMobile: '9999999999',
      stampOrdered: false,
      post: flaky,
      sleep: async () => undefined,
    });
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it('skips when already sent', async () => {
    const post = vi.fn();
    await fireDlaLead({
      fileId: 'SF1',
      formData: {
        '_meta.crm': {
          sent: [{ id: 'SF1-STAMP_STEP', at: 'x' }],
          pending: [],
        },
      },
      applicantName: 'A',
      applicantMobile: '9999999999',
      stampOrdered: false,
      post,
    });
    expect(post).not.toHaveBeenCalled();
  });
});
