import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  tone?: 'default' | 'dealer';
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className = '', required, tone = 'default', ...props }, ref) => {
    const dealer = tone === 'dealer';
    const textareaClasses = `
      w-full min-h-[88px] px-3 py-2 text-base bg-white border rounded touch-manipulation
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
        <textarea ref={ref} className={textareaClasses} rows={4} {...props} />
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

TextArea.displayName = 'TextArea';
