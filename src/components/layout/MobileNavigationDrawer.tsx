import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { getUxText } from '../../i18n/mobileUx';
import { BrandLogo } from '../common/BrandLogo';
import { EXPERIENCE_PREVIEW_OPTIONS, ExperienceView } from '../../core/client/liveSurfacePolicy';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: EffectiveEcosystemContext;
  navItems: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    section?: string;
    status?: 'ready' | 'controlled' | 'next';
  }>;
  activeRoute: string;
  onNavigate: (route: string) => void;
  currentLang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  isLive?: boolean;
  experienceView?: ExperienceView;
  canPreviewExperience?: boolean;
  onExperienceViewChange?: (view: ExperienceView) => void;
}

export const MobileNavigationDrawer: React.FC<MobileNavigationDrawerProps> = ({
  isOpen,
  onClose,
  context,
  navItems,
  activeRoute,
  onNavigate,
  currentLang,
  onChangeLang,
  isLive = false,
  experienceView = 'real',
  canPreviewExperience = false,
  onExperienceViewChange,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const t = getUxText(currentLang);
  const sectionNames: Record<string, Record<LanguageCode, string>> = {
    work: { 'pt-BR': 'Trabalho', 'en-US': 'Work', 'es-ES': 'Trabajo' },
    relationship: { 'pt-BR': 'Relacionamento', 'en-US': 'Relationships', 'es-ES': 'Relaciones' },
    operations: { 'pt-BR': 'Operação', 'en-US': 'Operations', 'es-ES': 'Operación' },
    governance: { 'pt-BR': 'Governança', 'en-US': 'Governance', 'es-ES': 'Gobernanza' },
    personal: { 'pt-BR': 'Meu espaço', 'en-US': 'My space', 'es-ES': 'Mi espacio' },
  };
  const previewNames: Record<ExperienceView, Record<LanguageCode, string>> = {
    real: { 'pt-BR': 'Minha visão real', 'en-US': 'My real view', 'es-ES': 'Mi vista real' },
    ceo: { 'pt-BR': 'CEO', 'en-US': 'CEO', 'es-ES': 'CEO' },
    musician: { 'pt-BR': 'Músico', 'en-US': 'Musician', 'es-ES': 'Músico' },
    worship_leader: { 'pt-BR': 'Líder de louvor', 'en-US': 'Worship leader', 'es-ES': 'Líder de alabanza' },
    pastor_leader: { 'pt-BR': 'Pastor ou líder', 'en-US': 'Pastor or leader', 'es-ES': 'Pastor o líder' },
    support: { 'pt-BR': 'Atendimento', 'en-US': 'Support', 'es-ES': 'Atención' },
    commercial: { 'pt-BR': 'Comercial', 'en-US': 'Commercial', 'es-ES': 'Comercial' },
    organization_admin: { 'pt-BR': 'Administrador', 'en-US': 'Administrator', 'es-ES': 'Administrador' },
  };

  // Focus trap and escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll and initial focus
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      closeBtnRef.current?.focus();

      return () => {
        document.body.style.overflow = originalOverflow;
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.drawer.title}
      className="fixed inset-0 z-50 flex lg:hidden"
      id="mobile-navigation-drawer"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Drawer */}
      <div
        ref={dialogRef}
        className="relative flex flex-col w-4/5 max-w-sm h-full bg-[#0E131F] border-r border-white/10 shadow-2xl animate-in slide-in-from-left duration-200"
      >
        {/* Header - added pt-[env(safe-area-inset-top)] if needed, but usually safe area is outside. Let's add it to the wrapper if needed, but typically browsers handle top safe area on fixed full-height elements. Let's just add safe-area insets. */}
        <div className="pt-[env(safe-area-inset-top)] flex flex-col h-full">
          <div className="h-14 px-2 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center pl-2">
              <BrandLogo layout="horizontal" surface="dark" size="drawerWordmark" />
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={t.drawer.close}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* User & Org Context */}
            <div className="p-4 border-b border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={context.user.avatarUrl}
                  alt={context.user.name}
                  className="w-10 h-10 rounded-full border border-indigo-500/50 object-cover"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-gray-200 truncate">
                    {context.user.name}
                  </span>
                  <span className="text-[11px] text-indigo-400 font-mono truncate">
                    {context.user.systemRole || t.drawer.noSystemRole}
                  </span>
                </div>
              </div>

              {context.mode === 'DEMO_MODE' && (
                <div className="bg-amber-950/40 border border-amber-500/20 text-amber-300 text-[11px] px-2 py-1 rounded font-medium">
                  {t.drawer.demoMode}
                </div>
              )}
              {isLive && canPreviewExperience && onExperienceViewChange && (
                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {currentLang === 'pt-BR' ? 'Visualizar experiência como' : currentLang === 'es-ES' ? 'Visualizar experiencia como' : 'Preview experience as'}
                  </span>
                  <select
                    value={experienceView}
                    onChange={(event) => onExperienceViewChange(event.target.value as ExperienceView)}
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-[#151c2a] px-3 text-xs font-medium text-slate-200 outline-none focus:border-indigo-400/40"
                  >
                    {EXPERIENCE_PREVIEW_OPTIONS.map((view) => (
                      <option key={view} value={view}>{previewNames[view][currentLang]}</option>
                    ))}
                  </select>
                  <span className="mt-2 block text-[10px] leading-4 text-slate-600">
                    {currentLang === 'pt-BR'
                      ? 'Somente visualização. Seu cargo e suas permissões reais não mudam.'
                      : currentLang === 'es-ES'
                        ? 'Solo visualización. Tu rol y permisos reales no cambian.'
                        : 'Preview only. Your real role and permissions do not change.'}
                  </span>
                </label>
              )}
            </div>

            {/* Navigation Links */}
            <div className="p-2">
              {(isLive
                ? Array.from(new Set(navItems.map((item) => item.section).filter(Boolean)))
                : [undefined]
              ).map((section) => {
                const items = isLive ? navItems.filter((item) => item.section === section) : navItems;
                if (!items.length) return null;
                return (
                  <div key={section || 'demo'} className="mb-3">
                    {isLive && section && (
                      <div className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {sectionNames[String(section)]?.[currentLang] || String(section)}
                      </div>
                    )}
                    <div className="space-y-1">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeRoute === item.id;
                        const label = isLive ? item.label : (t.navigation[item.id as keyof typeof t.navigation] || item.label);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onNavigate(item.id);
                              onClose();
                            }}
                            aria-current={isActive ? 'page' : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                              isActive
                                ? 'bg-indigo-500/14 text-indigo-200 ring-1 ring-indigo-400/20'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <Icon className="w-5 h-5 text-indigo-300/80 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                            {isLive && item.status !== 'ready' && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer (Languages & Version) */}
          <div className="p-4 border-t border-white/10 shrink-0 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2 bg-[#1A2234] border border-white/10 rounded-lg p-1 text-xs">
              {(['pt-BR', 'en-US', 'es-ES'] as LanguageCode[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onChangeLang(lang)}
                  className={`flex-1 py-2 min-h-[44px] rounded text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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
            <div className="text-[10px] text-center text-gray-500">
              {isLive ? 'MillionsNest Connect' : `MillionsNest Connect • ${t.drawer.demoVersion}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
