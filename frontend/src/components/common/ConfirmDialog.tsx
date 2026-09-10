/**
 * THEIAKSHI ONE — ConfirmDialog
 * Lightweight modal replacing native confirm() and prompt() across the app.
 * Provides ConfirmDialog (yes/no) and RejectReasonDialog (reason text input).
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Focus cancel button by default for safety
    const t = setTimeout(() => cancelRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog Panel */}
      <div className="relative w-full max-w-sm bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              danger
                ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)]'
                : 'bg-[var(--primary-soft)] text-[var(--primary)]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-sm font-bold text-[var(--text-primary)]"
            >
              {title}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 justify-end pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer min-h-[36px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[36px] ${
              danger
                ? 'bg-[var(--action-danger-bg)] text-[var(--action-danger-text)] hover:bg-[var(--action-danger-hover)]'
                : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RejectReasonDialog ───────────────────────────────────────────────────────

interface RejectReasonDialogProps {
  isOpen: boolean;
  title?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const RejectReasonDialog: React.FC<RejectReasonDialogProps> = ({
  isOpen,
  title = 'Rejection Reason',
  label = 'Please provide a reason for rejection:',
  placeholder = 'Enter reason...',
  confirmLabel = 'Confirm Rejection',
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) { setReason(''); return; }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h2 id="reject-dialog-title" className="text-sm font-bold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="reject-reason-input"
              className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
            >
              {label}
            </label>
            <textarea
              id="reject-reason-input"
              ref={inputRef}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--input-focus)] focus:ring-2 focus:ring-[var(--primary-soft)] resize-none transition-colors"
              required
              aria-required="true"
            />
          </div>

          <div className="flex gap-2.5 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer min-h-[36px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--action-danger-bg)] text-[var(--action-danger-text)] hover:bg-[var(--action-danger-hover)] transition-colors cursor-pointer disabled:opacity-50 min-h-[36px] flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
