import React from 'react';

export const DealerSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded bg-dealer-border"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
};
