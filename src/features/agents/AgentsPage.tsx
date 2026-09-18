/**
 * MillionsNest Connect - Agents Management Page
 */

import React, { useState } from 'react';
import {
  Bot,
  Plus,
  ShieldCheck,
  Radio,
  BookOpen,
  DollarSign,
  Info,
  Sliders,
  History,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { AgentDefinition } from '../../types';
import { mockAgents, mockTools, mockKnowledgeSources } from '../../demo/mockData';

export const AgentsPage: React.FC = () => {
  const [agents] = useState<AgentDefinition[]>(mockAgents);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ag_musicscale');

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
            <Bot className="w-3.5 h-3.5" />
            <span>Orquestração de Agentes de IA</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Agentes Especializados
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configuração de escopo, políticas de autonomia, fontes de conhecimento e limites operacionais.
          </p>
        </div>

        <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20">
          <Plus className="w-4 h-4" />
          <span>Novo Agente</span>
        </button>
      </div>

      {/* Main Grid: Agents List & Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Agents Cards */}
        <div className="lg:col-span-5 space-y-4">
          {agents.map((ag) => {
            const isSelected = ag.id === selectedAgent.id;
            return (
              <div
                key={ag.id}
                onClick={() => setSelectedAgentId(ag.id)}
                className={`p-5 rounded-2xl bg-[#121824] border cursor-pointer transition shadow-lg space-y-3 ${
                  isSelected
                    ? 'border-indigo-500/50 bg-indigo-600/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={ag.avatarUrl}
                      alt={ag.name}
                      className="w-12 h-12 rounded-xl object-cover border border-white/10"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white">{ag.name}</h3>
                      <span className="text-[11px] text-gray-400 font-mono">v{ag.version}</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase font-mono border border-emerald-500/30">
                    {ag.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase">Resolução Estimada</span>
                    <span className="font-bold text-cyan-300 font-numeric">{ag.resolutionRate}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase">Custo Mensal</span>
                    <span className="font-bold text-gray-200 font-numeric">
                      R$ {ag.currentCostMonthly.toFixed(2)} / {ag.costLimitMonthly}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-gray-400 uppercase font-mono">Modo:</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30 truncate">
                    {ag.autonomyMode}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column (7 cols): Selected Agent Full Inspector */}
        <div className="lg:col-span-7 bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedAgent.avatarUrl}
                alt={selectedAgent.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/50"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                  <span className="text-xs text-gray-400 font-mono">v{selectedAgent.version}</span>
                </div>
                <p className="text-xs text-indigo-400 font-medium mt-0.5">
                  {selectedAgent.promptStructure.role}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">Taxa de Resolução</span>
              <span className="text-lg font-bold text-cyan-400 font-numeric">
                {selectedAgent.resolutionRate}%
              </span>
            </div>
          </div>

          {/* Autonomy Mode Setting Card */}
          <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-2">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Modo de Autonomia
            </h3>
            <div className="p-3 bg-[#121824] border border-white/10 rounded-lg text-xs space-y-1">
              <div className="font-bold text-white font-mono uppercase">{selectedAgent.autonomyMode}</div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Este modo define a liberdade do agente ao responder no canal. Em modos com execução de ferramentas, toda ação exige confirmação explícita conforme a política do Tool Gateway.
              </p>
            </div>
          </div>

          {/* Goals & Allowed Tools */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Goals */}
            <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-gray-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Objetivos do Agente
              </h4>
              <ul className="space-y-1 text-gray-300 list-disc list-inside text-[11px]">
                {selectedAgent.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>

            {/* Allowed Tools */}
            <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-gray-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" /> Ferramentas Permitidas
              </h4>
              <div className="space-y-1">
                {selectedAgent.allowedToolIds.map((tid) => {
                  const t = mockTools.find((x) => x.id === tid);
                  return (
                    <div
                      key={tid}
                      className="px-2 py-1 bg-[#121824] rounded border border-white/5 font-mono text-[11px] text-cyan-300 flex justify-between"
                    >
                      <span>{t?.name || tid}</span>
                      <span className="text-gray-500">{t?.riskLevel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Knowledge Sources */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Fontes de Conhecimento Vinculadas
            </h4>
            <div className="space-y-2">
              {selectedAgent.knowledgeSourceIds.map((ksid) => {
                const ks = mockKnowledgeSources.find((x) => x.id === ksid);
                return (
                  <div
                    key={ksid}
                    className="p-3 bg-[#1A2234] border border-white/5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{ks?.title || ksid}</span>
                      <span className="text-[11px] text-gray-400">Escopo: {ks?.scope}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 text-[10px] font-mono">
                      v{ks?.version}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocked Themes */}
          <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-2 text-xs text-rose-200">
            <h4 className="font-bold text-rose-300 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-rose-400" /> Temas Bloqueados (Guardrails)
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedAgent.blockedThemes.map((bt, i) => (
                <span key={i} className="px-2.5 py-1 bg-rose-900/40 border border-rose-500/30 rounded-lg text-[11px]">
                  {bt}
                </span>
              ))}
            </div>
          </div>

          {/* Version History */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" /> Histórico de Versões
            </h4>
            <div className="space-y-2">
              {selectedAgent.versions.map((v, idx) => (
                <div key={idx} className="p-3 bg-[#1A2234] border border-white/5 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="font-bold text-cyan-300">v{v.version}</span>
                    <span className="text-gray-500">{new Date(v.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-300 text-[11px]">{v.changelog}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
