import {
  B2C_EV_GEO_PHOTO_UPLOAD_WEBHOOK_PATHS,
  type B2cEvGeoPhotoSlotId,
} from '../../constants/b2cEvGeoPhotoUpload.js';
import type { OneDriveUploadInput, OneDriveUploadResult } from './onedriveUpload.service.js';

const GEO_UPLOAD_ENV_KEYS: Record<B2cEvGeoPhotoSlotId, string> = {
  withSupportPerson: 'N8N_GEO_UPLOAD_UPL1_URL',
  withVehicle: 'N8N_GEO_UPLOAD_UPL2_URL',
  atResidence: 'N8N_GEO_UPLOAD_UPL3_URL',
};

function readN8nBaseUrl(): string {
  const base = process.env.N8N_BASE_URL?.trim() || 'https://fixrrahul.app.n8n.cloud';
  return base.replace(/\/$/, '');
}

function readGeoPhotoWebhookUrl(slotId: B2cEvGeoPhotoSlotId): string {
  const override = process.env[GEO_UPLOAD_ENV_KEYS[slotId]]?.trim();
  if (override) return override;

  const path = B2C_EV_GEO_PHOTO_UPLOAD_WEBHOOK_PATHS[slotId];
  return `${readN8nBaseUrl()}/webhook/${path}`;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractUploadPayload(parsed: unknown): Record<string, unknown> | null {
  if (Array.isArray(parsed)) {
    const first = parsed.find((item) => asRecord(item));
    return asRecord(first);
  }

  const root = asRecord(parsed);
  if (!root) return null;

  if (root.success === false) {
    throw new Error(String(root.error || 'Geo photo upload failed'));
  }

  const nestedData = asRecord(root.data);
  if (nestedData) return nestedData;

  return root;
}

function parseGeoPhotoUploadResponse(
  responseText: string,
  fallback: { fieldId: string; fileName: string }
): OneDriveUploadResult {
  const trimmed = responseText.trim();
  if (!trimmed) {
    throw new Error('Geo photo upload webhook returned an empty response');
  }

  if (isHttpUrl(trimmed)) {
    return {
      fieldId: fallback.fieldId,
      fileName: fallback.fileName,
      shareLink: trimmed,
      fileId: '',
      webUrl: trimmed,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Geo photo upload webhook returned an unrecognised response');
  }

  const data = extractUploadPayload(parsed);
  if (!data) {
    throw new Error('Geo photo upload webhook returned an unrecognised response');
  }

  const status = firstNonEmptyString(data.status).toLowerCase();
  if (status && status !== 'success') {
    throw new Error(String(data.error || data.message || 'Geo photo upload failed'));
  }

  const shareLink = firstNonEmptyString(
    data.url,
    data.shareLink,
    data.share_link,
    data.webUrl,
    data.web_url
  );

  if (!shareLink || !isHttpUrl(shareLink)) {
    throw new Error('Geo photo upload webhook did not return a URL');
  }

  return {
    fieldId: firstNonEmptyString(data.fieldId, fallback.fieldId) || fallback.fieldId,
    fileName:
      firstNonEmptyString(data.fileName, data.file_name, data.filename, fallback.fileName) ||
      fallback.fileName,
    shareLink,
    fileId: firstNonEmptyString(data.fileId, data.file_id, data.id),
    webUrl: firstNonEmptyString(data.webUrl, data.web_url, shareLink),
  };
}

export async function uploadGeoPhotoToWebhook(
  input: OneDriveUploadInput
): Promise<OneDriveUploadResult> {
  const slotId = input.fieldId as B2cEvGeoPhotoSlotId;
  const webhookUrl = readGeoPhotoWebhookUrl(slotId);

  const formData = new FormData();
  const blob = new Blob([input.buffer], { type: input.mimeType || 'application/octet-stream' });
  formData.append('file', blob, input.fileName);
  formData.append('fieldId', input.fieldId);
  formData.append('fileName', input.fileName);
  if (input.folderPath) formData.append('folderPath', input.folderPath);
  if (input.clientId) formData.append('clientId', input.clientId);
  if (input.loanApplicationId) formData.append('loanApplicationId', input.loanApplicationId);

  console.info('[geoPhotoUpload] POST', { slotId, webhookUrl, fileName: input.fileName });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Geo photo upload timed out after 120 seconds (${slotId})`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      responseText.trim() || `Geo photo upload failed with status ${response.status}`
    );
  }

  return parseGeoPhotoUploadResponse(responseText, {
    fieldId: input.fieldId,
    fileName: input.fileName,
  });
}
