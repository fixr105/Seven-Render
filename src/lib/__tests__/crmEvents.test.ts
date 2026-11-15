import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCrmMessageBody,
  fireEvent,
  flushCrm,
  sendToCrm,
  stripSensitiveFormData,
} from '../crmEvents';
import * as toolsClient from '../../services/toolsClient';

describe('stripSensitiveFormData', () => {
  it('removes score/bureau keys at any nesting depth', () => {
    const cleaned = stripSensitiveFormData({
      'borrower.customerName': 'GOVIND',
      'borrower.pan': 'HSJPP5704A',
      score: 750,
      cibil_score: 750,
      '_meta.borrowerBureau': {
        bureau_ref: 'AL-1',
        is_ntc: false,
        kill_code: 'X',
        result_json: { nested: true },
        status: 'ok',
      },
      keep: { nested_ok: true },
    });
    const raw = JSON.stringify(cleaned);
    expect(cleaned['borrower.customerName']).toBe('GOVIND');
    expect(cleaned['borrower.pan']).toBe('HSJPP5704A');
    expect(cleaned.keep).toEqual({ nested_ok: true });
    expect(raw).not.toMatch(/score|result_json|bureau_ref|cibil_score|is_ntc|kill_code/i);
    expect((cleaned['_meta.borrowerBureau'] as Record<string, unknown>).status).toBe('ok');
  });
});

describe('crmEvents → sevenfin-dla-event', () => {
  beforeEach(() => {
    vi.spyOn(toolsClient, 'postSevenfinDlaEvent').mockResolvedValue({
      status: 201,
      data: {
        ok: true,
        event_id: 'EVT-1',
        file_id: 'SF1',
        event: 'ELIGIBILITY_PASS',
      },
    });
    vi.spyOn(toolsClient, 'postSevenfinCrmLead').mockResolvedValue({
      status: 201,
      data: {
        ok: true,
        created: true,
        duplicate: false,
        lead_id: 'lead-1',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ELIGIBILITY_PASS posts dla-event with stripped payload and also crm-lead', async () => {
    const formData = {
      'borrower.customerName': 'GOVIND PANDEY',
      score: 750,
      '_meta.borrowerBureau': { bureau_ref: 'AL-1', status: 'ok' },
    };
    const result = await sendToCrm('ELIGIBILITY_PASS', 'Lender found for GOVIND PANDEY', '', {
      applicantName: 'Govind Pandey',
      applicantMobile: '7355621712',
      fileId: 'SFMWHK65WO',
      seq: 1,
      formData,
      withJson: true,
    });
    expect(result.sent).toBe(true);
    if (result.sent) {
      expect(result.reference).toBe('EVT-1');
      expect(result.lead_id).toBe('lead-1');
    }
    expect(toolsClient.postSevenfinDlaEvent).toHaveBeenCalledTimes(1);
    expect(toolsClient.postSevenfinCrmLead).toHaveBeenCalledTimes(1);

    const body = vi.mocked(toolsClient.postSevenfinDlaEvent).mock.calls[0][0];
    expect(body.event).toBe('ELIGIBILITY_PASS');
    expect(body.file_id).toBe('SFMWHK65WO');
    expect(body.dla_name).toBe('Seven Dealer EV');
    expect(body.applicant_name).toBe('GOVIND PANDEY');
    expect(body.phone).toBe('7355621712');
    expect(body.summary).toBe('Lender found for GOVIND PANDEY');
    expect(body.owner).toBe('Ajay');
    expect(body.seq).toBe(1);
    expect(typeof body.timestamp).toBe('string');
    expect(body.payload).toMatchObject({
      'borrower.customerName': 'GOVIND PANDEY',
      '_meta.borrowerBureau': { status: 'ok' },
    });
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/"score"|result_json|bureau_ref|cibil_score|is_ntc|kill_code/i);
  });

  it('CO_APPLICANT_CHECK sends payload null', async () => {
    await sendToCrm('CO_APPLICANT_CHECK', 'Co-applicant pass', '', {
      applicantName: 'GOVIND',
      applicantMobile: '7355621712',
      fileId: 'SF1',
      seq: 1,
      formData: { a: 1 },
      withJson: false,
    });
    const body = vi.mocked(toolsClient.postSevenfinDlaEvent).mock.calls[0][0];
    expect(body.payload).toBeNull();
    expect(toolsClient.postSevenfinCrmLead).not.toHaveBeenCalled();
  });

  it('DEADLINE_MISSED with seq 2 sends seq 2', async () => {
    await sendToCrm('DEADLINE_MISSED', 'missed #2', '', {
      applicantName: 'GOVIND',
      applicantMobile: '7355621712',
      fileId: 'SF1',
      seq: 2,
      formData: { keep: true, score: 1 },
      withJson: true,
    });
    const body = vi.mocked(toolsClient.postSevenfinDlaEvent).mock.calls[0][0];
    expect(body.event).toBe('DEADLINE_MISSED');
    expect(body.seq).toBe(2);
    expect(body.payload).toEqual({ keep: true });
  });

  it('network error returns sent false and does not throw', async () => {
    vi.mocked(toolsClient.postSevenfinDlaEvent).mockRejectedValueOnce(
      new Error('Request timed out')
    );
    await expect(
      sendToCrm('VKYC_FAILED', 'failed', '', {
        applicantName: 'A',
        applicantMobile: '9999999999',
        fileId: 'SF1',
      })
    ).resolves.toMatchObject({ sent: false });
  });

  it('duplicate dla-event counts as sent', async () => {
    vi.mocked(toolsClient.postSevenfinDlaEvent).mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        duplicate: true,
        event_id: 'EVT-DUP',
        message: 'Event already recorded',
      },
    });
    const result = await sendToCrm('ELIGIBILITY_FAIL', 'Not eligible', '', {
      applicantName: 'A',
      applicantMobile: '9999999999',
      fileId: 'SF1',
    });
    expect(result).toMatchObject({ sent: true, duplicate: true, reference: 'EVT-DUP' });
  });

  it('builds body in 2.3 shape with masked mobile', () => {
    const formData = { 'borrower.customerName': 'GOVIND', score: 750 };
    const body = buildCrmMessageBody({
      event: 'ELIGIBILITY_PASS',
      summary: 'Lender found for GOVIND',
      fileId: 'SF1',
      applicantName: 'GOVIND',
      applicantMobile: '7355621712',
      formData,
      withJson: true,
    });
    expect(body).toContain('ELIGIBILITY_PASS · Lender found for GOVIND');
    expect(body).toContain('XXXXXX1712');
    expect(body).not.toMatch(/"score"\s*:/);
  });

  it('fireEvent ELIGIBILITY_PASS persists sent with event_id and lead_id', async () => {
    const once = await fireEvent('ELIGIBILITY_PASS', {
      summary: 'Lender found for X',
      fileKey: 'SF1',
      formData: { secret_score: 1, name: 'X' },
      applicantName: 'X',
      applicantMobile: '9999999999',
      withJson: true,
    });
    const crm = once['_meta.crm'] as {
      sent: Array<{ lead_id?: string; reference?: string }>;
      pending: unknown[];
    };
    expect(crm.sent).toHaveLength(1);
    expect(crm.sent[0].reference).toBe('EVT-1');
    expect(crm.sent[0].lead_id).toBe('lead-1');
    expect(crm.pending).toHaveLength(0);
    const payload = vi.mocked(toolsClient.postSevenfinDlaEvent).mock.calls[0][0]
      .payload as Record<string, unknown>;
    expect(payload.name).toBe('X');
    expect(payload.secret_score).toBeUndefined();
  });

  it('fireEvent passes seq from n for DEADLINE_MISSED', async () => {
    await fireEvent('DEADLINE_MISSED', {
      summary: 'missed #2',
      fileKey: 'SF1',
      n: 2,
      formData: { a: 1 },
      applicantName: 'X',
      applicantMobile: '9999999999',
      withJson: true,
    });
    expect(vi.mocked(toolsClient.postSevenfinDlaEvent).mock.calls[0][0].seq).toBe(2);
  });

  it('flushCrm retries pending with seq from id', async () => {
    let formData: Record<string, unknown> = {
      '_meta.crm': {
        sent: [],
        pending: [
          {
            id: 'SF1-DEADLINE_MISSED-2',
            event: 'DEADLINE_MISSED',
            summary: 'missed',
            withJson: true,
          },
        ],
      },
      keep: true,
      score: 9,
    };
    formData = await flushCrm(formData, {
      fileKey: 'SF1',
      applicantName: 'A',
      applicantMobile: '9999999999',
    });
    const body = vi.mocked(toolsClient.postSevenfinDlaEvent).mock.calls[0][0];
    expect(body.seq).toBe(2);
    expect(body.payload).toMatchObject({ keep: true });
    const crm = formData['_meta.crm'] as { sent: unknown[]; pending: unknown[] };
    expect(crm.pending).toHaveLength(0);
    expect(crm.sent).toHaveLength(1);
  });

  it('CRM events only hit sevenfin-dla-event (+ crm-lead on pass)', async () => {
    await sendToCrm('PRICING_UNAVAILABLE', 'no band', '', {
      applicantName: 'A',
      applicantMobile: '9999999999',
      fileId: 'SF1',
    });
    expect(toolsClient.postSevenfinDlaEvent).toHaveBeenCalled();
    expect(toolsClient.postSevenfinCrmLead).not.toHaveBeenCalled();
    expect(toolsClient.postDlaLead).toBeDefined();
  });
});
