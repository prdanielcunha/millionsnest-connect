/**
 * MillionsNest Connect - Ecosystem Apps & Registered Tools
 */

import React, { useState } from 'react';
import {
  Grid,
  ShieldCheck,
  Music,
  Landmark,
  Bot,
  AlertTriangle,
  Play,
  CheckCircle2,
  Lock,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { ToolDefinition, EffectiveEcosystemContext, RiskLevel, ToolGatewayInvocationResponse, DemoConfirmationEvidence } from '../../types';
import { mockTools, mockAppManifests } from '../../demo/mockData';
import { ToolGatewayService } from '../../core/services/toolGateway';

interface ToolsPageProps {
  context: EffectiveEcosystemContext;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({ context }) => {
  const [tools] = useState<ToolDefinition[]>(mockTools);
  const [selectedToolId, setSelectedToolId] = useState<string>('tool_musicscale_add_song_to_living_library');
  const [executionResult, setExecutionResult] = useState<ToolGatewayInvocationResponse | null>(null);

  const selectedTool = tools.find((t) => t.id === selectedToolId) || tools[0];

  const handleTestInvocation = () => {
    const res = ToolGatewayService.invokeTool(
      context,
      selectedTool,
      { title: 'Exemplo Hino Novo', artist: 'Banda Central', key: 'G' },
      {
        requestId: `req_${Date.now()}`,
        correlationId: `corr_${Date.now()}`,
        idempotencyKey: `idempotency_${Date.now()}`,
        actor: {
          uid: context.user.uid,
          systemRole: context.user.systemRole,
        },
        organization: {
          id: context.activeOrganization.id,
        },
        appAccess: {
          appId: selectedTool.appId,
          capabilities: [],
        },
        channel: {
          type: 'whatsapp',
          conversationId: 'cnv_01',
        },
        locale: 'pt-BR',

      }
    );
    setExecutionResult(res);
  };

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'R0_PUBLIC':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30">R0 PÚBLICO</span>;
      case 'R1_AUTH_READ':
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] border border-blue-500/30">R1 LEITURA AUTH</span>;
      case 'R2_REVERSIBLE_WRITE':
        return <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30">R2 ESCRITA REVERSÍVEL</span>;
      case 'R3_PRIVILEGED':
        return <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] border border-rose-500/30">R3 PRIVILEGIADO</span>;
      case 'R4_CRITICAL':
        return <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] border border-purple-500/30">R4 CRÍTICO</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Grid className="w-3.5 h-3.5" />
            <span>Barramento de Ferramentas & Tool Gateway</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Aplicativos e Ferramentas Cadastradas
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Catálogo de ferramentas autorizadas dos aplicativos do ecossistema MillionsNest.
          </p>
        </div>
      </div>

      {/* Ecosystem Apps Catalog */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockAppManifests.map((app) => (
          <div
            key={app.appId}
            className="p-5 bg-[#121824] border border-white/10 rounded-2xl shadow-lg space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
                  {app.appId === 'musicscale' ? (
                    <Music className="w-5 h-5" />
                  ) : app.appId === 'nestfinance' ? (
                    <Landmark className="w-5 h-5" />
                  ) : (
                    <Bot className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{app.name}</h3>
                  <span className="text-[10px] text-gray-500 font-mono">App ID: {app.appId}</span>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                  app.status === 'ativo'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {app.status}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">{app.description}</p>

            <div className="pt-2 border-t border-white/5 text-[11px] text-indigo-400 font-mono flex items-center justify-between">
              <span>{app.registeredToolsCount} Ferramentas Registradas</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Tools Inspector & Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Tools Table */}
        <div className="lg:col-span-5 bg-[#121824] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider px-2">
            Ferramentas do MusicScale e Core
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {tools.map((t) => {
              const isSelected = t.id === selectedTool.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedToolId(t.id);
                    setExecutionResult(null);
                  }}
                  className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-600/20 border border-indigo-500/40'
                      : 'bg-[#1A2234] hover:bg-[#222C42] border border-white/5'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{t.name}</span>
                      <span className="text-[10px] text-gray-500">v{t.version}</span>
                    </div>
                    <span className="text-[11px] text-gray-400 block line-clamp-1">{t.title}</span>
                  </div>

                  <div className="shrink-0 text-right">{getRiskBadge(t.riskLevel)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 cols): Selected Tool Deep Details & Test Runner */}
        <div className="lg:col-span-7 bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{selectedTool.title}</h2>
                <span className="text-xs text-gray-400 font-mono">({selectedTool.name})</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{selectedTool.description}</p>
            </div>

            <div>{getRiskBadge(selectedTool.riskLevel)}</div>
          </div>

          {/* Living Library Specific Notice */}
          {selectedTool.name === 'addSongToLivingLibrary' && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-200 space-y-2">
              <div className="font-bold text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Aviso Especial da Biblioteca Viva (Global R3)
              </div>
              <p className="text-[11px] text-rose-200/90 leading-relaxed">
                A ferramenta <code className="text-rose-300 font-mono font-bold">addSongToLivingLibrary</code> é de impacto global no acervo de cifras. Exige explicitamente a capability global <code className="text-rose-300 font-mono font-bold">livingLibrary.manage</code>. Administradores de organizações locais não possuem este privilégio automaticamente.
              </p>
            </div>
          )}

          {/* Tool Specifications Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-1 font-mono">
              <span className="text-gray-500 text-[10px] uppercase block">Permissões Requeridas</span>
              <span className="text-cyan-300 font-semibold">
                {selectedTool.requiredPermissions.join(', ') || 'Nenhuma (Pública)'}
              </span>
            </div>

            <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-1 font-mono">
              <span className="text-gray-500 text-[10px] uppercase block">Política de Confirmação</span>
              <span className="text-amber-300 font-semibold">{selectedTool.confirmationPolicy}</span>
            </div>
          </div>

          {/* Test Execution Simulator */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                Testar Execução no Tool Gateway (DEMO_MODE)
              </h3>

              <button
                onClick={handleTestInvocation}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simular Invocação</span>
              </button>
            </div>

            {executionResult && (
              <div className="p-4 bg-black/40 border border-white/10 rounded-xl space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Resultado do Tool Gateway:</span>
                  {executionResult?.result?.status === 'success' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> SUCESSO (200 OK)
                    </span>
                  ) : executionResult?.result?.status === 'needs_confirmation' ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> AGUARDANDO CONFIRMAÇÃO
                    </span>
                  ) : executionResult?.result?.status === 'conflict' ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> CONFLITO
                    </span>
                  ) : executionResult?.result?.status === 'denied' ? (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> NEGADO (403 FORBIDDEN)
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> FALHA
                    </span>
                  )}
                </div>

                <pre className="bg-[#121824] p-3 rounded-lg text-[11px] text-gray-300 overflow-x-auto">
                  {JSON.stringify(executionResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
