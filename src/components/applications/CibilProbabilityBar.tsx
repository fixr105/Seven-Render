import React from 'react';
import {
  getCibilMarkerPercent,
  getCibilProbabilityLabel,
  getCibilProbabilityTier,
} from '../../lib/b2cEvCibilProbability';

interface CibilProbabilityBarProps {
  cibilScore: number | null;
}

export const CibilProbabilityBar: React.FC<CibilProbabilityBarProps> = ({ cibilScore }) => {
  if (cibilScore == null) return null;

  const tier = getCibilProbabilityTier(cibilScore);
  const label = getCibilProbabilityLabel(tier);
  const markerPercent = getCibilMarkerPercent(cibilScore);

  return (
    <div
      className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm"
      data-testid="cibil-probability-bar"
      aria-label="Loan approval probability indicator"
    >
      <p className="mb-3 text-center text-sm font-semibold text-neutral-800">{label}</p>
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
