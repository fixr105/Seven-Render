import React from 'react';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  const variantClasses = {
    primary: 'bg-brand-primary text-white hover:bg-[#2a2560] active:bg-[#1f1c4a] focus:ring-brand-primary',
    secondary: 'bg-white text-brand-primary border border-brand-primary hover:bg-brand-primary/10 active:bg-brand-primary/20 focus:ring-brand-primary',
    tertiary: 'bg-transparent text-brand-primary hover:bg-brand-primary/10 active:bg-brand-primary/20 focus:ring-brand-primary',
    danger: 'bg-error text-white hover:bg-red-600 active:bg-red-700 focus:ring-error',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-sm rounded',
    md: 'h-10 px-4 text-base rounded',
    lg: 'h-12 px-6 text-base rounded',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className={`animate-spin ${iconSizeClasses[size]} ${children ? 'mr-2' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {children && <span>Loading...</span>}
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className={`${iconSizeClasses[size]} ${children ? 'mr-2' : ''}`} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className={`${iconSizeClasses[size]} ${children ? 'ml-2' : ''}`} />}
        </>
      )}
    </button>
  );
};
