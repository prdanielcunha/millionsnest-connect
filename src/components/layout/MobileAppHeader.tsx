import React, { useState } from 'react';
import { Menu, Search, Bell, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { getUxText } from '../../i18n/mobileUx';
import { BrandLogo } from '../common/BrandLogo';

interface MobileAppHeaderProps {
  context: EffectiveEcosystemContext;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  setIsCommandPaletteOpen: (isOpen: boolean) => void;
  currentLang: LanguageCode;
  onSelectOrg: (orgId: string) => void;
  onNavigate?: (route: string) => void;
  isLive?: boolean;
  className?: string;
}

const liveSearchLabels: Record<LanguageCode, string> = {
  'pt-BR': 'Perguntar ao Connect',
  'en-US': 'Ask Connect',
  'es-ES': 'Preguntar a Connect',
};

export const MobileAppHeader: React.FC<MobileAppHeaderProps> = ({
  context,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setIsCommandPaletteOpen,
  currentLang,
  onSelectOrg,
  onNavigate,
  isLive = false,
  className = '',
}) => {
  const [isMobileOrgMenuOpen, setIsMobileOrgMenuOpen] = useState(false);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const t = getUxText(currentLang);

  React.useEffect(() => {
    if (!isMobileOrgMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOrgMenuOpen(false);
      }
    };

    const handlePointerDown = (e: PointerEvent | MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileOrgMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isMobileOrgMenuOpen]);

  const toggleOrgMenu = () => {
    if (isLive) return;
    setIsMobileOrgMenuOpen(!isMobileOrgMenuOpen);
    if (!isMobileOrgMenuOpen && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleSelectOrg = (orgId: string) => {
    if (isLive) return;
    onSelectOrg(orgId);
    setIsMobileOrgMenuOpen(false);
  };

  return (
    <div ref={headerRef} className={`flex flex-col border-b border-[#27394B] bg-[#0D151F] shrink-0 z-40 ${className}`}>
      <div className="h-14 px-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              if (!isMobileMenuOpen && isMobileOrgMenuOpen) {
                setIsMobileOrgMenuOpen(false);
              }
            }}
            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#66D9EF]/60 rounded-lg"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={isMobileMenuOpen ? t.header.closeMenu : t.header.openMenu}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center pl-1">
            <BrandLogo layout="mark" markColor="color" size="mobileMark" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setIsMobileOrgMenuOpen(false);
              if (isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
              }
              if (isLive) {
                onNavigate?.('assist');
                return;
              }
              setIsCommandPaletteOpen(true);
            }}
            className="w-11 h-11 flex items-center justify-center focus:outline-none rounded-lg text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-[#66D9EF]/60"
            aria-label={isLive ? liveSearchLabels[currentLang] : t.header.openSearch}
            title={isLive ? liveSearchLabels[currentLang] : t.header.openSearch}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="w-11 h-11 flex items-center justify-center text-gray-600 cursor-not-allowed focus:outline-none rounded-lg"
            aria-label={t.header.notificationsPlanned}
            aria-disabled="true"
            disabled
            title={t.header.notificationsPlanned}
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="h-12 border-t border-[#223345] flex items-center bg-[#111A27]">
        {isLive ? (
          <div
            className="flex items-center w-full h-full px-4 text-left"
            aria-label={`${t.header.activeOrganization}: ${context.activeOrganization.name}`}
            title={context.activeOrganization.name}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-[#66D9EF] shrink-0" />
              <span className="font-semibold text-white text-xs truncate">
                {context.activeOrganization.name}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleOrgMenu}
            className="flex items-center justify-between w-full h-full px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#66D9EF]/60"
            aria-expanded={isMobileOrgMenuOpen}
            aria-controls="mobile-org-menu"
            aria-label={`${t.header.activeOrganization}: ${context.activeOrganization.name}`}
            title={context.activeOrganization.name}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-[#66D9EF] shrink-0" />
              <span className="font-semibold text-white text-xs truncate">
                {context.activeOrganization.name}
              </span>
            </div>
            {isMobileOrgMenuOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
            )}
          </button>
        )}
      </div>

      {!isLive && isMobileOrgMenuOpen && (
        <div id="mobile-org-menu" className="bg-[#0D151F] border-t border-[#27394B] max-h-64 overflow-y-auto shadow-inner">
          <div className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-[#223345] bg-[#0B1018]/70">
            {t.header.organizations}
          </div>
          <div className="flex flex-col">
            {context.availableOrganizations.map((org) => {
              const isActive = org.id === context.activeOrganization.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelectOrg(org.id)}
                  className={`w-full text-left px-4 py-3 min-h-[44px] text-xs flex items-center justify-between transition focus:outline-none focus-visible:bg-white/10 ${
                    isActive ? 'bg-[#163442]/70 text-[#B8F0F8]' : 'text-[#AAB8C9] hover:bg-white/[0.035]'
                  }`}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={org.name}
                  title={org.name}
                >
                  <span className="font-medium truncate pr-2">{org.name}</span>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-[#66D9EF] shrink-0 uppercase tracking-wider">{t.header.active}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
