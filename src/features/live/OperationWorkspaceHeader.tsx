import React from 'react';
import {
  Bot,
  CircleDashed,
  History,
  Radio,
  Workflow,
} from 'lucide-react';
import type { LanguageCode } from '../../types';

type OperationRoute = 'channels' | 'agents' | 'automations' | 'executions';

type Props = {
  currentLang: LanguageCode;
  activeRoute: OperationRoute;
  onNavigate: (route: string) => void;
};

const copy = {
  'pt-BR': {
    eyebrow: 'OPERAÇÃO',
    title: 'Operação',
    subtitle: 'Canais, agentes e automações para uma operação mais fluida.',
    channels: 'Canais',
    agents: 'Agentes',
    automations: 'Automações',
    executions: 'Execuções',
    planned: 'Planejado',
  },
  'en-US': {
    eyebrow: 'OPERATIONS',
    title: 'Operations',
    subtitle: 'Channels, agents and automations for a smoother operation.',
    channels: 'Channels',
    agents: 'Agents',
    automations: 'Automations',
    executions: 'Executions',
    planned: 'Planned',
  },
  'es-ES': {
    eyebrow: 'OPERACIÓN',
    title: 'Operación',
    subtitle: 'Canales, agentes y automatizaciones para una operación más fluida.',
    channels: 'Canales',
    agents: 'Agentes',
    automations: 'Automatizaciones',
    executions: 'Ejecuciones',
    planned: 'Planeado',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

export const OperationWorkspaceHeader: React.FC<Props> = ({
  currentLang,
  activeRoute,
  onNavigate,
}) => {
  const t = copy[currentLang];
  const tabs: Array<{
    id: OperationRoute;
    label: string;
    icon: React.ElementType;
    route?: string;
    planned?: boolean;
  }> = [
    { id: 'channels', label: t.channels, icon: Radio, route: 'channels' },
    { id: 'agents', label: t.agents, icon: Bot, route: 'agents' },
    { id: 'automations', label: t.automations, icon: Workflow, route: 'automations' },
    { id: 'executions', label: t.executions, icon: History, planned: true },
  ];

  return (
    <header className="space-y-4">
      <div className="px-1 pt-1">
        <div className="connect-eyebrow">{t.eyebrow}</div>
        <h1 className="connect-page-title mt-2">{t.title}</h1>
        <p className="connect-page-subtitle mt-1.5">{t.subtitle}</p>
      </div>

      <nav className="flex overflow-x-auto border-b border-[#27394B]" aria-label={t.title}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeRoute === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.planned}
              onClick={() => tab.route && onNavigate(tab.route)}
              className={`connect-focus relative flex min-h-10 shrink-0 items-center gap-2 px-3.5 text-[11px] font-semibold transition ${active ? 'text-[#AEEFF8]' : tab.planned ? 'cursor-not-allowed text-[#4F6275]' : 'text-[#71859A] hover:text-[#AAB8C9]'}`}
              aria-current={active ? 'page' : undefined}
              title={tab.planned ? t.planned : undefined}
            >
              <Icon size={13} />
              {tab.label}
              {tab.planned && <CircleDashed size={10} className="text-[#506579]" />}
              {active && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-t-full bg-[#66D9EF]" />}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
