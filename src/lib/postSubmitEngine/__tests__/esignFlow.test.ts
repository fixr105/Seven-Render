import { describe, expect, it, vi } from 'vitest';
import {
  buildEsignPayload,
  buildEsignRefId,
  runEsignPrechecks,
} from '../esignFlow';
import type { EsignConfig } from '../../esignConfig';

const CONFIG: EsignConfig = {
  sign_project: 'seven_dealer_ev',
  sign_title: 'Loan Agreement',
  sign_reason: 'Loan Agreement Execution',
  sign_method: 'aadhaar_otp',
  sign_position_default: 'bottom-right',
  sign_all_pages: true,
  sign_order: 'sequential',
  sign_geo_required: true,
  sign_video_required: false,
  sign_position_applicant: 'bottom-right',
  sign_position_co_applicant: 'bottom-left',
};

const BASE_FORM = {
  'borrower.customerName': 'GOVIND',
  'borrower.mobile': '7355621712',
  'borrower.email': 'govind@example.com',
  '_meta.supportPersonType': 'co_applicant',
  'coApplicant.name': 'RITA',
  'coApplicant.mobile': '9876543210',
  'coApplicant.email': 'rita@example.com',
  '_meta.signing': {
    pack_url: 'https://cdn.example/pack.pdf',
    esign_ready: true,
  },
};

describe('esignFlow', () => {
  it('STOPs when config missing — no send', async () => {
    const result = await runEsignPrechecks({
      formData: BASE_FORM,
      loadConfig: async () => ({
        ok: false,
        missingKey: 'sign_project',
        message: 'Signing setup is incomplete. Contact support.',
      }),
    });
    expect(result.ok).toBe(false);
  });

  it('needs email input when support email missing', async () => {
    const result = await runEsignPrechecks({
      formData: { ...BASE_FORM, 'coApplicant.email': '' },
      loadConfig: async () => ({ ok: true, config: CONFIG }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.needsEmails).toBe(true);
      expect(result.missing?.supportEmail).toBe(true);
    }
  });

  it('blocks same mobile or email', async () => {
    const sameMobile = await runEsignPrechecks({
      formData: { ...BASE_FORM, 'coApplicant.mobile': '7355621712' },
      loadConfig: async () => ({ ok: true, config: CONFIG }),
    });
    expect(sameMobile.ok).toBe(false);

    const sameEmail = await runEsignPrechecks({
      formData: { ...BASE_FORM, 'coApplicant.email': 'govind@example.com' },
      loadConfig: async () => ({ ok: true, config: CONFIG }),
    });
    expect(sameEmail.ok).toBe(false);
  });

  it('builds payload with JSON booleans and SIGN1 refId', () => {
    const payload = buildEsignPayload({
      config: CONFIG,
      fileId: 'SFMWHK65WO',
      packUrl: 'https://cdn.example/pack.pdf',
      applicant: {
        name: 'GOVIND',
        email: 'govind@example.com',
        mobile: '7355621712',
        label: 'Applicant',
        emailKey: 'borrower.email',
      },
      support: {
        name: 'RITA',
        email: 'rita@example.com',
        mobile: '9876543210',
        label: 'Co-applicant',
        emailKey: 'coApplicant.email',
      },
    });
    expect(payload.refId).toBe(buildEsignRefId('SFMWHK65WO'));
    expect(payload.signAllPages).toBe(true);
    expect(payload.geoRequired).toBe(true);
    expect(payload.videoRequired).toBe(false);
    expect(Array.isArray(payload.signatories)).toBe(true);
    expect((payload.signatories as unknown[]).length).toBe(2);
  });

  it('precheck ok when pack ready and parties valid', async () => {
    const result = await runEsignPrechecks({
      formData: BASE_FORM,
      loadConfig: async () => ({ ok: true, config: CONFIG }),
    });
    expect(result.ok).toBe(true);
  });
});

describe('feature flags default off', () => {
  it('stamp and esign flags are off by default in vitest', async () => {
    const { isStampOrderEnabled, isEsignEnabled } = await import('../../featureFlags');
    expect(isStampOrderEnabled()).toBe(false);
    expect(isEsignEnabled()).toBe(false);
  });
});
