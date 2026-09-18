/**
 * MillionsNest Connect - Settings & Configuration Page
 */

import React from 'react';
import {
  Settings,
  ShieldCheck,
  Building,
  Users,
  Clock,
  Globe,
  Sliders,
  Radio,
  Lock,
} from 'lucide-react';
import { EffectiveEcosystemContext } from '../../types';

interface SettingsPageProps {
  context: EffectiveEcosystemContext;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ context }) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Settings className="w-3.5 h-3.5" />
            <span>Configurações Globais & Parâmetros</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Configurações do Connect
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Adapters de integração com MillionsNest, políticas de retenção e preferências da organização.
          </p>
        </div>
      </div>

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Integration & RBAC */}
        <div className="lg:col-span-2 space-y-6">
          {/* MillionsNest Canonical Integration Status */}
          <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" />
                Integração com Autoridade MillionsNest
              </h2>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-mono font-bold uppercase border border-emerald-500/30">
                ADAPTER CONECTADO (DEMO)
              </span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              MillionsNest é a fonte canônica para autenticação, organizações, memberships e papéis globais. O Connect não duplica dados de autorização.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-[#1A2234] rounded-xl border border-white/5 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase block">Organização Ativa</span>
                <span className="text-white font-bold">{context.activeOrganization.name}</span>
                <span className="text-gray-500 text-[10px] block">ID: {context.activeOrganization.id}</span>
              </div>

              <div className="p-3 bg-[#1A2234] rounded-xl border border-white/5 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase block">Seu Papel no Ecossistema</span>
                <span className="text-cyan-300 font-bold">{context.user.systemRole || 'Nenhum'}</span>
                <span className="text-gray-500 text-[10px] block">Capability: livingLibrary.manage</span>
              </div>
            </div>
          </div>

          {/* Business Hours & Queues */}
          <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Horário de Atendimento & Filas
            </h2>

            <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">Horário Comercial Ativo:</span>
                <span className="text-emerald-400 font-bold">Seg - Sáb (08:00 - 20:00)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">Resposta Fora do Horário:</span>
                <span className="text-cyan-300 font-bold">Agente de IA de Plantão</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Security & Environment */}
        <div className="space-y-6">
          <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              Segurança & Retenção
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#1A2234] rounded-xl border border-white/5 space-y-1">
                <span className="text-gray-400 font-medium block">Retenção de Histórico:</span>
                <span className="text-white font-bold">365 Dias (LGPD Compliant)</span>
              </div>

              <div className="p-3 bg-[#1A2234] rounded-xl border border-white/5 space-y-1">
                <span className="text-gray-400 font-medium block">Assinatura de Webhooks:</span>
                <span className="text-emerald-400 font-bold font-mono">HMAC SHA-256 Validados</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
