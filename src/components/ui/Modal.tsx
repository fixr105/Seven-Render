import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional data-testid for E2E tests */
  testId?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, size = 'md', testId }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative bg-white rounded-lg shadow-level-3 w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col border border-neutral-200`}
        data-testid={testId}
      >
        {children}
      </div>
    </div>
  );
};

interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ children, onClose }) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-neutral-200">
      <h2 className="text-lg font-semibold text-neutral-900">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-neutral-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-neutral-500" />
        </button>
      )}
    </div>
  );
};

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '' }) => {
  return <div className={`p-4 overflow-y-auto ${className}`}>{children}</div>;
};

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex items-center justify-end gap-2 p-4 border-t border-neutral-200 ${className}`}>
      {children}
    </div>
  );
};
