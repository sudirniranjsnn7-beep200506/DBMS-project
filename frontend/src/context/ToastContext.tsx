// ==============================================================================
// AssetVault: Toast Notification System
// Course: BCSE307L Database Systems (Fall 2026-27)
// Accessible toast alerts with automatic dismissal & semantic colors
// Supports both toast({ title, message, type }) and toast.success/error methods
// ==============================================================================

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

export interface ToastOptions {
  message: string;
  title?: string;
  type?: ToastType;
}

export interface ToastCallable {
  (options: ToastOptions): void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  toast: ToastCallable;
}

interface ToastContextType {
  toast: ToastCallable;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: Toast = { id, type, message, title };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Create callable function that also has helper methods and self-reference
  const toastFn = useCallback(
    (options: ToastOptions) => {
      addToast(options.type || 'info', options.message, options.title);
    },
    [addToast]
  ) as unknown as ToastCallable;

  toastFn.success = useCallback((message: string, title?: string) => addToast('success', message, title), [addToast]);
  toastFn.error = useCallback((message: string, title?: string) => addToast('error', message, title), [addToast]);
  toastFn.warning = useCallback((message: string, title?: string) => addToast('warning', message, title), [addToast]);
  toastFn.info = useCallback((message: string, title?: string) => addToast('info', message, title), [addToast]);
  toastFn.toast = toastFn;

  const contextValue = useMemo(
    () => ({ toast: toastFn, removeToast }),
    [toastFn, removeToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const config = {
            success: {
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
              border: 'border-emerald-500/30',
              bg: 'bg-white dark:bg-slate-900',
              text: 'text-slate-900 dark:text-slate-100',
            },
            error: {
              icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
              border: 'border-rose-500/30',
              bg: 'bg-white dark:bg-slate-900',
              text: 'text-slate-900 dark:text-slate-100',
            },
            warning: {
              icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
              border: 'border-amber-500/30',
              bg: 'bg-white dark:bg-slate-900',
              text: 'text-slate-900 dark:text-slate-100',
            },
            info: {
              icon: <Info className="w-5 h-5 text-primary-500 shrink-0" />,
              border: 'border-primary-500/30',
              bg: 'bg-white dark:bg-slate-900',
              text: 'text-slate-900 dark:text-slate-100',
            },
          }[t.type];

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border ${config.border} ${config.bg} animate-slide-up transition-all`}
            >
              {config.icon}
              <div className="flex-1 text-xs">
                {t.title && <h5 className={`font-semibold mb-0.5 ${config.text}`}>{t.title}</h5>}
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastCallable => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
