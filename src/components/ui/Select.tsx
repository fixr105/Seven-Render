import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className = '', required, ...props }, ref) => {
    const selectClasses = `
      w-full h-10 px-3 text-base bg-white border rounded
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
        <select ref={ref} className={selectClasses} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';
