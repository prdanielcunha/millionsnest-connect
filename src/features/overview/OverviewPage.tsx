/**
 * MillionsNest Connect - Overview / Dashboard Page
 */

import React from 'react';
import {
  MessageSquare,
  Clock,
  Bot,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Radio,
  Music,
  Plus,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';

interface OverviewPageProps {
  context: EffectiveEcosystemContext;
  currentLang: LanguageCode;
  onNavigate: (route: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  context,
  onNavigate,
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Ecosystem Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <span>Visão Geral do Atendimento Omnichannel</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Olá, {context.user.name}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Central inteligente de conversas, agentes de IA e ações no ecossistema MillionsNest.
          </p>
        </div>

        {/* Quick Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('inbox')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Abrir Caixa de Entrada</span>
          </button>
          <button
            onClick={() => onNavigate('agents')}
            className="px-4 py-2 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-gray-200 rounded-lg text-xs font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Criar Agente</span>
          </button>
          <button
            onClick={() => onNavigate('audit')}
            className="px-4 py-2 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-gray-200 rounded-lg text-xs font-medium flex items-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Revisar Auditoria</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Conversas Abertas</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric">18</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+12% hoje</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Aguardando Humano</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-numeric">3</div>
          <div className="text-[11px] text-amber-300 mt-1">Requer atenção imediata</div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Resolvido por IA</span>
            <Bot className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-numeric">84.5%</div>
          <div className="text-[11px] text-gray-400 mt-1">124 conversas automáticas</div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Tempo 1ª Resposta</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric">42s</div>
          <div className="text-[11px] text-emerald-400 mt-1">-8s que a média</div>
        </div>

        {/* KPI 5 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Saúde dos Canais</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-numeric">3/3</div>
          <div className="text-[11px] text-gray-400 mt-1">WhatsApp, IG, In-App OK</div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Needs Attention & Executed Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Needs Attention List */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">Precisa da sua atenção</h2>
              </div>
              <button
                onClick={() => onNavigate('inbox')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <span>Ver todas na caixa</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Item 1 */}
              <div
                onClick={() => onNavigate('inbox')}
                className="p-3 bg-[#1A2234] hover:bg-[#222C42] border border-white/5 rounded-lg flex items-center justify-between gap-4 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                    MC
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Mariana Costa</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                        Troca de Escala
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                      "Preciso trocar meu dia de escala de domingo para sábado por motivo de viagem."
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-amber-400 font-semibold block">Aguardando Aprovação</span>
                  <span className="text-[10px] text-gray-500">Há 15 minutos</span>
                </div>
              </div>

              {/* Item 2 */}
              <div
                onClick={() => onNavigate('inbox')}
                className="p-3 bg-[#1A2234] hover:bg-[#222C42] border border-white/5 rounded-lg flex items-center justify-between gap-4 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                    GS
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Gabriel Santos</span>
                      <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                        Biblioteca Viva
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                      Solicitou inclusão da música "Bondade de Deus" no acervo global. Requer capability livingLibrary.manage.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-cyan-400 font-semibold block">R3 Privilegiado</span>
                  <span className="text-[10px] text-gray-500">Há 32 minutos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Executed in Ecosystem Apps */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-semibold text-white">
                  Ações executadas nos aplicativos (Tool Gateway)
                </h2>
              </div>
              <button
                onClick={() => onNavigate('tools')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <span>Catálogo de Ferramentas</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#1A2234] border border-white/5 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      MusicScale • listSchedules
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Escala consultada para Gabriel Santos na Igreja Central Londrina.
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-mono">
                    SUCESSO (R1)
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Há 12 min</span>
                </div>
              </div>

              <div className="p-3 bg-[#1A2234] border border-white/5 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      MusicScale • addSongToLivingLibrary
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Tentativa de inserção global bloqueada. Capability livingLibrary.manage validada.
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 text-[10px] bg-rose-500/20 text-rose-300 rounded border border-rose-500/30 font-mono">
                    BLOQUEADO (R3)
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Há 25 min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Channel Status & Volume Summary */}
        <div className="space-y-6">
          {/* Channels Card */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                <span>Canais Omnichannel</span>
              </h2>
              <button
                onClick={() => onNavigate('channels')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Gerenciar
              </button>
            </div>

            <div className="space-y-3">
              {/* WhatsApp */}
              <div className="p-3 bg-[#1A2234] border border-white/5 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    WhatsApp Oficial
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    PLANEJADO (COEXISTÊNCIA)
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-mono pl-4">
                  +55 43 99990-7071
                </div>
              </div>

              {/* Instagram */}
              <div className="p-3 bg-[#1A2234] border border-white/5 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Instagram Direct
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    SAUDÁVEL
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-mono pl-4">
                  @millionsnest_official
                </div>
              </div>

              {/* In-App Widget */}
              <div className="p-3 bg-[#1A2234] border border-white/5 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    In-App Connect Widget
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    42 SESSÕES
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-mono pl-4">
                  Integrado no MusicScale
                </div>
              </div>
            </div>
          </div>

          {/* Volume Graph Mock */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-3">
            <h2 className="text-sm font-semibold text-white">
              Volume de Atendimento (Hoje)
            </h2>
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-gray-400 mb-1">
                  <span>WhatsApp</span>
                  <span className="font-numeric font-bold text-white">68% (142 msgs)</span>
                </div>
                <div className="w-full bg-[#1A2234] h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '68%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-gray-400 mb-1">
                  <span>Instagram Direct</span>
                  <span className="font-numeric font-bold text-white">22% (48 msgs)</span>
                </div>
                <div className="w-full bg-[#1A2234] h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: '22%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-gray-400 mb-1">
                  <span>In-App Widget</span>
                  <span className="font-numeric font-bold text-white">10% (21 msgs)</span>
                </div>
                <div className="w-full bg-[#1A2234] h-2 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
