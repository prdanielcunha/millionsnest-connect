/**
 * MillionsNest Connect - Main Layout Shell
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Radio,
  Users,
  Bot,
  BookOpen,
  Zap,
  Grid,
  Share2,
  BarChart2,
  ShieldCheck,
  Settings,
  FileText,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  Globe,
  Building2,
} from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { DemoBanner } from '../common/DemoBanner';
import { CommandPalette } from './CommandPalette';

interface ShellProps {
  context: EffectiveEcosystemContext;
  activeRoute: string;
  currentLang: LanguageCode;
  onNavigate: (route: string) => void;
  onSelectOrg: (orgId: string) => void;
  onChangeLang: (lang: LanguageCode) => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({
  context,
  activeRoute,
  currentLang,
  onNavigate,
  onSelectOrg,
  onChangeLang,
  children,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'inbox', label: 'Caixa de Entrada', icon: MessageSquare, badge: '3' },
    { id: 'menu', label: 'Menu Conversacional', icon: Radio },
    { id: 'contacts', label: 'Contatos', icon: Users },
    { id: 'agents', label: 'Agentes', icon: Bot },
    { id: 'knowledge', label: 'Conhecimento', icon: BookOpen },
    { id: 'automations', label: 'Automações', icon: Zap },
    { id: 'tools', label: 'Apps & Ferramentas', icon: Grid },
    { id: 'channels', label: 'Canais', icon: Share2 },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'docs', label: 'Docs Técnicos', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-gray-100 flex flex-col font-sans">
      {/* Top Demo Banner */}
      <DemoBanner />

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-col border-r border-white/10 bg-[#0E131F] transition-all duration-200 z-20 ${
            isSidebarOpen ? 'w-64' : 'w-20'
          }`}
        >
          {/* Brand Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
                MN
              </div>
              {isSidebarOpen && (
                <div className="flex flex-col">
                  <span className="font-bold text-sm tracking-wide text-white leading-none">
                    MillionsNest
                  </span>
                  <span className="text-[11px] font-medium text-cyan-400 tracking-wider uppercase mt-1">
                    Connect
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition"
              title={isSidebarOpen ? 'Recolher Menu' : 'Expandir Menu'}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition group ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                  title={!isSidebarOpen ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-400' : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                  />
                  {isSidebarOpen && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {isSidebarOpen && item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Context info */}
          {isSidebarOpen && (
            <div className="p-3 border-t border-white/10 bg-[#0B0E14]/50 text-[11px] text-gray-500 space-y-1">
              <div className="flex justify-between items-center">
                <span>Versão Connect</span>
                <span className="font-mono text-gray-400">v1.0.0-demo</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span>Ecosistema</span>
                <span className="text-cyan-400 font-medium">Canonical MN</span>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile Header & Drawer */}
        <div className="md:hidden bg-[#0E131F] border-b border-white/10 p-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
              MN
            </div>
            <span className="font-bold text-sm text-white">Connect</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-24 z-40 bg-[#0E131F] border-t border-white/10 p-4 overflow-y-auto">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-indigo-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar Header */}
          <header className="h-14 border-b border-white/10 bg-[#121824] px-4 flex items-center justify-between gap-4 shrink-0">
            {/* Left: Organization Selector & Context */}
            <div className="relative flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setIsOrgMenuOpen(!isOrgMenuOpen)}
                  className="flex items-center gap-2 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200 transition"
                >
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-white max-w-[160px] truncate">
                    {context.activeOrganization.name}
                  </span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30 uppercase font-mono">
                    {context.activeOrganization.plan}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {isOrgMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-[#121824] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">
                      Organizações do Ecossistema (Simuladas)
                    </div>
                    {context.availableOrganizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => {
                          onSelectOrg(org.id);
                          setIsOrgMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition ${
                          org.id === context.activeOrganization.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-300'
                        }`}
                      >
                        <span className="font-medium truncate">{org.name}</span>
                        {org.id === context.activeOrganization.id && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                        )}
                      </button>
                    ))}
                    <div className="p-2 border-t border-white/5 text-[10px] text-gray-500 text-center">
                      MillionsNest Canonical Authority
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Middle: Global Search Palette Trigger */}
            <div className="hidden sm:flex items-center flex-1 max-w-md">
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
            <div className="flex items-center gap-3">
              {/* Language Switcher */}
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
                  >
                    {lang.split('-')[0].toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Notifications */}
              <button className="p-2 rounded-lg bg-[#1A2234] border border-white/10 text-gray-400 hover:text-white transition relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400"></span>
              </button>

              {/* User Avatar */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
                <img
                  src={context.user.avatarUrl}
                  alt={context.user.name}
                  className="w-8 h-8 rounded-full border border-indigo-500/50 object-cover"
                />
                <div className="hidden lg:flex flex-col text-left">
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
          <main className="flex-1 overflow-y-auto bg-[#0B0E14] p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
