// ==============================================================================
// AssetVault: ConfirmDialog Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// High-stakes confirmation modal with destructive or warning color theming
// ==============================================================================

import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmText,
  cancelText,
  variant = 'danger',
  isLoading = false,
}) => {
  const finalConfirmLabel = confirmText || confirmLabel;
  const finalCancelLabel = cancelText || cancelLabel;

  const iconConfig = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
      bg: 'bg-rose-100 dark:bg-rose-950/60',
      button: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white focus:ring-rose-500',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-100 dark:bg-amber-950/60',
      button: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white focus:ring-amber-500',
    },
    info: {
      icon: <Info className="w-6 h-6 text-primary-600 dark:text-primary-400" />,
      bg: 'bg-primary-100 dark:bg-primary-950/60',
      button: 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white focus:ring-primary-500',
    },
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
          >
            {finalCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${iconConfig.button}`}
          >
            {isLoading ? 'Processing...' : finalConfirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4 py-2">
        <div className={`p-3 rounded-full shrink-0 ${iconConfig.bg}`}>
          {iconConfig.icon}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
          {message}
        </p>
      </div>
    </Modal>
  );
};
