/**
 * MillionsNest Connect - Demo Mode Warning Banner
 */

import React from 'react';
import { AlertTriangle, ShieldCheck, Database, Info } from 'lucide-react';

export const DemoBanner: React.FC = () => {
  return (
    <div className="bg-amber-950/40 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-200/90 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-semibold text-amber-300">DEMO_MODE ATIVO:</span>
        <span>
          Ambiente de simulação visual e arquitetônica. Dados isolados em memória. Nenhuma chave API, banco real ou integração externa foi conectada.
        </span>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-amber-400/80">
        <span className="inline-flex items-center gap-1">
          <Database className="w-3 h-3" /> Mocks Locais
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> RBAC Simulado
        </span>
        <span className="inline-flex items-center gap-1">
          <Info className="w-3 h-3" /> Tool Gateway Ativo
        </span>
      </div>
    </div>
  );
};
