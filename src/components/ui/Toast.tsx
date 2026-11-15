import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ type, message, onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: { iconClass: 'text-sf-success', icon: CheckCircle },
    error: { iconClass: 'text-sf-error', icon: AlertCircle },
    info: { iconClass: 'text-sf-info', icon: Info },
    warning: { iconClass: 'text-sf-warning', icon: AlertTriangle },
  };

  const { iconClass, icon: Icon } = config[type];

  return (
    <div className="flex w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border border-sf-border bg-sf-surface p-4 text-sf-text shadow-sf-shadow-md animate-slide-in sm:min-w-[280px] sm:max-w-md">
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconClass}`} />
      <p className="flex-1 text-sm leading-5">{message}</p>
      <button
        onClick={onClose}
        className="inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg text-sf-quiet hover:bg-sf-soft"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{ id: string; type: ToastType; message: string }>;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 pb-safe">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};
