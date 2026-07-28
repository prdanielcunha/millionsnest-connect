import React, { useEffect, useRef } from 'react';
import { PendingDemoToolInvocation } from '../../demo/confirmations/demoToolFlow';
import { LanguageCode } from '../../types';
import { demoConfirmationCatalog } from '../../i18n/demoConfirmationUx';
import { getDialogFocusableElements } from '../../core/a11y/dialogFocus';

export type DemoToolConfirmationDialogProps = {
  pending: PendingDemoToolInvocation | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  currentLang?: LanguageCode;
};

export function DemoToolConfirmationDialog({
  pending,
  isOpen,
  onConfirm,
  onCancel,
  currentLang = 'pt-BR',
}: DemoToolConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const t = demoConfirmationCatalog[currentLang] || demoConfirmationCatalog['pt-BR'];

  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const handleCancel = () => onCancelRef.current();
  const handleConfirm = () => onConfirmRef.current();

  useEffect(() => {
    if (isOpen) {
      if (document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      } else {
        previousFocusRef.current = null;
      }
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancelRef.current();
          return;
        }
        
        if (e.key === 'Tab') {
          if (!dialogRef.current) return;
          const focusableElements = getDialogFocusableElements(dialogRef.current);
          if (focusableElements.length === 0) {
            e.preventDefault();
            return;
          }
          if (focusableElements.length === 1) {
            e.preventDefault();
            focusableElements[0].focus();
            return;
          }

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = previousOverflow;
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  if (!isOpen || !pending) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-confirmation-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div 
        ref={dialogRef}
        className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
      >
        <div className="p-5 border-b border-neutral-800">
          <h2 id="demo-confirmation-title" className="text-lg font-semibold text-neutral-100 mb-1">
            {t.title} ({pending.tool.title})
          </h2>
          <p className="text-sm text-neutral-400">
            {t.description}
          </p>
        </div>

        <div className="p-5 overflow-y-auto max-h-[50vh] space-y-4">
          <div className="bg-amber-900/20 border border-amber-900/50 p-3 rounded-lg">
            <p className="text-sm text-amber-200">
              <strong>DEMO_MODE:</strong> {t.demoModeWarning}
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">{t.technicalName}</span>
              <span className="text-neutral-300 font-mono text-xs">{pending.tool.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">{t.organization}</span>
              <span className="text-neutral-300 truncate max-w-[150px]">{pending.organizationId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">{t.riskLevel}</span>
              <span className="text-neutral-300 font-mono text-xs">{pending.tool.riskLevel}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">{t.confirmationPolicy}</span>
              <span className="text-neutral-300">{pending.tool.confirmationPolicy}</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t.arguments}</h3>
            <pre className="bg-neutral-950 p-3 rounded border border-neutral-800 text-xs text-neutral-400 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(pending.args, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            ref={cancelBtnRef}
            onClick={handleCancel}
            className="min-h-[44px] min-w-[120px] px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors"
          >
            {t.cancel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            className="min-h-[44px] min-w-[120px] px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
