import { describe, expect, it, vi } from 'vitest';
import {
  buildStampOrderPayload,
  describeStampParties,
  mergeSigningPack,
  runStampFreeChecks,
  stampBootMode,
} from '../stampFlow';
import type { StampConfig } from '../../stampConfig';

const CONFIG: StampConfig = {
  stamp_state: 'Delhi',
  stamp_article_code: '5',
  stamp_purpose: 'Loan Agreement',
  stamp_denomination: 100,
  stamp_first_party: 'Fintree Finance Pvt Ltd',
  stamp_project: 'seven_dealer_ev',
};

const FORM = {
  'borrower.customerName': 'GOVIND PANDEY',
  'borrower.mobile': '7355621712',
  '_meta.supportPersonType': 'co_applicant',
  'coApplicant.name': 'RITA SHARMA',
  'coApplicant.mobile': '9876543210',
};

describe('stampBootMode', () => {
  it('polls status when an access key is already stored', () => {
    expect(stampBootMode({ '_meta.stamps': { accessKey: 'ABCD1234' } })).toBe('poll');
  });

  it('skips ordering and merge when the pack url is already stored', () => {
    expect(
      stampBootMode({ '_meta.signing': { pack_url: 'https://cdn.example/pack.pdf' } })
    ).toBe('pack');
  });
});

describe('describeStampParties', () => {
  it('names a co-applicant and the first party on every row', () => {
    const rows = describeStampParties(FORM, CONFIG.stamp_first_party);
    expect(rows).toEqual([
      {
        rowLabel: 'Applicant',
        secondParty: 'GOVIND PANDEY',
        firstParty: 'Fintree Finance Pvt Ltd',
      },
      {
        rowLabel: 'Co-applicant',
        secondParty: 'RITA SHARMA',
        firstParty: 'Fintree Finance Pvt Ltd',
      },
      {
        rowLabel: 'Applicant & co-applicant',
        secondParty: 'GOVIND PANDEY & RITA SHARMA',
        firstParty: 'Fintree Finance Pvt Ltd',
      },
    ]);
  });
});

describe('stampFlow free checks', () => {
  it('STOPs on missing config without catalog', async () => {
    const getCatalog = vi.fn();
    const result = await runStampFreeChecks({
      formData: FORM,
      fileId: 'SF1',
      loadConfig: async () => ({
        ok: false,
        missingKey: 'stamp_state',
        message: 'Stamp setup is incomplete. Contact support.',
      }),
      getCatalog,
    });
    expect(result.ok).toBe(false);
    expect(getCatalog).not.toHaveBeenCalled();
  });

  it('STOPs when validate returns valid false; names unmodified', async () => {
    const postValidate = vi.fn().mockResolvedValue({
      status: 200,
      data: { ok: true, data: { valid: false, errors: ['too long'], fields: {} } },
    });
    const postQuote = vi.fn();
    const result = await runStampFreeChecks({
      formData: FORM,
      fileId: 'SF1',
      loadConfig: async () => ({ ok: true, config: CONFIG }),
      getCatalog: async () => ({
        status: 200,
        data: {
          ok: true,
          data: [{ product_id: 'p1', state: 'Delhi', serviceable: true }],
        },
      }),
      postValidate,
      postQuote,
    });
    expect(result.ok).toBe(false);
    expect(postQuote).not.toHaveBeenCalled();
    expect(postValidate.mock.calls[0][0].secondParty).toBe('GOVIND PANDEY');
  });

  it('STOPs when unaffordable', async () => {
    const result = await runStampFreeChecks({
      formData: FORM,
      fileId: 'SF1',
      loadConfig: async () => ({ ok: true, config: CONFIG }),
      getCatalog: async () => ({
        status: 200,
        data: {
          ok: true,
          data: [{ product_id: 'p1', state: 'Delhi', serviceable: true }],
        },
      }),
      postValidate: async () => ({
        status: 200,
        data: { ok: true, data: { valid: true, errors: [] } },
      }),
      postQuote: async () => ({
        status: 200,
        data: { ok: true, data: { total: 300, affordable: false } },
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/can't be ordered/i);
  });

  it('passes with three papers and quote', async () => {
    const result = await runStampFreeChecks({
      formData: FORM,
      fileId: 'SFMWHK65WO',
      loadConfig: async () => ({ ok: true, config: CONFIG }),
      getCatalog: async () => ({
        status: 200,
        data: {
          ok: true,
          data: [{ product_id: 'prod-delhi', state: 'Delhi', serviceable: true }],
        },
      }),
      postValidate: async () => ({
        status: 200,
        data: { ok: true, data: { valid: true, errors: [] } },
      }),
      postQuote: async () => ({
        status: 200,
        data: { ok: true, data: { total: 0, affordable: true } },
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.papers).toHaveLength(3);
      expect(result.papers[1].secondParty).toBe('RITA SHARMA');
      expect(result.papers[2].secondParty).toBe('GOVIND PANDEY & RITA SHARMA');
      expect(result.productId).toBe('prod-delhi');
    }
  });
});

describe('stampFlow order + merge', () => {
  it('builds order payload with three orders and no callbackUrl', () => {
    const payload = buildStampOrderPayload({
      config: CONFIG,
      productId: 'p1',
      fileId: 'SF1',
      accessKey: 'ak',
      papers: [
        { refId: 'SF1-S1', firstParty: CONFIG.stamp_first_party, secondParty: 'A', rowLabel: 'Applicant' },
        { refId: 'SF1-S2', firstParty: CONFIG.stamp_first_party, secondParty: 'B', rowLabel: 'Co-applicant' },
        { refId: 'SF1-S3', firstParty: CONFIG.stamp_first_party, secondParty: 'A & B', rowLabel: 'Both' },
      ],
    });
    expect(payload.callbackUrl).toBeUndefined();
    expect((payload.orders as unknown[]).length).toBe(3);
  });

  it('retries failed refIds only', () => {
    const payload = buildStampOrderPayload({
      config: CONFIG,
      productId: 'p1',
      fileId: 'SF1',
      accessKey: 'ak',
      papers: [
        { refId: 'SF1-S1', firstParty: 'F', secondParty: 'A', rowLabel: 'A' },
        { refId: 'SF1-S2', firstParty: 'F', secondParty: 'B', rowLabel: 'B' },
        { refId: 'SF1-S3', firstParty: 'F', secondParty: 'C', rowLabel: 'C' },
      ],
      onlyRefIds: ['SF1-S2'],
    });
    expect((payload.orders as Array<{ refId: string }>).map((o) => o.refId)).toEqual([
      'SF1-S2',
    ]);
  });

  it('merges six files once; permanent false retries once', async () => {
    const postMerge = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: {
          ok: true,
          url: 'https://cdn.example/pack.pdf',
          permanent: false,
          pageCount: 9,
          esignReady: true,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          ok: true,
          url: 'https://cdn.example/pack.pdf',
          permanent: true,
          pageCount: 9,
          esignReady: true,
        },
      });
    const result = await mergeSigningPack({
      fileId: 'SF1',
      stampPdfUrls: [
        'https://cdn.example/s1.pdf',
        'https://cdn.example/s2.pdf',
        'https://cdn.example/s3.pdf',
      ],
      sanctionLetter: 'https://cdn.example/sl.pdf',
      loanAgreement: 'https://cdn.example/la.pdf',
      ckyc: 'https://cdn.example/ck.pdf',
      postMerge,
    });
    expect(result.ok).toBe(true);
    expect(postMerge).toHaveBeenCalledTimes(2);
    const files = postMerge.mock.calls[0][0].files as Array<{ label: string }>;
    expect(files.map((f) => f.label)).toEqual([
      'Stamp - applicant',
      'Stamp - co-applicant',
      'Stamp - applicant and co-applicant',
      'Sanction letter',
      'Loan agreement',
      'CKYC',
    ]);
  });
});
