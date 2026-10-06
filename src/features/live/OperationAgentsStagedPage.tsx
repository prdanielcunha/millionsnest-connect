import React from 'react';
import { Bot, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { OperationWorkspaceHeader } from './OperationWorkspaceHeader';

type Props = {
  currentLang: LanguageCode;
  onNavigate: (route: string) => void;
};

const copy = {
  'pt-BR': {
    eyebrow: 'AGENTES',
    title: 'Agentes entram aqui sem ultrapassar a política.',
    description: 'A superfície já tem destino e hierarquia definidos, mas a ativação permanece controlada até objetivo, conhecimento, ferramentas, escopo, aprovação por risco e limites efetivos estarem disponíveis no backend.',
    controlled: 'Ativação controlada',
    rule: 'Nenhum teste envia mensagem real por padrão.',
  },
  'en-US': {
    eyebrow: 'AGENTS',
    title: 'Agents belong here without bypassing policy.',
    description: 'The surface already has a defined destination and hierarchy, but activation remains controlled until purpose, knowledge, tools, scope, risk approval and effective limits are available in the backend.',
    controlled: 'Controlled activation',
    rule: 'Tests do not send real messages by default.',
  },
  'es-ES': {
    eyebrow: 'AGENTES',
    title: 'Los agentes entran aquí sin saltarse la política.',
    description: 'La superficie ya tiene destino y jerarquía definidos, pero la activación sigue controlada hasta que objetivo, conocimiento, herramientas, alcance, aprobación por riesgo y límites efectivos estén disponibles en el backend.',
    controlled: 'Activación controlada',
    rule: 'Las pruebas no envían mensajes reales por defecto.',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

export const OperationAgentsStagedPage: React.FC<Props> = ({ currentLang, onNavigate }) => {
  const t = copy[currentLang];
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-4 pb-28 lg:pb-8">
      <OperationWorkspaceHeader currentLang={currentLang} activeRoute="agents" onNavigate={onNavigate} />

      <section className="connect-surface grid min-h-[420px] place-items-center rounded-[14px] px-6 py-12 text-center">
        <div className="max-w-xl">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-[#315064] bg-[#163442]/55 text-[#8FE6F3]">
            <Bot size={19} />
          </span>
          <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#F1C77A]/18 bg-[#F1C77A]/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.1em] text-[#EACB8D]">
            <LockKeyhole size={11} /> {t.controlled}
          </div>
          <div className="mt-4 connect-eyebrow">{t.eyebrow}</div>
          <h2 className="mt-2 text-lg font-semibold tracking-[-.02em] text-[#F2F5FA]">{t.title}</h2>
          <p className="mt-2 text-xs leading-5 text-[#8093A6]">{t.description}</p>
          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[#6F8397]">
            <ShieldCheck size={12} /> {t.rule}
          </div>
        </div>
      </section>
    </main>
  );
};
