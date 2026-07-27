import React from 'react';
import {
  MessageSquare,
  Clock,
  Bot,
  AlertCircle,
  Radio,
  Music,
  Plus,
  ShieldCheck,
  TrendingUp,
  Activity,
  Wrench
} from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { getUxText } from '../../i18n/mobileUx';

interface OverviewPageProps {
  context: EffectiveEcosystemContext;
  currentLang: LanguageCode;
  onNavigate: (route: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  context,
  currentLang,
  onNavigate,
}) => {
  const t = getUxText(currentLang).overview;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Ecosystem Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="w-full md:w-auto min-w-0">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2 max-w-full">
            <span className="whitespace-normal">{t.headerTag}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight break-words">
            {t.titlePrefix}{context.user.name}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t.subtitle}
          </p>
        </div>

        {/* Quick Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={() => onNavigate('inbox')}
            className="w-full md:w-auto px-4 py-3 md:py-2 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20 sm:col-span-2 md:col-span-1"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t.openInbox}</span>
          </button>
          <button
            onClick={() => onNavigate('agents')}
            className="w-full md:w-auto px-4 py-3 md:py-2 min-h-[44px] bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-gray-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>{t.createAgent}</span>
          </button>
          <button
            onClick={() => onNavigate('audit')}
            className="w-full md:w-auto px-4 py-3 md:py-2 min-h-[44px] bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-gray-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>{t.reviewAudit}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
         <span className="bg-amber-950/40 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">{t.demoDataBadge}</span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {/* KPI 1 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-3 md:p-4 shadow-md min-w-0">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] md:text-xs font-medium truncate">{t.kpiOpenConversations}</span>
            <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-400 shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white font-numeric">18</div>
          <div className="text-[10px] md:text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span className="truncate">{t.todayPlus12}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-3 md:p-4 shadow-md min-w-0">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] md:text-xs font-medium truncate">{t.kpiWaiting}</span>
            <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400 shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-amber-400 font-numeric">3</div>
          <div className="text-[10px] md:text-[11px] text-amber-300 mt-1 truncate">{t.requiresAttention}</div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-3 md:p-4 shadow-md min-w-0">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] md:text-xs font-medium truncate">{t.kpiAHT}</span>
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white font-numeric">4m 12s</div>
          <div className="text-[10px] md:text-[11px] text-emerald-400 mt-1 truncate">{t.less30s}</div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-3 md:p-4 shadow-md min-w-0">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] md:text-xs font-medium truncate">{t.kpiAiResolution}</span>
            <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white font-numeric">68%</div>
          <div className="text-[10px] md:text-[11px] text-emerald-400 mt-1 truncate">{t.fullyAutonomous}</div>
        </div>

        {/* KPI 5 */}
        <div className="bg-[#121824] border border-white/10 rounded-xl p-3 md:p-4 shadow-md min-w-0 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] md:text-xs font-medium truncate">{t.kpiPlannedChannels}</span>
            <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white font-numeric">3</div>
          <div className="text-[10px] md:text-[11px] text-amber-400 mt-1 truncate">{t.noActiveIntegrations}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Needs Attention & Omnichannel */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Needs Attention */}
          <div className="bg-[#121824] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                {t.needsAttention}
              </h2>
              <button 
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium min-h-[44px] px-2 -mr-2"
                onClick={() => onNavigate('inbox')}
              >
                {t.viewAll}
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {[
                {
                  id: 1,
                  user: t.demoContact1,
                  intent: t.refundRequest,
                  status: t.waitingApproval,
                  time: t.time12m,
                },
                {
                  id: 2,
                  user: t.demoContact2,
                  intent: t.planQuestion,
                  status: t.agentEscalated,
                  time: t.time28m,
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-white/5 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0"
                  onClick={() => onNavigate('inbox')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {item.user.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-200 truncate">{item.user}</div>
                      <div className="text-xs text-gray-500 truncate">{item.intent}</div>
                    </div>
                  </div>
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2 md:gap-0 mt-2 md:mt-0 border-t md:border-t-0 border-white/5 pt-2 md:pt-0">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 max-w-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                      <span className="whitespace-normal">{item.status}</span>
                    </div>
                    <div className="text-[10px] text-gray-500">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Volume Chart Placeholder */}
          <div className="bg-[#121824] border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-1">{t.demoVolume}</h2>
            <p className="text-[11px] text-gray-500 mb-6">{t.demoVolumeDesc}</p>
            <div className="h-48 flex items-end justify-between gap-1 md:gap-2 mt-4">
              {[40, 65, 45, 80, 55, 90, 75].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2">
                  <div
                    className="w-full bg-indigo-500/20 hover:bg-indigo-500/40 transition rounded-t-sm border-t border-indigo-500/50 relative group"
                    style={{ height: `${height}%` }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#222C42] border border-white/10 text-white text-[10px] px-2 py-1 rounded transition-opacity shadow-lg">
                      {height * 12}
                    </div>
                  </div>
                  <div className="text-[9px] md:text-[10px] text-gray-500">
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Gateway & Channels */}
        <div className="space-y-6 min-w-0">
          {/* Tool Gateway Actions (Simulated) */}
          <div className="bg-[#121824] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 md:p-5 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                {t.simulatedGateway}
              </h2>
            </div>
            <div className="divide-y divide-white/5">
              {[
                {
                  id: 1,
                  action: 'Criar Inscrição',
                  app: 'NestFinance',
                  status: t.simulatedSuccess,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10 border-emerald-500/20',
                  time: t.time12m,
                },
                {
                  id: 2,
                  action: 'addSongToLivingLibrary',
                  app: 'MusicScale',
                  status: t.demoBlocked,
                  color: 'text-rose-400',
                  bg: 'bg-rose-500/10 border-rose-500/20',
                  time: 'Há 1h',
                  detail: t.demoBlockedDetail,
                },
                {
                  id: 3,
                  action: 'updateOrganizationSettings',
                  app: 'Connect',
                  status: t.pendingConfirmation,
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10 border-amber-500/20',
                  time: 'Há 2h',
                  detail: t.pendingDetail,
                },
              ].map((item) => (
                <div key={item.id} className="p-4 min-w-0">
                  <div className="flex flex-col md:flex-row justify-between md:items-start gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-gray-200 break-words">{item.action}</div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                        {item.app === 'MusicScale' && <Music className="w-3 h-3" />}
                        {item.app}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 shrink-0">{item.time}</div>
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className={`inline-flex items-center self-start gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${item.color} ${item.bg} border max-w-full`}>
                      <span className="whitespace-normal">{item.status}</span>
                    </div>
                    {item.detail && (
                      <div className="text-[10px] text-gray-400 break-words mt-1 leading-relaxed bg-white/5 p-2 rounded">
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/10 bg-white/[0.02]">
              <button 
                className="w-full min-h-[44px] text-xs text-indigo-400 hover:text-indigo-300 font-medium py-1"
                onClick={() => onNavigate('tools')}
              >
                {t.viewFullLog}
              </button>
            </div>
          </div>

          {/* Omnichannel Channels */}
          <div className="bg-[#121824] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 md:p-5 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-400" />
                {t.channels}
              </h2>
            </div>
            <div className="divide-y divide-white/5">
              <div className="p-4 flex flex-col gap-2 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-200 truncate">{t.officialWhatsApp}</div>
                    <div className="text-[11px] text-gray-500 truncate">+55 43 99990-7071</div>
                  </div>
                  <div className="inline-flex self-start md:self-auto items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 max-w-full">
                    <span className="whitespace-normal">{t.planned}</span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 bg-white/5 p-1.5 rounded">{t.coexistenceCloudApi}</div>
              </div>

              <div className="p-4 flex flex-col gap-2 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-200 truncate">{t.proInstagram}</div>
                    <div className="text-[11px] text-gray-500 truncate">Direct Messages</div>
                  </div>
                  <div className="inline-flex self-start md:self-auto items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 max-w-full">
                    <span className="whitespace-normal">{t.toConfigure}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-200 truncate">{t.contextualChat}</div>
                    <div className="text-[11px] text-gray-500 truncate">In-App Web/Mobile</div>
                  </div>
                  <div className="inline-flex self-start md:self-auto items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 max-w-full">
                    <span className="whitespace-normal">{t.planned}</span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 bg-white/5 p-1.5 rounded">{t.futureIntegration}</div>
              </div>
            </div>
            <div className="p-3 border-t border-white/10 bg-white/[0.02]">
              <button 
                className="w-full min-h-[44px] text-xs text-indigo-400 hover:text-indigo-300 font-medium py-1"
                onClick={() => onNavigate('channels')}
              >
                {t.manageChannels}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
