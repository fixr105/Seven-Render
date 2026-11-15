import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', id, hoverable = false, onClick }) => {
  const baseClasses = 'overflow-hidden rounded-xl border border-sf-border bg-sf-surface shadow-sf-shadow-sm';
  const hoverClasses = hoverable ? 'cursor-pointer transition-shadow duration-200 hover:shadow-sf-shadow-md' : '';

  return (
    <div id={id} className={`${baseClasses} ${hoverClasses} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
  return <div className={`border-b border-sf-border px-4 py-3 ${className}`}>{children}</div>;
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => {
  return <h3 className={`text-base font-semibold leading-6 text-sf-text ${className}`}>{children}</h3>;
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>;
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => {
  return <div className={`border-t border-sf-border px-4 py-3 ${className}`}>{children}</div>;
};
