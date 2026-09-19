import React from 'react';
import {
  ArrowRight,
  Bot,
  Inbox,
  MessageSquareText,
  Radar,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import { ExperienceProfile } from '../../core/client/liveSurfacePolicy';
import { LanguageCode } from '../../types';

interface AdaptiveHomePageProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
  profile: ExperienceProfile;
  onNavigate: (route: string) => void;
  showRadar: boolean;
}

type ModuleStatus = 'ready' | 'controlled' | 'next';

type HomeAction = {
  id: string;
  route: string;
  icon: React.ElementType;
  status: ModuleStatus;
  title: Record<LanguageCode, string>;
  description: Record<LanguageCode, string>;
};

const profileCopy: Record<ExperienceProfile, Record<LanguageCode, { eyebrow: string; title: string; subtitle: string }>> = {
  ceo: {
    'pt-BR': { eyebrow: 'COMMAND CENTER', title: 'O que exige sua decisão agora?', subtitle: 'Uma visão executiva do Connect: comunicação, relacionamento e operação sem transformar infraestrutura em ruído.' },
    'en-US': { eyebrow: 'COMMAND CENTER', title: 'What needs your decision now?', subtitle: 'An executive view of Connect: communication, relationships and operations without turning infrastructure into noise.' },
    'es-ES': { eyebrow: 'COMMAND CENTER', title: '¿Qué necesita tu decisión ahora?', subtitle: 'Una vista ejecutiva de Connect: comunicación, relaciones y operación sin convertir la infraestructura en ruido.' },
  },
  musician: {
    'pt-BR': { eyebrow: 'MINHA ROTINA', title: 'O que preciso saber da minha próxima escala?', subtitle: 'Consulte escala, repertório, presença e cifras sem procurar informação espalhada.' },
    'en-US': { eyebrow: 'MY WORK', title: 'What do I need to know about my next schedule?', subtitle: 'Check schedules, repertoire, attendance and charts without hunting for scattered information.' },
    'es-ES': { eyebrow: 'MI RUTINA', title: '¿Qué necesito saber de mi próxima escala?', subtitle: 'Consulta escala, repertorio, asistencia y cifras sin buscar información dispersa.' },
  },
  worship_leader: {
    'pt-BR': { eyebrow: 'LIDERANÇA DE LOUVOR', title: 'O que falta resolver na minha equipe?', subtitle: 'Centralize respostas, pessoas e consultas rápidas para cuidar da escala com menos atrito.' },
    'en-US': { eyebrow: 'WORSHIP LEADERSHIP', title: 'What still needs attention in my team?', subtitle: 'Bring responses, people and quick queries together so schedules are easier to manage.' },
    'es-ES': { eyebrow: 'LIDERAZGO DE ALABANZA', title: '¿Qué falta resolver en mi equipo?', subtitle: 'Centraliza respuestas, personas y consultas rápidas para organizar la escala con menos fricción.' },
  },
  pastor_leader: {
    'pt-BR': { eyebrow: 'LIDERANÇA', title: 'O que precisa da minha atenção?', subtitle: 'Veja conversas e pendências relevantes sem transformar o Connect em mais um painel para administrar.' },
    'en-US': { eyebrow: 'LEADERSHIP', title: 'What needs my attention?', subtitle: 'See relevant conversations and pending work without turning Connect into another dashboard to manage.' },
    'es-ES': { eyebrow: 'LIDERAZGO', title: '¿Qué necesita mi atención?', subtitle: 'Mira conversaciones y pendientes relevantes sin convertir Connect en otro panel para administrar.' },
  },
  support: {
    'pt-BR': { eyebrow: 'ATENDIMENTO', title: 'Quem está esperando resposta?', subtitle: 'Contexto, pessoas e Assist organizados para resolver primeiro o que realmente está pendente.' },
    'en-US': { eyebrow: 'SUPPORT', title: 'Who is waiting for a reply?', subtitle: 'Context, people and Assist organized around what actually needs to be resolved first.' },
    'es-ES': { eyebrow: 'ATENCIÓN', title: '¿Quién está esperando respuesta?', subtitle: 'Contexto, personas y Assist organizados para resolver primero lo que realmente está pendiente.' },
  },
  commercial: {
    'pt-BR': { eyebrow: 'RELACIONAMENTO', title: 'Quem precisa de acompanhamento hoje?', subtitle: 'Radar, pessoas e próximos passos com contexto — sem lead score opaco e sem abordagem automática.' },
    'en-US': { eyebrow: 'RELATIONSHIPS', title: 'Who needs follow-up today?', subtitle: 'Radar, people and next steps with context — no opaque lead score and no automatic outreach.' },
    'es-ES': { eyebrow: 'RELACIONES', title: '¿Quién necesita seguimiento hoy?', subtitle: 'Radar, personas y próximos pasos con contexto — sin puntuación opaca ni contacto automático.' },
  },
  organization_admin: {
    'pt-BR': { eyebrow: 'OPERAÇÃO', title: 'O que precisa estar saudável para o time trabalhar?', subtitle: 'Canais, automações e governança organizados por capacidade, com recursos incompletos claramente sinalizados.' },
    'en-US': { eyebrow: 'OPERATIONS', title: 'What needs to stay healthy for the team to work?', subtitle: 'Channels, automations and governance organized by capability, with incomplete features clearly labeled.' },
    'es-ES': { eyebrow: 'OPERACIÓN', title: '¿Qué debe estar saludable para que el equipo trabaje?', subtitle: 'Canales, automatizaciones y gobernanza organizados por capacidad, con funciones incompletas claramente señaladas.' },
  },
};

const uiCopy = {
  'pt-BR': {
    today: 'Hoje no Connect',
    available: 'Disponível',
    controlled: 'Ativação controlada',
    next: 'Próxima fase',
    open: 'Abrir',
    ecosystem: 'Seu ecossistema, sem trocar de contexto',
    ecosystemDesc: 'O Connect consulta os aplicativos pela camada segura e leva a resposta para o canal certo. O app de domínio continua sendo a fonte da verdade.',
    ask: 'Perguntar ao Connect',
    askDesc: 'Próxima escala, repertório, presença e cifras do MusicScale já usam dados reais e permissões validadas.',
    relationship: 'Relacionamento inteligente',
    relationshipDesc: 'Radar e Composer aparecem apenas para quem tem essa função. Eles usam o Connect; não definem o produto inteiro.',
    inbox: 'Caixa de entrada',
    inboxDesc: 'A fundação durável já existe, mas a ativação em produção continua protegida por gate de IAM.',
    people: 'Pessoas',
    peopleDesc: 'Contexto e identidades em uma visão única, respeitando separação entre dados pessoais e organizacionais.',
    operations: 'Operação omnichannel',
    operationsDesc: 'Canais, agentes e automações entram progressivamente sem fingir integrações que ainda não estão ativas.',
  },
  'en-US': {
    today: 'Today in Connect', available: 'Available', controlled: 'Controlled activation', next: 'Next phase', open: 'Open',
    ecosystem: 'Your ecosystem, without switching context', ecosystemDesc: 'Connect queries apps through the secure layer and brings the answer to the right channel. Domain apps remain the source of truth.',
    ask: 'Ask Connect', askDesc: 'MusicScale next schedule, repertoire, attendance and charts already use real data and validated permissions.',
    relationship: 'Relationship intelligence', relationshipDesc: 'Radar and Composer appear only for the right roles. They use Connect; they do not define the whole product.',
    inbox: 'Inbox', inboxDesc: 'The durable foundation exists, while production activation remains protected by the IAM gate.',
    people: 'People', peopleDesc: 'Context and identities in one view while keeping personal and organizational data separated.',
    operations: 'Omnichannel operations', operationsDesc: 'Channels, agents and automations roll out progressively without pretending unfinished integrations are live.',
  },
  'es-ES': {
    today: 'Hoy en Connect', available: 'Disponible', controlled: 'Activación controlada', next: 'Próxima fase', open: 'Abrir',
    ecosystem: 'Tu ecosistema, sin cambiar de contexto', ecosystemDesc: 'Connect consulta las aplicaciones mediante la capa segura y lleva la respuesta al canal correcto. La app de dominio sigue siendo la fuente de verdad.',
    ask: 'Preguntar a Connect', askDesc: 'Próxima escala, repertorio, asistencia y cifras de MusicScale ya usan datos reales y permisos validados.',
    relationship: 'Inteligencia de relaciones', relationshipDesc: 'Radar y Composer aparecen solo para los perfiles adecuados. Usan Connect; no definen todo el producto.',
    inbox: 'Bandeja de entrada', inboxDesc: 'La base duradera ya existe, mientras la activación en producción sigue protegida por el gate de IAM.',
    people: 'Personas', peopleDesc: 'Contexto e identidades en una sola vista, manteniendo separados los datos personales y organizacionales.',
    operations: 'Operación omnicanal', operationsDesc: 'Canales, agentes y automatizaciones llegan progresivamente sin fingir integraciones que todavía no están activas.',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

const actions: HomeAction[] = [
  {
    id: 'assist',
    route: 'assist',
    icon: MessageSquareText,
    status: 'ready',
    title: { 'pt-BR': 'Assist', 'en-US': 'Assist', 'es-ES': 'Assist' },
    description: {
      'pt-BR': 'Converse com o MusicScale usando o contexto real da organização.',
      'en-US': 'Talk to MusicScale using the organization’s real context.',
      'es-ES': 'Habla con MusicScale usando el contexto real de la organización.',
    },
  },
  {
    id: 'people',
    route: 'contacts',
    icon: Users,
    status: 'ready',
    title: { 'pt-BR': 'Pessoas', 'en-US': 'People', 'es-ES': 'Personas' },
    description: {
      'pt-BR': 'Identidades e contexto reunidos com limites claros de escopo.',
      'en-US': 'Identity and context together with clear scope boundaries.',
      'es-ES': 'Identidad y contexto juntos con límites claros de alcance.',
    },
  },
  {
    id: 'radar',
    route: 'radar',
    icon: Radar,
    status: 'ready',
    title: { 'pt-BR': 'Radar', 'en-US': 'Radar', 'es-ES': 'Radar' },
    description: {
      'pt-BR': 'Sinais explicáveis, próxima ação e abordagem assistida.',
      'en-US': 'Explainable signals, next action and assisted outreach.',
      'es-ES': 'Señales explicables, próxima acción y contacto asistido.',
    },
  },
  {
    id: 'inbox',
    route: 'inbox',
    icon: Inbox,
    status: 'controlled',
    title: { 'pt-BR': 'Inbox', 'en-US': 'Inbox', 'es-ES': 'Inbox' },
    description: {
      'pt-BR': 'Atendimento real preparado para ativação segura.',
      'en-US': 'Real support foundation prepared for safe activation.',
      'es-ES': 'Base de atención real preparada para activación segura.',
    },
  },
  {
    id: 'operations',
    route: 'automations',
    icon: Workflow,
    status: 'next',
    title: { 'pt-BR': 'Automações', 'en-US': 'Automations', 'es-ES': 'Automatizaciones' },
    description: {
      'pt-BR': 'Eventos do ecossistema virando comunicação auditada.',
      'en-US': 'Ecosystem events becoming audited communication.',
      'es-ES': 'Eventos del ecosistema convertidos en comunicación auditada.',
    },
  },
];

function visibleActionIds(profile: ExperienceProfile, showRadar: boolean): Set<string> {
  const base = profile === 'musician'
    ? ['assist']
    : profile === 'worship_leader' || profile === 'pastor_leader'
      ? ['assist', 'people', 'inbox']
      : profile === 'support'
        ? ['inbox', 'people', 'assist']
        : profile === 'commercial'
          ? ['radar', 'people', 'assist']
          : profile === 'organization_admin'
            ? ['inbox', 'people', 'assist', 'operations']
            : ['assist', 'inbox', 'people', 'radar', 'operations'];
  return new Set(base.filter(id => id !== 'radar' || showRadar));
}

export const AdaptiveHomePage: React.FC<AdaptiveHomePageProps> = ({
  session,
  currentLang,
  profile,
  onNavigate,
  showRadar,
}) => {
  const hero = profileCopy[profile][currentLang];
  const t = uiCopy[currentLang];
  const allowed = visibleActionIds(profile, showRadar);
  const visibleActions = actions.filter(action => allowed.has(action.id));

  const statusLabel = (status: ModuleStatus) => (
    status === 'ready' ? t.available : status === 'controlled' ? t.controlled : t.next
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_15%_0%,rgba(99,102,241,.15),transparent_34%),radial-gradient(circle_at_90%_12%,rgba(34,211,238,.07),transparent_30%),linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.018))] p-5 shadow-[0_30px_90px_rgba(0,0,0,.22)] sm:p-7 lg:p-9">
        <div className="relative max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-black/15 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-indigo-200">
            <Sparkles size={13} /> {hero.eyebrow}
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            {hero.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            {hero.subtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-white/[0.08] bg-black/15 px-3 py-1.5">
              {session.context.activeOrganization.name}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-black/15 px-3 py-1.5">
              {t.today}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const ready = action.status === 'ready';
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onNavigate(action.route)}
              className="group min-h-44 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-200">
                  <Icon size={18} />
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] ${
                  ready
                    ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200'
                    : action.status === 'controlled'
                      ? 'border-amber-300/15 bg-amber-300/[0.06] text-amber-100'
                      : 'border-white/[0.08] bg-white/[0.03] text-slate-500'
                }`}>
                  {statusLabel(action.status)}
                </span>
              </div>
              <h2 className="mt-5 text-base font-semibold text-white">{action.title[currentLang]}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">{action.description[currentLang]}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 transition group-hover:text-white">
                {t.open} <ArrowRight size={13} />
              </span>
            </button>
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Bot size={16} className="text-indigo-300" /> {t.ecosystem}</div>
          <p className="mt-3 text-sm leading-6 text-slate-500">{t.ecosystemDesc}</p>
          <button type="button" onClick={() => onNavigate('assist')} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-400/[0.07] px-3.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-400/[0.11]">
            {t.ask} <ArrowRight size={13} />
          </button>
        </article>

        <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <div className="text-sm font-semibold text-white">
            {profile === 'commercial' || profile === 'ceo' ? t.relationship : profile === 'organization_admin' ? t.operations : t.people}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {profile === 'commercial' || profile === 'ceo'
              ? t.relationshipDesc
              : profile === 'organization_admin'
                ? t.operationsDesc
                : t.peopleDesc}
          </p>
          {(profile === 'commercial' || profile === 'ceo') && showRadar && (
            <button type="button" onClick={() => onNavigate('radar')} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.09] px-3.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.05]">
              {t.relationship} <ArrowRight size={13} />
            </button>
          )}
        </article>
      </section>
    </main>
  );
};
