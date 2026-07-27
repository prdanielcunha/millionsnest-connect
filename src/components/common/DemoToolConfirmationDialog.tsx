import React, { useEffect, useRef } from 'react';
import { PendingDemoToolInvocation } from '../../demo/confirmations/demoToolFlow';

export type DemoToolConfirmationDialogProps = {
  pending: PendingDemoToolInvocation | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DemoToolConfirmationDialog({
  pending,
  isOpen,
  onConfirm,
  onCancel,
}: DemoToolConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelBtnRef.current?.focus();
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen || !pending) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-confirmation-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div 
        ref={dialogRef}
        className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
      >
        <div className="p-5 border-b border-neutral-800">
          <h2 id="demo-confirmation-title" className="text-lg font-semibold text-neutral-100 mb-1">
            Confirmar Execução ({pending.tool.title})
          </h2>
          <p className="text-sm text-neutral-400">
            Ação solicitada no ambiente de demonstração.
          </p>
        </div>

        <div className="p-5 overflow-y-auto max-h-[50vh] space-y-4">
          <div className="bg-amber-900/20 border border-amber-900/50 p-3 rounded-lg">
            <p className="text-sm text-amber-200">
              <strong>Aviso DEMO_MODE:</strong> Esta confirmação é demonstrativa. A autorização real será reavaliada pelo backend do MillionsNest e pelo Tool Gateway.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">Nome técnico:</span>
              <span className="text-neutral-300 font-mono text-xs">{pending.tool.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">Organização:</span>
              <span className="text-neutral-300 truncate max-w-[150px]">{pending.organizationId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">Nível de risco:</span>
              <span className="text-neutral-300 font-mono text-xs">{pending.tool.riskLevel}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800/50">
              <span className="text-neutral-500">Política de conf.:</span>
              <span className="text-neutral-300">{pending.tool.confirmationPolicy}</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">Argumentos</h3>
            <pre className="bg-neutral-950 p-3 rounded border border-neutral-800 text-xs text-neutral-400 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(pending.args, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
