import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      closeBtnRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu principal"
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
        {/* Header */}
        <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-[10px]">
              MN
            </div>
            <span className="font-bold text-sm text-white">Connect</span>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-safe">
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
                  {context.user.systemRole}
                </span>
              </div>
            </div>

            {context.mode === 'DEMO_MODE' && (
              <div className="bg-amber-950/40 border border-amber-500/20 text-amber-300 text-[11px] px-2 py-1 rounded font-medium">
                DEMO_MODE • Simulador Ativo
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="p-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer (Languages & Version) */}
        <div className="p-4 border-t border-white/10 shrink-0 space-y-4">
          <div className="flex items-center gap-2 bg-[#1A2234] border border-white/10 rounded-lg p-1 text-xs">
            {(['pt-BR', 'en-US', 'es-ES'] as LanguageCode[]).map((lang) => (
              <button
                key={lang}
                onClick={() => onChangeLang(lang)}
                className={`flex-1 py-1.5 rounded text-[11px] font-medium transition ${
                  currentLang === lang
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {lang.split('-')[0].toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-center text-gray-500">
            MillionsNest Connect v1.0.0
          </div>
        </div>
      </div>
    </div>
  );
};
