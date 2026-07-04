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
  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
      <div
        className="grid w-full gap-1 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.includes(index) || index < currentStep;
          const isLocked = lockedSteps.includes(index);
          const isClickable =
            !!onStepClick && !isLocked && (isCompleted || index === currentStep);
          const accent = getStepAccent(step.id);

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              title={step.description ? `${step.label} — ${step.description}` : step.label}
              data-testid={`b2c-stepper-step-${step.id}`}
              data-step-accent={accent}
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
                className={`line-clamp-2 w-full text-[10px] font-semibold leading-tight sm:text-xs ${
                  isLocked ? 'text-neutral-500' : isActive ? 'text-white' : 'text-neutral-900'
                }`}
              >
                {step.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
