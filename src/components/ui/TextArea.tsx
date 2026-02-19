import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className = '', required, ...props }, ref) => {
    const textareaClasses = `
      w-full min-h-[88px] px-3 py-2 text-base bg-white border rounded touch-manipulation
      transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
      disabled:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-500
      ${error ? 'border-error focus:ring-error focus:border-error' : 'border-neutral-300'}
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
        <textarea ref={ref} className={textareaClasses} rows={4} {...props} />
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

TextArea.displayName = 'TextArea';
