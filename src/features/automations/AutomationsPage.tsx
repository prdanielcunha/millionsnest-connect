/**
 * MillionsNest Connect - Automations & Journeys Page
 */

import React, { useState } from 'react';
import {
  Zap,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sliders,
  Filter,
} from 'lucide-react';
import { AutomationDefinition } from '../../types';
import { mockAutomations } from '../../demo/mockData';

export const AutomationsPage: React.FC = () => {
  const [automations] = useState<AutomationDefinition[]>(mockAutomations);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string>('aut_01');

  const selectedAutomation = automations.find((a) => a.id === selectedAutomationId) || automations[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>Automação & Jornadas Conversacionais</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Automações
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gatilhos de atendimento, lembretes de escala e encaminhamento automático de voluntários.
          </p>
        </div>

        <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20">
          <Plus className="w-4 h-4" />
          <span>Nova Automação</span>
        </button>
      </div>

      {/* Grid: Automations List & Flow Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {automations.map((aut) => {
            const isSelected = aut.id === selectedAutomation.id;
            return (
              <div
                key={aut.id}
                onClick={() => setSelectedAutomationId(aut.id)}
                className={`p-5 rounded-2xl bg-[#121824] border cursor-pointer transition shadow-lg space-y-3 ${
                  isSelected ? 'border-indigo-500/50 bg-indigo-600/10' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{aut.name}</h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono uppercase">
                    {aut.status}
                  </span>
                </div>

                <p className="text-xs text-gray-400">
                  <strong className="text-gray-300">Gatilho:</strong> {aut.trigger}
                </p>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5 text-gray-500 font-numeric">
                  <span>Execuções Simuladas:</span>
                  <span className="font-bold text-white">{aut.executionsCount}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Visualizer (7 cols) */}
        <div className="lg:col-span-7 bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">{selectedAutomation.name}</h2>
              <span className="text-xs text-gray-400">Construtor Visual de Jornada</span>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-mono font-bold uppercase border border-emerald-500/30">
              {selectedAutomation.status}
            </span>
          </div>

          {/* Flow Visual Blocks */}
          <div className="space-y-3">
            {selectedAutomation.blocks.map((block, index) => (
              <React.Fragment key={block.id}>
                <div className="p-4 bg-[#1A2234] border border-white/10 rounded-xl space-y-1 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Passo {index + 1}: {block.type}
                    </span>
                    <span className="text-xs font-semibold text-white">{block.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-1">{block.config}</p>
                </div>

                {index < selectedAutomation.blocks.length - 1 && (
                  <div className="flex justify-center">
                    <ArrowRight className="w-4 h-4 text-gray-500 rotate-90 my-1" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
