/**
 * MillionsNest Connect - Main Application Entry
 * Full-stack Bootstrap Foundation
 */

import React, { useState } from 'react';
import { Shell } from './components/layout/Shell';
import { EffectiveEcosystemContext, LanguageCode } from './types';
import { mockEcosystemContext } from './demo/mockData';

// Feature Pages
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

export default function App() {
  const [context, setContext] = useState<EffectiveEcosystemContext>(mockEcosystemContext);
  const [activeRoute, setActiveRoute] = useState<string>('overview');
  const [currentLang, setCurrentLang] = useState<LanguageCode>('pt-BR');

  const handleSelectOrg = (orgId: string) => {
    const selectedOrg = context.availableOrganizations.find((o) => o.id === orgId);
    if (selectedOrg) {
      setContext((prev) => ({
        ...prev,
        activeOrganization: selectedOrg,
      }));
    }
  };

  const renderCurrentPage = () => {
    switch (activeRoute) {
      case 'overview':
        return (
          <OverviewPage
            context={context}
            currentLang={currentLang}
            onNavigate={setActiveRoute}
          />
        );
      case 'inbox':
        return (
          <InboxPage
            context={context}
            currentLang={currentLang}
            onNavigate={setActiveRoute}
          />
        );
      case 'menu':
        return <ConversationalMenuPage />;
      case 'contacts':
        return <ContactsPage />;
      case 'agents':
        return <AgentsPage />;
      case 'knowledge':
        return <KnowledgePage />;
      case 'automations':
        return <AutomationsPage />;
      case 'tools':
        return <ToolsPage context={context} currentLang={currentLang} />;
      case 'channels':
        return <ChannelsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'audit':
        return <AuditPage />;
      case 'settings':
        return <SettingsPage context={context} />;
      case 'docs':
        return <DocsPage />;
      default:
        return (
          <OverviewPage
            context={context}
            currentLang={currentLang}
            onNavigate={setActiveRoute}
          />
        );
    }
  };

  return (
    <Shell
      context={context}
      activeRoute={activeRoute}
      currentLang={currentLang}
      onNavigate={setActiveRoute}
      onSelectOrg={handleSelectOrg}
      onChangeLang={setCurrentLang}
    >
      {renderCurrentPage()}
    </Shell>
  );
}
