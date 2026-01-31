import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', id, hoverable = false, onClick }) => {
  const baseClasses = 'bg-white rounded-lg shadow-level-1 border border-neutral-200 overflow-hidden';
  const hoverClasses = hoverable ? 'cursor-pointer hover:shadow-level-2 transition-shadow duration-200' : '';

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
  return <div className={`px-4 py-3 border-b border-neutral-200 ${className}`}>{children}</div>;
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => {
  return <h3 className={`text-base font-semibold text-neutral-900 ${className}`}>{children}</h3>;
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
  return <div className={`px-4 py-3 border-t border-neutral-200 ${className}`}>{children}</div>;
};
