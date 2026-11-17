/**
 * Post-submit Engine / Tools client.
 * All calls go through same-origin `/engine` and `/tools` proxies.
 * Never import VITE_ENGINE_BASE / VITE_TOOLS_BASE into UI components.
 */

import {
  BUREAU_CACHE_TABLE,
  buildBureauCachePanFilter,
  mapBureauCacheRecordToFormDataPatch,
  pickBureauCacheRecord,
} from '../lib/bureauCacheLookup';
import type { PanLookupFieldPrefix } from '../lib/b2cEvPanLookup';
import { extractFilledDocUrl } from '../lib/postSubmitEngine/filledDocUrl';
import { readDoPdfFromJson } from '../lib/doApproval';
import { apiService } from './api';
import { normalizeQualifyPayload } from '../lib/postSubmitEngine/qualifyResult';

export const ENGINE_BASE_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BASE_ID) ||
  'appzbyi8q7pJRl1cd';

export class EngineRequestError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'EngineRequestError';
    this.status = status;
    this.body = body;
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

async function postJson<T = unknown>(
  path: string,
  body: unknown,
  options?: { timeoutMs?: number }
): Promise<T> {
  const controller =
    options?.timeoutMs && options.timeoutMs > 0 ? new AbortController() : null;
  const timer =
    controller && options?.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const msg =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Request failed (${res.status})`;
      throw new EngineRequestError(msg, res.status, data);
    }
    return data as T;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      throw new EngineRequestError('Request timed out', 408, null);
    }
    throw err;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

/** Flat Airtable row: `id` plus column names at top level (no `fields` wrapper). */
export type AirtableFlatRecord = {
  id?: string;
  [key: string]: unknown;
};

export type AirtableGetResponse = {
  ok?: boolean;
  count?: number;
  state?: string;
  error?: string;
  records?: AirtableFlatRecord[];
  id?: string;
  [key: string]: unknown;
};

export type AirtableWriteResponse = {
  ok?: boolean;
  id?: string;
  state?: string;
  error?: string;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
};

function assertAirtableOk<T extends { ok?: boolean; state?: string; error?: string }>(
  data: T,
  fallback: string
): T {
  if (data && data.ok === true) return data;
  const msg =
    (data && typeof data.error === 'string' && data.error) ||
    (data && typeof data.state === 'string' && data.state) ||
    fallback;
  throw new EngineRequestError(msg, 200, data);
}

/** Read a column from a flat Airtable record (Engine returns no `fields` wrapper). */
export function readAirtableField(record: AirtableFlatRecord | null | undefined, column: string): unknown {
  if (!record) return undefined;
  if (column in record) return record[column];
  const nested = record.fields;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return (nested as Record<string, unknown>)[column];
  }
  return undefined;
}

export async function airtableGet(input: {
  table: string;
  filter_formula: string;
  /** @deprecated Ignored by Engine — use filter_formula only. Kept for call-site migration. */
  filter?: string;
  max?: number;
  base_id?: string;
}): Promise<AirtableGetResponse> {
  const formula = input.filter_formula || input.filter || '';
  const data = await postJson<AirtableGetResponse>('/engine/airtable_get', {
    base_id: input.base_id || ENGINE_BASE_ID,
    table: input.table,
    filter_formula: formula,
    max: input.max ?? 100,
  });
  return assertAirtableOk(data, 'Airtable get failed');
}

export type BureauCacheLookupResult = {
  formDataPatch: Record<string, string>;
  lookupAt: string;
  recordId?: string;
};

/**
 * Wizard PAN autofill: structured Bureau Cache only (no postMMfrontPAN).
 * Returns null on cache miss / empty profile.
 */
export async function lookupBureauCacheByPan(input: {
  pan: string;
  target?: PanLookupFieldPrefix;
}): Promise<BureauCacheLookupResult | null> {
  const pan = String(input.pan || '').trim();
  if (!pan) return null;
  const filter = buildBureauCachePanFilter(pan);
  const response = await airtableGet({
    table: BUREAU_CACHE_TABLE,
    filter,
    filter_formula: filter,
  });
  const record = pickBureauCacheRecord(response);
  if (!record) return null;
  const prefix = input.target ?? 'borrower';
  const formDataPatch = mapBureauCacheRecordToFormDataPatch(record, prefix);
  if (!formDataPatch) return null;
  return {
    formDataPatch,
    lookupAt: new Date().toISOString(),
    recordId: record.id,
  };
}

/**
 * Create or update an Airtable row via Engine.
 * - Include `record_id` to update; omit it to create (allowed for non–Loan Applications tables).
 * - Loan Applications rows are created only by Express draft/save — Engine may only update.
 * - Do not send `action` — Engine ignores it.
 */
export async function airtableWrite(input: {
  table: string;
  record_id?: string;
  fields: Record<string, unknown>;
  base_id?: string;
}): Promise<AirtableWriteResponse> {
  if (input.table === 'Loan Applications' && !String(input.record_id || '').startsWith('rec')) {
    throw new EngineRequestError(
      'Loan Applications rows must be created by Express; Engine airtable_write requires an existing rec… record_id',
      400,
      null
    );
  }
  const body: Record<string, unknown> = {
    base_id: input.base_id || ENGINE_BASE_ID,
    table: input.table,
    fields: input.fields,
  };
  if (input.record_id) {
    body.record_id = input.record_id;
  }
  const data = await postJson<AirtableWriteResponse>('/engine/airtable_write', body);
  return assertAirtableOk(data, 'Airtable write failed');
}

export type QualifyResponse = {
  ok?: boolean;
  pass?: boolean;
  score?: number | null;
  monthly_obligations?: number | null;
  bureau_ref?: string;
  kill_code?: string;
  borrower_message?: string;
  is_ntc?: boolean;
  failed?: unknown[];
  missing?: unknown[];
  applicant?: Record<string, unknown> | null;
  cached?: boolean;
  state?: string;
  error?: string;
  [key: string]: unknown;
};

/** Fresh bureau pulls can take a long time — default 60s. */
export const QUALIFY_TIMEOUT_MS = 60_000;

export async function qualifyApplicant(payload: Record<string, unknown>): Promise<QualifyResponse> {
  const raw = await postJson<unknown>(
    '/engine/qualify',
    {
      base_id: ENGINE_BASE_ID,
      ...payload,
    },
    { timeoutMs: QUALIFY_TIMEOUT_MS }
  );
  return normalizeQualifyPayload(raw);
}

/**
 * Upload a file via Engine `/engine/urllink`.
 * Multipart field must be named exactly `data`. Do not set Content-Type manually.
 */
export async function uploadToUrl(file: File | Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append('data', file, filename);

  const res = await fetch('/engine/urllink', {
    method: 'POST',
    body: form,
  });
  const data = (await parseJsonSafe(res)) as Record<string, unknown> | null;
  if (!res.ok || !data || data.ok !== true) {
    const msg =
      (data && typeof data.error_message === 'string' && data.error_message) ||
      (data && typeof data.error === 'string' && data.error) ||
      'File upload failed';
    throw new EngineRequestError(msg, res.status || 200, data);
  }
  const url = typeof data.url === 'string' ? data.url : '';
  if (!url) {
    throw new EngineRequestError('Upload response missing url', res.status, data);
  }
  return url;
}

const DO_PDF_PATH = '/engine/85af8f18-a251-45a3-b95e-ad593070fd0e';
export const DO_PDF_TIMEOUT_MS = 120_000;

export class DoPdfGenerationError extends Error {
  constructor(reason: string) {
    super(`DO generation failed: ${reason}`);
    this.name = 'DoPdfGenerationError';
  }
}

/** Generate the disbursement-order PDF. One attempt, 120s, no retry. */
export async function requestDoPdf(
  payload: Record<string, string>
): Promise<{ url: string; fileName: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DO_PDF_TIMEOUT_MS);
  try {
    const res = await fetch(DO_PDF_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      if (!res.ok) {
        throw new EngineRequestError('Could not generate DO. Try again.', res.status, null);
      }
      const blob = await res.blob();
      const fileName = 'DO.pdf';
      const url = await uploadToUrl(blob, fileName);
      return { url, fileName };
    }
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new EngineRequestError('Could not generate DO. Try again.', res.status, data);
    }
    const parsed = readDoPdfFromJson(data);
    if (!parsed.ok) {
      throw new DoPdfGenerationError(parsed.error);
    }
    const stored = await apiService.storeGeneratedDoPdf({
      url: parsed.url,
      fileName: parsed.fileName,
    });
    if (!stored.success || !stored.data?.url) {
      throw new DoPdfGenerationError(stored.error || 'Could not save the DO file');
    }
    return {
      url: stored.data.url,
      fileName: stored.data.fileName || parsed.fileName,
    };
  } catch (err) {
    if (err instanceof DoPdfGenerationError || err instanceof EngineRequestError) throw err;
    throw new EngineRequestError('No response. Check with ops.', 408, null);
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated Prefer uploadToUrl — kept for NTC / legacy call sites. */
export async function uploadFileToUrl(file: File): Promise<string> {
  return uploadToUrl(file, file.name);
}

export type RankOfferRaw = {
  amount?: number;
  roi?: number;
  pf?: number;
  emi?: number;
  tenure?: number;
  apr?: number;
  lender_id?: string;
  lender_name?: string;
  real_lender_id?: string;
  [key: string]: unknown;
};

export type MultiLenderRankResponse = {
  ranked?: RankOfferRaw[];
  offers?: RankOfferRaw[];
  results?: RankOfferRaw[];
  data?: { ranked?: RankOfferRaw[]; offers?: RankOfferRaw[] };
  [key: string]: unknown;
};

export async function multiLenderRank(
  payload: Record<string, unknown>
): Promise<MultiLenderRankResponse> {
  return postJson<MultiLenderRankResponse>('/tools/multi_lender_rank', {
    base_id: ENGINE_BASE_ID,
    ...payload,
  });
}

export type FilledDocUrlResponse = {
  url?: string;
  file_url?: string;
  pdf_url?: string;
  data?: { url?: string };
  [key: string]: unknown;
};

export async function fillSanctionLetter(payload: unknown): Promise<string> {
  const data = await postJson<FilledDocUrlResponse | FilledDocUrlResponse[]>(
    '/engine/POSTfull1',
    payload
  );
  const url = extractFilledDocUrl(data);
  if (!url) throw new EngineRequestError('Sanction letter URL missing', 200, data);
  return url;
}

export async function fillLoanAgreement(payload: unknown): Promise<string> {
  const data = await postJson<FilledDocUrlResponse | FilledDocUrlResponse[]>(
    '/engine/POSTfull2',
    payload
  );
  const url = extractFilledDocUrl(data);
  if (!url) throw new EngineRequestError('Loan agreement URL missing', 200, data);
  return url;
}

export async function fillCkyc(payload: unknown): Promise<string> {
  const data = await postJson<FilledDocUrlResponse | FilledDocUrlResponse[]>(
    '/engine/POSTfull3',
    payload
  );
  const url = extractFilledDocUrl(data);
  if (!url) throw new EngineRequestError('CKYC URL missing', 200, data);
  return url;
}

/** @deprecated Opti Pro stamp/sign removed — use /tools/edrafter-stamp-* and /tools/edrafter-esign. */
export type StampOrder = {
  orderId?: string;
  stampType?: string;
  refId?: string;
  orderStatus?: string;
  stage?: string;
  [key: string]: unknown;
};
