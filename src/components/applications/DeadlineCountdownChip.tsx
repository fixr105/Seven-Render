import React, { useEffect, useState } from 'react';
import {
  countdownUrgency,
  formatCountdownHhMmSs,
  readDeadlineMeta,
  remainingMs,
} from '../../lib/deadlineCountdown';

export type DeadlineCountdownChipProps = {
  formData: Record<string, unknown>;
  className?: string;
};

export const DeadlineCountdownChip: React.FC<DeadlineCountdownChipProps> = ({
  formData,
  className = '',
}) => {
  const deadline = readDeadlineMeta(formData);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline || deadline.completed_at) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (!deadline || deadline.completed_at) return null;

  const ms = remainingMs(deadline.deadline_at, new Date(now));
  const urgency = countdownUrgency(ms, deadline.completed_at);
  if (urgency === 'done') return null;

  const tone =
    urgency === 'red' || urgency === 'expired'
      ? 'bg-dealer-error/15 text-dealer-error border-dealer-error/40'
      : urgency === 'amber'
        ? 'bg-dealer-warning/15 text-dealer-warning border-dealer-warning/40'
        : 'bg-dealer-surface-soft text-dealer-text border-dealer-border';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${tone} ${className}`}
      data-testid="deadline-countdown-chip"
      data-urgency={urgency}
      title={`Deadline ${deadline.deadline_at}`}
    >
      {formatCountdownHhMmSs(ms)}
    </span>
  );
};
