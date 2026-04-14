/**
 * Direct n8n get-raad webhook client.
 * Bypasses the backend when configured, avoiding 404 from API base URL issues.
 * Set VITE_N8N_RAAD_FETCH_WEBHOOK_URL in Vercel to enable (e.g. https://fixrrahul.app.n8n.cloud/webhook/get-raad).
 * When unset in production, uses default get-raad URL so RAAD reports load without backend proxy.
 */

const ENV_URL = (import.meta.env.VITE_N8N_RAAD_FETCH_WEBHOOK_URL || '').trim();
const DEFAULT_RAAD_WEBHOOK = 'https://fixrrahul.app.n8n.cloud/webhook/get-raad';
const RAAD_WEBHOOK_URL = ENV_URL || (import.meta.env.PROD ? DEFAULT_RAAD_WEBHOOK : '');

export function hasDirectRaadWebhook(): boolean {
  return RAAD_WEBHOOK_URL.length > 0;
}

interface RaadResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

function normalizeListResponse(data: unknown): unknown {
  if (!Array.isArray(data) || data.length === 0) return data;
  const unwrapped = data.map((item: unknown) =>
    typeof item === 'object' && item !== null && 'json' in (item as object)
      ? (item as { json: unknown }).json
      : item
  );
  return unwrapped.map((item: unknown) => {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const loanId =
      (obj.ID as string) || (obj.loanApplicationId as string) || (obj.id as string) || `row-${obj.row_number ?? '?'}`;
    const hasContent = typeof obj.content === 'string' || Array.isArray(obj.content);
    return {
      id: loanId,
      loanApplicationId: loanId,
      status: obj.status === 'error' || obj.error ? 'error' : hasContent ? 'ready' : obj.status ?? 'processing',
      error: obj.error,
      html: obj.html,
      pdfUrl: obj.pdfUrl,
    };
  });
}

function normalizeSingleResponse(data: unknown): unknown {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    let normalized = typeof first === 'object' && first !== null && 'json' in first ? (first as { json: unknown }).json : first;
    if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
      const obj = normalized as Record<string, unknown>;
      if (!obj.html && !obj.pdfUrl && typeof obj.content === 'string') {
        try {
          const parsed = JSON.parse(obj.content) as Array<{ type?: string; text?: string }>;
          const textPart = Array.isArray(parsed) ? parsed.find((p) => p?.type === 'text' && typeof p.text === 'string') : null;
          if (textPart?.text?.trim()) obj.html = textPart.text.trim();
        } catch {
          // keep as is
        }
      }
    }
    return normalized;
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (!obj.html && !obj.pdfUrl && typeof obj.content === 'string') {
      try {
        const parsed = JSON.parse(obj.content) as Array<{ type?: string; text?: string }>;
        const textPart = Array.isArray(parsed) ? parsed.find((p) => p?.type === 'text' && typeof p.text === 'string') : null;
        if (textPart?.text?.trim()) obj.html = textPart.text.trim();
      } catch {
        // keep as is
      }
    }
    return data;
  }
  return data;
}

export async function fetchRaadFromWebhook(loanApplicationId?: string): Promise<RaadResponse> {
  if (!RAAD_WEBHOOK_URL) {
    return { success: false, error: 'VITE_N8N_RAAD_FETCH_WEBHOOK_URL is not configured' };
  }
  try {
    const body = loanApplicationId ? { loanApplicationId: loanApplicationId.trim() } : {};
    const res = await fetch(RAAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

    const isListAll = !loanApplicationId?.trim();
    const normalized = isListAll ? normalizeListResponse(data) : normalizeSingleResponse(data);
    return { success: true, data: normalized };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
