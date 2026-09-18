/**
 * MillionsNest Connect - Channels Management Page
 */

import React from 'react';
import {
  Share2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Radio,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { mockChannels } from '../../demo/mockData';

export const ChannelsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
            <Radio className="w-3.5 h-3.5" />
            <span>Canais Omnichannel & Webhooks</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Canais de Atendimento
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Status, saúde, webhooks e coexistência oficial de canais WhatsApp, Instagram e In-App.
          </p>
        </div>

        {/* Security Alert Banner */}
        <div className="bg-indigo-950/40 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-200 max-w-md space-y-1">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-indigo-400" />
            Segurança de Credenciais
          </div>
          <p className="text-[11px] text-indigo-200/80">
            Nenhuma chave de API, segredo de webhook ou token Meta/WhatsApp é exposto no cliente. Todos os segredos operam exclusivamente server-side.
          </p>
        </div>
      </div>

      {/* Channels Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockChannels.map((chn) => (
          <div
            key={chn.id}
            className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  {chn.name}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold uppercase border border-emerald-500/30">
                  {chn.status}
                </span>
              </div>

              <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl font-mono text-xs space-y-1">
                <span className="text-gray-500 text-[10px] uppercase block">Identificador Oficial:</span>
                <span className="text-cyan-300 font-bold">{chn.identifier}</span>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                {chn.coexistenceStatus}
              </p>

              {/* Details table */}
              <div className="space-y-1.5 text-xs pt-2 border-t border-white/5 text-gray-400 font-mono">
                {Object.entries(chn.details).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span className="text-gray-200">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-[11px] text-gray-500 font-mono flex items-center justify-between">
              <span>Webhook: {chn.webhookUrl}</span>
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
