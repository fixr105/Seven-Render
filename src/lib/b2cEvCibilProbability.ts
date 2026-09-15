import { apiService } from '../services/api';

export type CibilChances = {
  score: number;
  label: string;
};

export function parseCibilScore(raw: unknown): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

/** Read borrower CIBIL from PAN lookup meta, with legacy field fallback. */
export function getBorrowerCibilScoreFromFormData(
  formData: Record<string, unknown>
): number | null {
  return (
    parseCibilScore(formData['_meta.panLookup.cibilScore']) ??
    parseCibilScore(formData['borrower.cibilScore'])
  );
}

/** Clamp chance score for bar marker (0–100). */
export function getChanceMarkerPercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, score));
}

/**
 * Fetch dynamic CIBIL chances from backend BRE calculator.
 * Never exposes lender names (client-safe endpoint response).
 */
export async function fetchCibilChances(cibil: number): Promise<CibilChances> {
  const res = await apiService.getCibilChances(cibil);
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Failed to load CIBIL chances');
  }
  const score = Number(res.data.score);
  const label = String(res.data.label ?? '');
  return {
    score: Number.isFinite(score) ? score : 0,
    label: label || 'Almost No Chance',
  };
}
