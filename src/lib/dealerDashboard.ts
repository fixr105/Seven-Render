import { formatInr } from './postSubmitEngine/canonical';
import type { DealerStatus } from '../components/dealer-ui/StatusBadge';
import { readFormPath } from './formPath';

const TERMINAL_STATUSES = new Set(['completed', 'rejected', 'cancelled']);

const STATUS_RULES: Array<{ needles: string[]; badge: DealerStatus }> = [
  { needles: ['draft', 'new'], badge: 'pending' },
  { needles: ['processing', 'qualifying', 'filling'], badge: 'in_progress' },
  { needles: ['pending', 'review', 'waiting'], badge: 'needs_action' },
  { needles: ['completed', 'disbursed', 'signed'], badge: 'done' },
  { needles: ['rejected', 'failed', 'cancelled', 'blocked'], badge: 'blocked' },
];

export type DashboardRow = {
  id: string;
  fileId: string;
  applicant: string;
  amount: number | null;
  amountLabel: string;
  product: string;
  status: string;
  badge: DealerStatus;
  modifiedMs: number;
  updatedLabel: string;
};

export type DashboardKpis = {
  total: number;
  active: number;
  sanctionedLabel: string;
  pendingAction: number;
};

export function mapAirtableStatus(status: string): DealerStatus {
  const haystack = status.toLowerCase();
  for (const rule of STATUS_RULES) {
    if (rule.needles.some((needle) => haystack.includes(needle))) return rule.badge;
  }
  return 'pending';
}

export function formatUpdatedLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = now.getTime() - date.getTime();
  if (diff >= 0 && diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    return mins === 1 ? '1 min ago' : `${mins} min ago`;
  }
  const formatted = date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatted.replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
}

function parseFormData(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function readAmount(form: Record<string, unknown> | null): number | null {
  if (!form) return null;
  const requested = readFormPath(form, 'loan.requestedAmount');
  const stored = readFormPath(form, 'loan.amount');
  const raw = requested.present && requested.value !== '' && requested.value != null
    ? requested.value
    : stored.present
      ? stored.value
      : undefined;
  if (raw == null || raw === '') return null;
  const amount = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

function hasPricing(form: Record<string, unknown> | null): boolean {
  if (!form) return false;
  return readFormPath(form, '_meta.pricing.roi_pct').present;
}

function isPendingAction(status: string, form: Record<string, unknown> | null, now: Date): boolean {
  if (status.toLowerCase().includes('pending')) return true;
  if (!form || !readFormPath(form, '_meta.deadline').present) return false;
  const at = readFormPath(form, '_meta.deadline.deadline_at');
  if (!at.present || at.value == null || String(at.value).trim() === '') return false;
  const time = new Date(String(at.value)).getTime();
  return Number.isFinite(time) && time > now.getTime();
}

function modifiedIso(record: Record<string, unknown>): string {
  const raw = record.Modified ?? record['Last Updated'] ?? record.createdTime ?? '';
  return String(raw || '');
}

export function buildDashboard(
  records: Array<Record<string, unknown>>,
  now = new Date()
): { kpis: DashboardKpis; rows: DashboardRow[] } {
  let active = 0;
  let sanctioned = 0;
  let pendingAction = 0;

  const rows = records.map((record) => {
    const status = String(record.Status ?? record.status ?? '');
    const form = parseFormData(record['Form Data'] ?? record.formData);
    const amount = readAmount(form);
    if (!TERMINAL_STATUSES.has(status.trim().toLowerCase())) active += 1;
    if (hasPricing(form) && amount != null) sanctioned += amount;
    if (isPendingAction(status, form, now)) pendingAction += 1;

    const applicantRaw = form ? readFormPath(form, 'borrower.customerName').value : undefined;
    const applicant =
      form && applicantRaw != null && String(applicantRaw).trim()
        ? String(applicantRaw).trim().toUpperCase()
        : '—';
    const productRaw = form ? readFormPath(form, 'loan.productId').value : undefined;
    const product =
      productRaw != null && String(productRaw).trim()
        ? String(productRaw).trim()
        : String(record['Loan Product'] || '').trim() || '—';
    const iso = modifiedIso(record);
    const modifiedMs = new Date(iso).getTime();

    return {
      id: String(record.id || ''),
      fileId: String(record['File ID'] || (form ? readFormPath(form, '_meta.fileId').value : '') || '—'),
      applicant,
      amount,
      amountLabel: amount == null ? '—' : formatInr(amount),
      product,
      status,
      badge: mapAirtableStatus(status),
      modifiedMs: Number.isFinite(modifiedMs) ? modifiedMs : 0,
      updatedLabel: formatUpdatedLabel(iso, now),
    };
  });

  rows.sort((a, b) => b.modifiedMs - a.modifiedMs);

  return {
    kpis: {
      total: records.length,
      active,
      sanctionedLabel: formatInr(sanctioned),
      pendingAction,
    },
    rows: rows.slice(0, 20),
  };
}

export function filterDashboardRows(
  rows: DashboardRow[],
  query: string,
  badges: DealerStatus[]
): DashboardRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (badges.length > 0 && !badges.includes(row.badge)) return false;
    if (!needle) return true;
    return (
      row.fileId.toLowerCase().includes(needle) || row.applicant.toLowerCase().includes(needle)
    );
  });
}
