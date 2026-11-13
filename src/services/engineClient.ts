function requireBaseId(): string {
  const baseId = import.meta.env.VITE_BASE_ID;
  if (!baseId) throw new Error('VITE_BASE_ID is not configured');
  return baseId;
}

/** The live airtable_get webhook reads `filter_formula`, while the form sends `filter`. */
export function buildEnginePayload(
  tool: string,
  body: Record<string, unknown>,
  baseId: string
): Record<string, unknown> {
  const rest = { ...body };
  delete rest.base_id;
  if (tool === 'airtable_get' && typeof rest.filter === 'string' && rest.filter_formula == null) {
    rest.filter_formula = rest.filter;
  }
  return { ...rest, base_id: baseId };
}

export async function enginePost(tool: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const response = await fetch(`/engine/${tool}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEnginePayload(tool, body, requireBaseId())),
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(detail ? `Engine ${tool}: ${response.status} ${detail}` : `Engine ${tool}: ${response.status}`);
  }
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

export function engineUpload(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string }> {
  const baseId = requireBaseId();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/engine/file-to-url');
    const form = new FormData();
    form.append('file1', file, file.name);
    form.append('filename', file.name);
    form.append('base_id', baseId);
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total === 0) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Engine file-to-url: network error'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Engine file-to-url: ${xhr.status}`));
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText) as {
          url?: string;
          file_url?: string;
          fileUrl?: string;
          data?: { url?: string; file_url?: string };
        };
        const url = body.url || body.file_url || body.fileUrl || body.data?.url || body.data?.file_url;
        if (!url) {
          reject(new Error('Engine file-to-url: missing url'));
          return;
        }
        resolve({ url });
      } catch {
        reject(new Error('Engine file-to-url: invalid response'));
      }
    };
    xhr.send(form);
  });
}
