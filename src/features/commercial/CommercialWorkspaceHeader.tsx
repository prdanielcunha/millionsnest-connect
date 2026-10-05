import React from 'react';
import {
  Briefcase,
  MessageSquareText,
  Music2,
  Radar,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import type { LanguageCode } from '../../types';

type Props = {
  currentLang: LanguageCode;
  activeRoute: 'opportunities' | 'followups' | 'playbooks' | 'composer';
  onNavigate: (route: string) => void;
};

const copy = {
  'pt-BR': {
    eyebrow: 'RELACIONAMENTO',
    title: 'Comercial',
    subtitle: 'Oportunidades, conversas e ações para crescer com propósito.',
    product: 'Produto',
    radar: 'Radar',
    opportunities: 'Oportunidades',
    followups: 'Follow-ups',
    playbooks: 'Playbooks',
    composer: 'Composer',
    productHint: 'Contexto comercial atual',
  },
  'en-US': {
    eyebrow: 'RELATIONSHIPS',
    title: 'Commercial',
    subtitle: 'Opportunities, conversations and actions to grow with purpose.',
    product: 'Product',
    radar: 'Radar',
    opportunities: 'Opportunities',
    followups: 'Follow-ups',
    playbooks: 'Playbooks',
    composer: 'Composer',
    productHint: 'Current commercial context',
  },
  'es-ES': {
    eyebrow: 'RELACIONES',
    title: 'Comercial',
    subtitle: 'Oportunidades, conversaciones y acciones para crecer con propósito.',
    product: 'Producto',
    radar: 'Radar',
    opportunities: 'Oportunidades',
    followups: 'Follow-ups',
    playbooks: 'Playbooks',
    composer: 'Composer',
    productHint: 'Contexto comercial actual',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

export const CommercialWorkspaceHeader: React.FC<Props> = ({
  currentLang,
  activeRoute,
  onNavigate,
}) => {
  const t = copy[currentLang];
  const tabs = [
    { id: 'radar', label: t.radar, icon: Radar },
    { id: 'opportunities', label: t.opportunities, icon: Briefcase },
    { id: 'followups', label: t.followups, icon: UsersRound },
    { id: 'playbooks', label: t.playbooks, icon: MessageSquareText },
    { id: 'composer', label: t.composer, icon: Sparkles },
  ] as const;

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="connect-eyebrow">{t.eyebrow}</div>
          <h1 className="connect-page-title mt-2">{t.title}</h1>
          <p className="connect-page-subtitle mt-1.5">{t.subtitle}</p>
        </div>

        <div
          className="flex min-h-10 min-w-[190px] items-center gap-2.5 rounded-[9px] border border-[#2B3A4D] bg-[#111A27] px-3 text-left"
          title={t.productHint}
          aria-label={`${t.product}: MusicScale`}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#66D9EF]/18 bg-[#163442] text-[#66D9EF]">
            <Music2 size={13} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[8px] font-semibold uppercase tracking-[.11em] text-[#62768A]">{t.product}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-[#E9F1F6]">MusicScale</span>
          </span>
        </div>
      </div>

      <nav className="flex overflow-x-auto border-b border-[#27394B]" aria-label={t.title}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeRoute === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`connect-focus relative flex min-h-10 shrink-0 items-center gap-2 px-3.5 text-[11px] font-semibold transition ${active ? 'text-[#AEEFF8]' : 'text-[#71859A] hover:text-[#AAB8C9]'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={13} />
              {tab.label}
              {active && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-t-full bg-[#66D9EF]" />}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
