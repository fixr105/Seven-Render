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
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation';

  const variantClasses = {
    primary: 'bg-sf-navy text-white hover:bg-sf-navy/90 active:bg-sf-navy/80 focus:ring-sf-navy focus:ring-offset-2',
    secondary: 'border border-sf-border bg-sf-surface text-sf-text hover:bg-sf-soft focus:ring-sf-navy focus:ring-offset-2',
    tertiary: 'bg-transparent text-sf-navy hover:bg-sf-soft focus:ring-sf-navy focus:ring-offset-2',
    danger: 'bg-sf-error text-white hover:bg-sf-error/90 active:bg-sf-error/80 focus:ring-sf-error focus:ring-offset-2',
  };

  const sizeClasses = {
    sm: 'h-8 min-h-[44px] rounded-lg px-3 text-sm',
    md: 'h-10 min-h-[44px] rounded-lg px-4 text-sm',
    lg: 'h-12 min-h-[44px] rounded-lg px-6 text-sm',
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
