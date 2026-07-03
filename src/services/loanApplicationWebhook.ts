/**
 * Direct n8n loan application webhook client.
 * Posts to /webhook/loanapplications and verifies via GET /webhook/loanapplication.
 *
 * Set VITE_N8N_LOAN_APPLICATIONS_URL to override (default in production: fixrrahul n8n).
 */

const N8N_BASE = (import.meta.env.VITE_N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud').replace(/\/$/, '');

const DEFAULT_POST_URL = `${N8N_BASE}/webhook/loanapplications`;
const DEFAULT_GET_URL = `${N8N_BASE}/webhook/loanapplication`;

function getWebhookUrls(): { postUrl: string; getUrl: string } {
  const envPost = (import.meta.env.VITE_N8N_LOAN_APPLICATIONS_URL || '').trim();
  const envGet = (import.meta.env.VITE_N8N_LOAN_APPLICATION_GET_URL || '').trim();
  const postUrl = envPost || (import.meta.env.PROD ? DEFAULT_POST_URL : '');
  const getUrl = envGet || (import.meta.env.PROD ? DEFAULT_GET_URL : '');
  return { postUrl, getUrl };
}

export function hasDirectLoanApplicationWebhook(): boolean {
  const { postUrl, getUrl } = getWebhookUrls();
  return postUrl.length > 0 && getUrl.length > 0;
}

export interface CreateLoanApplicationInput {
  clientId: string;
  productId: string;
  applicantName?: string;
  requestedLoanAmount?: string | number;
  formData?: Record<string, unknown>;
  saveAsDraft?: boolean;
  clientSubmissionId?: string;
}

export interface CreateLoanApplicationResult {
  success: boolean;
  data?: {
    loanApplicationId: string;
    fileId: string;
    status: string;
  };
  error?: string;
}

function generateFileId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `SF${timestamp.slice(-8)}`;
}

function buildLoanApplicationPayload(data: Record<string, unknown>): Record<string, string> {
  let formData = data['Form Data'] ?? data.formData ?? '';
  let parsedFormData: Record<string, unknown> = {};
  if (typeof formData === 'object' && formData !== null) {
    parsedFormData = formData as Record<string, unknown>;
    formData = JSON.stringify(formData);
  }
  if (typeof formData === 'string' && formData.trim() !== '') {
    try {
      const parsed = JSON.parse(formData);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsedFormData = parsed as Record<string, unknown>;
      }
    } catch {
      parsedFormData = {};
    }
  }
  if (formData == null || (typeof formData === 'string' && formData.trim() === '')) {
    formData = '';
  }

  const str = (key: string, alt?: string) => String(data[key] ?? (alt ? data[alt] : '') ?? '').trim();

  return {
    'File ID': str('File ID', 'fileId'),
    Client: str('Client', 'client'),
    'Applicant Name': str('Applicant Name', 'applicantName'),
    'Loan Product': str('Loan Product', 'loanProduct'),
    'Requested Loan Amount': String(data['Requested Loan Amount'] ?? data.requestedLoanAmount ?? ''),
    Documents: str('Documents', 'documents'),
    Status: str('Status', 'status'),
    'Assigned Credit Analyst': str('Assigned Credit Analyst'),
    'Assigned NBFC': str('Assigned NBFC'),
    'Lender Decision Status': str('Lender Decision Status'),
    'Lender Decision Date': str('Lender Decision Date'),
    'Lender Decision Remarks': str('Lender Decision Remarks'),
    'Approved Loan Amount': str('Approved Loan Amount'),
    'AI File Summary': str('AI File Summary'),
    'Creation Date': str('Creation Date', 'creationDate'),
    'Submitted Date': str('Submitted Date', 'submittedDate'),
    'Last Updated': str('Last Updated', 'lastUpdated'),
    'Asana Task ID': str('Asana Task ID'),
    'Asana Task Link': str('Asana Task Link'),
    'KAM ID': str('KAM ID', 'kamId'),
    'Mobile Number': str('Mobile Number') || String(parsedFormData._mobileNumber ?? ''),
    'Email Id': str('Email Id') || String(parsedFormData._email ?? ''),
    'Type of Purchase': str('Type of Purchase') || String(parsedFormData._typeOfPurchase ?? ''),
    Remarks: str('Remarks') || String(parsedFormData.Remarks ?? ''),
    'Form Data': typeof formData === 'string' ? formData : '',
    'Form Config Version': str('Form Config Version', 'formConfigVersion'),
    'Needs Attention': str('Needs Attention', 'needsAttention'),
    'Validation Warnings': str('Validation Warnings', 'validationWarnings'),
    'Client Submission ID': str('Client Submission ID', 'clientSubmissionId'),
    MD: str('MD', 'md'),
  };
}

function extractApplications(body: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
      if (Array.isArray(obj.records)) return obj.records as Record<string, unknown>[];
    }
  } catch {
    // ignore
  }
  return [];
}

async function waitForPersistedRecord(
  getUrl: string,
  options: {
  fileId: string;
  clientSubmissionId?: string;
}
): Promise<Record<string, unknown> | null> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(getUrl, { method: 'GET' });
      if (res.ok) {
        const apps = extractApplications(await res.text());
        const found = apps.find((app) => {
          const appFileId = String(app['File ID'] || app.fileId || '').trim();
          const appSubmissionId = String(app['Client Submission ID'] || app.clientSubmissionId || '').trim();
          return (
            appFileId === options.fileId ||
            (options.clientSubmissionId ? appSubmissionId === options.clientSubmissionId : false)
          );
        });
        if (found) return found;
      }
    } catch {
      // retry
    }
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

export async function createLoanApplicationViaWebhook(
  input: CreateLoanApplicationInput
): Promise<CreateLoanApplicationResult> {
  const { postUrl, getUrl } = getWebhookUrls();
  if (!postUrl || !getUrl) {
    return { success: false, error: 'Direct loan application webhook is not configured.' };
  }

  const fileId = generateFileId();
  const applicationId = `APP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const status = input.saveAsDraft ? 'draft' : 'under_kam_review';
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const fullFormData: Record<string, unknown> = {
    applicantName: input.applicantName || '',
    requestedLoanAmount: input.requestedLoanAmount ?? '',
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.formData || {}),
  };

  const payload = buildLoanApplicationPayload({
    'File ID': fileId,
    Client: input.clientId,
    'Applicant Name': input.applicantName || '',
    'Loan Product': input.productId || '',
    'Requested Loan Amount':
      input.requestedLoanAmount !== undefined && input.requestedLoanAmount !== null
        ? String(input.requestedLoanAmount)
        : '',
    Status: status,
    'Creation Date': today,
    'Last Updated': now,
    'Submitted Date': input.saveAsDraft ? '' : today,
    'Form Data': fullFormData,
    'Client Submission ID': input.clientSubmissionId || '',
  });

  try {
    const postRes = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const postText = await postRes.text();

    if (!postRes.ok) {
      return {
        success: false,
        error: `Loan application webhook failed (${postRes.status}): ${postText.slice(0, 200)}`,
      };
    }

    if (postText.trim() !== '') {
      try {
        const parsed = JSON.parse(postText) as Record<string, unknown>;
        if (parsed.success === false) {
          return {
            success: false,
            error: String(parsed.error || parsed.message || 'Webhook reported success=false'),
          };
        }
      } catch {
        // Non-JSON 2xx is acceptable when Airtable write succeeds.
      }
    }

    const persisted = await waitForPersistedRecord(getUrl, {
      fileId,
      clientSubmissionId: input.clientSubmissionId,
    });

    if (!persisted) {
      return {
        success: false,
        error:
          'Application was not confirmed in Airtable. Re-import SEVEN-DASHBOARD(2).json so loanapplications upserts by File ID.',
      };
    }

    return {
      success: true,
      data: {
        loanApplicationId: String(persisted.id || applicationId),
        fileId: String(persisted['File ID'] || persisted.fileId || fileId),
        status: String(persisted.Status || persisted.status || status),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
