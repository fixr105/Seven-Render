import React from 'react';
import { DealerSkeleton } from './DealerSkeleton';
import { StatusBadge } from './StatusBadge';

type DealerWaitingProps = {
  title: string;
  testId?: string;
  className?: string;
  children?: React.ReactNode;
};

export const DealerWaiting: React.FC<DealerWaitingProps> = ({
  title,
  testId,
  className = '',
  children,
}) => {
  return (
    <div
      className={`rounded-[12px] border border-dealer-border bg-dealer-surface p-5 ${className}`}
      data-testid={testId}
      aria-live="polite"
    >
      <div className="mb-3">
        <StatusBadge status="in_progress" pulse />
      </div>
      <p className="post-submit-body text-sm font-medium text-dealer-navy">{title}</p>
      {children}
      <div className="mt-3">
        <DealerSkeleton />
      </div>
    </div>
  );
};
