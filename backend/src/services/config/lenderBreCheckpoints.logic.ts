/**
 * Pure lender BRE checkpoint evaluation (no n8n imports).
 * Decisions never include lender name or UserID.
 */

export const BRE_OPERATORS = ['less_than', 'greater_than', 'boolean_true', 'boolean_false'] as const;
export type BreOperator = (typeof BRE_OPERATORS)[number];

export interface LenderBreCheckpoint {
  userId: string;
  parameter: string;
  rejectionCode: string;
  operator: BreOperator;
  threshold: number | null;
  active: boolean;
}

export type ApplicantParameters = Record<string, number | boolean | null | undefined>;

export type BreCheckpointDecision =
  | { status: 'Pending'; reason: 'BUREAU_REPORT_MISSING' }
  | { status: 'BRE REJECTED'; reason: string; failedRules: string[] }
  | { status: 'BRE APPROVED'; reason: 'ELIGIBLE' };

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === 'yes' || v === '1' || v === 'checked';
  }
  return false;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readField(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return undefined;
}

function isBreOperator(value: string): value is BreOperator {
  return (BRE_OPERATORS as readonly string[]).includes(value);
}

export function normalizeCheckpointRecord(raw: unknown): LenderBreCheckpoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const fields =
    record.fields && typeof record.fields === 'object'
      ? (record.fields as Record<string, unknown>)
      : record;

  const userId = String(readField(fields, 'UserID', 'User ID', 'userId') ?? '').trim();
  const parameter = String(readField(fields, 'Parameter', 'parameter') ?? '').trim();
  const rejectionCode = String(readField(fields, 'Rejection Code', 'rejectionCode', 'rejection_code') ?? '').trim();
  const operatorRaw = String(readField(fields, 'Operator', 'operator') ?? '').trim();
  if (!parameter || !rejectionCode || !isBreOperator(operatorRaw)) return null;

  return {
    userId,
    parameter,
    rejectionCode,
    operator: operatorRaw,
    threshold: coerceNumber(readField(fields, 'Threshold', 'threshold')),
    active: coerceBoolean(readField(fields, 'Active', 'active')),
  };
}

function ruleFails(rule: LenderBreCheckpoint, applicant: ApplicantParameters): boolean {
  const value = applicant[rule.parameter];
  switch (rule.operator) {
    case 'less_than':
      return typeof value === 'number' && rule.threshold != null && value < rule.threshold;
    case 'greater_than':
      return typeof value === 'number' && rule.threshold != null && value > rule.threshold;
    case 'boolean_true':
      return value === true;
    case 'boolean_false':
      return value === false;
    default: {
      const _exhaustive: never = rule.operator;
      return _exhaustive;
    }
  }
}

export function evaluateCheckpoints(
  checkpoints: LenderBreCheckpoint[],
  applicant: ApplicantParameters,
  options?: { bureauReportMissing?: boolean }
): BreCheckpointDecision {
  if (options?.bureauReportMissing) {
    return { status: 'Pending', reason: 'BUREAU_REPORT_MISSING' };
  }

  const active = checkpoints.filter((rule) => rule.active);
  const failedRules = active.filter((rule) => ruleFails(rule, applicant)).map((rule) => rule.rejectionCode);
  if (failedRules.length > 0) {
    return { status: 'BRE REJECTED', reason: failedRules[0] ?? 'INELIGIBLE', failedRules };
  }
  return { status: 'BRE APPROVED', reason: 'ELIGIBLE' };
}
