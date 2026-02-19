import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon: Icon, iconPosition = 'left', className = '', required, ...props }, ref) => {
    const inputClasses = `
      w-full min-h-[44px] h-10 px-3 text-base bg-white border rounded touch-manipulation
      transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
      disabled:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-500
      ${error ? 'border-error focus:ring-error focus:border-error' : 'border-neutral-300'}
      ${Icon ? (iconPosition === 'left' ? 'pl-10' : 'pr-10') : ''}
      ${className}
    `;

    return (
      <div className="w-full">
        {label && (
          <label className="block mb-1 text-sm font-medium text-neutral-700">
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && iconPosition === 'left' && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          )}
          <input ref={ref} className={inputClasses} {...props} />
          {Icon && iconPosition === 'right' && (
            <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-error">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-neutral-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
