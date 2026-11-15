import { airtableGet } from '../services/engineClient';

export const ESIGN_CONFIG_KEYS = [
  'sign_project',
  'sign_title',
  'sign_reason',
  'sign_method',
  'sign_position_default',
  'sign_all_pages',
  'sign_order',
  'sign_geo_required',
  'sign_video_required',
  'sign_position_applicant',
  'sign_position_co_applicant',
] as const;

export type EsignConfig = {
  sign_project: string;
  sign_title: string;
  sign_reason: string;
  sign_method: string;
  sign_position_default: string;
  sign_all_pages: boolean;
  sign_order: string;
  sign_geo_required: boolean;
  sign_video_required: boolean;
  sign_position_applicant: string;
  sign_position_co_applicant: string;
};

export type EsignConfigResult =
  | { ok: true; config: EsignConfig }
  | { ok: false; missingKey: string; message: string };

function parseBoolText(raw: string): boolean | null {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

export async function loadEsignConfig(get = airtableGet): Promise<EsignConfigResult> {
  let records: Array<Record<string, unknown>> = [];
  try {
    const res = await get({
      table: 'Config',
      filter_formula: '',
      max: 200,
    });
    records = (res.records || []) as Array<Record<string, unknown>>;
  } catch {
    return {
      ok: false,
      missingKey: 'sign_project',
      message: 'Signing setup is incomplete. Contact support.',
    };
  }

  const map = new Map<string, string>();
  for (const row of records) {
    const key = String(row.key ?? row.Key ?? '').trim();
    const value = String(row.value ?? row.Value ?? '').trim();
    if (key) map.set(key, value);
  }

  const boolKeys = [
    'sign_all_pages',
    'sign_geo_required',
    'sign_video_required',
  ] as const;

  for (const key of ESIGN_CONFIG_KEYS) {
    const value = map.get(key) || '';
    if (!value) {
      return {
        ok: false,
        missingKey: key,
        message: 'Signing setup is incomplete. Contact support.',
      };
    }
    if ((boolKeys as readonly string[]).includes(key) && parseBoolText(value) == null) {
      return {
        ok: false,
        missingKey: key,
        message: 'Signing setup is incomplete. Contact support.',
      };
    }
  }

  return {
    ok: true,
    config: {
      sign_project: map.get('sign_project')!,
      sign_title: map.get('sign_title')!,
      sign_reason: map.get('sign_reason')!,
      sign_method: map.get('sign_method')!,
      sign_position_default: map.get('sign_position_default')!,
      sign_all_pages: parseBoolText(map.get('sign_all_pages')!)!,
      sign_order: map.get('sign_order')!,
      sign_geo_required: parseBoolText(map.get('sign_geo_required')!)!,
      sign_video_required: parseBoolText(map.get('sign_video_required')!)!,
      sign_position_applicant: map.get('sign_position_applicant')!,
      sign_position_co_applicant: map.get('sign_position_co_applicant')!,
    },
  };
}

export function maskEmailForDisplay(email: string): string {
  const raw = String(email || '').trim();
  const at = raw.indexOf('@');
  if (at <= 0) return '***';
  return `${raw[0]}***${raw.slice(at)}`;
}

export function isValidEmail(email: string): boolean {
  const e = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
