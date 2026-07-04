import {
  hasBorrowerPatchData,
  mapPanLookupOutputToFormDataPatch,
  parseWebhookOutput,
} from './panLookup.mapper.js';

const DEFAULT_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/postMMfrontPAN';
const WEBHOOK_TIMEOUT_MS = 120_000;
const WEBHOOK_MAX_ATTEMPTS = 3;
const WEBHOOK_INITIAL_BACKOFF_MS = 300;

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export interface PanLookupRequest {
  mobileNumber: string;
  panNumber: string;
  fullName: string;
  borrowerEmail?: string | null;
}

export type PanLookupSuccess = {
  success: true;
  formDataPatch: Record<string, string>;
  lookupAt: string;
};

export type PanLookupFailure = {
  success: false;
  error: string;
  code: 'VALIDATION_ERROR' | 'WEBHOOK_ERROR' | 'EMPTY_RESPONSE' | 'PARSE_ERROR';
};

export type PanLookupResult = PanLookupSuccess | PanLookupFailure;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getWebhookUrl(): string {
  return process.env.N8N_POST_MM_FRONT_PAN_URL?.trim() || DEFAULT_WEBHOOK_URL;
}

function normalizePanInput(value: string): string {
  return value.replace(/\s+/g, '').replace(/-/g, '').trim().toUpperCase();
}

export function validatePanLookupRequest(input: PanLookupRequest): string | null {
  const mobile = input.mobileNumber?.trim() ?? '';
  const pan = normalizePanInput(input.panNumber ?? '');
  const fullName = input.fullName?.trim() ?? '';

  if (!fullName) return 'Full name is required';
  if (!pan) return 'PAN is required';
  if (!PAN_REGEX.test(pan)) {
    return 'PAN must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)';
  }
  if (!mobile) return 'Mobile number is required';
  let digits = mobile.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
    return 'Please enter a valid 10-digit Indian mobile number';
  }

  const borrowerEmail = input.borrowerEmail?.trim();
  if (borrowerEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(borrowerEmail)) {
      return 'Please enter a valid borrower email address';
    }
  }

  return null;
}

async function callWebhookWithRetry(
  factory: () => Promise<globalThis.Response>
): Promise<{ response?: globalThis.Response; error?: Error }> {
  let backoffMs = WEBHOOK_INITIAL_BACKOFF_MS;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await factory();
      if (response.ok || response.status < 500 || attempt === WEBHOOK_MAX_ATTEMPTS) {
        return { response };
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === WEBHOOK_MAX_ATTEMPTS) {
        return { error: lastError };
      }
    }
    await sleep(backoffMs);
    backoffMs *= 2;
  }

  return { error: lastError ?? new Error('Webhook request failed') };
}

export async function lookupBorrowerByPan(input: PanLookupRequest): Promise<PanLookupResult> {
  const validationError = validatePanLookupRequest(input);
  if (validationError) {
    return { success: false, error: validationError, code: 'VALIDATION_ERROR' };
  }

  let digits = input.mobileNumber.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  const payload = {
    Mobile_Number: digits,
    PAN_Number: normalizePanInput(input.panNumber),
    Full_Name: input.fullName.trim(),
    // n8n workflow still expects recipient_email
    recipient_email: input.borrowerEmail?.trim() || null,
  };

  const attempt = await callWebhookWithRetry(() =>
    fetch(getWebhookUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
  );

  if (attempt.error) {
    return {
      success: false,
      error: attempt.error.message || 'Failed to reach PAN lookup service',
      code: 'WEBHOOK_ERROR',
    };
  }

  const response = attempt.response!;
  const responseText = await response.text();

  if (!response.ok) {
    return {
      success: false,
      error: `PAN lookup failed (${response.status})`,
      code: 'WEBHOOK_ERROR',
    };
  }

  if (!responseText.trim()) {
    return {
      success: false,
      error: 'PAN lookup returned no borrower details',
      code: 'EMPTY_RESPONSE',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: 'PAN lookup returned an invalid response',
      code: 'PARSE_ERROR',
    };
  }

  const output = parseWebhookOutput(parsed);
  if (!output) {
    return {
      success: false,
      error: 'PAN lookup returned no borrower details',
      code: 'EMPTY_RESPONSE',
    };
  }

  // CIBIL is intentionally discarded — reserved for a future feature.
  delete output.cibil_score;

  const formDataPatch = mapPanLookupOutputToFormDataPatch(output);
  if (!hasBorrowerPatchData(formDataPatch)) {
    return {
      success: false,
      error: 'PAN lookup returned no borrower details',
      code: 'EMPTY_RESPONSE',
    };
  }

  return {
    success: true,
    formDataPatch,
    lookupAt: new Date().toISOString(),
  };
}
