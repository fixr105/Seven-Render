function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function isDoRequested(formData: Record<string, unknown>): boolean {
  return Boolean(readString(formData['_meta.doRequest.requestedAt']));
}

export function buildDoRequestMessage(context: {
  applicantName?: string;
  applicationId?: string;
}): string {
  const applicant = context.applicantName?.trim() || 'the borrower';
  const applicationRef = context.applicationId ? ` (application ${context.applicationId})` : '';
  return `Please process Disbursement Order (DO) for ${applicant}${applicationRef}.`;
}

export const POST_DO_LOCKED_STAGE_IDS = ['insurance', 'vehicle'] as const;
