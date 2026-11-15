/**
 * Same-origin /tools/* client (proxied to VITE_TOOLS_BASE).
 * Never import the tools host into UI components.
 */

export class ToolsRequestError extends Error {
  status: number;
  body: unknown;
  errorType?: string;

  constructor(message: string, status: number, body: unknown, errorType?: string) {
    super(message);
    this.name = 'ToolsRequestError';
    this.status = status;
    this.body = body;
    this.errorType = errorType;
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

async function toolsFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ status: number; data: unknown }> {
  const { timeoutMs, ...rest } = init;
  const controller = timeoutMs && timeoutMs > 0 ? new AbortController() : null;
  const timer =
    controller && timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(path, {
      ...rest,
      signal: controller?.signal ?? rest.signal,
    });
    const data = await parseJsonSafe(res);
    return { status: res.status, data };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      throw new ToolsRequestError('Request timed out', 408, null, 'TIMEOUT');
    }
    throw err;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

export async function toolsPost(
  path: string,
  body: unknown,
  options?: { timeoutMs?: number }
): Promise<{ status: number; data: unknown }> {
  return toolsFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: options?.timeoutMs,
  });
}

export async function toolsGet(
  path: string,
  options?: { timeoutMs?: number }
): Promise<{ status: number; data: unknown }> {
  return toolsFetch(path, { method: 'GET', timeoutMs: options?.timeoutMs });
}

// —— CRM lead ——
export async function postSevenfinCrmLead(payload: Record<string, string>) {
  return toolsPost('/tools/sevenfin-crm-lead', payload, { timeoutMs: 15_000 });
}

// —— DLA event (all CRM events) ——
export async function postSevenfinDlaEvent(payload: Record<string, unknown>) {
  return toolsPost('/tools/sevenfin-dla-event', payload, { timeoutMs: 15_000 });
}

// —— DLA lead ——
export async function postDlaLead(payload: {
  applicant_name: string;
  phone: string;
  dla_name: string;
  stamp_ordered: boolean;
}) {
  return toolsPost('/tools/dla_lead', payload, { timeoutMs: 15_000 });
}

// —— Stamp tools ——
export async function getEdrafterStampCatalog() {
  return toolsGet('/tools/edrafter-stamp-catalog', { timeoutMs: 30_000 });
}

export async function postEdrafterStampValidate(payload: Record<string, unknown>) {
  return toolsPost('/tools/edrafter-stamp-validate', payload, { timeoutMs: 30_000 });
}

export async function postEdrafterStampQuote(payload: Record<string, unknown>) {
  return toolsPost('/tools/edrafter-stamp-quote', payload, { timeoutMs: 30_000 });
}

export async function postEdrafterStampOrder(payload: Record<string, unknown>) {
  return toolsPost('/tools/edrafter-stamp-order', payload, { timeoutMs: 90_000 });
}

export async function getEdrafterStampStatus(accessKey: string, groupId: string) {
  const qs = new URLSearchParams({ accessKey, groupId });
  return toolsGet(`/tools/edrafter-stamp-status?${qs.toString()}`, { timeoutMs: 30_000 });
}

export async function postPdfMerge(payload: Record<string, unknown>) {
  return toolsPost('/tools/pdf-merge', payload, { timeoutMs: 200_000 });
}

// —— eSign ——
export async function postEdrafterEsign(payload: Record<string, unknown>) {
  return toolsPost('/tools/edrafter-esign', payload, { timeoutMs: 150_000 });
}

export async function getEdrafterEsignStatus(refId: string) {
  const qs = new URLSearchParams({ refId });
  return toolsGet(`/tools/edrafter-esign-status?${qs.toString()}`, { timeoutMs: 30_000 });
}
