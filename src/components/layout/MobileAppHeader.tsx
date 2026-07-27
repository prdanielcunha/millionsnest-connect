import React, { useState } from 'react';
import { Menu, Search, Bell, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { getUxText } from '../../i18n/mobileUx';

interface MobileAppHeaderProps {
  context: EffectiveEcosystemContext;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  setIsCommandPaletteOpen: (isOpen: boolean) => void;
  currentLang: LanguageCode;
  onSelectOrg: (orgId: string) => void;
  className?: string;
}

export const MobileAppHeader: React.FC<MobileAppHeaderProps> = ({
  context,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setIsCommandPaletteOpen,
  currentLang,
  onSelectOrg,
  className = '',
}) => {
  const [isMobileOrgMenuOpen, setIsMobileOrgMenuOpen] = useState(false);
  const t = getUxText(currentLang);

  const toggleOrgMenu = () => {
    setIsMobileOrgMenuOpen(!isMobileOrgMenuOpen);
    if (!isMobileOrgMenuOpen && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleSelectOrg = (orgId: string) => {
    onSelectOrg(orgId);
    setIsMobileOrgMenuOpen(false);
  };

  return (
    <div className={`flex flex-col border-b border-white/10 bg-[#121824] shrink-0 z-40 ${className}`}>
      {/* Top row: Menu, Brand, Search, Notifications */}
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
            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={isMobileMenuOpen ? t.header.closeMenu : t.header.openMenu}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 pl-1">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-[10px]">
              MN
            </div>
            <span className="font-bold text-sm text-white">Connect</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
            aria-label={t.header.openSearch}
          >
            <Search className="w-5 h-5" />
          </button>
          <button 
            type="button"
            className="w-11 h-11 flex items-center justify-center text-gray-600 cursor-not-allowed focus:outline-none rounded-lg" 
            aria-label={t.header.notificationsPlanned}
            aria-disabled="true"
            title={t.header.notificationsPlanned}
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Second row: Context / Active Organization */}
      <div className="h-12 border-t border-white/5 flex items-center bg-[#1A2234]">
        <button
          type="button"
          onClick={toggleOrgMenu}
          className="flex items-center justify-between w-full h-full px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
          aria-expanded={isMobileOrgMenuOpen}
          aria-controls="mobile-org-menu"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
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
      </div>

      {/* Expanded Org Menu */}
      {isMobileOrgMenuOpen && (
        <div id="mobile-org-menu" className="bg-[#121824] border-t border-white/10 max-h-64 overflow-y-auto shadow-inner">
          <div className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5 bg-[#0B0E14]/50">
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
                    isActive ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-300 hover:bg-white/5'
                  }`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="font-medium truncate pr-2">{org.name}</span>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-indigo-400 shrink-0 uppercase tracking-wider">{t.header.active}</span>
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
