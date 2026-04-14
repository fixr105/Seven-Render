/**
 * Direct n8n get-pager webhook client.
 * Bypasses the backend when configured for PAGER result fetch.
 * Set VITE_N8N_PAGER_FETCH_WEBHOOK_URL to enable (e.g. https://fixrrahul.app.n8n.cloud/webhook/get-pager).
 * When unset in production, uses default get-pager URL so PAGER reports load without backend proxy.
 *
 * List mode: POST {} = list all PAGER reports (same contract as get-raad).
 * Single mode: POST { loanApplicationId } = fetch one report.
 */

const ENV_URL = (import.meta.env.VITE_N8N_PAGER_FETCH_WEBHOOK_URL || '').trim();
const DEFAULT_PAGER_WEBHOOK = 'https://fixrrahul.app.n8n.cloud/webhook/get-pager';
const PAGER_WEBHOOK_URL = ENV_URL || (import.meta.env.PROD ? DEFAULT_PAGER_WEBHOOK : '');

export function hasDirectPagerWebhook(): boolean {
  return PAGER_WEBHOOK_URL.length > 0;
}

export interface PagerResponse {
  success: boolean;
  data?: {
    status?: string;
    pdfUrl?: string;
    reportUrl?: string;
    error?: string;
  };
  error?: string;
}

export interface PagerListResponse {
  success: boolean;
  data?: Array<{ id?: string; loanApplicationId?: string; status?: string; error?: string; pdfUrl?: string }>;
  error?: string;
}

function normalizePagerListResponse(data: unknown): Array<{ id?: string; loanApplicationId?: string; status?: string; error?: string; pdfUrl?: string }> {
  if (!Array.isArray(data) || data.length === 0) return [];
  const unwrapped = data.map((item: unknown) =>
    typeof item === 'object' && item !== null && 'json' in (item as object)
      ? (item as { json: unknown }).json
      : item
  );
  return unwrapped.map((item: unknown) => {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const loanId =
      (obj.ID as string) || (obj.loanApplicationId as string) || (obj.id as string) || `row-${obj.row_number ?? '?'}`;
    const status = obj.status === 'error' || obj.error ? 'error' : (obj.pdfUrl || obj.reportUrl) ? 'ready' : (obj.status as string) ?? 'processing';
    return {
      id: loanId,
      loanApplicationId: loanId,
      status,
      error: obj.error as string | undefined,
      pdfUrl: (obj.pdfUrl ?? obj.reportUrl) as string | undefined,
    };
  });
}

export async function fetchPagerListFromWebhook(): Promise<PagerListResponse> {
  if (!PAGER_WEBHOOK_URL) {
    return { success: false, error: 'VITE_N8N_PAGER_FETCH_WEBHOOK_URL is not configured' };
  }
  try {
    const res = await fetch(PAGER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      return {
        success: false,
        error: isJson ? (data as { message?: string }).message : String(data),
      };
    }

    const raw = typeof data === 'object' && data !== null ? data : {};
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { data?: unknown }).data)
        ? (raw as { data: unknown[] }).data
        : [];
    const normalized = normalizePagerListResponse(arr);
    return { success: true, data: normalized };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function fetchPagerFromWebhook(loanApplicationId: string): Promise<PagerResponse> {
  if (!PAGER_WEBHOOK_URL) {
    return { success: false, error: 'VITE_N8N_PAGER_FETCH_WEBHOOK_URL is not configured' };
  }
  if (!loanApplicationId?.trim()) {
    return { success: false, error: 'loanApplicationId is required' };
  }
  try {
    const res = await fetch(PAGER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanApplicationId: loanApplicationId.trim() }),
    });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      return {
        success: false,
        error: isJson ? (data as { message?: string }).message : String(data),
      };
    }

    const raw = typeof data === 'object' && data !== null ? data : {};
    const item = Array.isArray(raw) && raw.length > 0
      ? (raw[0] as Record<string, unknown>)
      : (raw as Record<string, unknown>);
    const unwrapped = item && typeof item === 'object' && 'json' in item
      ? (item.json as Record<string, unknown>)
      : item;
    const obj = (unwrapped && typeof unwrapped === 'object' ? unwrapped : {}) as Record<string, unknown>;

    const status = (obj.status as string) ?? (obj.error ? 'failed' : 'processing');
    const pdfUrl = (obj.pdfUrl as string) ?? (obj.reportUrl as string) ?? (obj.pdf_url as string) ?? '';
    const error = obj.error as string | undefined;

    return {
      success: true,
      data: {
        status,
        pdfUrl: pdfUrl || undefined,
        reportUrl: pdfUrl || undefined,
        error,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
