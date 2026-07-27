import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { LanguageCode } from '../../types';
import { getInboxUxText } from '../../i18n/inboxUx';

interface InboxFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filterMode: string;
  setFilterMode: (mode: string) => void;
  channelFilter: string;
  setChannelFilter: (channel: string) => void;
  currentLang: LanguageCode;
}

export const InboxFilterSheet: React.FC<InboxFilterSheetProps> = ({
  isOpen,
  onClose,
  filterMode,
  setFilterMode,
  channelFilter,
  setChannelFilter,
  currentLang,
}) => {
  const t = getInboxUxText(currentLang);
  const dialogRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pb-safe bg-black/60 backdrop-blur-sm">
      <div 
        ref={dialogRef}
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="filter-dialog-title"
        className="w-full max-w-md bg-[#121824] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full"
      >
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h2 id="filter-dialog-title" className="text-sm font-bold text-white">
            {t.filters}
          </h2>
          <button 
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={t.cancel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">{t.responsibility}</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'all', label: t.all },
                { id: 'mine', label: t.mine },
                { id: 'unassigned', label: t.unassigned },
                { id: 'waiting_human', label: t.waitingHuman },
                { id: 'automatic', label: t.automationActive },
                { id: 'resolved', label: t.resolved },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition ${
                    filterMode === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#1A2234] text-gray-300 hover:bg-[#222C42]'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-400 uppercase">{t.channels}</h3>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{t.demoDataNotice}</span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { id: 'all', label: t.allChannels },
                { id: 'whatsapp', label: t.channelWhatsappDemo },
                { id: 'instagram', label: t.channelInstagramDemo },
                { id: 'inapp', label: t.channelInAppDemo },
              ].map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannelFilter(ch.id)}
                  className={`min-h-[44px] px-4 py-2 text-left rounded-lg text-sm font-medium transition ${
                    channelFilter === ch.id
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-[#1A2234] text-gray-300 border border-transparent hover:bg-[#222C42]'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-[#0B0E14] flex gap-3">
          <button
            type="button"
            onClick={() => {
              setFilterMode('all');
              setChannelFilter('all');
            }}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl font-semibold text-sm text-gray-300 bg-[#1A2234] hover:bg-[#222C42] focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            {t.clearFilters}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
};
