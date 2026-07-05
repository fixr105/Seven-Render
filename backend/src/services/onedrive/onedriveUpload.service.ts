export interface OneDriveUploadInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  fieldId: string;
  folderPath?: string;
  clientId?: string;
  loanApplicationId?: string;
}

export interface OneDriveUploadResult {
  fieldId: string;
  fileName: string;
  shareLink: string;
  fileId: string;
  webUrl: string;
}

function readUploadWebhookUrl(): string {
  const url = process.env.ONEDRIVE_UPLOAD_URL?.trim();
  if (!url) {
    throw new Error('Document upload is not configured (ONEDRIVE_UPLOAD_URL missing)');
  }
  return url;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

function parseUploadResponse(
  payload: unknown,
  fallback: { fieldId: string; fileName: string }
): OneDriveUploadResult {
  const root =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const shareLink = firstNonEmptyString(
    data.shareLink,
    data.share_link,
    data.webUrl,
    data.web_url,
    data.url
  );
  if (!shareLink) {
    throw new Error('Upload webhook did not return a share link');
  }

  return {
    fieldId: firstNonEmptyString(data.fieldId, fallback.fieldId) || fallback.fieldId,
    fileName: firstNonEmptyString(data.fileName, data.file_name, fallback.fileName) || fallback.fileName,
    shareLink,
    fileId: firstNonEmptyString(data.fileId, data.file_id, data.id),
    webUrl: firstNonEmptyString(data.webUrl, data.web_url, shareLink),
  };
}

export async function uploadToOneDrive(input: OneDriveUploadInput): Promise<OneDriveUploadResult> {
  const webhookUrl = readUploadWebhookUrl();
  const formData = new FormData();
  const blob = new Blob([input.buffer], { type: input.mimeType || 'application/octet-stream' });
  formData.append('file', blob, input.fileName);
  formData.append('fieldId', input.fieldId);
  formData.append('fileName', input.fileName);
  if (input.folderPath) formData.append('folderPath', input.folderPath);
  if (input.clientId) formData.append('clientId', input.clientId);
  if (input.loanApplicationId) formData.append('loanApplicationId', input.loanApplicationId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      responseText.trim() || `Document upload failed with status ${response.status}`
    );
  }

  if (!responseText.trim()) {
    throw new Error('Document upload webhook returned an empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error('Document upload webhook returned non-JSON response');
  }

  const root =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  if (root.success === false) {
    throw new Error(String(root.error || 'Document upload failed'));
  }

  return parseUploadResponse(parsed, {
    fieldId: input.fieldId,
    fileName: input.fileName,
  });
}
