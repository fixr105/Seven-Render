import React from 'react';

export type DealerStatus = 'pending' | 'in_progress' | 'needs_action' | 'done' | 'blocked';

const LABEL: Record<DealerStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  needs_action: 'Needs action',
  done: 'Done',
  blocked: 'Blocked',
};

const DOT: Record<DealerStatus, string> = {
  pending: 'bg-dealer-text-quiet',
  in_progress: 'bg-dealer-navy',
  needs_action: 'bg-dealer-warning',
  done: 'bg-dealer-success',
  blocked: 'bg-dealer-error',
};

const FILL: Record<DealerStatus, string> = {
  pending: 'bg-dealer-surface-soft text-dealer-text',
  in_progress: 'bg-dealer-surface-soft text-dealer-navy',
  needs_action: 'bg-dealer-warning/15 text-dealer-warning',
  done: 'bg-dealer-success/10 text-dealer-success',
  blocked: 'bg-dealer-error/10 text-dealer-error',
};

type StatusBadgeProps = {
  status: DealerStatus;
  pulse?: boolean;
  variant?: 'lite' | 'filled';
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  pulse = false,
  variant = 'lite',
}) => {
  const shell =
    variant === 'filled'
      ? `rounded-full px-2 py-0.5 ${FILL[status]}`
      : 'text-dealer-text';

  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-semibold leading-4 ${shell}`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]} ${
          pulse ? 'motion-safe:animate-pulse' : ''
        }`}
        aria-hidden
      />
      {LABEL[status]}
    </span>
  );
};

export function statusBarClass(status: DealerStatus | undefined): string | null {
  if (status === 'needs_action') return 'bg-dealer-warning';
  if (status === 'blocked') return 'bg-dealer-error';
  if (status === 'done') return 'bg-dealer-success';
  return null;
}
