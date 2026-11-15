export type DeadlineMeta = {
  started_at: string;
  deadline_at: string;
  missed_count: number;
  completed_at?: string;
  /** Set when KAM Flags create failed; cleared after a successful retry. */
  flag_pending?: string;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function buildDeadlineMeta(startedAt: Date = new Date()): DeadlineMeta {
  const started = startedAt.toISOString();
  const deadline = new Date(startedAt.getTime() + DAY_MS).toISOString();
  return {
    started_at: started,
    deadline_at: deadline,
    missed_count: 0,
  };
}

export function readDeadlineMeta(formData: Record<string, unknown>): DeadlineMeta | null {
  const raw = formData['_meta.deadline'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return normalizeDeadline(parsed as Record<string, unknown>);
        }
      } catch {
        return null;
      }
    }
    return null;
  }
  return normalizeDeadline(raw as Record<string, unknown>);
}

function normalizeDeadline(raw: Record<string, unknown>): DeadlineMeta | null {
  const started_at = String(raw.started_at || '').trim();
  const deadline_at = String(raw.deadline_at || '').trim();
  if (!started_at || !deadline_at) return null;
  const missed = Number(raw.missed_count);
  const flag_pending = String(raw.flag_pending || '').trim();
  return {
    started_at,
    deadline_at,
    missed_count: Number.isFinite(missed) ? missed : 0,
    completed_at: raw.completed_at ? String(raw.completed_at) : undefined,
    ...(flag_pending ? { flag_pending } : {}),
  };
}

export function mergeDeadlineIntoFormData(
  formData: Record<string, unknown>,
  deadline: DeadlineMeta
): Record<string, unknown> {
  return {
    ...formData,
    '_meta.deadline': deadline,
  };
}

export function remainingMs(deadlineAt: string, now: Date = new Date()): number {
  const end = Date.parse(deadlineAt);
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - now.getTime());
}

export function formatCountdownHhMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type CountdownUrgency = 'normal' | 'amber' | 'red' | 'expired' | 'done';

export function countdownUrgency(ms: number, completedAt?: string): CountdownUrgency {
  if (completedAt) return 'done';
  if (ms <= 0) return 'expired';
  if (ms < 30 * 60 * 1000) return 'red';
  if (ms < 2 * HOUR_MS) return 'amber';
  return 'normal';
}

export function isDeadlineExpired(deadlineAt: string, now: Date = new Date()): boolean {
  return remainingMs(deadlineAt, now) <= 0;
}

export function resetDeadlineAfterMiss(deadline: DeadlineMeta, now: Date = new Date()): DeadlineMeta {
  return {
    started_at: deadline.started_at,
    deadline_at: new Date(now.getTime() + DAY_MS).toISOString(),
    missed_count: (deadline.missed_count || 0) + 1,
    completed_at: deadline.completed_at,
    // Fresh window — clear stale pending flag id; caller sets a new one if needed.
  };
}

export function buildKamFlagId(fileId: string, missedCountAfter: number): string {
  return `${fileId}-D${missedCountAfter}`;
}
