export type CibilProbabilityTier = 'almost_none' | 'co_applicant' | 'chances' | 'full';

const CIBIL_DISPLAY_MIN = 300;
const CIBIL_DISPLAY_MAX = 900;

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

export function getCibilProbabilityTier(score: number): CibilProbabilityTier {
  if (score <= 550) return 'almost_none';
  if (score <= 630) return 'co_applicant';
  if (score <= 674) return 'chances';
  return 'full';
}

export function getCibilProbabilityLabel(tier: CibilProbabilityTier): string {
  switch (tier) {
    case 'almost_none':
      return 'Almost No chance';
    case 'co_applicant':
      return 'Chances with co applicant';
    case 'chances':
      return 'Chances';
    case 'full':
      return '90% chance';
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}

const CIBIL_MARKER_MAX_PERCENT = 90;

export function getCibilMarkerPercent(score: number): number {
  const clamped = Math.min(Math.max(score, CIBIL_DISPLAY_MIN), CIBIL_DISPLAY_MAX);
  const range = CIBIL_DISPLAY_MAX - CIBIL_DISPLAY_MIN;
  const rawPercent = ((clamped - CIBIL_DISPLAY_MIN) / range) * 100;
  return Math.min(rawPercent, CIBIL_MARKER_MAX_PERCENT);
}
