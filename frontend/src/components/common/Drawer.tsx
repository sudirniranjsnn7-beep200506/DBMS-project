// ==============================================================================
// AssetVault: Accessible Slide-over Drawer Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Right-hand slide-over panel for inspector sidebars, detail views, and diffs
// ==============================================================================

import React, { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[width];

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div
          className={`w-screen ${widthClass} bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full transform transition-all duration-300 ease-in-out`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
              {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
