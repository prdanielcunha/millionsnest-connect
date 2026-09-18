/**
 * MillionsNest Connect - Immutable Audit Log Page
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  FileCode,
  X,
  ExternalLink,
} from 'lucide-react';
import { AuditEvent } from '../../types';
import { ToolGatewayService } from '../../core/services/toolGateway';

export const AuditPage: React.FC = () => {
  const [logs] = useState<AuditEvent[]>(ToolGatewayService.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'cross_tenant' | 'living_library' | 'denied'>('all');

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'cross_tenant' && !log.isCrossTenantBlocked) return false;
    if (filterType === 'living_library' && !log.isLivingLibraryBlocked) return false;
    if (filterType === 'denied' && log.result !== 'negado') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.actor.toLowerCase().includes(q) ||
        log.requestId.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.toolName && log.toolName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Auditoria Imutável do Tool Gateway</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Trilha de Auditoria & Segurança
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Registro detalhado de todas as tentativas de invocação de ferramentas, decisões de RBAC e bloqueios de governança.
          </p>
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-[#1A2234] text-gray-400 hover:text-white'
            }`}
          >
            Todos os Eventos ({logs.length})
          </button>
          <button
            onClick={() => setFilterType('cross_tenant')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              filterType === 'cross_tenant'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-[#1A2234] text-gray-400 hover:text-white'
            }`}
          >
            Bloqueios Cross-Tenant
          </button>
          <button
            onClick={() => setFilterType('living_library')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              filterType === 'living_library'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-[#1A2234] text-gray-400 hover:text-white'
            }`}
          >
            Biblioteca Viva (Capability)
          </button>
        </div>
      </div>

      {/* Main Audit Logs Table */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ator, requestId, ferramenta ou detalhe..."
            className="w-full bg-[#1A2234] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-3">Horário</th>
                <th className="py-3 px-3">Ator & Organização</th>
                <th className="py-3 px-3">Ferramenta & Risco</th>
                <th className="py-3 px-3">Resultado</th>
                <th className="py-3 px-3">Request ID</th>
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 font-sans">
                    Nenhum log encontrado para estes critérios.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-3 text-gray-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-white block truncate max-w-[180px] font-sans">
                        {log.actor}
                      </span>
                      <span className="text-[10px] text-gray-500">{log.organizationId}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-cyan-300 block">{log.toolName || 'N/A'}</span>
                      <span className="text-[10px] text-amber-300">{log.riskLevel || 'R0'}</span>
                    </td>
                    <td className="py-3 px-3">
                      {log.result === 'sucesso' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          SUCESSO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                          NEGADO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-400 text-[11px]">{log.requestId}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 rounded text-gray-300 hover:text-white transition font-sans text-[11px]"
                      >
                        Inspecionar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal / Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Detalhes do Evento de Auditoria</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#1A2234] rounded-xl border border-white/5">
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Request ID</span>
                  <span className="text-cyan-300 font-bold">{selectedLog.requestId}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Correlation ID</span>
                  <span className="text-cyan-300 font-bold">{selectedLog.correlationId}</span>
                </div>
              </div>

              <div className="p-3 bg-[#1A2234] rounded-xl border border-white/5 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase block">Detalhamento Técnico</span>
                <p className="text-gray-200 text-xs leading-relaxed font-sans">{selectedLog.details}</p>
              </div>

              {selectedLog.isLivingLibraryBlocked && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-200 font-sans text-xs">
                  <strong>Motivo de Bloqueio:</strong> A capability global <code className="text-rose-300 font-mono">livingLibrary.manage</code> é exigida para ações na Biblioteca Viva e não foi localizada no perfil do ator.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/10 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
