/**
 * MillionsNest Connect - Main Application Entry
 * Demo and staged live Core remain deliberately separated.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Shell } from './components/layout/Shell';
import { EffectiveEcosystemContext, LanguageCode } from './types';
import { mockEcosystemContext } from './demo/mockData';
import {
  bootstrapLiveConnectSession,
  CONNECT_LIVE_MODE_ENABLED,
  LiveConnectSession,
} from './core/client/liveConnectSession';
import { isGlobalGovernanceRole } from './core/roles/systemRoles';
import {
  ExperiencePreviewConfig,
  ExperienceView,
  resolveExperienceProfile,
  resolveRealExperienceProfile,
} from './core/client/liveSurfacePolicy';
import { buildHubConnectLaunchUrl, shouldRedirectToHubConnectLaunch } from './core/client/connectLaunchBridge';
import { AdaptiveHomePage } from './features/live/AdaptiveHomePage';
import { DeveloperPreviewPage } from './features/developer/DeveloperPreviewPage';
import { LiveCorePage } from './features/live/LiveCorePage';
import { RadarPage } from './features/radar/RadarPage';
import { LivePeoplePage } from './features/contacts/LivePeoplePage';
import { PersonalSourcesPage } from './features/sources/PersonalSourcesPage';
import { RelationshipIntelligencePage } from './features/intelligence/RelationshipIntelligencePage';
import { JourneyFollowupConnectPage } from './features/journey/JourneyFollowupConnectPage';
import { resolveJourneyFollowupId } from './features/journey/journeyFollowup';

// Demo feature pages remain available while the live rollout flag is off.
import { OverviewPage } from './features/overview/OverviewPage';
import { InboxPage } from './features/inbox/InboxPage';
import { ConversationalMenuPage } from './features/menu/ConversationalMenuPage';
import { ContactsPage } from './features/contacts/ContactsPage';
import { AgentsPage } from './features/agents/AgentsPage';
import { KnowledgePage } from './features/knowledge/KnowledgePage';
import { AutomationsPage } from './features/automations/AutomationsPage';
import { ToolsPage } from './features/tools/ToolsPage';
import { ChannelsPage } from './features/channels/ChannelsPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { AuditPage } from './features/audit/AuditPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { DocsPage } from './features/docs/DocsPage';

const SAFE_BOOTSTRAP_ERROR_CODES = new Set([
  'HANDOFF_REQUIRED',
  'HANDOFF_INVALID',
  'HANDOFF_EXPIRED',
  'FIREBASE_CONFIG_UNAVAILABLE',
  'HANDOFF_EXCHANGE_FAILED',
  'HANDOFF_IDENTITY_MISMATCH',
  'AUTH_REQUIRED',
  'ORGANIZATION_REQUIRED',
  'ORGANIZATION_CONTEXT_MISMATCH',
  'ORGANIZATION_ACCESS_DENIED',
  'CANONICAL_CONTEXT_UNAVAILABLE',
  'CANONICAL_CONTEXT_MISMATCH',
]);

function safeBootstrapErrorCode(error: unknown): string {
  const candidate = error instanceof Error ? error.message.trim() : '';
  return SAFE_BOOTSTRAP_ERROR_CODES.has(candidate) ? candidate : 'LIVE_BOOT_FAILED';
}

function LiveBootScreen({ failed, errorCode }: { failed?: boolean; errorCode?: string | null }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#08090c] px-6 text-white">
      <section className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
          {failed ? <LockKeyhole size={21} /> : <Loader2 size={21} className="animate-spin" />}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {failed ? 'Abra o Connect pelo MillionsNest' : 'Confirmando seu contexto'}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          {failed
            ? 'A sessão segura não pôde ser confirmada. Volte ao Hub, escolha sua organização e abra o Connect novamente.'
            : 'Validando identidade, organização e permissões antes de liberar o Connect Core.'}
        </p>
        {failed && errorCode && (
          <p className="mx-auto mt-3 w-fit rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 font-mono text-[11px] tracking-wide text-slate-400">
            Diagnóstico: {errorCode}
          </p>
        )}
        {failed && (
          <button
            type="button"
            onClick={() => window.location.assign('https://www.millionsnest.com/dashboard/overview')}
            className="mt-6 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            Voltar ao MillionsNest
          </button>
        )}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck size={13} /> Zero Trust Client · contexto validado no servidor
        </div>
      </section>
    </main>
  );
}

function LiveStagedSection({
  title,
  description,
  actionLabel,
  onAction,
  statusLabel,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  statusLabel: string;
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-4xl items-center justify-center px-3 py-10 sm:px-5">
      <section className="relative w-full overflow-hidden rounded-[30px] border border-white/[0.09] bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.12),transparent_35%),rgba(255,255,255,.025)] p-7 text-center shadow-[0_28px_80px_rgba(0,0,0,.2)] sm:p-10">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.09] bg-white/[0.04]">
          <ShieldCheck className="text-slate-300" size={20} />
        </div>
        <div className="mx-auto mt-4 w-fit rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
          {statusLabel}
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.09]"
          >
            {actionLabel}
          </button>
        )}
      </section>
    </main>
  );
}

type StagedLiveItem = { title: string; description: string; actionLabel?: string; actionRoute?: string };

const stagedLiveCopy: Record<LanguageCode, Record<string, StagedLiveItem>> = {
  'pt-BR': {
    inbox: { title: 'Inbox real', description: 'A base durável, autorização e persistência já existem. A interface permanece em ativação controlada até o gate de IAM ser liberado com segurança.' },
    opportunities: { title: 'Oportunidades', description: 'A promoção manual já funciona dentro do Radar. O workspace dedicado está sendo separado para deixar o funil comercial claro sem transformar o Connect em um CRM genérico.', actionLabel: 'Abrir Radar', actionRoute: 'radar' },
    playbooks: { title: 'Playbooks', description: 'O playbook MusicScale já orienta o Composer por etapas e pequenos “sins”. A gestão visual dedicada entra como superfície do módulo comercial.', actionLabel: 'Abrir Radar', actionRoute: 'radar' },
    composer: { title: 'Composer', description: 'O Composer já gera abordagens editáveis no fluxo do Radar. Esta área dedicada reunirá modelos, tons, objetivos e follow-ups sem automatizar o envio.', actionLabel: 'Abrir Radar', actionRoute: 'radar' },
    automations: { title: 'Automações', description: 'Os contratos de eventos e ações auditadas estão preparados. A ativação visual acontecerá por fatias reais, começando pelos eventos do MusicScale.' },
    channels: { title: 'Canais', description: 'WhatsApp oficial, in-app e adapters futuros serão mostrados aqui somente quando a integração correspondente estiver realmente conectada.' },
    agents: { title: 'Agentes', description: 'A autonomia será progressiva, com contexto, políticas e confirmação por risco. Nenhum agente será exibido como ativo antes da conexão real.' },
    knowledge: { title: 'Conhecimento', description: 'A camada contextual será ativada junto aos fluxos reais de suporte e Assist, sem criar um painel técnico antes da hora.' },
    audit: { title: 'Auditoria', description: 'Os eventos seguros já são registrados no Core. A superfície administrativa consolidada será liberada sem expor PII desnecessária.' },
    settings: { title: 'Configurações', description: 'Configurações avançadas aparecem conforme capability e somente quando houver uma ação real e segura para administrar.' },
    preferences: { title: 'Preferências', description: 'Idioma, experiência e preferências pessoais serão centralizados aqui sem alterar permissões reais do Hub.' },
    fallback: { title: 'Integração em liberação controlada', description: 'Esta área ainda não está conectada a uma superfície de produção. O Connect mostra esse estado de forma explícita para não confundir fundação técnica com recurso disponível.' },
  },
  'en-US': {
    inbox: { title: 'Real Inbox', description: 'Durable storage, authorization and persistence are already in place. The UI stays under controlled activation until the IAM gate is safely released.' },
    opportunities: { title: 'Opportunities', description: 'Manual promotion already works inside Radar. The dedicated workspace is being separated so the commercial funnel stays clear without turning Connect into a generic CRM.', actionLabel: 'Open Radar', actionRoute: 'radar' },
    playbooks: { title: 'Playbooks', description: 'The MusicScale playbook already guides Composer through stages and small yeses. Dedicated visual management becomes part of the commercial module.', actionLabel: 'Open Radar', actionRoute: 'radar' },
    composer: { title: 'Composer', description: 'Composer already creates editable outreach drafts inside Radar. This dedicated area will gather models, tones, goals and follow-ups without automating the send.', actionLabel: 'Open Radar', actionRoute: 'radar' },
    automations: { title: 'Automations', description: 'Audited event and action contracts are prepared. The visual surface will activate in real vertical slices, starting with MusicScale events.' },
    channels: { title: 'Channels', description: 'Official WhatsApp, in-app and future adapters will appear here only when the corresponding integration is actually connected.' },
    agents: { title: 'Agents', description: 'Autonomy will be progressive, with context, policies and risk-based confirmation. No agent is shown as active before the real connection exists.' },
    knowledge: { title: 'Knowledge', description: 'Contextual knowledge activates alongside real support and Assist flows instead of becoming a technical panel too early.' },
    audit: { title: 'Audit', description: 'Secure events are already recorded by Core. The consolidated administrative surface will ship without exposing unnecessary PII.' },
    settings: { title: 'Settings', description: 'Advanced settings appear by capability only when there is a real, safe action to administer.' },
    preferences: { title: 'Preferences', description: 'Language, experience and personal preferences will live here without changing real Hub permissions.' },
    fallback: { title: 'Controlled integration rollout', description: 'This area is not connected to a production surface yet. Connect exposes that state explicitly so technical foundations are never confused with available features.' },
  },
  'es-ES': {
    inbox: { title: 'Inbox real', description: 'La base duradera, la autorización y la persistencia ya existen. La interfaz permanece en activación controlada hasta que el gate de IAM sea liberado con seguridad.' },
    opportunities: { title: 'Oportunidades', description: 'La promoción manual ya funciona dentro de Radar. El workspace dedicado se está separando para que el embudo comercial sea claro sin convertir Connect en un CRM genérico.', actionLabel: 'Abrir Radar', actionRoute: 'radar' },
    playbooks: { title: 'Playbooks', description: 'El playbook de MusicScale ya guía Composer por etapas y pequeños “sí”. La gestión visual dedicada será una superficie del módulo comercial.', actionLabel: 'Abrir Radar', actionRoute: 'radar' },
    composer: { title: 'Composer', description: 'Composer ya crea borradores editables dentro de Radar. Esta área reunirá modelos, tonos, objetivos y follow-ups sin automatizar el envío.', actionLabel: 'Abrir Radar', actionRoute: 'radar' },
    automations: { title: 'Automatizaciones', description: 'Los contratos de eventos y acciones auditadas están preparados. La superficie visual se activará por flujos reales, comenzando con eventos de MusicScale.' },
    channels: { title: 'Canales', description: 'WhatsApp oficial, in-app y futuros adapters aparecerán aquí solo cuando la integración correspondiente esté realmente conectada.' },
    agents: { title: 'Agentes', description: 'La autonomía será progresiva, con contexto, políticas y confirmación según riesgo. Ningún agente aparecerá activo antes de la conexión real.' },
    knowledge: { title: 'Conocimiento', description: 'La capa contextual se activará junto a los flujos reales de soporte y Assist, sin crear un panel técnico antes de tiempo.' },
    audit: { title: 'Auditoría', description: 'Core ya registra eventos seguros. La superficie administrativa consolidada se liberará sin exponer PII innecesaria.' },
    settings: { title: 'Configuración', description: 'La configuración avanzada aparece por capability y solo cuando exista una acción real y segura para administrar.' },
    preferences: { title: 'Preferencias', description: 'Idioma, experiencia y preferencias personales se centralizarán aquí sin cambiar los permisos reales del Hub.' },
    fallback: { title: 'Integración en liberación controlada', description: 'Esta área todavía no está conectada a una superficie de producción. Connect muestra ese estado de forma explícita para no confundir base técnica con función disponible.' },
  },
};

const controlledLabel: Record<LanguageCode, string> = {
  'pt-BR': 'Ativação controlada',
  'en-US': 'Controlled activation',
  'es-ES': 'Activación controlada',
};

function initialLiveRoute() {
  return resolveJourneyFollowupId(window.location.pathname) ? 'journey-followup' : 'overview';
}

export default function App() {
  const [demoContext, setDemoContext] = useState<EffectiveEcosystemContext>(mockEcosystemContext);
  const [liveSession, setLiveSession] = useState<LiveConnectSession | null>(null);
  const [liveBootState, setLiveBootState] = useState<'idle' | 'loading' | 'failed'>(
    CONNECT_LIVE_MODE_ENABLED ? 'loading' : 'idle',
  );
  const [liveBootErrorCode, setLiveBootErrorCode] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<string>(initialLiveRoute);
  const [currentLang, setCurrentLang] = useState<LanguageCode>('pt-BR');
  const [previewConfig, setPreviewConfig] = useState<ExperiencePreviewConfig>({
    view: 'real',
    organizationId: '',
    product: 'auto',
    plan: 'real',
    device: 'auto',
    accountState: 'active',
    dataMode: 'real_permitted',
  });

  useEffect(() => {
    if (!CONNECT_LIVE_MODE_ENABLED) return;
    let mounted = true;
    setLiveBootState('loading');
    setLiveBootErrorCode(null);
    bootstrapLiveConnectSession()
      .then((session) => {
        if (!mounted) return;
        setLiveSession(session);
        // Everyone lands on the adaptive home. Relationship Intelligence remains
        // an optional capability instead of becoming the identity of Connect.
        setActiveRoute((current) => current === 'journey-followup' ? current : 'overview');
        setPreviewConfig({
          view: 'real',
          organizationId: session.context.activeOrganization.id,
          product: 'auto',
          plan: 'real',
          device: 'auto',
          accountState: 'active',
          dataMode: 'real_permitted',
        });
        setLiveBootErrorCode(null);
        setLiveBootState('idle');
      })
      .catch((error) => {
        if (!mounted) return;
        const errorCode = safeBootstrapErrorCode(error);
        if (shouldRedirectToHubConnectLaunch(errorCode)) {
          window.location.replace(buildHubConnectLaunchUrl());
          return;
        }
        setLiveSession(null);
        setLiveBootErrorCode(errorCode);
        setLiveBootState('failed');
      });
    return () => { mounted = false; };
  }, []);

  if (CONNECT_LIVE_MODE_ENABLED && liveBootState === 'loading') {
    return <LiveBootScreen />;
  }
  if (CONNECT_LIVE_MODE_ENABLED && (liveBootState === 'failed' || !liveSession)) {
    return <LiveBootScreen failed errorCode={liveBootErrorCode} />;
  }

  const context = liveSession?.context ?? demoContext;
  const isLive = Boolean(liveSession);
  const showRadar = isLive && isGlobalGovernanceRole(context.user.systemRole);
  const canPreviewExperience = isLive && isGlobalGovernanceRole(context.user.systemRole);
  const activeMembership = context.memberships.find(
    (membership) => membership.organizationId === context.activeOrganization.id,
  );
  const realExperienceProfile = resolveRealExperienceProfile(
    context.user.systemRole,
    activeMembership?.organizationRole,
  );
  const effectiveExperienceProfile = resolveExperienceProfile(
    canPreviewExperience ? previewConfig.view : 'real',
    realExperienceProfile,
  );
  const previewOrganization = context.availableOrganizations.find(
    (organization) => organization.id === previewConfig.organizationId,
  ) || context.activeOrganization;

  const handleExperienceViewChange = (view: ExperienceView) => {
    if (!canPreviewExperience) return;
    setPreviewConfig((current) => ({ ...current, view }));
    setActiveRoute('overview');
  };

  const handleSelectOrg = (orgId: string) => {
    if (isLive) return;
    const selectedOrg = context.availableOrganizations.find((o) => o.id === orgId);
    if (selectedOrg) {
      setDemoContext((prev) => ({
        ...prev,
        activeOrganization: selectedOrg,
      }));
    }
  };

  const renderDemoPage = () => {
    switch (activeRoute) {
      case 'overview':
        return <OverviewPage context={context} currentLang={currentLang} onNavigate={setActiveRoute} />;
      case 'inbox':
        return <InboxPage context={context} currentLang={currentLang} onNavigate={setActiveRoute} />;
      case 'menu':
        return <ConversationalMenuPage context={context} currentLang={currentLang} />;
      case 'contacts': return <ContactsPage />;
      case 'agents': return <AgentsPage />;
      case 'knowledge': return <KnowledgePage />;
      case 'automations': return <AutomationsPage />;
      case 'tools': return <ToolsPage context={context} currentLang={currentLang} />;
      case 'channels': return <ChannelsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'audit': return <AuditPage />;
      case 'settings': return <SettingsPage context={context} />;
      case 'docs': return <DocsPage />;
      default: return <OverviewPage context={context} currentLang={currentLang} onNavigate={setActiveRoute} />;
    }
  };

  const renderCurrentPage = () => {
    if (!liveSession) return renderDemoPage();
    if (activeRoute === 'journey-followup') {
      return <JourneyFollowupConnectPage session={liveSession} currentLang={currentLang} />;
    }
    if (activeRoute === 'overview') {
      return (
        <AdaptiveHomePage
          session={liveSession}
          currentLang={currentLang}
          profile={effectiveExperienceProfile}
          onNavigate={setActiveRoute}
          showRadar={showRadar}
          previewConfig={canPreviewExperience ? previewConfig : undefined}
          previewOrganizationName={previewOrganization.name}
        />
      );
    }
    if (activeRoute === 'developer' && canPreviewExperience) {
      return (
        <DeveloperPreviewPage
          session={liveSession}
          currentLang={currentLang}
          config={previewConfig}
          showRadar={showRadar}
          onChange={setPreviewConfig}
          onChangeLang={setCurrentLang}
          onOpenHome={() => setActiveRoute('overview')}
        />
      );
    }
    if (activeRoute === 'assist') {
      return <LiveCorePage session={liveSession} currentLang={currentLang} />;
    }
    if (activeRoute === 'radar' && showRadar) {
      return <RadarPage session={liveSession} currentLang={currentLang} />;
    }
    if ((activeRoute === 'sources' || activeRoute === 'imports') && showRadar) {
      return <PersonalSourcesPage session={liveSession} currentLang={currentLang} onNavigate={setActiveRoute} />;
    }
    if (activeRoute === 'intelligence' && showRadar) {
      return <RelationshipIntelligencePage session={liveSession} currentLang={currentLang} />;
    }
    if (activeRoute === 'contacts' && showRadar) {
      return <LivePeoplePage session={liveSession} currentLang={currentLang} />;
    }

    const item = stagedLiveCopy[currentLang][activeRoute] || stagedLiveCopy[currentLang].fallback;
    return (
      <LiveStagedSection
        title={item.title}
        description={item.description}
        actionLabel={item.actionLabel}
        onAction={item.actionRoute ? () => setActiveRoute(item.actionRoute!) : undefined}
        statusLabel={controlledLabel[currentLang]}
      />
    );
  };

  return (
    <Shell
      context={context}
      activeRoute={activeRoute}
      currentLang={currentLang}
      onNavigate={setActiveRoute}
      onSelectOrg={handleSelectOrg}
      onChangeLang={setCurrentLang}
      isLive={isLive}
      showRadar={showRadar}
      experienceProfile={effectiveExperienceProfile}
      experienceView={previewConfig.view}
      canPreviewExperience={canPreviewExperience}
      onExperienceViewChange={handleExperienceViewChange}
    >
      {renderCurrentPage()}
    </Shell>
  );
}
