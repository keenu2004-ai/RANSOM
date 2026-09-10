import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (msg: string, duration?: number) => void;
  error: (msg: string, duration?: number) => void;
  warning: (msg: string, duration?: number) => void;
  info: (msg: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-[var(--badge-success-bg)] border-[var(--badge-success-border)] text-[var(--badge-success-text)]',
  error: 'bg-[var(--action-danger-soft)] border-[var(--action-danger-bg)]/40 text-[var(--action-danger-bg)]',
  warning: 'bg-[var(--accent-attention)] border-[var(--accent-attention-border)] text-[var(--accent-attention-text)]',
  info: 'bg-[var(--bg-surface-secondary)] border-[var(--border-default)] text-[var(--text-primary)]',
};

const ToastEntry: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 10);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 250);
    }, toast.duration ?? 4500);

    return () => {
      clearTimeout(enterTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 250);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-lg',
        'max-w-sm w-full pointer-events-auto',
        'transition-all duration-[250ms] ease-out',
        STYLES[toast.type],
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      ].join(' ')}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="flex-1 text-xs leading-relaxed font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    showToast,
    success: (msg, dur) => showToast('success', msg, dur),
    error: (msg, dur) => showToast('error', msg, dur),
    warning: (msg, dur) => showToast('warning', msg, dur),
    info: (msg, dur) => showToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-label="Toast notifications"
            className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none"
          >
            {toasts.map(t => (
              <ToastEntry key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};
