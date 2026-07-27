import React, { useState } from 'react';
import { 
  Menu, X, Search, Bell, Building2, Globe, ChevronDown, ChevronUp,
  LayoutDashboard, MessageSquare, Wrench, Users, BrainCircuit,
  Workflow, Radio, LineChart, ShieldCheck, Settings, BookOpen
} from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { DemoBanner } from '../common/DemoBanner';
import { CommandPalette } from './CommandPalette';
import { MobileAppHeader } from './MobileAppHeader';
import { MobileNavigationDrawer } from './MobileNavigationDrawer';
import { getUxText } from '../../i18n/mobileUx';

interface ShellProps {
  children: React.ReactNode;
  context: EffectiveEcosystemContext;
  currentLang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  onSelectOrg: (orgId: string) => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export const Shell: React.FC<ShellProps> = ({
  children,
  context,
  currentLang,
  onChangeLang,
  onSelectOrg,
  activeRoute,
  onNavigate,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopOrgMenuOpen, setIsDesktopOrgMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const t = getUxText(currentLang);

  const navItems = [
    { id: 'overview', label: t.navigation.overview, icon: LayoutDashboard },
    { id: 'inbox', label: t.navigation.inbox, icon: MessageSquare },
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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0B0E14] overflow-x-hidden">
      <DemoBanner currentLang={currentLang} />

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Mobile Header (Hidden on lg) */}
        <MobileAppHeader
          className="lg:hidden"
          context={context}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
          currentLang={currentLang}
          onSelectOrg={onSelectOrg}
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
          {/* Desktop Sidebar (Hidden on mobile/tablet) */}
          <div className="hidden lg:flex w-64 flex-col bg-[#121824] border-r border-white/10 shrink-0">
            <div className="h-14 flex items-center gap-2 px-4 border-b border-white/10">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                MN
              </div>
              <span className="font-bold text-sm text-white">Connect</span>
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
              {t.header.brandAuth.split('|').map((part, i) => (
                <React.Fragment key={i}>
                  {part.trim()}
                  {i === 0 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <section className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* Desktop Top Bar (Hidden on mobile/tablet) */}
            <header className="hidden lg:flex h-14 border-b border-white/10 bg-[#121824] px-4 items-center justify-between gap-4 shrink-0">
              {/* Left: Organization Selector */}
              <div className="relative flex items-center gap-3 min-w-0">
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
              </div>

              {/* Middle: Global Search Palette Trigger */}
              <div className="flex items-center flex-1 max-w-md">
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
              </div>

              {/* Right Controls: Language, Notifications, User */}
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
                  <img
                    src={context.user.avatarUrl}
                    alt={context.user.name}
                    className="w-8 h-8 rounded-full border border-indigo-500/50 object-cover"
                  />
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

            {/* Page Body */}
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col p-4 md:p-6">
              {children}
            </main>
          </section>
        </div>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
