import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, Database, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { LanguageCode } from '../../types';
import { getUxText } from '../../i18n/mobileUx';

interface DemoBannerProps {
  currentLang: LanguageCode;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ currentLang }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = getUxText(currentLang);

  return (
    <div className="bg-amber-950/40 border-b border-amber-500/20 text-amber-200/90 shrink-0">
      {/* Mobile/Tablet Compact View */}
      <div className="lg:hidden flex items-center justify-between px-2 text-xs min-h-[44px]">
        <div className="flex items-center gap-2 min-w-0 pl-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300 truncate">{t.demoBanner.summary}</span>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="min-h-[44px] px-2 text-xs font-medium text-amber-300/80 hover:text-amber-300 flex items-center gap-1 shrink-0 ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
          aria-expanded={isExpanded}
          aria-controls="demo-banner-details"
        >
          {isExpanded ? t.demoBanner.hideDetails : t.demoBanner.details} 
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Mobile Details */}
      {isExpanded && (
        <div id="demo-banner-details" className="lg:hidden px-4 pb-4 pt-1 text-xs text-amber-200/80 space-y-2 border-t border-amber-500/10 mt-1">
          <p className="leading-relaxed">{t.demoBanner.description}</p>
          <ul className="space-y-1.5 list-disc pl-4 pt-1">
            <li>{t.demoBanner.noApiOrDatabase}</li>
            <li>{t.demoBanner.noExternalIntegration}</li>
            <li>{t.demoBanner.serverSideAuthorization}</li>
          </ul>
        </div>
      )}

      {/* Desktop View */}
      <div className="hidden lg:flex px-4 py-2 text-xs flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300">{t.demoBanner.activeLabel}</span>
          <span>{t.demoBanner.description}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-amber-400/80">
          <span className="inline-flex items-center gap-1">
            <Database className="w-3.5 h-3.5" /> {t.demoBanner.localMocks}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> {t.demoBanner.simulatedRbac}
          </span>
          <span className="inline-flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> {t.demoBanner.simulatedToolGateway}
          </span>
        </div>
      </div>
    </div>
  );
};
