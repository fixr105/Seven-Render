import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  const variantClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-brand-primary/20 text-brand-primary border-brand-primary/30',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    primary: 'bg-brand-primary/20 text-brand-primary border-brand-primary/30',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};
