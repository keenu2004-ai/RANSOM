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

  // Compute inline suggestion suffix if input matches start of expectedValue
  const isPrefix = expectedValue.toLowerCase().startsWith(inputValue.toLowerCase()) && inputValue.length > 0;
  const suggestionSuffix = isPrefix ? expectedValue.slice(inputValue.length) : '';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // TAB autofills suggested completion string into input. DOES NOT SUBMIT / DOES NOT CALL onConfirm().
      if (isPrefix || inputValue === '') {
        setInputValue(expectedValue);
        setValidationError(null);
      }
      // Explicitly retain focus on the confirmation input field
      inputRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // ENTER validates input. DOES NOT SUBMIT / DOES NOT CALL onConfirm().
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-red-950/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-300">
            You are about to permanently delete:
          </p>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <div className="font-semibold text-slate-100">{entityName}</div>
            {entityId && <div className="text-xs font-mono text-cyan-400 mt-0.5">{entityId}</div>}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
              To confirm, type: <span className="font-mono text-cyan-400 select-all font-bold">{expectedValue}</span>
            </label>

            {/* Smart Autocomplete Input Field */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={`Type '${expectedValue}'`}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Ghost Autocomplete Text Overlay */}
              {isPrefix && (
                <div className="absolute left-[15px] top-[10px] pointer-events-none font-mono text-sm flex items-center">
                  <span className="opacity-0">{inputValue}</span>
                  <span className="text-slate-500">{suggestionSuffix}</span>
                </div>
              )}
            </div>

            {/* Keyboard Guidance Hint */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">TAB</kbd> to complete</span>
              <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">ESC</kbd> to cancel</span>
            </div>

            {/* Validation Message */}
            {validationError && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-2 rounded flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-slate-950/50 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          
          {/* EXPLICIT DELETE BUTTON — ONLY THIS BUTTON CALLS onConfirm() */}
          <button
            type="button"
            onClick={handleExplicitDeleteClick}
            disabled={!isExactMatch || isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center space-x-2 transition ${
              isExactMatch && !isLoading
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
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
