import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';

export type JourneyStepState = 'done' | 'current' | 'upcoming' | 'locked';

type JourneyStep = {
  id: string;
  label: string;
  wizardIndex?: number;
  phaseId: string;
};

type JourneyPhase = {
  id: string;
  label: string;
  numbered: boolean;
  steps: JourneyStep[];
};

const PHASES: JourneyPhase[] = [
  {
    id: 'application',
    label: 'Application',
    numbered: true,
    steps: [
      { id: 'product', label: 'Loan product', wizardIndex: 0, phaseId: 'application' },
      { id: 'borrower', label: 'Borrower', wizardIndex: 1, phaseId: 'application' },
      { id: 'loan', label: 'Loan details', wizardIndex: 2, phaseId: 'application' },
      { id: 'dealer', label: 'Dealer', wizardIndex: 3, phaseId: 'application' },
      { id: 'support-person', label: 'Co-applicant', wizardIndex: 4, phaseId: 'application' },
      { id: 'kyc-documents', label: 'KYC & documents', wizardIndex: 5, phaseId: 'application' },
    ],
  },
  {
    id: 'approval',
    label: 'Approval',
    numbered: false,
    steps: [
      { id: 'eligibility', label: 'Eligibility', phaseId: 'approval' },
      { id: 'ntc', label: 'NTC upload', phaseId: 'approval' },
      { id: 'offer', label: 'Offer', phaseId: 'approval' },
      { id: 'enach', label: 'eNACH', phaseId: 'approval' },
      { id: 'documents', label: 'Documents', phaseId: 'approval' },
      { id: 'stamps', label: 'Stamps', phaseId: 'approval' },
      { id: 'signing', label: 'Signing', phaseId: 'approval' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    numbered: false,
    steps: [
      { id: 'photos', label: 'Photos', phaseId: 'delivery' },
      { id: 'insurance', label: 'Insurance', phaseId: 'delivery' },
      { id: 'vehicle', label: 'Vehicle', phaseId: 'delivery' },
      { id: 'iot', label: 'IoT tagging', phaseId: 'delivery' },
    ],
  },
];

const ALL_STEPS = PHASES.flatMap((phase) => phase.steps);

const STATE_WORD: Record<JourneyStepState, string> = {
  done: 'Done',
  current: 'Current',
  upcoming: 'Upcoming',
  locked: 'Locked',
};

type JourneyRailProps = {
  currentIndex?: number;
  currentStepId?: string;
  completedIndices?: number[];
  lockedIndices?: number[];
  onStepClick?: (index: number) => void;
};

function flatIndex(id: string): number {
  return ALL_STEPS.findIndex((step) => step.id === id);
}

function resolveCurrent(currentStepId: string | undefined, currentIndex: number): JourneyStep {
  if (currentStepId === 'done') {
    return { id: 'done', label: 'Done', phaseId: 'approval' };
  }
  if (currentStepId) {
    const match = ALL_STEPS.find((step) => step.id === currentStepId);
    if (match) return match;
  }
  return ALL_STEPS[currentIndex] ?? ALL_STEPS[0];
}

function currentFlat(current: JourneyStep): number {
  if (current.id === 'done') return flatIndex('signing');
  const index = flatIndex(current.id);
  return index < 0 ? 0 : index;
}

function stepState(
  step: JourneyStep,
  current: JourneyStep,
  completedIndices: number[],
  lockedIndices: number[]
): JourneyStepState {
  if (step.id === current.id) return 'current';
  if (step.wizardIndex != null && lockedIndices.includes(step.wizardIndex)) return 'locked';
  const stepAt = flatIndex(step.id);
  const currentAt = currentFlat(current);
  if (current.id === 'done' && step.phaseId !== 'delivery') return 'done';
  if (
    step.wizardIndex != null &&
    current.wizardIndex != null &&
    step.wizardIndex < current.wizardIndex
  ) {
    return 'done';
  }
  if (step.wizardIndex != null && completedIndices.includes(step.wizardIndex) && stepAt < currentAt) {
    return 'done';
  }
  if (current.wizardIndex == null && stepAt < currentAt) return 'done';
  if (step.wizardIndex == null) return 'locked';
  return 'upcoming';
}

function unlockHint(phaseId: string): string {
  if (phaseId === 'delivery') return 'Unlocks after signing';
  return 'Unlocks after Request DO';
}

function phaseStatus(
  phase: JourneyPhase,
  current: JourneyStep,
  states: JourneyStepState[]
): 'current' | 'done' | 'locked' {
  if (phase.id === current.phaseId && current.id !== 'done') return 'current';
  if (states.every((state) => state === 'done')) return 'done';
  return 'locked';
}

function dotClass(state: JourneyStepState, size: 'step' | 'phone'): string {
  const dimension =
    size === 'phone' ? 'h-1.5 w-1.5' : state === 'current' ? 'h-2.5 w-2.5' : 'h-2 w-2';
  const color =
    state === 'done'
      ? 'bg-dealer-success'
      : state === 'current'
        ? 'bg-dealer-navy'
        : 'bg-dealer-border';
  return `${dimension} shrink-0 rounded-full ${color}`;
}

export const JourneyRail: React.FC<JourneyRailProps> = ({
  currentIndex = 0,
  currentStepId,
  completedIndices = [],
  lockedIndices = [],
  onStepClick,
}) => {
  const [stuck, setStuck] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const titleId = useId();
  const currentStepRef = useRef<HTMLLIElement>(null);
  const current = resolveCurrent(currentStepId, currentIndex);
  const currentPhase = PHASES.find((phase) => phase.id === current.phaseId) ?? PHASES[0];

  useEffect(() => {
    const main = document.querySelector('main');
    const onScroll = () => {
      const top = main instanceof HTMLElement ? main.scrollTop : window.scrollY;
      setStuck(top > 0);
    };
    main?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      main?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const node = currentStepRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }, [current.id]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const stateOf = (step: JourneyStep) => stepState(step, current, completedIndices, lockedIndices);

  const canClick = (step: JourneyStep, state: JourneyStepState) =>
    Boolean(onStepClick) &&
    step.wizardIndex != null &&
    state === 'done' &&
    (current.wizardIndex == null || step.wizardIndex < current.wizardIndex) &&
    !lockedIndices.includes(step.wizardIndex);

  const phaseIndex = currentPhase.steps.findIndex((step) => step.id === current.id);
  const phaseStepNumber = phaseIndex >= 0 ? phaseIndex + 1 : currentPhase.steps.length;

  return (
    <div
      data-testid="journey-rail"
      className={`sticky top-0 min-w-0 overflow-x-hidden border-b border-dealer-border bg-dealer-surface-soft ${
        sheetOpen ? 'z-50' : 'z-20'
      }`}
      style={stuck ? { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)' } : undefined}
    >
      <div className="hidden h-[72px] flex-col md:flex">
        <div className="flex h-9 items-end gap-6 px-1">
          {PHASES.map((phase) => {
            const states = phase.steps.map((step) => stateOf(step));
            const status = phaseStatus(phase, current, states);
            return (
              <div
                key={phase.id}
                data-testid={`journey-phase-${phase.id}`}
                className={`inline-flex h-9 items-center gap-1 border-b-2 text-[11px] font-semibold uppercase tracking-[0.1em] lg:text-xs ${
                  status === 'current'
                    ? 'border-dealer-navy text-dealer-navy'
                    : 'border-transparent text-dealer-text-quiet'
                } ${status === 'locked' ? 'opacity-45' : ''}`}
              >
                {status === 'locked' ? <Lock className="h-3 w-3" aria-hidden /> : null}
                {phase.label}
                {status === 'done' ? (
                  <Check className="h-3 w-3 text-dealer-success" aria-hidden />
                ) : null}
              </div>
            );
          })}
        </div>
        <ol
          data-testid="journey-steps"
          className="flex h-9 min-w-0 items-center gap-3 overflow-x-auto px-1 [scrollbar-width:none] lg:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {currentPhase.steps.map((step) => {
            const state = stateOf(step);
            const clickable = canClick(step, state);
            const tooltip =
              state === 'locked'
                ? `${step.label} · ${STATE_WORD[state]}. ${unlockHint(step.phaseId)}`
                : `${step.label} · ${STATE_WORD[state]}`;
            const labelClass = `whitespace-nowrap text-xs lg:text-[13px] ${
              state === 'current'
                ? 'font-semibold text-dealer-navy'
                : state === 'done'
                  ? 'font-normal text-dealer-text'
                  : 'font-normal text-dealer-text-quiet'
            }`;
            const itemClass = `inline-flex h-9 shrink-0 items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dealer-navy ${
              state === 'locked' ? 'opacity-45' : ''
            } ${clickable ? 'cursor-pointer' : 'cursor-default'}`;
            const body = (
              <>
                <span className={dotClass(state, 'step')} aria-hidden />
                <span className={labelClass}>{step.label}</span>
                {state === 'locked' ? <Lock className="h-3 w-3" aria-hidden /> : null}
              </>
            );
            return (
              <li
                key={step.id}
                ref={state === 'current' ? currentStepRef : undefined}
                className="shrink-0"
              >
                {clickable || state === 'upcoming' || state === 'locked' ? (
                  <button
                    type="button"
                    disabled={!clickable}
                    data-testid={`journey-step-${step.id}`}
                    className={itemClass}
                    title={tooltip}
                    aria-current={state === 'current' ? 'step' : undefined}
                    onClick={() => {
                      if (clickable && step.wizardIndex != null) onStepClick?.(step.wizardIndex);
                    }}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={itemClass} title={tooltip} aria-current="step">
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        data-testid="journey-mobile"
        className="flex min-h-11 w-full flex-col justify-center gap-1 px-1 py-1 text-left md:hidden"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
      >
        <span className="flex w-full items-center">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-dealer-navy">
            {currentPhase.label}
          </span>
          <span className="text-[13px] font-normal text-dealer-text-quiet">
            {` · Step ${phaseStepNumber} of ${currentPhase.steps.length}`}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 text-dealer-text-quiet" aria-hidden />
        </span>
        <span className="flex items-center gap-2" aria-hidden>
          {currentPhase.steps.map((step) => (
            <span
              key={step.id}
              data-testid="journey-mobile-dot"
              className={dotClass(stateOf(step), 'phone')}
            />
          ))}
        </span>
      </button>

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/40 md:hidden"
          role="presentation"
          onClick={() => setSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-[12px] bg-dealer-surface p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="sr-only">
              Your application
            </h2>
            {PHASES.map((phase) => {
              const states = phase.steps.map((step) => stateOf(step));
              const status = phaseStatus(phase, current, states);
              const doneCount = states.filter((state) => state === 'done').length;
              return (
                <section key={phase.id} className="mt-3 first:mt-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-dealer-text-quiet">
                      {phase.label}
                    </h3>
                    {status === 'locked' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-dealer-text-quiet">
                        <Lock className="h-3 w-3" aria-hidden />
                        Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-dealer-text-quiet">
                        {status === 'done' ? (
                          <Check className="h-3 w-3 text-dealer-success" aria-hidden />
                        ) : null}
                        {doneCount} of {phase.steps.length}
                      </span>
                    )}
                  </div>
                  <ol className="mt-1">
                    {phase.steps.map((step) => {
                      const state = stateOf(step);
                      const clickable = canClick(step, state);
                      const row = `flex min-h-11 w-full items-center gap-2 pl-4 text-left text-sm ${
                        state === 'current'
                          ? 'rounded-lg bg-dealer-surface-soft font-semibold text-dealer-navy'
                          : state === 'done'
                            ? 'font-normal text-dealer-text'
                            : 'font-normal text-dealer-text-quiet'
                      } ${state === 'locked' ? 'opacity-45' : ''}`;
                      return (
                        <li key={step.id}>
                          {clickable ? (
                            <button
                              type="button"
                              className={row}
                              onClick={() => {
                                if (step.wizardIndex != null) onStepClick?.(step.wizardIndex);
                                setSheetOpen(false);
                              }}
                            >
                              <Check className="h-4 w-4 text-dealer-success" aria-hidden />
                              {step.label}
                            </button>
                          ) : (
                            <span
                              className={row}
                              title={
                                state === 'locked'
                                  ? `${step.label}. ${unlockHint(phase.id)}`
                                  : undefined
                              }
                              aria-current={state === 'current' ? 'step' : undefined}
                            >
                              {state === 'done' ? (
                                <Check className="h-4 w-4 text-dealer-success" aria-hidden />
                              ) : state === 'locked' ? (
                                <Lock className="h-4 w-4" aria-hidden />
                              ) : (
                                <span className={dotClass(state, 'step')} aria-hidden />
                              )}
                              {step.label}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export function railStepIdForPostSubmit(phase: string): string {
  switch (phase) {
    case 'ntc_upload':
      return 'ntc';
    case 'documents':
    case 'vkyc_gate':
    case 'write_approval':
    case 'doc_fill':
      return 'documents';
    case 'lender_rank':
    case 'rank_error':
    case 'offer':
      return 'offer';
    case 'enach':
      return 'enach';
    case 'stamp_step':
      return 'stamps';
    case 'esign_step':
    case 'signing_sent':
      return 'signing';
    case 'done':
      return 'done';
    case 'resolving':
    case 'qualify':
    case 'qualify_error':
    case 'not_eligible':
    case 'rejected':
    case 'co_qualify':
    case 'write_qualified':
    case 'error':
      return 'eligibility';
    default:
      return 'eligibility';
  }
}
