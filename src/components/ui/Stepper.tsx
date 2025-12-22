/**
 * Module 2: Stepper Component
 * 
 * Multi-step form stepper for sectioned loan application form
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
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.includes(index) || index < currentStep;
          const isClickable = onStepClick && (isCompleted || index === currentStep);

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    transition-all duration-200
                    ${isCompleted
                      ? 'bg-success text-white'
                      : isActive
                      ? 'bg-brand-primary text-white ring-4 ring-brand-primary/20'
                      : 'bg-neutral-200 text-neutral-600'
                    }
                    ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="font-semibold">{index + 1}</span>
                  )}
                </button>
                <div className="mt-2 text-center">
                  <p
                    className={`
                      text-sm font-medium
                      ${isActive ? 'text-brand-primary' : isCompleted ? 'text-success' : 'text-neutral-600'}
                    `}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-neutral-500 mt-1">{step.description}</p>
                  )}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2
                    ${isCompleted ? 'bg-success' : 'bg-neutral-200'}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};


