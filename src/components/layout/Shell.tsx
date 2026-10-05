import React, { useState } from 'react';
import {
  Search,
  Bell,
  Building2,
  Globe,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  MessageSquare,
  MessageSquareText,
  Wrench,
  Users,
  BrainCircuit,
  Workflow,
  Radio,
  LineChart,
  ShieldCheck,
  Settings,
  BookOpen,
  Radar,
  Database,
  Eye,
  Code2,
  Briefcase,
  MoreHorizontal,
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

type LiveNavSection = 'work' | 'relationship' | 'operations' | 'knowledge' | 'governance' | 'personal';
type LiveNavStatus = 'ready' | 'controlled' | 'next';

type LiveNavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  section: LiveNavSection;
  status: LiveNavStatus;
  childRoutes?: string[];
};

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
  'pt-BR': 'Buscar pessoas, conversas e ações',
  'en-US': 'Search people, conversations and actions',
  'es-ES': 'Buscar personas, conversaciones y acciones',
};

const liveFooterLabels: Record<LanguageCode, string> = {
  'pt-BR': 'Conhecimento e ferramentas',
  'en-US': 'Knowledge and tools',
  'es-ES': 'Conocimiento y herramientas',
};

const sectionLabels: Record<LiveNavSection, Record<LanguageCode, string>> = {
  work: { 'pt-BR': 'Trabalho', 'en-US': 'Work', 'es-ES': 'Trabajo' },
  relationship: { 'pt-BR': 'Relacionamento', 'en-US': 'Relationships', 'es-ES': 'Relaciones' },
  operations: { 'pt-BR': 'Operação', 'en-US': 'Operations', 'es-ES': 'Operación' },
  knowledge: { 'pt-BR': 'Conhecimento e ferramentas', 'en-US': 'Knowledge & tools', 'es-ES': 'Conocimiento y herramientas' },
  governance: { 'pt-BR': 'Governança', 'en-US': 'Governance', 'es-ES': 'Gobernanza' },
  personal: { 'pt-BR': 'Meu espaço', 'en-US': 'My space', 'es-ES': 'Mi espacio' },
};

const profileLabels: Record<ExperienceView, Record<LanguageCode, string>> = {
  real: { 'pt-BR': 'Minha visão real', 'en-US': 'My real view', 'es-ES': 'Mi vista real' },
  ceo: { 'pt-BR': 'Visão CEO', 'en-US': 'CEO view', 'es-ES': 'Vista CEO' },
  musician: { 'pt-BR': 'Músico', 'en-US': 'Musician', 'es-ES': 'Músico' },
  worship_leader: { 'pt-BR': 'Líder de louvor', 'en-US': 'Worship leader', 'es-ES': 'Líder de alabanza' },
  pastor_leader: { 'pt-BR': 'Pastor ou líder', 'en-US': 'Pastor or leader', 'es-ES': 'Pastor o líder' },
  support: { 'pt-BR': 'Atendimento', 'en-US': 'Support', 'es-ES': 'Atención' },
  commercial: { 'pt-BR': 'Comercial', 'en-US': 'Commercial', 'es-ES': 'Comercial' },
  organization_admin: { 'pt-BR': 'Administrador', 'en-US': 'Administrator', 'es-ES': 'Administrador' },
};

const previewLabels: Record<LanguageCode, { label: string; safe: string; exit: string }> = {
  'pt-BR': {
    label: 'Visualizar como',
    safe: 'Prévia de experiência — suas permissões reais não mudam',
    exit: 'Voltar à minha visão',
  },
  'en-US': {
    label: 'Preview as',
    safe: 'Experience preview — your real permissions do not change',
    exit: 'Back to my view',
  },
  'es-ES': {
    label: 'Visualizar como',
    safe: 'Vista previa de experiencia — tus permisos reales no cambian',
    exit: 'Volver a mi vista',
  },
};

const routeLabels: Record<string, Record<LanguageCode, string>> = {
  overview: { 'pt-BR': 'Seu dia', 'en-US': 'Your day', 'es-ES': 'Tu día' },
  inbox: { 'pt-BR': 'Atendimento', 'en-US': 'Support', 'es-ES': 'Atención' },
  contacts: { 'pt-BR': 'Pessoas', 'en-US': 'People', 'es-ES': 'Personas' },
  assist: { 'pt-BR': 'Assist', 'en-US': 'Assist', 'es-ES': 'Assist' },
  radar: { 'pt-BR': 'Radar', 'en-US': 'Radar', 'es-ES': 'Radar' },
  opportunities: { 'pt-BR': 'Comercial', 'en-US': 'Commercial', 'es-ES': 'Comercial' },
  playbooks: { 'pt-BR': 'Playbooks', 'en-US': 'Playbooks', 'es-ES': 'Playbooks' },
  composer: { 'pt-BR': 'Composer', 'en-US': 'Composer', 'es-ES': 'Composer' },
  intelligence: { 'pt-BR': 'Inteligência', 'en-US': 'Intelligence', 'es-ES': 'Inteligencia' },
  automations: { 'pt-BR': 'Automações', 'en-US': 'Automations', 'es-ES': 'Automatizaciones' },
  channels: { 'pt-BR': 'Canais', 'en-US': 'Channels', 'es-ES': 'Canales' },
  agents: { 'pt-BR': 'Agentes', 'en-US': 'Agents', 'es-ES': 'Agentes' },
  knowledge: { 'pt-BR': 'Conhecimento', 'en-US': 'Knowledge', 'es-ES': 'Conocimiento' },
  audit: { 'pt-BR': 'Auditoria', 'en-US': 'Audit', 'es-ES': 'Auditoría' },
  settings: { 'pt-BR': 'Políticas', 'en-US': 'Policies', 'es-ES': 'Políticas' },
  developer: { 'pt-BR': 'Central do desenvolvedor', 'en-US': 'Developer Center', 'es-ES': 'Central del desarrollador' },
  sources: { 'pt-BR': 'Fontes pessoais', 'en-US': 'Personal sources', 'es-ES': 'Fuentes personales' },
  imports: { 'pt-BR': 'Importações', 'en-US': 'Imports', 'es-ES': 'Importaciones' },
  preferences: { 'pt-BR': 'Preferências', 'en-US': 'Preferences', 'es-ES': 'Preferencias' },
};

const mobileLabels: Record<LanguageCode, { home: string; conversations: string; assist: string; more: string }> = {
  'pt-BR': { home: 'Início', conversations: 'Conversas', assist: 'Assist', more: 'Mais' },
  'en-US': { home: 'Home', conversations: 'Conversations', assist: 'Assist', more: 'More' },
  'es-ES': { home: 'Inicio', conversations: 'Conversaciones', assist: 'Assist', more: 'Más' },
};

function isCommercialRoute(route: string) {
  return ['opportunities', 'playbooks', 'composer'].includes(route);
}

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

  const liveNavItems: LiveNavItem[] = [
    { id: 'overview', label: routeLabels.overview[currentLang], icon: LayoutDashboard, section: 'work', status: 'ready' },
    { id: 'inbox', label: routeLabels.inbox[currentLang], icon: MessageSquare, section: 'work', status: 'controlled' },
    { id: 'contacts', label: routeLabels.contacts[currentLang], icon: Users, section: 'work', status: 'ready' },
    { id: 'assist', label: routeLabels.assist[currentLang], icon: MessageSquareText, section: 'work', status: 'ready' },
    { id: 'radar', label: routeLabels.radar[currentLang], icon: Radar, section: 'relationship', status: 'ready' },
    {
      id: 'opportunities',
      label: routeLabels.opportunities[currentLang],
      icon: Briefcase,
      section: 'relationship',
      status: 'ready',
      childRoutes: ['followups', 'playbooks', 'composer'],
    },
    { id: 'channels', label: routeLabels.channels[currentLang], icon: Radio, section: 'operations', status: 'ready' },
    { id: 'agents', label: routeLabels.agents[currentLang], icon: BrainCircuit, section: 'operations', status: 'next' },
    { id: 'automations', label: routeLabels.automations[currentLang], icon: Workflow, section: 'operations', status: 'controlled' },
    { id: 'knowledge', label: routeLabels.knowledge[currentLang], icon: BookOpen, section: 'knowledge', status: 'next' },
    { id: 'settings', label: routeLabels.settings[currentLang], icon: Settings, section: 'knowledge', status: 'controlled' },
    { id: 'audit', label: routeLabels.audit[currentLang], icon: ShieldCheck, section: 'governance', status: 'ready' },
    { id: 'developer', label: routeLabels.developer[currentLang], icon: Code2, section: 'governance', status: 'ready' },
    { id: 'sources', label: routeLabels.sources[currentLang], icon: Database, section: 'personal', status: 'ready' },
    { id: 'imports', label: routeLabels.imports[currentLang], icon: Database, section: 'personal', status: 'ready' },
    { id: 'preferences', label: routeLabels.preferences[currentLang], icon: Settings, section: 'personal', status: 'controlled' },
  ];

  const visibleLiveRouteIds = new Set(getExperienceNavigationRouteIds(experienceProfile, showRadar));
  const navItems = isLive
    ? liveNavItems.filter((item) => visibleLiveRouteIds.has(item.id))
    : demoNavItems;

  const liveSections: LiveNavSection[] = ['work', 'relationship', 'operations', 'knowledge', 'governance', 'personal'];

  const selectOrganization = (orgId: string) => {
    onSelectOrg(orgId);
    setIsDesktopOrgMenuOpen(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0B1018] overflow-x-hidden">
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
          onNavigate={onNavigate}
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
          isLive={isLive}
          experienceView={experienceView}
          canPreviewExperience={canPreviewExperience}
          onExperienceViewChange={onExperienceViewChange}
        />

        <div className="flex-1 min-h-0 flex">
          <aside className="hidden lg:flex w-[224px] flex-col connect-shell-panel border-r shrink-0">
            <div className="flex h-[62px] items-center px-4 border-b connect-divider">
              <BrandLogo layout="horizontal" surface="dark" size="desktopWordmark" />
            </div>

            <div className="flex-1 overflow-y-auto py-5">
              <nav className="px-3">
                {isLive ? liveSections.map((section) => {
                  const items = liveNavItems.filter(
                    (item) => item.section === section && visibleLiveRouteIds.has(item.id),
                  );
                  if (!items.length) return null;

                  return (
                    <div key={section} className="mb-5">
                      <div className="px-2.5 pb-2 text-[9px] font-semibold uppercase tracking-[0.17em] text-[#6E8297]">
                        {sectionLabels[section][currentLang]}
                      </div>
                      <div className="space-y-0.5">
                        {items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeRoute === item.id || Boolean(item.childRoutes?.includes(activeRoute));
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onNavigate(item.id)}
                              className={`connect-focus group relative flex min-h-10 w-full items-center gap-3 rounded-[10px] px-2.5 text-[13px] font-medium transition ${isActive
                                ? 'bg-[#163442]/70 text-[#EAFBFF]'
                                : 'text-[#9FB0C2] hover:bg-white/[0.035] hover:text-[#F2F5FA]'}`}
                              aria-current={isActive ? 'page' : undefined}
                            >
                              {isActive && <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-[#66D9EF] shadow-[0_0_14px_rgba(102,217,239,.38)]" />}
                              <Icon className={`h-[16px] w-[16px] shrink-0 ${isActive ? 'text-[#66D9EF]' : 'text-[#7890A7] group-hover:text-[#B7C7D7]'}`} />
                              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                              {item.status !== 'ready' && (
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.status === 'controlled' ? 'bg-[#F1C77A]/75' : 'bg-[#506277]'}`}
                                  title={item.status === 'controlled' ? 'Ativação controlada' : 'Próxima fase'}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeRoute === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => onNavigate(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${isActive
                            ? 'bg-[#163442] text-[#EAFBFF] border border-[#66D9EF]/20'
                            : 'text-gray-300 hover:bg-white/5'}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </nav>
            </div>

            {isLive && (
              <div className="border-t connect-divider px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => onNavigate('knowledge')}
                  className="connect-focus flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left text-[10px] text-[#71849A] hover:text-[#AFC0D1]"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{liveFooterLabels[currentLang]}</span>
                </button>
                <div className="mt-1 truncate px-1 text-[9px] text-[#4F6073]">{context.activeOrganization.name}</div>
              </div>
            )}
          </aside>

          <section className="flex-1 min-w-0 min-h-0 flex flex-col">
            <header className="hidden lg:flex h-[62px] border-b connect-divider bg-[#0D151F]/95 px-5 items-center gap-5 shrink-0">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDesktopOrgMenuOpen((open) => !open)}
                  className="connect-focus flex min-h-9 min-w-[190px] max-w-[250px] items-center gap-2.5 rounded-[9px] border border-[#2B3A4D] bg-[#111A27] px-3 text-xs text-[#D5DEE8] transition hover:border-[#3D5369] hover:bg-[#162131]"
                  aria-expanded={isDesktopOrgMenuOpen}
                  aria-label={t.header.activeOrganization}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-[#8FA6BB]" />
                  <span className="min-w-0 flex-1 truncate text-left font-semibold text-[#EEF4F8]">{context.activeOrganization.name}</span>
                  {isDesktopOrgMenuOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {isDesktopOrgMenuOpen && (
                  <div className="absolute left-0 top-[calc(100%+.5rem)] z-50 w-[280px] overflow-hidden rounded-xl border border-[#304256] bg-[#111A27]/98 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.48)] backdrop-blur-xl">
                    <div className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#6F8194]">
                      {t.header.organizations}
                    </div>
                    {context.availableOrganizations.map((org) => {
                      const isActive = org.id === context.activeOrganization.id;
                      return (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => selectOrganization(org.id)}
                          className={`connect-focus flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-xs transition ${isActive ? 'bg-[#163442]/70 text-white' : 'text-[#AAB8C9] hover:bg-white/[0.04]'}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-[#66D9EF]' : 'bg-[#45586B]'}`} />
                          <span className="min-w-0 flex-1 truncate font-medium">{org.name}</span>
                          {isActive && <span className="text-[9px] uppercase tracking-[.1em] text-[#76D9EC]">{org.plan}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => isLive ? onNavigate('assist') : setIsCommandPaletteOpen(true)}
                  className="connect-focus flex h-9 w-full max-w-[500px] items-center gap-2 rounded-[9px] border border-[#26384A] bg-[#111A27] px-3 text-left text-xs text-[#7F92A7] transition hover:border-[#3A5168] hover:text-[#AFC1D3]"
                  aria-label={isLive ? liveSearchLabels[currentLang] : t.header.openSearch}
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{isLive ? liveSearchLabels[currentLang] : t.header.openSearch}</span>
                  <kbd className="rounded border border-[#2C3D4F] bg-[#0B1018] px-1.5 py-0.5 font-mono text-[9px] text-[#627589]">⌘K</kbd>
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isLive && canPreviewExperience && onExperienceViewChange && (
                  <label className="connect-focus hidden min-h-9 items-center gap-2 rounded-[9px] border border-[#2B3A4D] bg-[#111A27] px-2.5 xl:flex">
                    <Eye className="h-3.5 w-3.5 text-[#66D9EF]" />
                    <select
                      value={experienceView}
                      onChange={(event) => onExperienceViewChange(event.target.value as ExperienceView)}
                      className="max-w-[132px] bg-transparent text-[11px] font-semibold text-[#D8E3EC] outline-none"
                      aria-label={previewLabels[currentLang].label}
                    >
                      {EXPERIENCE_PREVIEW_OPTIONS.map((view) => (
                        <option key={view} value={view} className="bg-[#111A27] text-slate-200">
                          {profileLabels[view][currentLang]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="flex h-9 items-center rounded-[9px] border border-[#2B3A4D] bg-[#111A27] px-1">
                  <Globe className="ml-1 h-3.5 w-3.5 text-[#71859A]" />
                  {(['pt-BR', 'en-US', 'es-ES'] as LanguageCode[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => onChangeLang(lang)}
                      className={`connect-focus rounded-md px-1.5 py-1 text-[9px] font-semibold transition ${currentLang === lang ? 'bg-[#163442] text-[#A9F0FB]' : 'text-[#708398] hover:text-[#AFBECD]'}`}
                      aria-pressed={currentLang === lang}
                    >
                      {lang.split('-')[0].toUpperCase()}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled
                  className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#2B3A4D] bg-[#111A27] text-[#526579]"
                  aria-label={t.header.notificationsPlanned}
                  title={t.header.notificationsPlanned}
                  aria-disabled="true"
                >
                  <Bell className="h-4 w-4" />
                </button>

                <div className="ml-1 flex items-center gap-2.5 border-l border-[#27384A] pl-3">
                  {context.user.avatarUrl ? (
                    <img
                      src={context.user.avatarUrl}
                      alt={context.user.name}
                      className="h-8 w-8 rounded-full border border-[#66D9EF]/25 object-cover"
                    />
                  ) : (
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-[#66D9EF]/25 bg-[#163442] text-[10px] font-bold text-[#A7EEF9]">
                      {context.user.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden max-w-[126px] flex-col xl:flex">
                    <span className="truncate text-[11px] font-semibold leading-tight text-[#EEF4F8]">{context.user.name}</span>
                    <span className="mt-0.5 truncate text-[9px] text-[#6F8298]">
                      {isLive ? profileLabels[experienceProfile][currentLang] : (context.user.systemRole || t.drawer.noSystemRole)}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {isLive && canPreviewExperience && experienceView !== 'real' && (
              <div className="flex min-h-9 items-center justify-between gap-3 border-b border-[#66D9EF]/10 bg-[#163442]/35 px-4 text-[10px] text-[#B7EFF7] lg:px-6">
                <span className="flex min-w-0 items-center gap-2">
                  <Eye className="h-3.5 w-3.5 shrink-0 text-[#66D9EF]" />
                  <strong className="truncate">{profileLabels[experienceView][currentLang]}</strong>
                  <span className="hidden text-[#7EA4B1] sm:inline">· {previewLabels[currentLang].safe}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onExperienceViewChange?.('real')}
                  className="connect-focus shrink-0 rounded-md px-2 py-1 font-semibold text-[#BDEFF7] hover:bg-white/[0.04]"
                >
                  {previewLabels[currentLang].exit}
                </button>
              </div>
            )}

            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col p-3 pb-24 sm:p-4 md:p-5 lg:p-6 lg:pb-6">
              {children}
            </main>
          </section>
        </div>
      </div>

      {isLive && (
        <nav className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-30 mx-auto grid max-w-md grid-cols-4 rounded-[18px] border border-[#304256] bg-[#0D151F]/95 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-2xl lg:hidden" aria-label="Navegação rápida">
          {[
            { id: 'overview', label: mobileLabels[currentLang].home, icon: LayoutDashboard, action: () => onNavigate('overview') },
            { id: 'inbox', label: mobileLabels[currentLang].conversations, icon: MessageSquare, action: () => onNavigate('inbox') },
            { id: 'assist', label: mobileLabels[currentLang].assist, icon: MessageSquareText, action: () => onNavigate('assist') },
            { id: 'more', label: mobileLabels[currentLang].more, icon: MoreHorizontal, action: () => setIsMobileMenuOpen(true) },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'more'
              ? false
              : item.id === 'inbox'
                ? activeRoute === 'inbox'
                : item.id === 'overview'
                  ? activeRoute === 'overview'
                  : activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                aria-current={isActive ? 'page' : undefined}
                className={`connect-focus flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[13px] px-1 text-[9px] font-medium transition ${isActive ? 'bg-[#163442]/80 text-white' : 'text-[#71849A]'}`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#66D9EF]' : ''}`} />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

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
