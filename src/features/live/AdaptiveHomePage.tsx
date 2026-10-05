import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Inbox,
  MessageSquareText,
  Music2,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import { ExperiencePreviewConfig, ExperienceProfile } from '../../core/client/liveSurfacePolicy';
import { LiveInboxClient, type LiveInboxConversation } from '../../core/client/liveInboxClient';
import { PersonalRadarClient, type RadarClientPerson } from '../../core/client/personalRadarClient';
import { LanguageCode } from '../../types';

interface AdaptiveHomePageProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
  profile: ExperienceProfile;
  onNavigate: (route: string) => void;
  showRadar: boolean;
  previewConfig?: ExperiencePreviewConfig;
  previewOrganizationName?: string;
}

type AttentionKind = 'conversation' | 'commercial' | 'operation' | 'assist';

type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  meta: string;
  badge: string;
  route: string;
  actionLabel: string;
  reason: string;
  nextStep: string;
  timestamp?: string;
  accent: 'cyan' | 'amber' | 'violet' | 'slate';
};

const copy = {
  'pt-BR': {
    dayEyebrow: 'VISÃO DO ECOSSISTEMA',
    helloMorning: 'Bom dia',
    helloAfternoon: 'Boa tarde',
    helloEvening: 'Boa noite',
    subtitle: 'Conversas, contexto e próximos passos.',
    attention: 'Precisa da sua atenção',
    all: 'Tudo',
    support: 'Atendimento',
    approvals: 'Aprovações',
    followups: 'Follow-ups',
    empty: 'Nenhuma pendência neste filtro',
    emptyDesc: 'Quando houver algo real para resolver, ele aparece aqui — sem contadores inventados.',
    open: 'Abrir',
    context: 'Contexto da seleção',
    noSelection: 'Selecione um item para ver o contexto.',
    organization: 'Organização',
    source: 'Origem',
    owner: 'Responsável',
    next: 'Próximo passo',
    evidence: 'Evidências',
    activity: 'Atividade',
    apps: 'Conversar com seus aplicativos',
    askPlaceholder: 'O que você precisa consultar ou resolver?',
    accessHint: 'Acesso conforme suas permissões.',
    operation: 'Operação',
    operationHint: 'Acesso rápido à operação do ecossistema.',
    channels: 'Canais',
    agents: 'Agentes',
    automations: 'Automações',
    state: 'Consultar estado',
    realData: 'Dados reais',
    controlled: 'Ativação controlada',
    simulated: 'Cenário de pré-visualização',
    simulatedDesc: 'A prévia altera apenas a apresentação. Ações reais ficam bloqueadas em cenários simulados.',
    whatsapp: 'WhatsApp',
    radar: 'Radar',
    musicScale: 'MusicScale',
    musicScaleDesc: 'Escalas e repertório',
    nestJourney: 'NestJourney',
    nestJourneyDesc: 'Acolhimento e acompanhamento',
    nestFinance: 'NestFinance',
    nestFinanceDesc: 'Contagem e pendências',
    appUnavailable: 'Aplicativo não disponível nesta organização',
    conversationNew: 'Responder conversa',
    conversationProgress: 'Continuar atendimento',
    conversationWaitingTeam: 'Equipe precisa agir',
    conversationReason: 'Conversa real persistida na Inbox do Connect.',
    conversationNext: 'Abra a conversa, confira o histórico e responda ou encaminhe com segurança.',
    commercialFollowup: 'Retomar uma conversa',
    commercialReason: 'Follow-up comercial registrado e pronto para acompanhamento.',
    commercialNext: 'Revise o contexto e prepare a próxima mensagem antes de abrir o WhatsApp.',
    commercialSignal: 'Revisar oportunidade',
    commercialSignalReason: 'Sinal explicável do Radar com contexto disponível.',
    commercialSignalNext: 'Confira a evidência, valide a relevância e escolha a próxima ação.',
    operationsAttention: 'Revisar operação',
    operationsReason: 'Há uma área operacional disponível para conferência.',
    operationsNext: 'Abra a área correspondente para consultar o estado real.',
    assistTitle: 'Consultar seus aplicativos',
    assistReason: 'Use o Assist para consultar informações autorizadas sem navegar por cada aplicativo.',
    assistNext: 'Faça uma pergunta. O app de domínio continua validando dados e permissões.',
    profile: {
      ceo: 'Visão CEO',
      musician: 'Músico',
      worship_leader: 'Líder de louvor',
      pastor_leader: 'Pastor ou líder',
      support: 'Atendimento',
      commercial: 'Comercial',
      organization_admin: 'Administrador',
    },
  },
  'en-US': {
    dayEyebrow: 'ECOSYSTEM VIEW',
    helloMorning: 'Good morning',
    helloAfternoon: 'Good afternoon',
    helloEvening: 'Good evening',
    subtitle: 'Conversations, context and next steps.',
    attention: 'Needs your attention',
    all: 'All',
    support: 'Support',
    approvals: 'Approvals',
    followups: 'Follow-ups',
    empty: 'Nothing pending in this filter',
    emptyDesc: 'When something real needs action, it appears here — without invented counters.',
    open: 'Open',
    context: 'Selection context',
    noSelection: 'Select an item to inspect its context.',
    organization: 'Organization',
    source: 'Source',
    owner: 'Owner',
    next: 'Next step',
    evidence: 'Evidence',
    activity: 'Activity',
    apps: 'Talk to your apps',
    askPlaceholder: 'What do you need to check or resolve?',
    accessHint: 'Access follows your permissions.',
    operation: 'Operations',
    operationHint: 'Quick access to ecosystem operations.',
    channels: 'Channels',
    agents: 'Agents',
    automations: 'Automations',
    state: 'Check status',
    realData: 'Real data',
    controlled: 'Controlled activation',
    simulated: 'Preview scenario',
    simulatedDesc: 'Preview changes presentation only. Real actions stay locked in simulated scenarios.',
    whatsapp: 'WhatsApp',
    radar: 'Radar',
    musicScale: 'MusicScale',
    musicScaleDesc: 'Schedules and repertoire',
    nestJourney: 'NestJourney',
    nestJourneyDesc: 'Welcome and follow-up',
    nestFinance: 'NestFinance',
    nestFinanceDesc: 'Count and pending work',
    appUnavailable: 'App unavailable for this organization',
    conversationNew: 'Reply to conversation',
    conversationProgress: 'Continue support',
    conversationWaitingTeam: 'Team action required',
    conversationReason: 'Real conversation persisted in Connect Inbox.',
    conversationNext: 'Open the conversation, review history and reply or hand off safely.',
    commercialFollowup: 'Resume a conversation',
    commercialReason: 'A recorded commercial follow-up is ready for attention.',
    commercialNext: 'Review context and prepare the next message before opening WhatsApp.',
    commercialSignal: 'Review opportunity',
    commercialSignalReason: 'Explainable Radar signal with context available.',
    commercialSignalNext: 'Inspect the evidence, validate relevance and choose the next action.',
    operationsAttention: 'Review operations',
    operationsReason: 'An operational area is available for review.',
    operationsNext: 'Open the relevant area to inspect its real state.',
    assistTitle: 'Ask your apps',
    assistReason: 'Use Assist to query authorized information without navigating every app.',
    assistNext: 'Ask a question. The domain app still validates data and permissions.',
    profile: {
      ceo: 'CEO view',
      musician: 'Musician',
      worship_leader: 'Worship leader',
      pastor_leader: 'Pastor or leader',
      support: 'Support',
      commercial: 'Commercial',
      organization_admin: 'Administrator',
    },
  },
  'es-ES': {
    dayEyebrow: 'VISTA DEL ECOSISTEMA',
    helloMorning: 'Buenos días',
    helloAfternoon: 'Buenas tardes',
    helloEvening: 'Buenas noches',
    subtitle: 'Conversaciones, contexto y próximos pasos.',
    attention: 'Necesita tu atención',
    all: 'Todo',
    support: 'Atención',
    approvals: 'Aprobaciones',
    followups: 'Follow-ups',
    empty: 'No hay pendientes en este filtro',
    emptyDesc: 'Cuando exista algo real para resolver, aparecerá aquí — sin contadores inventados.',
    open: 'Abrir',
    context: 'Contexto de la selección',
    noSelection: 'Selecciona un elemento para ver su contexto.',
    organization: 'Organización',
    source: 'Origen',
    owner: 'Responsable',
    next: 'Próximo paso',
    evidence: 'Evidencias',
    activity: 'Actividad',
    apps: 'Hablar con tus aplicaciones',
    askPlaceholder: '¿Qué necesitas consultar o resolver?',
    accessHint: 'Acceso según tus permisos.',
    operation: 'Operación',
    operationHint: 'Acceso rápido a la operación del ecosistema.',
    channels: 'Canales',
    agents: 'Agentes',
    automations: 'Automatizaciones',
    state: 'Consultar estado',
    realData: 'Datos reales',
    controlled: 'Activación controlada',
    simulated: 'Escenario de vista previa',
    simulatedDesc: 'La vista previa cambia solo la presentación. Las acciones reales quedan bloqueadas en escenarios simulados.',
    whatsapp: 'WhatsApp',
    radar: 'Radar',
    musicScale: 'MusicScale',
    musicScaleDesc: 'Escalas y repertorio',
    nestJourney: 'NestJourney',
    nestJourneyDesc: 'Acogida y seguimiento',
    nestFinance: 'NestFinance',
    nestFinanceDesc: 'Conteo y pendientes',
    appUnavailable: 'Aplicación no disponible en esta organización',
    conversationNew: 'Responder conversación',
    conversationProgress: 'Continuar atención',
    conversationWaitingTeam: 'El equipo debe actuar',
    conversationReason: 'Conversación real persistida en la Inbox de Connect.',
    conversationNext: 'Abre la conversación, revisa el historial y responde o deriva con seguridad.',
    commercialFollowup: 'Retomar una conversación',
    commercialReason: 'Un follow-up comercial registrado está listo para seguimiento.',
    commercialNext: 'Revisa el contexto y prepara el próximo mensaje antes de abrir WhatsApp.',
    commercialSignal: 'Revisar oportunidad',
    commercialSignalReason: 'Señal explicable del Radar con contexto disponible.',
    commercialSignalNext: 'Revisa la evidencia, valida relevancia y elige la próxima acción.',
    operationsAttention: 'Revisar operación',
    operationsReason: 'Hay un área operativa disponible para revisión.',
    operationsNext: 'Abre el área correspondiente para consultar su estado real.',
    assistTitle: 'Consultar tus aplicaciones',
    assistReason: 'Usa Assist para consultar información autorizada sin navegar por cada aplicación.',
    assistNext: 'Haz una pregunta. La aplicación de dominio sigue validando datos y permisos.',
    profile: {
      ceo: 'Vista CEO',
      musician: 'Músico',
      worship_leader: 'Líder de alabanza',
      pastor_leader: 'Pastor o líder',
      support: 'Atención',
      commercial: 'Comercial',
      organization_admin: 'Administrador',
    },
  },
} satisfies Record<LanguageCode, any>;

function greeting(language: LanguageCode, hour: number, firstName: string, t: typeof copy['pt-BR']) {
  const prefix = hour < 12 ? t.helloMorning : hour < 18 ? t.helloAfternoon : t.helloEvening;
  return `${prefix}, ${firstName}.`;
}

function compactConversationId(value: string) {
  return value.length > 16 ? `…${value.slice(-10)}` : value;
}

function formatDate(language: LanguageCode, date = new Date()) {
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatTime(language: LanguageCode, value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function conversationTitle(conversation: LiveInboxConversation, t: typeof copy['pt-BR']) {
  if (conversation.status === 'new') return t.conversationNew;
  if (conversation.status === 'waiting_team') return t.conversationWaitingTeam;
  return t.conversationProgress;
}

function isConversationActionable(conversation: LiveInboxConversation) {
  return ['new', 'in_progress', 'waiting_team'].includes(conversation.status);
}

function realApps(session: LiveConnectSession) {
  return new Set(
    session.context.appAccess
      .filter((item) => item.access)
      .map((item) => item.appId.toLocaleLowerCase('en-US')),
  );
}

export const AdaptiveHomePage: React.FC<AdaptiveHomePageProps> = ({
  session,
  currentLang,
  profile,
  onNavigate,
  showRadar,
  previewConfig,
  previewOrganizationName,
}) => {
  const t = copy[currentLang];
  const inboxClient = useMemo(() => new LiveInboxClient(session), [session]);
  const radarClient = useMemo(() => new PersonalRadarClient(session), [session]);
  const [conversations, setConversations] = useState<LiveInboxConversation[]>([]);
  const [radarPeople, setRadarPeople] = useState<RadarClientPerson[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'support' | 'followups'>('all');
  const [selectedId, setSelectedId] = useState('');
  const [homeNotice, setHomeNotice] = useState('');

  const syntheticPreview = Boolean(previewConfig && (
    previewConfig.organizationId !== session.context.activeOrganization.id ||
    previewConfig.product !== 'auto' ||
    previewConfig.plan !== 'real' ||
    previewConfig.accountState !== 'active' ||
    previewConfig.dataMode !== 'real_permitted' ||
    previewConfig.capabilities !== null
  ));

  useEffect(() => {
    let cancelled = false;
    setHomeLoading(true);
    setHomeNotice('');

    const load = async () => {
      const inboxPromise = inboxClient.listConversations(20)
        .then((items) => { if (!cancelled) setConversations(items); })
        .catch(() => { if (!cancelled) setConversations([]); });

      const radarPromise = showRadar
        ? radarClient.getRadar()
            .then((result) => { if (!cancelled) setRadarPeople(result.people); })
            .catch(() => { if (!cancelled) setRadarPeople([]); })
        : Promise.resolve();

      await Promise.all([inboxPromise, radarPromise]);
      if (!cancelled) setHomeLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [inboxClient, radarClient, showRadar]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    conversations
      .filter(isConversationActionable)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4)
      .forEach((conversation) => {
        items.push({
          id: `conversation:${conversation.conversationId}`,
          kind: 'conversation',
          title: conversationTitle(conversation, t),
          meta: `${t.whatsapp} · ${compactConversationId(conversation.conversationId)}`,
          badge: t.support,
          route: 'inbox',
          actionLabel: t.open,
          reason: t.conversationReason,
          nextStep: t.conversationNext,
          timestamp: conversation.updatedAt,
          accent: conversation.status === 'waiting_team' ? 'amber' : 'cyan',
        });
      });

    if (showRadar) {
      const due = radarPeople
        .filter((person) => person.followUpAt && new Date(person.followUpAt).getTime() <= Date.now())
        .sort((a, b) => new Date(a.followUpAt || 0).getTime() - new Date(b.followUpAt || 0).getTime())
        .slice(0, 2);

      due.forEach((person) => {
        items.push({
          id: `followup:${person.id}`,
          kind: 'commercial',
          title: t.commercialFollowup,
          meta: person.probableName || person.displayName,
          badge: t.followups,
          route: 'opportunities',
          actionLabel: t.open,
          reason: t.commercialReason,
          nextStep: t.commercialNext,
          timestamp: person.followUpAt || undefined,
          accent: 'violet',
        });
      });

      const signaled = radarPeople
        .filter((person) => person.signals?.length && !due.some((item) => item.id === person.id))
        .slice(0, 2);

      signaled.forEach((person) => {
        const signal = person.signals[0];
        items.push({
          id: `radar:${person.id}`,
          kind: 'commercial',
          title: t.commercialSignal,
          meta: person.probableName || person.displayName,
          badge: t.radar,
          route: 'radar',
          actionLabel: t.open,
          reason: signal?.reason || t.commercialSignalReason,
          nextStep: signal?.nextAction || t.commercialSignalNext,
          timestamp: person.lastDateKey || undefined,
          accent: 'violet',
        });
      });
    }

    if (items.length === 0 && ['musician', 'worship_leader', 'pastor_leader'].includes(profile)) {
      items.push({
        id: 'assist:musicscale',
        kind: 'assist',
        title: t.assistTitle,
        meta: t.musicScale,
        badge: 'Assist',
        route: 'assist',
        actionLabel: t.open,
        reason: t.assistReason,
        nextStep: t.assistNext,
        accent: 'cyan',
      });
    }

    return items;
  }, [conversations, radarPeople, profile, showRadar, t]);

  const filteredItems = attentionItems.filter((item) => {
    if (filter === 'support') return item.kind === 'conversation';
    if (filter === 'followups') return item.kind === 'commercial';
    return true;
  });

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedId('');
      return;
    }
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const selected = attentionItems.find((item) => item.id === selectedId) || null;
  const apps = realApps(session);
  const firstName = session.context.user.name.trim().split(/\s+/)[0] || session.context.user.name;
  const now = new Date();
  const pageGreeting = greeting(currentLang, now.getHours(), firstName, t);
  const organizationName = previewOrganizationName || session.context.activeOrganization.name;

  const appCards = [
    { id: 'musicscale', label: t.musicScale, description: t.musicScaleDesc, icon: Music2 },
    { id: 'nestjourney', label: t.nestJourney, description: t.nestJourneyDesc, icon: Users },
    { id: 'nestfinance', label: t.nestFinance, description: t.nestFinanceDesc, icon: CreditCard },
  ];

  const activeApps = appCards.filter((app) => apps.has(app.id));
  const shownApps = activeApps.length ? activeApps : appCards.slice(0, 1);

  const performNavigate = (route: string) => {
    if (syntheticPreview) {
      setHomeNotice(t.simulatedDesc);
      return;
    }
    onNavigate(route);
  };

  const accentClasses: Record<AttentionItem['accent'], string> = {
    cyan: 'text-[#66D9EF] bg-[#66D9EF]/10 border-[#66D9EF]/18',
    amber: 'text-[#F1C77A] bg-[#F1C77A]/10 border-[#F1C77A]/18',
    violet: 'text-[#B6A8FF] bg-[#A998FF]/10 border-[#A998FF]/18',
    slate: 'text-[#AAB8C9] bg-white/[0.04] border-white/[0.08]',
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-4 pb-28 lg:pb-8">
      <header className="flex flex-col gap-4 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="connect-eyebrow">{t.dayEyebrow}</div>
          <h1 className="connect-page-title mt-2">{pageGreeting}</h1>
          <p className="connect-page-subtitle mt-1.5">{t.subtitle}</p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xs font-medium capitalize text-[#B7C5D3]">{formatDate(currentLang, now)}</div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.14em] text-[#61758A]">
            {t.profile[profile]} · {organizationName}
          </div>
        </div>
      </header>

      {syntheticPreview && (
        <section className="flex items-start gap-3 rounded-xl border border-[#66D9EF]/15 bg-[#163442]/35 px-4 py-3">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-[#66D9EF]" />
          <div>
            <div className="text-xs font-semibold text-[#DFFAFF]">{t.simulated}</div>
            <p className="mt-1 text-[11px] leading-5 text-[#8CAAB6]">{t.simulatedDesc}</p>
          </div>
        </section>
      )}

      {homeNotice && (
        <div className="rounded-xl border border-[#F1C77A]/20 bg-[#F1C77A]/[0.06] px-4 py-3 text-xs text-[#F6DDA9]">
          {homeNotice}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.95fr)_minmax(310px,.92fr)]">
        <article className="connect-surface overflow-hidden rounded-[14px]">
          <div className="flex flex-col gap-3 border-b connect-divider px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <BellRing size={17} className="text-[#66D9EF]" />
              <h2 className="text-sm font-semibold text-[#F2F5FA]">{t.attention}</h2>
              {!homeLoading && (
                <span className="rounded-md border border-[#2B3A4D] bg-[#0D151F] px-2 py-0.5 text-[9px] font-semibold text-[#73869A]">
                  {attentionItems.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {([
                ['all', t.all],
                ['support', t.support],
                ['followups', t.followups],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`connect-focus min-h-8 whitespace-nowrap rounded-lg border px-3 text-[10px] font-semibold transition ${filter === id
                    ? 'border-[#66D9EF]/25 bg-[#163442]/70 text-[#B9F3FB]'
                    : 'border-[#263648] bg-transparent text-[#76899E] hover:text-[#AAB9C8]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[310px]">
            {homeLoading ? (
              <div className="space-y-0 divide-y divide-[#263648]/55">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="flex animate-pulse items-center gap-3 px-4 py-4 sm:px-5">
                    <div className="h-9 w-9 rounded-xl bg-white/[0.04]" />
                    <div className="flex-1">
                      <div className="h-3 w-40 rounded bg-white/[0.05]" />
                      <div className="mt-2 h-2.5 w-60 max-w-[70%] rounded bg-white/[0.03]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="grid min-h-[310px] place-items-center px-6 py-12 text-center">
                <div className="max-w-md">
                  <CheckCircle2 size={24} className="mx-auto text-[#5D7388]" />
                  <div className="mt-3 text-sm font-semibold text-[#DCE5ED]">{t.empty}</div>
                  <p className="mt-2 text-xs leading-5 text-[#708398]">{t.emptyDesc}</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#263648]/65">
                {filteredItems.map((item) => {
                  const isSelected = selectedId === item.id;
                  const Icon = item.kind === 'conversation'
                    ? MessageSquareText
                    : item.kind === 'commercial'
                      ? Briefcase
                      : item.kind === 'operation'
                        ? Workflow
                        : Sparkles;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      onDoubleClick={() => performNavigate(item.route)}
                      className={`connect-row connect-focus flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5 ${isSelected ? 'connect-row-selected' : ''}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${accentClasses[item.accent]}`}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[13px] font-semibold text-[#EEF4F8]">{item.title}</span>
                          <span className="rounded-md border border-[#324659] bg-[#111B28] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.08em] text-[#7F94A8]">
                            {item.badge}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-[#75889C]">{item.meta}</span>
                      </span>
                      {item.timestamp && <span className="hidden shrink-0 text-[9px] text-[#5E7185] sm:block">{formatTime(currentLang, item.timestamp)}</span>}
                      <span className="hidden items-center gap-1 text-[10px] font-semibold text-[#9EEBF6] md:flex">
                        {item.actionLabel} <ChevronRight size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        <aside className="connect-surface flex min-h-[390px] flex-col rounded-[14px]">
          <div className="border-b connect-divider px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F2F5FA]">
              <CircleAlert size={16} className="text-[#91A8BC]" />
              {t.context}
            </div>
          </div>

          {!selected ? (
            <div className="grid flex-1 place-items-center px-6 py-10 text-center">
              <p className="max-w-xs text-xs leading-5 text-[#708398]">{t.noSelection}</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="px-4 py-5 sm:px-5">
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${accentClasses[selected.accent]}`}>
                    {selected.kind === 'conversation' ? <MessageSquareText size={18} /> : selected.kind === 'commercial' ? <Briefcase size={18} /> : <Sparkles size={18} />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold leading-5 text-[#F2F5FA]">{selected.title}</div>
                    <div className="mt-1 text-[11px] text-[#7E91A6]">{selected.meta}</div>
                  </div>
                </div>

                <dl className="mt-5 divide-y divide-[#263648]/65 border-y border-[#263648]/65 text-[11px]">
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-[#667A90]">{t.organization}</dt>
                    <dd className="truncate font-medium text-[#C9D4DE]">{organizationName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-[#667A90]">{t.source}</dt>
                    <dd className="font-medium text-[#C9D4DE]">{selected.kind === 'conversation' ? t.whatsapp : selected.kind === 'commercial' ? t.radar : 'Connect'}</dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#71859A]">{t.evidence}</div>
                  <p className="mt-2 text-xs leading-5 text-[#A4B3C1]">{selected.reason}</p>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#71859A]">{t.next}</div>
                  <p className="mt-2 text-xs leading-5 text-[#A4B3C1]">{selected.nextStep}</p>
                </div>
              </div>

              <div className="mt-auto border-t connect-divider p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => performNavigate(selected.route)}
                  className="connect-accent-button connect-focus flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] px-4 text-xs font-bold"
                >
                  {selected.actionLabel} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </aside>
      </section>

      <section className="connect-surface rounded-[14px] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#F2F5FA]">{t.apps}</h2>
          <span className="text-[9px] uppercase tracking-[.12em] text-[#61758A]">{t.realData}</span>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {shownApps.map((app) => {
            const Icon = app.icon;
            const isAvailable = apps.has(app.id);
            return (
              <button
                key={app.id}
                type="button"
                disabled={!isAvailable && app.id !== 'musicscale'}
                onClick={() => performNavigate('assist')}
                title={!isAvailable ? t.appUnavailable : undefined}
                className="connect-focus flex min-h-[62px] items-center gap-3 rounded-[10px] border border-[#2B3A4D] bg-[#0D151F]/55 px-3.5 text-left transition hover:border-[#3D566D] hover:bg-[#111C2A] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#66D9EF]/18 bg-[#163442] text-[#66D9EF]">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[#E7EEF4]">{app.label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-[#6F8297]">{app.description}</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-[#62768A]" />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => performNavigate('assist')}
          className="connect-focus mt-3 flex min-h-11 w-full items-center gap-3 rounded-[10px] border border-[#2B3A4D] bg-[#0A121C] px-3.5 text-left text-xs text-[#708398] transition hover:border-[#3C5369] hover:text-[#AAB9C8]"
        >
          <Sparkles size={15} className="shrink-0 text-[#66D9EF]" />
          <span className="flex-1">{t.askPlaceholder}</span>
          <ArrowRight size={14} />
        </button>
        <div className="mt-2 px-1 text-[9px] text-[#536679]">{t.accessHint}</div>
      </section>

      {['ceo', 'organization_admin'].includes(profile) && (
        <section className="connect-surface rounded-[14px] px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex min-w-[180px] items-center gap-2">
              <ShieldCheck size={16} className="text-[#8FA6BB]" />
              <div>
                <div className="text-xs font-semibold text-[#E7EEF4]">{t.operation}</div>
                <div className="mt-0.5 text-[9px] text-[#627589]">{t.operationHint}</div>
              </div>
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              {[
                { route: 'channels', label: t.channels, icon: Radio },
                { route: 'agents', label: t.agents, icon: Users },
                { route: 'automations', label: t.automations, icon: Workflow },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => performNavigate(item.route)}
                    className="connect-focus flex min-h-10 items-center gap-2 rounded-[9px] border border-[#2B3A4D] bg-[#0D151F]/55 px-3 text-left transition hover:bg-[#13202E]"
                  >
                    <Icon size={14} className="text-[#85A0B7]" />
                    <span className="flex-1 text-[11px] font-medium text-[#C6D1DB]">{item.label}</span>
                    <span className="text-[9px] text-[#607489]">{t.state}</span>
                    <ChevronRight size={12} className="text-[#5B6E82]" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </main>
  );
};
