import { isComplianceDone } from './b2cEvCompliance';
import { hasValue } from './formPath';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function isDoRequested(formData: Record<string, unknown>): boolean {
  return Boolean(readString(formData['_meta.doRequest.requestedAt']));
}

export function isDoFulfilled(formData: Record<string, unknown>): boolean {
  if (readString(formData['_meta.doRequest.fulfilledAt'])) return true;
  return readString(formData['_meta.doRequest.status']) === 'approved';
}

export function getDoRejectionReason(formData: Record<string, unknown>): string {
  return readString(formData['_meta.doRequest.rejectionReason']);
}

export function hasDoRejectionOnRecord(formData: Record<string, unknown>): boolean {
  return readString(formData['_meta.doRequest.status']) === 'rejected' && Boolean(getDoRejectionReason(formData));
}

export function arePostDoStagesUnlocked(formData: Record<string, unknown>): boolean {
  return isDoFulfilled(formData);
}

export type DeliveryCardId = 'geo' | 'insurance' | 'vehicle' | 'iot';

const DO_LOCK = 'Opens after the disbursement order is approved.';
const SIGN_LOCK = 'Opens after both people have signed the loan documents.';
const VEHICLE_LOCK = 'Opens after vehicle details are saved.';

export function isLoanPackSigned(formData: Record<string, unknown>): boolean {
  if (hasValue(formData, '_meta.esign.stage', (value) => value === 'signed')) return true;
  return isComplianceDone(formData, 'compliance.loanAgreementSigned');
}

/** Insurance and Vehicle open when the DO is approved. Photos also need a signed loan pack. IoT also needs vehicle details saved. */
export function isDeliveryCardOpen(
  formData: Record<string, unknown>,
  card: DeliveryCardId,
  vehicleDone: boolean
): boolean {
  if (!isDoFulfilled(formData)) return false;
  if (card === 'insurance' || card === 'vehicle') return true;
  if (!isLoanPackSigned(formData)) return false;
  if (card === 'geo') return true;
  if (card === 'iot') return vehicleDone;
  const unreachable: never = card;
  return unreachable;
}

export function deliveryLockReason(
  formData: Record<string, unknown>,
  card: DeliveryCardId,
  vehicleDone: boolean
): string | null {
  if (isDeliveryCardOpen(formData, card, vehicleDone)) return null;
  if (!isDoFulfilled(formData)) return DO_LOCK;
  if (!isLoanPackSigned(formData)) return SIGN_LOCK;
  if (card === 'iot') return VEHICLE_LOCK;
  return null;
}

export function deliveryBanner(formData: Record<string, unknown>): string {
  if (!isDoFulfilled(formData)) return 'Waiting for disbursement order approval.';
  if (!isLoanPackSigned(formData)) {
    return 'Disbursement order approved. Fill insurance and vehicle details. Photos and IoT open after signing.';
  }
  return 'Ready for delivery.';
}

export function buildDoRequestMessage(context: {
  applicantName?: string;
  applicationId?: string;
}): string {
  const applicant = context.applicantName?.trim() || 'the borrower';
  const applicationRef = context.applicationId ? ` (application ${context.applicationId})` : '';
  return `Please process Disbursement Order (DO) for ${applicant}${applicationRef}.`;
}

/** Dealer flow no longer waits on KAM/DO — Delivery is post-signing. */
export const POST_DO_LOCKED_STAGE_IDS = [] as const;
