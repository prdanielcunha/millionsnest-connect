import React from 'react';
import { X, Wrench, Lock } from 'lucide-react';
import { LanguageCode } from '../../types';
import { getInboxUxText } from '../../i18n/inboxUx';
import { useInboxDialogA11y } from './useInboxDialogA11y';
import { mockTools } from '../../demo/mockData';

interface InboxQuickToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateTool: (toolName: string) => void;
  currentLang: LanguageCode;
}

export const InboxQuickToolsSheet: React.FC<InboxQuickToolsSheetProps> = ({
  isOpen,
  onClose,
  onSimulateTool,
  currentLang,
}) => {
  const t = getInboxUxText(currentLang);
  const { containerRef } = useInboxDialogA11y(isOpen, onClose);
  
  if (!isOpen) return null;

  const targetToolNames = ['listSchedules', 'createScheduleDraft', 'addSongToLivingLibrary'];
  const tools = targetToolNames.map(name => mockTools.find(t => t.name === name)).filter(Boolean);

  const getRiskBadgeClass = (risk: string) => {
    if (risk.startsWith('R1')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    if (risk.startsWith('R2')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] bg-black/60 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        ref={containerRef}
        id="mobile-quick-tools-sheet"
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="quicktools-dialog-title"
        className="w-full max-w-md bg-[#121824] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full"
      >
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h2 id="quicktools-dialog-title" className="text-sm font-bold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-400" />
            {t.quickTools}
          </h2>
          <button 
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={t.closeDialog}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {tools.map((tool) => {
            if (!tool) return null;
            const isHumanApproval = tool.confirmationPolicy === 'human_approval';
            
            if (isHumanApproval) {
              return (
                <div
                  key={tool.name}
                  tabIndex={0}
                  aria-disabled="true"
                  className="w-full text-left p-4 bg-[#1A2234] border border-white/5 rounded-xl opacity-60 cursor-not-allowed flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-gray-200 truncate flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      {tool.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono border whitespace-nowrap ${getRiskBadgeClass(tool.riskLevel)}`}>
                      {tool.riskLevel}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2">
                    {tool.title}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-gray-500 font-mono mt-1 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span>{t.appLabel} {tool.appId}</span>
                      <span>{t.policyLabel} {tool.confirmationPolicy}</span>
                    </div>
                    <div className="text-rose-400/80 mt-1">
                      {t.humanApprovalRequired} - {t.unavailableInDemo}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={tool.name}
                type="button"
                onClick={() => {
                  onSimulateTool(tool.name);
                  onClose();
                }}
                className="w-full text-left p-4 bg-[#1A2234] border border-white/5 rounded-xl transition focus:outline-none flex flex-col gap-2 hover:border-indigo-500/30 hover:bg-white/5 focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-gray-200 truncate flex items-center gap-2">
                    {tool.name}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono border whitespace-nowrap ${getRiskBadgeClass(tool.riskLevel)}`}>
                    {tool.riskLevel}
                  </span>
                </div>
                <div className="text-xs text-gray-400 line-clamp-2">
                  {tool.title}
                </div>
                <div className="flex flex-col gap-1 text-xs text-gray-500 font-mono mt-1 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span>{t.appLabel} {tool.appId}</span>
                    <span>{t.policyLabel} {tool.confirmationPolicy}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
