import React from 'react';
import { Check } from 'lucide-react';

export interface B2cEvWizardStep {
  id: string;
  label: string;
  description?: string;
}

interface B2cEvWizardStepperProps {
  steps: B2cEvWizardStep[];
  currentStep: number;
  completedSteps: number[];
  lockedSteps: number[];
  onStepClick?: (stepIndex: number) => void;
}

type StepAccent = 'default' | 'purple' | 'green';
type StepPhase = 'do' | 'get-paid';

const DO_STAGE_LABEL = 'DO stage';
const GET_PAID_STAGE_LABEL = 'Get Paid';

function getStepPhase(stepIndex: number): StepPhase {
  return stepIndex < 6 ? 'do' : 'get-paid';
}

function getPhaseHoverLabel(phase: StepPhase): string {
  return phase === 'do' ? DO_STAGE_LABEL : GET_PAID_STAGE_LABEL;
}

function getPhaseBackdropClasses(phase: StepPhase): string {
  return phase === 'do'
    ? 'rounded-xl border border-blue-100 bg-blue-50'
    : 'rounded-xl border border-green-100 bg-green-50';
}

function getStepAccent(stepId: string): StepAccent {
  if (stepId === 'geo-photos') return 'purple';
  if (stepId === 'insurance' || stepId === 'vehicle') return 'green';
  return 'default';
}

function getCircleClasses(
  accent: StepAccent,
  isLocked: boolean,
  isActive: boolean,
  isCompleted: boolean
): string {
  if (isLocked) return 'bg-neutral-300 text-neutral-500';

  if (isActive) {
    switch (accent) {
      case 'purple':
        return 'bg-violet-500 text-white ring-2 ring-violet-200';
      case 'green':
        return 'bg-success text-white ring-2 ring-green-200';
      default:
        return 'bg-white/20 text-white';
    }
  }

  if (isCompleted) {
    switch (accent) {
      case 'purple':
        return 'bg-violet-600 text-white';
      case 'green':
        return 'bg-success text-white';
      default:
        return 'bg-success text-white';
    }
  }

  switch (accent) {
    case 'purple':
      return 'bg-violet-100 text-violet-700 ring-2 ring-violet-400';
    case 'green':
      return 'bg-green-100 text-green-800 ring-2 ring-success';
    default:
      return 'bg-neutral-200 text-neutral-600';
  }
}

export const B2cEvWizardStepper: React.FC<B2cEvWizardStepperProps> = ({
  steps,
  currentStep,
  completedSteps,
  lockedSteps,
  onStepClick,
}) => {
  const doStageSteps = steps.slice(0, 6);
  const getPaidStageSteps = steps.slice(6);

  const renderStep = (step: B2cEvWizardStep, index: number) => {
    const isActive = index === currentStep;
    const isCompleted = completedSteps.includes(index) || index < currentStep;
    const isLocked = lockedSteps.includes(index);
    const isClickable =
      !!onStepClick && !isLocked && (isCompleted || index === currentStep);
    const accent = getStepAccent(step.id);
    const phase = getStepPhase(index);

    return (
      <button
        key={step.id}
        type="button"
        onClick={() => isClickable && onStepClick?.(index)}
        disabled={!isClickable}
        data-testid={`b2c-stepper-step-${step.id}`}
        data-step-accent={accent}
        data-step-phase={phase}
        className={`
          min-w-0 flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center sm:px-2 sm:py-2.5
          transition-all duration-200 touch-manipulation
          ${isLocked ? 'cursor-not-allowed border border-neutral-200 bg-neutral-100 opacity-45 grayscale' : ''}
          ${!isLocked && isActive ? 'bg-brand-primary text-white shadow-md' : ''}
          ${!isLocked && !isActive ? 'border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300' : ''}
          ${isClickable ? 'cursor-pointer' : isLocked ? 'cursor-not-allowed' : 'cursor-default'}
        `}
      >
        <span
          className={`
            flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm
            ${getCircleClasses(accent, isLocked, isActive, isCompleted)}
          `}
        >
          {isCompleted && !isActive && !isLocked ? (
            <Check className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            index + 1
          )}
        </span>
        <p
          title={getPhaseHoverLabel(phase)}
          className={`line-clamp-2 w-full text-[10px] font-semibold leading-tight sm:text-xs ${
            isLocked ? 'text-neutral-500' : isActive ? 'text-white' : 'text-neutral-900'
          }`}
        >
          {step.label}
        </p>
      </button>
    );
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:gap-2">
      <div
        className={`min-w-0 flex-[6] p-3 sm:p-4 ${getPhaseBackdropClasses('do')}`}
        data-testid="b2c-stepper-phase-do"
      >
        <div
          className="grid w-full gap-1 sm:gap-2"
          style={{ gridTemplateColumns: `repeat(${doStageSteps.length}, minmax(0, 1fr))` }}
        >
          {doStageSteps.map((step, localIndex) => renderStep(step, localIndex))}
        </div>
      </div>
      {getPaidStageSteps.length > 0 && (
        <div
          className={`min-w-0 flex-[2] p-3 sm:p-4 ${getPhaseBackdropClasses('get-paid')}`}
          data-testid="b2c-stepper-phase-get-paid"
        >
          <div
            className="grid w-full gap-1 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${getPaidStageSteps.length}, minmax(0, 1fr))` }}
          >
            {getPaidStageSteps.map((step, localIndex) => renderStep(step, localIndex + 6))}
          </div>
        </div>
      )}
    </div>
  );
};
