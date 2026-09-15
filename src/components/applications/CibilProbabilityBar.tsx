import React, { useEffect, useState } from 'react';
import {
  fetchCibilChances,
  getChanceMarkerPercent,
  type CibilChances,
} from '../../lib/b2cEvCibilProbability';

interface CibilProbabilityBarProps {
  cibilScore: number | null;
  /** Optional controlled result — when set, skips fetch. */
  chances?: CibilChances | null;
  onChancesLoaded?: (chances: CibilChances) => void;
}

export const CibilProbabilityBar: React.FC<CibilProbabilityBarProps> = ({
  cibilScore,
  chances: controlledChances,
  onChancesLoaded,
}) => {
  const [fetched, setFetched] = useState<CibilChances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (controlledChances != null) {
      setFetched(controlledChances);
      return;
    }
    if (cibilScore == null) {
      setFetched(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchCibilChances(cibilScore)
      .then((data) => {
        if (cancelled) return;
        setFetched(data);
        onChancesLoaded?.(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetched(null);
        setError(err instanceof Error ? err.message : 'Failed to load chances');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cibilScore, controlledChances, onChancesLoaded]);

  if (cibilScore == null) return null;

  const chances = controlledChances ?? fetched;
  if (loading && !chances) {
    return (
      <div
        className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm"
        data-testid="cibil-probability-bar"
        aria-busy="true"
      >
        <p className="text-center text-sm text-neutral-500">Loading chances…</p>
      </div>
    );
  }

  if (error && !chances) {
    return (
      <div
        className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm"
        data-testid="cibil-probability-bar"
        role="alert"
      >
        <p className="text-center text-sm text-error">{error}</p>
      </div>
    );
  }

  if (!chances) return null;

  const markerPercent = getChanceMarkerPercent(chances.score);

  return (
    <div
      className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm"
      data-testid="cibil-probability-bar"
      aria-label="Loan approval probability indicator"
    >
      <p className="mb-3 text-center text-sm font-semibold text-neutral-800">{chances.label}</p>
      <div className="relative h-3 w-full overflow-hidden rounded-full">
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 via-orange-400 via-45% via-yellow-400 via-70% to-green-500 opacity-90"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-neutral-900 shadow-[0_0_12px_rgba(0,0,0,0.35)]"
          style={{ left: `${markerPercent}%` }}
          data-testid="cibil-probability-marker"
          aria-hidden
        />
      </div>
    </div>
  );
};
