/**
 * MillionsNest Connect - Knowledge Base Page
 * Terminology rule: Use "base de conhecimento", NEVER "treinar a IA".
 */

import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  FileText,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sparkles,
  Layers,
  Clock,
} from 'lucide-react';
import { KnowledgeSource } from '../../types';
import { mockKnowledgeSources } from '../../demo/mockData';

export const KnowledgePage: React.FC = () => {
  const [sources] = useState<KnowledgeSource[]>(mockKnowledgeSources);
  const [activeTab, setActiveTab] = useState<'sources' | 'qa_preview' | 'conflicts'>('sources');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredSources = sources.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contentSnippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Gestão da Base de Conhecimento</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Base de Conhecimento
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Artigos, políticas, manuais e dados dinâmicos para fundamentação de agentes de IA.
          </p>
        </div>

        <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20">
          <Plus className="w-4 h-4" />
          <span>Nova Fonte de Conhecimento</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'sources'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-[#121824] text-gray-400 hover:text-white'
          }`}
        >
          Fontes Ativas ({sources.length})
        </button>
        <button
          onClick={() => setActiveTab('qa_preview')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'qa_preview'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-[#121824] text-gray-400 hover:text-white'
          }`}
        >
          Simulador de Resposta por Confiança
        </button>
        <button
          onClick={() => setActiveTab('conflicts')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'conflicts'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-[#121824] text-gray-400 hover:text-white'
          }`}
        >
          Conflitos & Expirados (0)
        </button>
      </div>

      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar documento ou palavra-chave..."
              className="w-full bg-[#121824] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSources.map((ks) => (
              <div
                key={ks.id}
                className="p-5 bg-[#121824] border border-white/10 rounded-2xl shadow-lg space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase font-mono border border-indigo-500/30">
                      {ks.type}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {ks.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white">{ks.title}</h3>
                  <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                    "{ks.contentSnippet}"
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5 space-y-1 text-[11px] text-gray-500 font-mono">
                  <div className="flex justify-between">
                    <span>Dono:</span>
                    <span className="text-gray-300">{ks.owner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Escopo:</span>
                    <span className="text-cyan-400 uppercase">{ks.scope}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Versão:</span>
                    <span className="text-gray-300">v{ks.version}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'qa_preview' && (
        <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Demonstração de Resposta por Nível de Confiança
          </h3>

          <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-3 text-xs">
            <div className="font-semibold text-gray-300">
              Pergunta Simulação: "Quais são as diretrizes para adicionar uma cifra na Biblioteca Viva?"
            </div>

            <div className="p-3 bg-black/40 rounded-lg space-y-2 text-gray-200">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-cyan-400 font-bold">Resposta Fundamentada (Confiança: 98.2%)</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">FONTE REVISADA</span>
              </div>
              <p className="leading-relaxed">
                Para homologar uma cifra na Biblioteca Viva compartilhada, exige-se código ISRC válido ou identificação do autor, notação cifrada simplificada e capability <code className="text-cyan-300 font-mono">livingLibrary.manage</code>.
              </p>
              <div className="text-[10px] text-gray-500 pt-1 border-t border-white/5 font-mono">
                Fonte: "Diretrizes de Curadoria da Biblioteca Viva" (v1.5, Global)
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conflicts' && (
        <div className="p-8 text-center bg-[#121824] border border-white/10 rounded-2xl shadow-xl text-xs text-gray-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="font-bold text-white">Nenhum conflito ou documento expirado</h3>
          <p className="max-w-md mx-auto">
            Todas as fontes de conhecimento da base estão homologadas e atualizadas para a organização ativa.
          </p>
        </div>
      )}
    </div>
  );
};
