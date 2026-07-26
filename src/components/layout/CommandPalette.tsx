/**
 * MillionsNest Connect - Command Palette / Global Search
 */

import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, Users, Bot, BookOpen, Wrench, Radio, BarChart3, ShieldAlert, Settings, FileText } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { route: 'overview', title: 'Visão Geral (Dashboard)', category: 'Navegação', icon: BarChart3 },
    { route: 'inbox', title: 'Caixa de Entrada (Conversas Ativas)', category: 'Atendimento', icon: MessageSquare },
    { route: 'menu', title: 'Menu Conversacional (WhatsApp / Instagram)', category: 'Atendimento', icon: Radio },
    { route: 'contacts', title: 'Contatos & Identidades Externas', category: 'Gestão', icon: Users },
    { route: 'agents', title: 'Agentes de IA (Configuração & Autonomia)', category: 'Agentes', icon: Bot },
    { route: 'knowledge', title: 'Base de Conhecimento (Docs & FAQs)', category: 'Conhecimento', icon: BookOpen },
    { route: 'automations', title: 'Automações & Jornadas de Atendimento', category: 'Automações', icon: Wrench },
    { route: 'tools', title: 'Aplicativos & Ferramentas (MusicScale / NestFinance)', category: 'Integrações', icon: Wrench },
    { route: 'channels', title: 'Canais de Entrada (WhatsApp +55 43 99990-7071)', category: 'Canais', icon: Radio },
    { route: 'analytics', title: 'Analytics & Métricas de Atendimento', category: 'Relatórios', icon: BarChart3 },
    { route: 'audit', title: 'Auditoria Imutável (Tool Gateway Logs)', category: 'Segurança', icon: ShieldAlert },
    { route: 'settings', title: 'Configurações Globais & Equipe', category: 'Sistema', icon: Settings },
    { route: 'docs', title: 'Documentação Técnica & Arquitetura', category: 'Documentação', icon: FileText },
  ];

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="bg-[#121824] border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-3 border-b border-white/10 flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite para buscar páginas, ferramentas, contatos ou comandos..."
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-white/5">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.route}
                  onClick={() => {
                    onNavigate(item.route);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-white/5 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500">{item.category}</div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 border border-white/10 px-2 py-0.5 rounded">
                    Ir para
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="bg-[#0B0E14] px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
          <span>Use ESC para fechar</span>
          <span>Navegação Rápida • MillionsNest Connect</span>
        </div>
      </div>
    </div>
  );
};
