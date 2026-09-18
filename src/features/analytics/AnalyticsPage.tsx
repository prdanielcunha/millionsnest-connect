/**
 * MillionsNest Connect - Analytics Page
 */

import React from 'react';
import {
  BarChart2,
  Clock,
  Bot,
  UserCheck,
  TrendingUp,
  AlertCircle,
  Filter,
  DollarSign,
  Info,
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Métricas & Desempenho Omnichannel</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Analytics de Atendimento
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Indicadores de resolução, automação por canal, tempo de resposta e custos operacionais simulados.
          </p>
        </div>

        {/* Filter Period */}
        <div className="flex items-center gap-2 bg-[#1A2234] border border-white/10 p-1.5 rounded-xl text-xs">
          <Filter className="w-3.5 h-3.5 text-gray-400 ml-1" />
          <button className="px-3 py-1 bg-indigo-600 text-white font-semibold rounded-lg">Últimos 7 dias</button>
          <button className="px-3 py-1 text-gray-400 hover:text-white">Últimos 30 dias</button>
        </div>
      </div>

      {/* Disclaimers Banner */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl text-xs text-indigo-200/90 flex items-center gap-3">
        <Info className="w-5 h-5 text-indigo-400 shrink-0" />
        <span>
          <strong>Aviso Metodológico:</strong> As estatísticas de sentimento e estimativa de custos utilizam modelos estatísticos auxiliares em DEMO_MODE e não devem ser tratadas como auditoria financeira conclusiva.
        </span>
      </div>

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-1">
          <span className="text-xs text-gray-400 font-medium">Volume Total de Atendimentos</span>
          <div className="text-2xl font-bold text-white font-numeric">1,482</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> +18.4% esta semana
          </div>
        </div>

        <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-1">
          <span className="text-xs text-gray-400 font-medium">Resolução por IA</span>
          <div className="text-2xl font-bold text-cyan-400 font-numeric">84.5%</div>
          <div className="text-[11px] text-gray-400 mt-1">1,252 conversas sem transbordo</div>
        </div>

        <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-1">
          <span className="text-xs text-gray-400 font-medium">Tempo Médio de 1ª Resposta</span>
          <div className="text-2xl font-bold text-white font-numeric">42 seg</div>
          <div className="text-[11px] text-emerald-400 mt-1">SLA cumprido em 99.1%</div>
        </div>

        <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-1">
          <span className="text-xs text-gray-400 font-medium">Custo Estimado da IA (Mês)</span>
          <div className="text-2xl font-bold text-emerald-400 font-numeric">R$ 145.50</div>
          <div className="text-[11px] text-gray-400 mt-1">Dentro do orçamento de R$ 500</div>
        </div>
      </div>

      {/* Distribution by Channel and Resolution Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white">Distribuição por Canal</h2>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-gray-300 mb-1">
                <span>WhatsApp Oficial (+55 43 99990-7071)</span>
                <span className="font-numeric font-bold">1,020 msgs (68.8%)</span>
              </div>
              <div className="w-full bg-[#1A2234] h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '68.8%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-gray-300 mb-1">
                <span>Instagram Direct (@millionsnest_official)</span>
                <span className="font-numeric font-bold">320 msgs (21.5%)</span>
              </div>
              <div className="w-full bg-[#1A2234] h-2.5 rounded-full overflow-hidden">
                <div className="bg-pink-500 h-full rounded-full" style={{ width: '21.5%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-gray-300 mb-1">
                <span>In-App Widget (MusicScale)</span>
                <span className="font-numeric font-bold">142 msgs (9.7%)</span>
              </div>
              <div className="w-full bg-[#1A2234] h-2.5 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full rounded-full" style={{ width: '9.7%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white">Ações por Aplicativo (Tool Gateway)</h2>
          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-[#1A2234] rounded-xl flex justify-between items-center">
              <span>MusicScale • Consultas de Escala</span>
              <span className="text-cyan-300 font-bold">842 invocações</span>
            </div>
            <div className="p-3 bg-[#1A2234] rounded-xl flex justify-between items-center">
              <span>MusicScale • Rascunhos de Culto</span>
              <span className="text-amber-300 font-bold">114 invocações</span>
            </div>
            <div className="p-3 bg-[#1A2234] rounded-xl flex justify-between items-center">
              <span>Biblioteca Viva • Homologação Global</span>
              <span className="text-rose-300 font-bold">12 bloqueios (livingLibrary.manage)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
