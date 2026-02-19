/**
 * Multi-step form stepper – horizontal layout with numbered steps, title and subtitle.
 * Matches New Loan Application design: light card, current step in dark blue, optional vertical progress.
 */

import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  steps: Array<{ id: string; label: string; description?: string }>;
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  completedSteps?: number[];
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  completedSteps = [],
}) => {
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
        {/* Vertical progress indicator on the right - hidden on mobile to save space */}
        <div className="hidden sm:flex flex-shrink-0 flex-col justify-center items-center w-1 ml-2 bg-neutral-200 rounded-full overflow-hidden self-stretch min-h-[60px]">
          {steps.slice(0, Math.min(4, steps.length)).map((_, i) => (
            <div
              key={i}
              className={`w-full flex-1 min-h-[4px] ${i <= currentStep ? 'bg-brand-primary' : 'bg-neutral-200'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
