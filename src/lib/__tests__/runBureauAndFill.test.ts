import { describe, expect, it, vi, beforeEach } from 'vitest';
import { airtableGet, qualifyApplicant } from '../../services/engineClient';
import {
  applyAddressIndexToPatch,
  buildAddressLine,
  buildBureauVerifyKey,
  mapQualifyApplicantToFormPatch,
  mergeBureauMetaIntoFormData,
  runBureauAndFill,
} from '../runBureauAndFill';

vi.mock('../../services/engineClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/engineClient')>();
  return {
    ...actual,
    qualifyApplicant: vi.fn(),
    airtableGet: vi.fn(),
  };
});

const PASS_RESPONSE = {
  ok: true,
  pass: true,
  is_ntc: false,
  kill_code: null,
  failed: [],
  missing: [],
  bureau_ref: 'AL6af8test',
  cached: false,
  applicant: {
    name: 'PRIYA SHARMA',
    dob: '1992-09-30',
    pan: 'ABCDE1234F',
    mobile: '9876543210',
    email: 'priya@example.com',
    gender: 'Female',
    addresses: [
      {
        line1: 'HOUSE AND STREET',
        line2: 'AREA',
        line3: null,
        city: null,
        state_code: '29',
        pin: '560078',
      },
    ],
  },
};

describe('mapQualifyApplicantToFormPatch', () => {
  it('maps pass applicant including Karnataka from state_code 29', () => {
    const { patch } = mapQualifyApplicantToFormPatch('coApplicant', PASS_RESPONSE.applicant, {
      keepPan: 'ABCDE1234F',
      keepMobile: '9876543210',
    });
    expect(patch['coApplicant.dob']).toBe('1992-09-30');
    expect(patch['coApplicant.email']).toBe('priya@example.com');
    expect(patch['coApplicant.gender']).toBe('Female');
    expect(patch['coApplicant.address.line1']).toBe('HOUSE AND STREET, AREA');
    expect(patch['coApplicant.address.pincode']).toBe('560078');
    expect(patch['coApplicant.address.state']).toBe('Karnataka');
    expect(patch['coApplicant.pan']).toBe('ABCDE1234F');
    expect(patch['coApplicant.mobile']).toBe('9876543210');
  });

  it('leaves dob/address empty when null or empty addresses', () => {
    const { patch } = mapQualifyApplicantToFormPatch(
      'coApplicant',
      {
        name: 'PRIYA SHARMA',
        dob: null,
        email: null,
        gender: null,
        addresses: [],
      },
      { keepPan: 'ABCDE1234F', keepMobile: '9876543210' }
    );
    expect(patch['coApplicant.name']).toBe('PRIYA SHARMA');
    expect(patch['coApplicant.dob']).toBeUndefined();
    expect(patch['coApplicant.address.line1']).toBeUndefined();
    expect(Object.values(patch).every((v) => v !== 'null' && v !== 'empty')).toBe(true);
  });
});

describe('buildAddressLine', () => {
  it('skips null parts', () => {
    expect(
      buildAddressLine({ line1: 'A', line2: null, line3: 'C', city: null, state_code: null, pin: null })
    ).toBe('A, C');
  });
});

describe('runBureauAndFill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills from pass response and sets meta', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PASS_RESPONSE);
    const outcome = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: 'FILE-1-CO',
      requested_amount: 100000,
    });
    expect(outcome.status).toBe('pass');
    expect(outcome.formDataPatch['coApplicant.dob']).toBe('1992-09-30');
    expect(outcome.meta.bureau_ref).toBe('AL6af8test');
    expect(outcome.guardWrite).toMatchObject({
      role: 'support',
      pan: 'ABCDE1234F',
      mobile: '9876543210',
    });
    expect(qualifyApplicant).toHaveBeenCalledTimes(1);
    const body = (qualifyApplicant as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body).toMatchObject({
      Full_Name: 'Priya Sharma',
      Mobile_Number: '9876543210',
      PAN_Number: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: 'FILE-1-CO',
      requested_amount: 100000,
    });
  });

  it('treats NTC-only fail as ntc', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      pass: false,
      failed: [{ rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' }],
      applicant: { name: 'NTC PERSON', addresses: [] },
    });
    const outcome = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'NTC PERSON',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
    });
    expect(outcome.status).toBe('ntc');
  });

  it('treats NTC plus a score-floor failure as ntc', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      pass: false,
      failed: [
        { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
        { rejection_code: 'CIBIL_BELOW_650' },
      ],
      applicant: { name: 'NTC PERSON', addresses: [] },
    });
    const outcome = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'NTC PERSON',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
    });
    expect(outcome.status).toBe('ntc');
  });

  it('autofills on fail and returns reasons', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      pass: false,
      kill_code: 'CC_OVERDUE_GT_5000',
      failed: [{ parameter: 'cc_overdue', rejection_code: 'CC_OVERDUE_GT_5000' }],
      applicant: PASS_RESPONSE.applicant,
      bureau_ref: 'AL-fail',
    });
    const outcome = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
    });
    expect(outcome.status).toBe('fail');
    expect(outcome.formDataPatch['coApplicant.name']).toBe('PRIYA SHARMA');
    expect(outcome.reasons.some((r) => /credit card overdue/i.test(r))).toBe(true);
  });

  it('returns error without autofill on ok false', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      state: 'INPUT_ERROR',
      missing: ['Full_Name'],
    });
    const outcome = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'X',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
    });
    expect(outcome.status).toBe('error');
    expect(outcome.formDataPatch).toEqual({});
  });

  it('does not reuse an error outcome for the same PAN|mobile', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, state: 'BUREAU_ERROR' })
      .mockResolvedValueOnce(PASS_RESPONSE);
    const first = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
    });
    expect(first.status).toBe('error');
    const second = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
      lastVerifiedKey: buildBureauVerifyKey('ABCDE1234F', '9876543210'),
      previousOutcome: first,
    });
    expect(qualifyApplicant).toHaveBeenCalledTimes(2);
    expect(second.status).toBe('pass');
    expect(second.reused).not.toBe(true);
  });

  it('does not call qualify when a fresh bureau guard matches PAN and mobile', async () => {
    const lookupBureauCache = vi.fn().mockResolvedValue({
      ok: true,
      pass: true,
      cached: true,
      applicant: PASS_RESPONSE.applicant,
    });
    const outcome = await runBureauAndFill({
      prefix: 'borrower',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: 'FILE-1',
      requested_amount: 100000,
      formData: {
        '_meta.bureauGuard': {
          borrower: {
            pan: 'ABCDE1234F',
            mobile: '9876543210',
            calledAt: '2026-11-01T00:00:00.000Z',
          },
        },
      },
      now: new Date('2026-11-15T00:00:00.000Z'),
      cacheDays: 30,
      lookupBureauCache,
    });
    expect(qualifyApplicant).not.toHaveBeenCalled();
    expect(lookupBureauCache).toHaveBeenCalledWith('ABCDE1234F');
    expect(outcome.status).toBe('pass');
    expect(outcome.reused).toBe(true);
  });

  it('calls qualify when the bureau guard PAN does not match', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PASS_RESPONSE);
    const lookupBureauCache = vi.fn();
    await runBureauAndFill({
      prefix: 'borrower',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: 'FILE-1',
      requested_amount: 100000,
      formData: {
        '_meta.bureauGuard': {
          borrower: {
            pan: 'OTHER1234Z',
            mobile: '9876543210',
            calledAt: '2026-11-01T00:00:00.000Z',
          },
        },
      },
      now: new Date('2026-11-15T00:00:00.000Z'),
      cacheDays: 30,
      lookupBureauCache,
    });
    expect(qualifyApplicant).toHaveBeenCalledTimes(1);
    expect(lookupBureauCache).not.toHaveBeenCalled();
  });

  it('reuses previous outcome for same PAN|mobile', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PASS_RESPONSE);
    const first = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
    });
    const second = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'Priya Sharma',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
      lastVerifiedKey: buildBureauVerifyKey('ABCDE1234F', '9876543210'),
      previousOutcome: first,
    });
    expect(qualifyApplicant).toHaveBeenCalledTimes(1);
    expect(second.reused).toBe(true);
  });

  it('blocks same PAN as borrower without calling qualify', async () => {
    const outcome = await runBureauAndFill({
      prefix: 'coApplicant',
      fullName: 'Same Person',
      mobile: '9876543210',
      pan: 'BAIPG3083L',
      consent_bureau_at: '2026-11-15T01:00:00.000Z',
      application_id: '',
      requested_amount: 0,
      borrowerPan: 'BAIPG3083L',
    });
    expect(qualifyApplicant).not.toHaveBeenCalled();
    expect(outcome.status).toBe('error');
    expect(outcome.errorMessage).toMatch(/same person/i);
  });

  it('merges bureau meta without wiping panLookup', () => {
    const merged = mergeBureauMetaIntoFormData(
      { '_meta.panLookup.status': 'success', 'borrower.pan': 'BAIPG3083L' },
      '_meta.coApplicantBureau',
      {
        status: 'pass',
        is_ntc: false,
        bureau_ref: 'AL1',
        cached: false,
        failed_codes: [],
        checked_at: '2026-11-15T01:00:00.000Z',
        pan: 'ABCDE1234F',
      }
    );
    expect(merged['_meta.panLookup.status']).toBe('success');
    expect(merged['_meta.coApplicantBureau.status']).toBe('pass');
    expect(merged['borrower.pan']).toBe('BAIPG3083L');
  });

  it('returns every cached bureau address instead of only the first', async () => {
    vi.mocked(airtableGet).mockResolvedValue({
      records: [
        {
          id: 'recCache',
          fields: {
            pan: 'ABCDE1234F',
            mobile: '9876543210',
            score: 712,
            applicant: {
              name: 'PRIYA SHARMA',
              addresses: [
                { line1: '12 Main Street', city: 'Chennai', pincode: '600001', state: 'Tamil Nadu' },
                { line1: '88 Lake Road', city: 'Madurai', pin: '625001', state_code: '33' },
              ],
            },
          },
        },
      ],
    } as never);

    const now = new Date('2026-11-17T12:00:00.000Z');
    const outcome = await runBureauAndFill({
      prefix: 'borrower',
      fullName: 'PRIYA SHARMA',
      mobile: '9876543210',
      pan: 'ABCDE1234F',
      consent_bureau_at: now.toISOString(),
      application_id: 'rec1',
      requested_amount: 100000,
      formData: {
        '_meta.bureauGuard': {
          borrower: {
            pan: 'ABCDE1234F',
            mobile: '9876543210',
            calledAt: now.toISOString(),
          },
        },
      },
      now,
    });

    expect(qualifyApplicant).not.toHaveBeenCalled();
    expect(outcome.addresses.map((address) => address.line1)).toEqual([
      '12 Main Street',
      '88 Lake Road',
    ]);
    expect(outcome.formDataPatch['borrower.address.line1']).toBe('12 Main Street');
  });

  it('switches address index', () => {
    const addresses = [
      { line1: 'A', line2: null, line3: null, city: 'X', state_code: '29', pin: '560078' },
      { line1: 'B', line2: 'C', line3: null, city: 'Y', state_code: '09', pin: '241001' },
    ];
    const patch = applyAddressIndexToPatch('coApplicant', addresses, 1, {});
    expect(patch['coApplicant.address.line1']).toBe('B, C');
    expect(patch['coApplicant.address.state']).toBe('Uttar Pradesh');
  });

  it('submit-shaped form_data keeps coApplicant and bureau meta keys', () => {
    const formData = {
      'borrower.pan': 'BAIPG3083L',
      'coApplicant.name': 'PRIYA SHARMA',
      'coApplicant.pan': 'ABCDE1234F',
      '_meta.panLookup.status': 'success',
      '_meta.formTemplate': 'b2c_ev_v1',
    };
    const merged = mergeBureauMetaIntoFormData(formData, '_meta.coApplicantBureau', {
      status: 'pass',
      is_ntc: false,
      bureau_ref: 'AL1',
      cached: true,
      failed_codes: [],
      checked_at: '2026-11-15T01:00:00.000Z',
      pan: 'ABCDE1234F',
    });
    const payload = { ...merged, '_meta.formTemplate': 'b2c_ev_v1' };
    expect(payload['coApplicant.name']).toBe('PRIYA SHARMA');
    expect(payload['coApplicant.pan']).toBe('ABCDE1234F');
    expect(payload['_meta.coApplicantBureau.status']).toBe('pass');
    expect(payload['_meta.panLookup.status']).toBe('success');
    expect(JSON.stringify(payload)).toContain('coApplicant.name');
    expect(JSON.stringify(payload)).toContain('_meta.coApplicantBureau');
  });
});
