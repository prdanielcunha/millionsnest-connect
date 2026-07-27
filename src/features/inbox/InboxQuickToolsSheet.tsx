import React, { useEffect, useRef } from 'react';
import { X, Wrench } from 'lucide-react';
import { LanguageCode } from '../../types';
import { getInboxUxText } from '../../i18n/inboxUx';

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

  const tools = [
    {
      name: 'listSchedules',
      desc: 'Listar Escalas do MusicScale',
      app: 'musicscale',
      risk: 'R1_AUTH_READ',
      policy: 'none',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
    },
    {
      name: 'createScheduleDraft',
      desc: 'Criar Rascunho de Escala',
      app: 'musicscale',
      risk: 'R2_REVERSIBLE_WRITE',
      policy: 'explicit',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    },
    {
      name: 'addSongToLivingLibrary',
      desc: 'Adicionar à Biblioteca Viva (Global)',
      app: 'musicscale',
      risk: 'R3_PRIVILEGED',
      policy: 'human_approval',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pb-safe bg-black/60 backdrop-blur-sm">
      <div 
        ref={dialogRef}
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
            aria-label={t.cancel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {tools.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => {
                onSimulateTool(tool.name);
                onClose();
              }}
              className="w-full text-left p-4 bg-[#1A2234] border border-white/5 hover:border-indigo-500/30 hover:bg-white/5 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-indigo-500 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-gray-200 truncate">{tool.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border whitespace-nowrap ${tool.badgeClass}`}>
                  {tool.risk}
                </span>
              </div>
              <div className="text-xs text-gray-400 line-clamp-2">
                {tool.desc}
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mt-1 pt-2 border-t border-white/5">
                <span>App: {tool.app}</span>
                <span>Policy: {tool.policy}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
