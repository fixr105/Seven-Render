const DO_PDF_HOST = 'pdf-temp-files.s3.us-west-2.amazonaws.com';
const MAX_BYTES = 15 * 1024 * 1024;

export function assertDoPdfSourceUrl(value: unknown): string {
  let parsed: URL;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error('Unsupported DO file URL');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== DO_PDF_HOST) {
    throw new Error('Unsupported DO file URL');
  }
  return parsed.toString();
}

function safePdfName(value: unknown): string {
  const base = String(value || '')
    .split(/[/\\]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120);
  if (!base) return 'DO.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export async function storeGeneratedDoPdf(input: {
  url: unknown;
  fileName?: unknown;
  fetchImpl?: typeof fetch;
  urllinkUrl?: string;
}): Promise<{ url: string; fileName: string }> {
  const source = assertDoPdfSourceUrl(input.url);
  const fileName = safePdfName(input.fileName);
  const fetchImpl = input.fetchImpl || fetch;
  const downloaded = await fetchImpl(source);
  if (!downloaded.ok) throw new Error('Could not save the DO file');
  const bytes = Buffer.from(await downloaded.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES || !bytes.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error('Could not save the DO file');
  }

  const base = (process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud').replace(/\/$/, '');
  const urllinkUrl = input.urllinkUrl || `${base}/webhook/urllink`;
  const form = new FormData();
  form.append('data', new Blob([bytes], { type: 'application/pdf' }), fileName);
  const uploaded = await fetchImpl(urllinkUrl, { method: 'POST', body: form });
  const payload = (await uploaded.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
  const url = payload && payload.ok === true ? String(payload.url || '').trim() : '';
  if (!uploaded.ok || !url.startsWith('https://')) {
    throw new Error('Could not save the DO file');
  }
  return { url, fileName };
}
