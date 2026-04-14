/**
 * Client documents folder link generation via n8n createfolder webhook.
 */

import { randomUUID } from 'node:crypto';
import { n8nApiClient } from '../airtable/n8nApiClient.js';
import { extractFolderUrlFromResponse } from './documentsFolderUrlParse.js';

export { extractFolderUrlFromResponse };

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/** Resolve webhook URL: full override or default under N8N_BASE_URL. */
export function getCreateFolderWebhookUrl(): string {
  const override = process.env.N8N_CREATE_FOLDER_WEBHOOK_URL?.trim();
  if (override) return override;

  const base = process.env.N8N_BASE_URL?.replace(/\/$/, '');
  if (!base) {
    throw new Error('N8N_BASE_URL or N8N_CREATE_FOLDER_WEBHOOK_URL is required');
  }
  return `${base}/webhook/createfolder`;
}

export function generateNid(): string {
  return randomUUID();
}

export interface CreateFolderWebhookResult {
  folderUrl: string;
  rawPayload: unknown;
}

/**
 * POST { nid, clientId } to createfolder webhook; parse folder URL from response.
 */
export async function postCreateFolderWebhook(payload: {
  nid: string;
  clientId: string;
}): Promise<CreateFolderWebhookResult> {
  const webhookUrl = getCreateFolderWebhookUrl();

  const result = await n8nApiClient.post<Record<string, unknown>>(webhookUrl, payload, {
    timeout: DEFAULT_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });

  if (!result.success || result.data === undefined) {
    throw new Error(result.error || 'Create folder webhook failed');
  }

  const data = result.data;
  const rawText =
    typeof data === 'object' && data !== null && 'message' in data && typeof (data as any).message === 'string'
      ? String((data as any).message)
      : JSON.stringify(data);

  const folderUrl = extractFolderUrlFromResponse(data, rawText);
  if (!folderUrl) {
    throw new Error('Could not parse folder URL from automation response');
  }

  return { folderUrl, rawPayload: data };
}
