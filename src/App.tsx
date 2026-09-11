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
import { LiveCorePage } from './features/live/LiveCorePage';
import { RadarPage } from './features/radar/RadarPage';

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

function LiveStagedSection() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center px-5 py-12">
      <section className="w-full rounded-[28px] border border-white/10 bg-white/[0.035] p-7 text-center backdrop-blur-xl sm:p-10">
        <ShieldCheck className="mx-auto text-slate-400" size={25} />
        <h2 className="mt-4 text-xl font-semibold text-white">Integração em liberação controlada</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Esta área ainda não foi conectada ao backend real. Para não misturar dados demonstrativos com sua organização, ela permanece bloqueada no modo ao vivo.
        </p>
      </section>
    </main>
  );
}

export default function App() {
  const [demoContext, setDemoContext] = useState<EffectiveEcosystemContext>(mockEcosystemContext);
  const [liveSession, setLiveSession] = useState<LiveConnectSession | null>(null);
  const [liveBootState, setLiveBootState] = useState<'idle' | 'loading' | 'failed'>(
    CONNECT_LIVE_MODE_ENABLED ? 'loading' : 'idle',
  );
  const [liveBootErrorCode, setLiveBootErrorCode] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<string>('overview');
  const [currentLang, setCurrentLang] = useState<LanguageCode>('pt-BR');

  useEffect(() => {
    if (!CONNECT_LIVE_MODE_ENABLED) return;
    let mounted = true;
    setLiveBootState('loading');
    setLiveBootErrorCode(null);
    bootstrapLiveConnectSession()
      .then((session) => {
        if (!mounted) return;
        setLiveSession(session);
        // Current commercial priority: eligible ecosystem-governance users land
        // directly in Relationship Intelligence instead of a generic overview.
        // Non-governance users keep the existing Core landing and RBAC boundary.
        if (isGlobalGovernanceRole(session.context.user.systemRole)) {
          setActiveRoute('radar');
        }
        setLiveBootErrorCode(null);
        setLiveBootState('idle');
      })
      .catch((error) => {
        if (!mounted) return;
        setLiveSession(null);
        setLiveBootErrorCode(safeBootstrapErrorCode(error));
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
    if (activeRoute === 'radar' && showRadar) {
      return <RadarPage session={liveSession} currentLang={currentLang} />;
    }
    if (activeRoute === 'overview') {
      return <LiveCorePage session={liveSession} currentLang={currentLang} />;
    }
    return <LiveStagedSection />;
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
    >
      {renderCurrentPage()}
    </Shell>
  );
}
