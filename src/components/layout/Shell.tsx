import React, { useState } from 'react';
import {
  Search, Bell, Building2, Globe, ChevronDown, ChevronUp,
  LayoutDashboard, MessageSquare, MessageSquareText, Wrench, Users, BrainCircuit,
  Workflow, Radio, LineChart, ShieldCheck, Settings, BookOpen, Radar, Database, Eye, Sparkles as SparklesIcon
} from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { BrandLogo } from '../common/BrandLogo';
import { DemoBanner } from '../common/DemoBanner';
import { CommandPalette } from './CommandPalette';
import { MobileAppHeader } from './MobileAppHeader';
import { MobileNavigationDrawer } from './MobileNavigationDrawer';
import { getUxText } from '../../i18n/mobileUx';
import {
  EXPERIENCE_PREVIEW_OPTIONS,
  ExperienceProfile,
  ExperienceView,
  getExperienceNavigationRouteIds,
} from '../../core/client/liveSurfacePolicy';

interface ShellProps {
  children: React.ReactNode;
  context: EffectiveEcosystemContext;
  currentLang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  onSelectOrg: (orgId: string) => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
  isLive?: boolean;
  showRadar?: boolean;
  experienceProfile?: ExperienceProfile;
  experienceView?: ExperienceView;
  canPreviewExperience?: boolean;
  onExperienceViewChange?: (view: ExperienceView) => void;
}

const radarLabels: Record<LanguageCode, string> = {
  'pt-BR': 'Radar',
  'en-US': 'Radar',
  'es-ES': 'Radar',
};

const sourceLabels: Record<LanguageCode, string> = {
  'pt-BR': 'Minhas fontes',
  'en-US': 'My sources',
  'es-ES': 'Mis fuentes',
};

const intelligenceLabels: Record<LanguageCode, string> = {
  'pt-BR': 'Inteligência',
  'en-US': 'Intelligence',
  'es-ES': 'Inteligencia',
};

const liveSearchLabels: Record<LanguageCode, string> = {
  'pt-BR': 'Perguntar ao Connect',
  'en-US': 'Ask Connect',
  'es-ES': 'Preguntar a Connect',
};

const liveFooterLabels: Record<LanguageCode, string> = {
  'pt-BR': 'MillionsNest Connect',
  'en-US': 'MillionsNest Connect',
  'es-ES': 'MillionsNest Connect',
};

type LiveNavSection = 'work' | 'relationship' | 'operations' | 'governance' | 'personal';
type LiveNavStatus = 'ready' | 'controlled' | 'next';

const sectionLabels: Record<LiveNavSection, Record<LanguageCode, string>> = {
  work: { 'pt-BR': 'Trabalho', 'en-US': 'Work', 'es-ES': 'Trabajo' },
  relationship: { 'pt-BR': 'Relacionamento', 'en-US': 'Relationships', 'es-ES': 'Relaciones' },
  operations: { 'pt-BR': 'Operação', 'en-US': 'Operations', 'es-ES': 'Operación' },
  governance: { 'pt-BR': 'Governança', 'en-US': 'Governance', 'es-ES': 'Gobernanza' },
  personal: { 'pt-BR': 'Meu espaço', 'en-US': 'My space', 'es-ES': 'Mi espacio' },
};

const profileLabels: Record<ExperienceView, Record<LanguageCode, string>> = {
  real: { 'pt-BR': 'Minha visão real', 'en-US': 'My real view', 'es-ES': 'Mi vista real' },
  ceo: { 'pt-BR': 'CEO', 'en-US': 'CEO', 'es-ES': 'CEO' },
  musician: { 'pt-BR': 'Músico', 'en-US': 'Musician', 'es-ES': 'Músico' },
  worship_leader: { 'pt-BR': 'Líder de louvor', 'en-US': 'Worship leader', 'es-ES': 'Líder de alabanza' },
  pastor_leader: { 'pt-BR': 'Pastor ou líder', 'en-US': 'Pastor or leader', 'es-ES': 'Pastor o líder' },
  support: { 'pt-BR': 'Atendimento', 'en-US': 'Support', 'es-ES': 'Atención' },
  commercial: { 'pt-BR': 'Comercial', 'en-US': 'Commercial', 'es-ES': 'Comercial' },
  organization_admin: { 'pt-BR': 'Administrador', 'en-US': 'Administrator', 'es-ES': 'Administrador' },
};

const previewLabels: Record<LanguageCode, { label: string; safe: string }> = {
  'pt-BR': { label: 'Visualizar como', safe: 'Somente experiência · suas permissões reais continuam inalteradas' },
  'en-US': { label: 'Preview as', safe: 'Experience preview only · your real permissions stay unchanged' },
  'es-ES': { label: 'Visualizar como', safe: 'Solo vista previa · tus permisos reales siguen sin cambios' },
};

const routeLabels: Record<string, Record<LanguageCode, string>> = {
  overview: { 'pt-BR': 'Início', 'en-US': 'Home', 'es-ES': 'Inicio' },
  inbox: { 'pt-BR': 'Caixa de entrada', 'en-US': 'Inbox', 'es-ES': 'Bandeja de entrada' },
  contacts: { 'pt-BR': 'Pessoas', 'en-US': 'People', 'es-ES': 'Personas' },
  assist: { 'pt-BR': 'Assist', 'en-US': 'Assist', 'es-ES': 'Assist' },
  radar: { 'pt-BR': 'Radar', 'en-US': 'Radar', 'es-ES': 'Radar' },
  opportunities: { 'pt-BR': 'Oportunidades', 'en-US': 'Opportunities', 'es-ES': 'Oportunidades' },
  playbooks: { 'pt-BR': 'Playbooks', 'en-US': 'Playbooks', 'es-ES': 'Playbooks' },
  composer: { 'pt-BR': 'Composer', 'en-US': 'Composer', 'es-ES': 'Composer' },
  intelligence: { 'pt-BR': 'Inteligência', 'en-US': 'Intelligence', 'es-ES': 'Inteligencia' },
  automations: { 'pt-BR': 'Automações', 'en-US': 'Automations', 'es-ES': 'Automatizaciones' },
  channels: { 'pt-BR': 'Canais', 'en-US': 'Channels', 'es-ES': 'Canales' },
  agents: { 'pt-BR': 'Agentes', 'en-US': 'Agents', 'es-ES': 'Agentes' },
  knowledge: { 'pt-BR': 'Conhecimento', 'en-US': 'Knowledge', 'es-ES': 'Conocimiento' },
  audit: { 'pt-BR': 'Auditoria', 'en-US': 'Audit', 'es-ES': 'Auditoría' },
  settings: { 'pt-BR': 'Configurações', 'en-US': 'Settings', 'es-ES': 'Configuración' },
  sources: { 'pt-BR': 'Fontes pessoais', 'en-US': 'Personal sources', 'es-ES': 'Fuentes personales' },
  imports: { 'pt-BR': 'Importações', 'en-US': 'Imports', 'es-ES': 'Importaciones' },
  preferences: { 'pt-BR': 'Preferências', 'en-US': 'Preferences', 'es-ES': 'Preferencias' },
};

export const Shell: React.FC<ShellProps> = ({
  children,
  context,
  currentLang,
  onChangeLang,
  onSelectOrg,
  activeRoute,
  onNavigate,
  isLive = false,
  showRadar = false,
  experienceProfile = 'musician',
  experienceView = 'real',
  canPreviewExperience = false,
  onExperienceViewChange,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopOrgMenuOpen, setIsDesktopOrgMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const t = getUxText(currentLang);

  const demoNavItems = [
    { id: 'overview', label: t.navigation.overview, icon: LayoutDashboard },
    { id: 'inbox', label: t.navigation.inbox, icon: MessageSquare },
    ...(showRadar ? [
      { id: 'radar', label: radarLabels[currentLang], icon: Radar },
      { id: 'sources', label: sourceLabels[currentLang], icon: Database },
      { id: 'intelligence', label: intelligenceLabels[currentLang], icon: BrainCircuit },
    ] : []),
    { id: 'tools', label: t.navigation.tools, icon: Wrench },
    { id: 'contacts', label: t.navigation.contacts, icon: Users },
    { id: 'agents', label: t.navigation.agents, icon: BrainCircuit },
    { id: 'knowledge', label: t.navigation.knowledge, icon: BookOpen },
    { id: 'automations', label: t.navigation.automations, icon: Workflow },
    { id: 'channels', label: t.navigation.channels, icon: Radio },
    { id: 'analytics', label: t.navigation.analytics, icon: LineChart },
    { id: 'audit', label: t.navigation.audit, icon: ShieldCheck },
    { id: 'settings', label: t.navigation.settings, icon: Settings },
  ];

  const liveNavItems = [
    { id: 'overview', icon: LayoutDashboard, section: 'work' as LiveNavSection, status: 'ready' as LiveNavStatus },
    { id: 'inbox', icon: MessageSquare, section: 'work' as LiveNavSection, status: 'controlled' as LiveNavStatus },
    { id: 'contacts', icon: Users, section: 'work' as LiveNavSection, status: 'ready' as LiveNavStatus },
    { id: 'assist', icon: MessageSquareText, section: 'work' as LiveNavSection, status: 'ready' as LiveNavStatus },
    { id: 'radar', icon: Radar, section: 'relationship' as LiveNavSection, status: 'ready' as LiveNavStatus },
    { id: 'opportunities', icon: Users, section: 'relationship' as LiveNavSection, status: 'controlled' as LiveNavStatus },
    { id: 'playbooks', icon: BookOpen, section: 'relationship' as LiveNavSection, status: 'controlled' as LiveNavStatus },
    { id: 'composer', icon: SparklesIcon, section: 'relationship' as LiveNavSection, status: 'controlled' as LiveNavStatus },
    { id: 'intelligence', icon: BrainCircuit, section: 'relationship' as LiveNavSection, status: 'ready' as LiveNavStatus },
    { id: 'automations', icon: Workflow, section: 'operations' as LiveNavSection, status: 'next' as LiveNavStatus },
    { id: 'channels', icon: Radio, section: 'operations' as LiveNavSection, status: 'next' as LiveNavStatus },
    { id: 'agents', icon: BrainCircuit, section: 'operations' as LiveNavSection, status: 'next' as LiveNavStatus },
    { id: 'knowledge', icon: BookOpen, section: 'operations' as LiveNavSection, status: 'next' as LiveNavStatus },
    { id: 'audit', icon: ShieldCheck, section: 'governance' as LiveNavSection, status: 'controlled' as LiveNavStatus },
    { id: 'settings', icon: Settings, section: 'governance' as LiveNavSection, status: 'controlled' as LiveNavStatus },
    { id: 'sources', icon: Database, section: 'personal' as LiveNavSection, status: 'ready' as LiveNavStatus },
    { id: 'imports', icon: Database, section: 'personal' as LiveNavSection, status: 'ready' as LiveNavStatus },
    { id: 'preferences', icon: Settings, section: 'personal' as LiveNavSection, status: 'controlled' as LiveNavStatus },
  ].map(item => ({ ...item, label: routeLabels[item.id][currentLang] }));

  const visibleLiveRouteIds = new Set(getExperienceNavigationRouteIds(experienceProfile, showRadar));
  const navItems = isLive
    ? liveNavItems.filter((item) => visibleLiveRouteIds.has(item.id))
    : demoNavItems;

  const liveSections: LiveNavSection[] = ['work', 'relationship', 'operations', 'governance', 'personal'];
  const bottomPriority = experienceProfile === 'commercial'
    ? ['overview', 'radar', 'contacts', 'assist']
    : experienceProfile === 'organization_admin'
      ? ['overview', 'inbox', 'contacts', 'assist']
      : ['overview', 'assist', 'inbox', 'contacts'];
  const bottomNavItems = isLive
    ? bottomPriority.map(id => navItems.find(item => item.id === id)).filter(Boolean) as typeof navItems
    : [];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0B0E14] overflow-x-hidden">
      {!isLive && <DemoBanner currentLang={currentLang} />}

      <div className="flex-1 min-h-0 flex flex-col">
        <MobileAppHeader
          className="lg:hidden"
          context={context}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
          currentLang={currentLang}
          onSelectOrg={onSelectOrg}
          isLive={isLive}
        />

        <MobileNavigationDrawer
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          context={context}
          navItems={navItems}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
          currentLang={currentLang}
          onChangeLang={onChangeLang}
        />

        <div className="flex-1 min-h-0 flex">
          <div className="hidden lg:flex w-64 flex-col bg-[#121824] border-r border-white/10 shrink-0">
            <div className="h-14 flex items-center gap-2 px-4 border-b border-white/10">
              <BrandLogo layout="horizontal" surface="dark" size="desktopWordmark" />
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <nav className="space-y-1 px-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeRoute === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-white/10 text-[10px] text-gray-500 text-center">
              {isLive ? (
                <>
                  <span>{liveFooterLabels[currentLang]}</span>
                  <br />
                  <span className="text-gray-600">{context.activeOrganization.name}</span>
                </>
              ) : (
                t.header.brandAuth.split('|').map((part, i) => (
                  <React.Fragment key={i}>
                    {part.trim()}
                    {i === 0 && <br />}
                  </React.Fragment>
                ))
              )}
            </div>
          </div>

          <section className="flex-1 min-w-0 min-h-0 flex flex-col">
            <header className="hidden lg:flex h-14 border-b border-white/10 bg-[#121824] px-4 items-center justify-between gap-4 shrink-0">
              <div className="relative flex items-center gap-3 min-w-0">
                {isLive ? (
                  <div
                    className="flex items-center gap-2 bg-[#1A2234] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200"
                    aria-label={t.header.activeOrganization}
                    title={t.header.activeOrganization}
                  >
                    <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-white max-w-[160px] truncate">
                      {context.activeOrganization.name}
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase font-mono">
                      {context.activeOrganization.plan}
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setIsDesktopOrgMenuOpen(!isDesktopOrgMenuOpen)}
                      className="flex items-center gap-2 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200 transition"
                      aria-expanded={isDesktopOrgMenuOpen}
                      aria-label={t.header.activeOrganization}
                    >
                      <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-semibold text-white max-w-[160px] truncate">
                        {context.activeOrganization.name}
                      </span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase font-mono">
                        {context.activeOrganization.plan}
                      </span>
                      {isDesktopOrgMenuOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {isDesktopOrgMenuOpen && (
                      <div className="absolute left-0 mt-2 w-64 bg-[#121824] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">
                          {t.header.organizations}
                        </div>
                        {context.availableOrganizations.map((org) => {
                          const isActive = org.id === context.activeOrganization.id;
                          return (
                            <button
                              key={org.id}
                              onClick={() => {
                                onSelectOrg(org.id);
                                setIsDesktopOrgMenuOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition ${
                                isActive ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-300'
                              }`}
                            >
                              <span className="font-medium truncate pr-2">{org.name}</span>
                              {isActive && (
                                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center flex-1 max-w-md">
                {isLive ? (
                  <div
                    className="w-full bg-[#1A2234] border border-white/10 text-gray-500 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-not-allowed"
                    aria-disabled="true"
                    title={liveSearchLabels[currentLang]}
                  >
                    <Search className="w-3.5 h-3.5 text-gray-500" />
                    <span>{liveSearchLabels[currentLang]}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="w-full bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-gray-400 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition group"
                    aria-label={t.header.openSearch}
                  >
                    <span className="flex items-center gap-2 group-hover:text-gray-200">
                      <Search className="w-3.5 h-3.5 text-gray-400" />
                      <span>{t.header.openSearch}</span>
                    </span>
                    <kbd className="bg-[#0B0E14] border border-white/10 text-[10px] px-1.5 py-0.5 rounded font-mono text-gray-400">
                      ⌘K
                    </kbd>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 bg-[#1A2234] border border-white/10 rounded-lg p-0.5 text-xs">
                  <Globe className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
                  {(['pt-BR', 'en-US', 'es-ES'] as LanguageCode[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => onChangeLang(lang)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                        currentLang === lang
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                      aria-pressed={currentLang === lang}
                    >
                      {lang.split('-')[0].toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="p-2 rounded-lg bg-[#1A2234] border border-white/10 text-gray-600 cursor-not-allowed transition relative"
                  aria-label={t.header.notificationsPlanned}
                  title={t.header.notificationsPlanned}
                  aria-disabled="true"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
                  {context.user.avatarUrl ? (
                    <img
                      src={context.user.avatarUrl}
                      alt={context.user.name}
                      className="w-8 h-8 rounded-full border border-indigo-500/50 object-cover"
                    />
                  ) : (
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-indigo-500/50 bg-indigo-500/10 text-[10px] font-bold text-indigo-200">
                      {context.user.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-gray-200 leading-tight">
                      {context.user.name}
                    </span>
                    <span className="text-[10px] text-indigo-400 font-mono">
                      {context.user.systemRole || t.drawer.noSystemRole}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col p-4 md:p-6">
              {children}
            </main>
          </section>
        </div>
      </div>

      {!isLive && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
