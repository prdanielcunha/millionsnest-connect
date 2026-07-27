const fs = require('fs');
const path = require('path');

// 3. Shell.tsx
fs.writeFileSync('src/components/layout/Shell.tsx', `import React, { useState } from 'react';
import { 
  Menu, X, Search, Bell, Building2, Globe, ChevronDown,
  LayoutDashboard, MessageSquare, Wrench, Users, BrainCircuit,
  Workflow, Radio, LineChart, ShieldCheck, Settings, BookOpen
} from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { DemoBanner } from '../common/DemoBanner';
import { CommandPalette } from './CommandPalette';
import { MobileAppHeader } from './MobileAppHeader';
import { MobileNavigationDrawer } from './MobileNavigationDrawer';

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
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'inbox', label: 'Caixa de Entrada', icon: MessageSquare },
    { id: 'tools', label: 'Tool Gateway', icon: Wrench },
    { id: 'contacts', label: 'Contatos', icon: Users },
    { id: 'agents', label: 'Agentes IA', icon: BrainCircuit },
    { id: 'knowledge', label: 'Conhecimento', icon: BookOpen },
    { id: 'automations', label: 'Automações', icon: Workflow },
    { id: 'channels', label: 'Canais', icon: Radio },
    { id: 'analytics', label: 'Métricas', icon: LineChart },
    { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0B0E14] overflow-x-hidden">
      <DemoBanner />

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Mobile Header (Hidden on lg) */}
        <MobileAppHeader
          className="lg:hidden"
          context={context}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isOrgMenuOpen={isOrgMenuOpen}
          setIsOrgMenuOpen={setIsOrgMenuOpen}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
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

        {/* Mobile Org Menu Dropdown overlay (only below header if open) */}
        {isOrgMenuOpen && (
          <div className="lg:hidden absolute top-[104px] inset-x-0 mx-4 z-40">
             <div className="bg-[#121824] border border-white/10 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100">
               <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">
                 Organizações (Simuladas)
               </div>
               {context.availableOrganizations.map((org) => (
                 <button
                   key={org.id}
                   onClick={() => {
                     onSelectOrg(org.id);
                     setIsOrgMenuOpen(false);
                   }}
                   className={\`w-full text-left px-3 py-3 text-xs flex items-center justify-between hover:bg-white/5 transition \${
                     org.id === context.activeOrganization.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-300'
                   }\`}
                 >
                   <span className="font-medium truncate">{org.name}</span>
                   {org.id === context.activeOrganization.id && (
                     <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                   )}
                 </button>
               ))}
             </div>
          </div>
        )}

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
                      className={\`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition \${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-gray-300 hover:bg-white/5'
                      }\`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            
            <div className="p-4 border-t border-white/10 text-[10px] text-gray-500 text-center">
              Contexto demonstrativo<br />Autoridade: MillionsNest
            </div>
          </div>

          <section className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* Desktop Top Bar (Hidden on mobile/tablet) */}
            <header className="hidden lg:flex h-14 border-b border-white/10 bg-[#121824] px-4 items-center justify-between gap-4 shrink-0">
              {/* Left: Organization Selector */}
              <div className="relative flex items-center gap-3 min-w-0">
                <div className="relative">
                  <button
                    onClick={() => setIsOrgMenuOpen(!isOrgMenuOpen)}
                    className="flex items-center gap-2 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200 transition"
                  >
                    <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-white max-w-[160px] truncate">
                      {context.activeOrganization.name}
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase font-mono">
                      {context.activeOrganization.plan}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </button>
                  {isOrgMenuOpen && (
                    <div className="absolute left-0 mt-2 w-64 bg-[#121824] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">
                        Organizações (Simuladas)
                      </div>
                      {context.availableOrganizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => {
                            onSelectOrg(org.id);
                            setIsOrgMenuOpen(false);
                          }}
                          className={\`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition \${
                            org.id === context.activeOrganization.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-300'
                          }\`}
                        >
                          <span className="font-medium truncate">{org.name}</span>
                          {org.id === context.activeOrganization.id && (
                            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Middle: Global Search Palette Trigger */}
              <div className="flex items-center flex-1 max-w-md">
                <button
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="w-full bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-gray-400 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition group"
                >
                  <span className="flex items-center gap-2 group-hover:text-gray-200">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    <span>Buscar páginas, ferramentas, contatos (Cmd+K)...</span>
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
                      className={\`px-2 py-1 rounded text-[11px] font-medium transition \${
                        currentLang === lang
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-gray-400 hover:text-gray-200'
                      }\`}
                    >
                      {lang.split('-')[0].toUpperCase()}
                    </button>
                  ))}
                </div>
                <button className="p-2 rounded-lg bg-[#1A2234] border border-white/10 text-gray-400 hover:text-white transition relative">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400"></span>
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
                      {context.user.systemRole}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* Page Body */}
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-6">
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
`);

// 4. DemoBanner.tsx
fs.writeFileSync('src/components/common/DemoBanner.tsx', `import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, Database, Info, ChevronDown, ChevronUp } from 'lucide-react';

export const DemoBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-amber-950/40 border-b border-amber-500/20 text-amber-200/90 shrink-0">
      {/* Mobile/Tablet Compact View */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300 truncate">DEMO_MODE • Dados simulados</span>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-medium text-amber-300/80 hover:text-amber-300 flex items-center gap-1 shrink-0 ml-2"
          aria-expanded={isExpanded}
        >
          Detalhes {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded Mobile Details */}
      {isExpanded && (
        <div className="lg:hidden px-4 pb-3 pt-1 text-[11px] text-amber-200/80 space-y-2 border-t border-amber-500/10 mt-1">
          <p>Ambiente de simulação visual e arquitetônica. Dados isolados em memória.</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Nenhuma API ou banco real conectado.</li>
            <li>Nenhuma integração externa ativa.</li>
            <li>Autorização real futura será server-side.</li>
          </ul>
        </div>
      )}

      {/* Desktop View */}
      <div className="hidden lg:flex px-4 py-2 text-xs flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300">DEMO_MODE ATIVO:</span>
          <span>
            Ambiente de simulação visual e arquitetônica. Dados isolados em memória. Nenhuma chave API, banco real ou integração externa conectada.
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-amber-400/80">
          <span className="inline-flex items-center gap-1">
            <Database className="w-3 h-3" /> Mocks Locais
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> RBAC Simulado
          </span>
          <span className="inline-flex items-center gap-1">
            <Info className="w-3 h-3" /> Tool Gateway simulado
          </span>
        </div>
      </div>
    </div>
  );
};
`);
