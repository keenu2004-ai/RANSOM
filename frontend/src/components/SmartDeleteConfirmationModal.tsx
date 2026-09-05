import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle2, ShieldAlert } from 'lucide-react';

interface SmartDeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  entityName: string;
  entityId?: string;
  expectedValue: string;
  actionLabel?: string;
  isLoading?: boolean;
}

export const SmartDeleteConfirmationModal: React.FC<SmartDeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityName,
  entityId,
  expectedValue,
  actionLabel = 'Delete',
  isLoading = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setValidationError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isExactMatch = inputValue.trim().toLowerCase() === expectedValue.trim().toLowerCase();
  const isPrefix = expectedValue.toLowerCase().startsWith(inputValue.toLowerCase()) && inputValue.length > 0;
  const suggestionSuffix = isPrefix ? expectedValue.slice(inputValue.length) : '';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (isPrefix || inputValue === '') {
        setInputValue(expectedValue);
        setValidationError(null);
      }
      inputRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!isExactMatch) {
        setValidationError(`Please type exact confirmation string: '${expectedValue}' before clicking Delete.`);
      } else {
        setValidationError(null);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (validationError) setValidationError(null);
  };

  const handleExplicitDeleteClick = async () => {
    if (!isExactMatch || isLoading) return;
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)]">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--action-danger-soft)]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white text-[var(--action-danger-bg)] border border-[var(--action-danger-bg)]/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[var(--action-danger-bg)]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            You are about to permanently delete:
          </p>

          <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)]">
            <div className="font-bold text-sm text-[var(--text-primary)]">{entityName}</div>
            {entityId && <div className="text-xs font-mono text-[var(--primary)] mt-0.5">{entityId}</div>}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              To confirm, type: <span className="font-mono text-[var(--primary)] select-all font-bold">{expectedValue}</span>
            </label>

            {/* Input Field */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={`Type '${expectedValue}'`}
                className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] font-mono text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-2 focus:ring-[var(--primary)]/30 transition shadow-sm"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Ghost Autocomplete Text Overlay */}
              {isPrefix && (
                <div className="absolute left-[15px] top-[10px] pointer-events-none font-mono text-sm flex items-center">
                  <span className="opacity-0">{inputValue}</span>
                  <span className="text-[var(--text-muted)]">{suggestionSuffix}</span>
                </div>
              )}
            </div>

            {/* Keyboard Guidance Hint */}
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1">
              <span>Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded font-mono text-[10px]">TAB</kbd> to complete</span>
              <span>Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded font-mono text-[10px]">ESC</kbd> to cancel</span>
            </div>

            {/* Validation Message */}
            {validationError && (
              <div className="text-xs text-[var(--action-danger-bg)] bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 p-2.5 rounded-xl flex items-center space-x-1.5 font-medium">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-[var(--bg-surface-muted)] border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExplicitDeleteClick}
            disabled={!isExactMatch || isLoading}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition cursor-pointer ${
              isExactMatch && !isLoading
                ? 'bg-[var(--action-danger-bg)] hover:bg-[var(--action-danger-hover)] text-white shadow-sm'
                : 'bg-[var(--bg-surface-muted)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-subtle)]'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{actionLabel}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
