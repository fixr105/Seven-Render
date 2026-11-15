import {
  getEdrafterEsignStatus,
  postEdrafterEsign,
} from '../../services/toolsClient';
import { isEsignEnabled } from '../featureFlags';
import { isValidEmail, loadEsignConfig, type EsignConfig } from '../esignConfig';
import { fileIdAlnum } from '../stampConfig';
import { getApplicantParty, getSupportPersonParty } from './supportPersonParty';

export type EsignPartyInput = {
  name: string;
  email: string;
  mobile: string;
  label: string;
  emailKey: string;
};

export type EsignPrecheckOk = {
  ok: true;
  config: EsignConfig;
  applicant: EsignPartyInput;
  support: EsignPartyInput;
  packUrl: string;
  esignReady: boolean;
};

export type EsignPrecheckFail = {
  ok: false;
  message: string;
  needsEmails?: boolean;
  missing?: { applicantEmail?: boolean; supportEmail?: boolean };
  goBackToStamp?: boolean;
};

function readSigningMeta(formData: Record<string, unknown>): Record<string, unknown> {
  const raw = formData['_meta.signing'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function readEsignMeta(formData: Record<string, unknown>): Record<string, unknown> {
  const raw = formData['_meta.esign'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function esignEnabled(): boolean {
  return isEsignEnabled();
}

export function buildEsignRefId(fileId: string): string {
  return `${fileIdAlnum(fileId)}-SIGN1`;
}

export async function runEsignPrechecks(input: {
  formData: Record<string, unknown>;
  loadConfig?: typeof loadEsignConfig;
}): Promise<EsignPrecheckOk | EsignPrecheckFail> {
  const loadConfig = input.loadConfig || loadEsignConfig;
  const cfg = await loadConfig();
  if (!cfg.ok) {
    return { ok: false, message: cfg.message };
  }

  const signing = readSigningMeta(input.formData);
  const packUrl = String(signing.pack_url || '').trim();
  const esignReady = signing.esign_ready === true;
  if (!packUrl.startsWith('https://') || !esignReady) {
    return {
      ok: false,
      message: 'Signing pack is not ready yet.',
      goBackToStamp: true,
    };
  }

  const supportParty = getSupportPersonParty(input.formData);
  if (!supportParty.ok) {
    return { ok: false, message: supportParty.reason };
  }
  const applicantParty = getApplicantParty(input.formData);

  const applicant: EsignPartyInput = {
    name: applicantParty.name,
    email: applicantParty.email,
    mobile: applicantParty.mobile,
    label: 'Applicant',
    emailKey: 'borrower.email',
  };
  const support: EsignPartyInput = {
    name: supportParty.party.name,
    email: supportParty.party.email,
    mobile: supportParty.party.mobile,
    label: supportParty.party.label,
    emailKey: `${supportParty.party.prefix}.email`,
  };

  const missingApplicantEmail = !isValidEmail(applicant.email);
  const missingSupportEmail = !isValidEmail(support.email);
  if (missingApplicantEmail || missingSupportEmail) {
    return {
      ok: false,
      message: 'Email addresses are required for eSign.',
      needsEmails: true,
      missing: {
        applicantEmail: missingApplicantEmail,
        supportEmail: missingSupportEmail,
      },
    };
  }

  if (applicant.mobile.length !== 10 || support.mobile.length !== 10) {
    return { ok: false, message: 'Mobile numbers are required for eSign.' };
  }
  if (
    applicant.mobile === support.mobile ||
    applicant.email.toLowerCase() === support.email.toLowerCase()
  ) {
    return {
      ok: false,
      message:
        'Applicant and co-applicant need their own mobile number and email to sign.',
    };
  }

  return {
    ok: true,
    config: cfg.config,
    applicant,
    support,
    packUrl,
    esignReady,
  };
}

export function buildEsignPayload(input: {
  config: EsignConfig;
  fileId: string;
  packUrl: string;
  applicant: EsignPartyInput;
  support: EsignPartyInput;
}): Record<string, unknown> {
  const id = fileIdAlnum(input.fileId);
  const refId = buildEsignRefId(input.fileId);
  return {
    project: input.config.sign_project,
    refId,
    documentUrl: input.packUrl,
    documentName: `${id}-loan-pack.pdf`,
    title: input.config.sign_title,
    reason: input.config.sign_reason,
    signMethod: input.config.sign_method,
    signaturePosition: input.config.sign_position_default,
    signAllPages: input.config.sign_all_pages,
    signingOrder: input.config.sign_order,
    geoRequired: input.config.sign_geo_required,
    videoRequired: input.config.sign_video_required,
    signatories: [
      {
        name: input.applicant.name,
        email: input.applicant.email,
        phone: input.applicant.mobile,
        position: input.config.sign_position_applicant,
      },
      {
        name: input.support.name,
        email: input.support.email,
        phone: input.support.mobile,
        position: input.config.sign_position_co_applicant,
      },
    ],
  };
}

export async function sendEsign(payload: Record<string, unknown>) {
  return postEdrafterEsign(payload);
}

export async function fetchEsignStatus(refId: string) {
  return getEdrafterEsignStatus(refId);
}

export async function pingEsignTool(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { status, data } = await getEdrafterEsignStatus('PING-NOT-REAL');
    const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    if (status === 404 && (body.error_type === 'NOT_FOUND' || body.ok === false)) {
      return { ok: true };
    }
    // Non-JSON / n8n not registered → tool not published
    if (status === 404 && body.raw != null) {
      return { ok: false, message: 'eSign tool not published. Contact support.' };
    }
    if (typeof data === 'string' && /not registered|webhook/i.test(data)) {
      return { ok: false, message: 'eSign tool not published. Contact support.' };
    }
    return { ok: false, message: 'eSign tool not published. Contact support.' };
  } catch {
    return { ok: false, message: 'eSign tool not published. Contact support.' };
  }
}
