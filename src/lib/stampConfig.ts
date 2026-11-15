import { airtableGet } from '../services/engineClient';

export const STAMP_CONFIG_KEYS = [
  'stamp_state',
  'stamp_article_code',
  'stamp_purpose',
  'stamp_denomination',
  'stamp_first_party',
  'stamp_project',
] as const;

export type StampConfigKey = (typeof STAMP_CONFIG_KEYS)[number];

export type StampConfig = {
  stamp_state: string;
  stamp_article_code: string;
  stamp_purpose: string;
  stamp_denomination: number;
  stamp_first_party: string;
  stamp_project: string;
};

export type StampConfigResult =
  | { ok: true; config: StampConfig }
  | { ok: false; missingKey: string; message: string };

export async function loadStampConfig(
  get = airtableGet
): Promise<StampConfigResult> {
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
      missingKey: 'stamp_state',
      message: 'Stamp setup is incomplete. Contact support.',
    };
  }

  const map = new Map<string, string>();
  for (const row of records) {
    const key = String(row.key ?? row.Key ?? '').trim();
    const value = String(row.value ?? row.Value ?? '').trim();
    if (key) map.set(key, value);
  }

  for (const key of STAMP_CONFIG_KEYS) {
    const value = map.get(key) || '';
    if (!value) {
      return {
        ok: false,
        missingKey: key,
        message: 'Stamp setup is incomplete. Contact support.',
      };
    }
  }

  const denomination = Number(map.get('stamp_denomination'));
  if (!Number.isFinite(denomination)) {
    return {
      ok: false,
      missingKey: 'stamp_denomination',
      message: 'Stamp setup is incomplete. Contact support.',
    };
  }

  return {
    ok: true,
    config: {
      stamp_state: map.get('stamp_state')!,
      stamp_article_code: map.get('stamp_article_code')!,
      stamp_purpose: map.get('stamp_purpose')!,
      stamp_denomination: denomination,
      stamp_first_party: map.get('stamp_first_party')!,
      stamp_project: map.get('stamp_project')!,
    },
  };
}

export function fileIdAlnum(fileId: string): string {
  return String(fileId || '').replace(/[^a-zA-Z0-9]/g, '');
}

export function buildStampRefIds(fileId: string): [string, string, string] {
  const id = fileIdAlnum(fileId);
  return [`${id}-S1`, `${id}-S2`, `${id}-S3`];
}
