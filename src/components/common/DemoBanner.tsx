import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, Database, Info, ChevronDown, ChevronUp } from 'lucide-react';

export const DemoBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-amber-950/40 border-b border-amber-500/20 text-amber-200/90 shrink-0">
      {/* Mobile/Tablet Compact View */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300 truncate">DEMO_MODE • Dados simulados</span>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-medium text-amber-300/80 hover:text-amber-300 flex items-center gap-1 shrink-0 ml-2"
          aria-expanded={isExpanded}
        >
          Detalhes {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded Mobile Details */}
      {isExpanded && (
        <div className="lg:hidden px-4 pb-3 pt-1 text-[11px] text-amber-200/80 space-y-2 border-t border-amber-500/10 mt-1">
          <p>Ambiente de simulação visual e arquitetônica. Dados isolados em memória.</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Nenhuma API ou banco real conectado.</li>
            <li>Nenhuma integração externa ativa.</li>
            <li>Autorização real futura será server-side.</li>
          </ul>
        </div>
      )}

      {/* Desktop View */}
      <div className="hidden lg:flex px-4 py-2 text-xs flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300">DEMO_MODE ATIVO:</span>
          <span>
            Ambiente de simulação visual e arquitetônica. Dados isolados em memória. Nenhuma chave API, banco real ou integração externa conectada.
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
            <Info className="w-3 h-3" /> Tool Gateway simulado
          </span>
        </div>
      </div>
    </div>
  );
};
