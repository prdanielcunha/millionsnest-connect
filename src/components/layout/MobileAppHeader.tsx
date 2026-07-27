import React from 'react';
import { Menu, Search, Bell, Building2, ChevronDown } from 'lucide-react';
import { EffectiveEcosystemContext } from '../../types';

interface MobileAppHeaderProps {
  context: EffectiveEcosystemContext;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  isOrgMenuOpen: boolean;
  setIsOrgMenuOpen: (isOpen: boolean) => void;
  setIsCommandPaletteOpen: (isOpen: boolean) => void;
  className?: string;
}

export const MobileAppHeader: React.FC<MobileAppHeaderProps> = ({
  context,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isOrgMenuOpen,
  setIsOrgMenuOpen,
  setIsCommandPaletteOpen,
  className = '',
}) => {
  return (
    <div className={`flex flex-col border-b border-white/10 bg-[#121824] shrink-0 ${className}`}>
      {/* Top row: Menu, Brand, Search, Notifications */}
      <div className="h-14 px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-400 hover:text-white"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <span className="w-6 h-6"></span> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-[10px]">
              MN
            </div>
            <span className="font-bold text-sm text-white">Connect</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="text-gray-400 hover:text-white"
            aria-label="Open global search"
          >
            <Search className="w-5 h-5" />
          </button>
          <button className="text-gray-400 hover:text-white relative" aria-label="Notifications">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-cyan-400"></span>
          </button>
        </div>
      </div>

      {/* Second row: Context / Active Organization */}
      <div className="h-12 px-4 border-t border-white/5 flex items-center bg-[#1A2234]">
        <button
          onClick={() => setIsOrgMenuOpen(!isOrgMenuOpen)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={isOrgMenuOpen}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-white text-xs truncate">
              {context.activeOrganization.name}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
        </button>
      </div>
    </div>
  );
};
