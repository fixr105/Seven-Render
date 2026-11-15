import React from 'react';
import { StatusBadge, statusBarClass, type DealerStatus } from './StatusBadge';

type SectionCardProps = {
  title: string;
  helper?: string;
  status?: DealerStatus;
  pulse?: boolean;
  children: React.ReactNode;
  testId?: string;
};

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  helper,
  status,
  pulse = false,
  children,
  testId,
}) => {
  const bar = statusBarClass(status);
  return (
    <section
      data-testid={testId}
      className="relative overflow-hidden rounded-[12px] border border-dealer-border bg-dealer-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-5"
    >
      {bar ? <span className={`absolute inset-x-0 top-0 h-[2px] ${bar}`} aria-hidden /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-6 text-dealer-text">{title}</h3>
          {helper ? (
            <p className="mt-1 text-[13px] font-normal leading-[18px] text-dealer-text-quiet">
              {helper}
            </p>
          ) : null}
        </div>
        {status ? <StatusBadge status={status} pulse={pulse} variant="filled" /> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
};
