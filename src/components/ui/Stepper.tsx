/**
 * Multi-step form stepper – horizontal layout with numbered steps and title.
 * Uses equal-width columns so all steps fit within the viewport.
 */

import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  steps: Array<{ id: string; label: string; description?: string }>;
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  completedSteps?: number[];
  /** When true, steps share equal width and fit the screen without horizontal scroll. */
  fitToWidth?: boolean;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  completedSteps = [],
  fitToWidth = false,
}) => {
  if (fitToWidth) {
    return (
      <div className="w-full rounded-xl bg-neutral-50 border border-neutral-200 p-3 sm:p-4">
        <div
          className="grid w-full gap-1 sm:gap-2"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = completedSteps.includes(index) || index < currentStep;
            const isClickable = !!onStepClick && (isCompleted || index === currentStep);

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                title={step.description ? `${step.label} — ${step.description}` : step.label}
                className={`
                  min-w-0 flex flex-col items-center gap-1 rounded-lg px-1 py-2 sm:px-2 sm:py-2.5 text-center
                  transition-all duration-200 touch-manipulation
                  ${isActive ? 'bg-brand-primary text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300'}
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <span
                  className={`
                    flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-semibold
                    ${isCompleted && !isActive ? 'bg-success text-white' : ''}
                    ${isActive ? 'bg-white/20 text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-neutral-200 text-neutral-600' : ''}
                  `}
                >
                  {isCompleted && !isActive ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : index + 1}
                </span>
                <p
                  className={`w-full text-[10px] sm:text-xs font-semibold leading-tight line-clamp-2 ${isActive ? 'text-white' : 'text-neutral-900'}`}
                >
                  {step.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-neutral-50 border border-neutral-200 p-4 sm:p-6">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth snap-x snap-mandatory touch-manipulation [scrollbar-width:thin]">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.includes(index) || index < currentStep;
          const isClickable = !!onStepClick && (isCompleted || index === currentStep);

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`
                flex-shrink-0 flex items-start gap-3 rounded-lg px-4 py-3 min-w-[140px] sm:min-w-[180px] max-w-[220px] text-left snap-start
                transition-all duration-200 touch-manipulation
                ${isActive ? 'bg-brand-primary text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300'}
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              <span
                className={`
                  flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold
                  ${isCompleted && !isActive ? 'bg-success text-white' : ''}
                  ${isActive ? 'bg-white/20 text-white' : ''}
                  ${!isActive && !isCompleted ? 'bg-neutral-200 text-neutral-600' : ''}
                `}
              >
                {isCompleted && !isActive ? <Check className="w-5 h-5" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-neutral-900'}`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className={`text-xs mt-0.5 truncate ${isActive ? 'text-white/90' : 'text-neutral-500'}`}>
                    {step.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
