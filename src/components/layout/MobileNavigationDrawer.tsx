import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { getUxText } from '../../i18n/mobileUx';
import { BrandLogo } from '../common/BrandLogo';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: EffectiveEcosystemContext;
  navItems: Array<{ id: string; label: string; icon: React.ElementType }>;
  activeRoute: string;
  onNavigate: (route: string) => void;
  currentLang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
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
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const t = getUxText(currentLang);

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
            </div>

            {/* Navigation Links */}
            <div className="p-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.id;
                // Get localized label
                const label = t.navigation[item.id as keyof typeof t.navigation] || item.label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
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
              MillionsNest Connect • {t.drawer.demoVersion}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
