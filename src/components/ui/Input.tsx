import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  tone?: 'default' | 'dealer';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon: Icon, iconPosition = 'left', className = '', required, tone = 'default', ...props }, ref) => {
    const dealer = tone === 'dealer';
    const inputClasses = `
      w-full min-h-[44px] h-10 px-3 text-base bg-white border rounded touch-manipulation
      transition-colors duration-200
      focus:outline-none focus:ring-2
      disabled:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-500
      ${dealer ? 'font-inter text-dealer-text' : ''}
      ${error
        ? dealer
          ? 'border-dealer-error focus:ring-dealer-error focus:border-dealer-error'
          : 'border-error focus:ring-error focus:border-error'
        : dealer
          ? 'border-dealer-border focus:ring-dealer-navy focus:border-dealer-navy'
          : 'border-neutral-300 focus:ring-brand-primary focus:border-brand-primary'}
      ${Icon ? (iconPosition === 'left' ? 'pl-10' : 'pr-10') : ''}
      ${className}
    `;

    return (
      <div className="w-full">
        {label && (
          <label className={`block mb-1 text-sm font-medium ${dealer ? 'font-inter text-dealer-text' : 'text-neutral-700'}`}>
            {label}
            {required && <span className={`${dealer ? 'text-dealer-error' : 'text-error'} ml-1`}>*</span>}
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
          <p className={`mt-1 text-sm ${dealer ? 'text-dealer-error' : 'text-error'}`}>{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-neutral-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
