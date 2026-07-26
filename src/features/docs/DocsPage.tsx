/**
 * MillionsNest Connect - Interactive Documentation Viewer
 */

import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  BookOpen,
  Code2,
  Workflow,
  Sparkles,
} from 'lucide-react';

export const DocsPage: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<'product' | 'architecture' | 'security' | 'tool_protocol' | 'ai_studio'>('product');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <FileText className="w-3.5 h-3.5" />
            <span>Documentação Técnica & Arquitetural</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Central de Documentação
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Especificações de produto, arquitetura de execução, segurança, Tool Protocol e fluxo de trabalho.
          </p>
        </div>
      </div>

      {/* Docs Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 text-xs font-semibold">
        {[
          { id: 'product', label: 'Visão de Produto (PRODUCT.md)', icon: BookOpen },
          { id: 'architecture', label: 'Arquitetura (ARCHITECTURE.md)', icon: Workflow },
          { id: 'security', label: 'Segurança & RBAC (SECURITY.md)', icon: ShieldCheck },
          { id: 'tool_protocol', label: 'Tool Protocol (TOOL_PROTOCOL.md)', icon: Code2 },
          { id: 'ai_studio', label: 'AI Studio Workflow (AI_STUDIO_WORKFLOW.md)', icon: Sparkles },
        ].map((doc) => {
          const Icon = doc.icon;
          const isActive = activeDoc === doc.id;
          return (
            <button
              key={doc.id}
              onClick={() => setActiveDoc(doc.id as any)}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-[#121824] text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 text-indigo-400" />
              <span>{doc.label}</span>
            </button>
          );
        })}
      </div>

      {/* Document Content View */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 text-xs text-gray-300 leading-relaxed font-sans">
        {activeDoc === 'product' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              Visão de Produto — MillionsNest Connect
            </h2>
            <p>
              O <strong>MillionsNest Connect</strong> é a camada omnichannel de atendimento, relacionamento, agentes de IA e execução segura de ações nos aplicativos MillionsNest (MusicScale, NestFinance, etc.).
            </p>
            <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-2">
              <h3 className="font-bold text-white text-sm">Regras Canônicas de Produto:</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                <li>MillionsNest é a fonte canônica para autenticação, organização, membership e autorização.</li>
                <li>Connect não duplica e não cria estruturas paralelas de autenticação.</li>
                <li>A IA nunca grava diretamente nos bancos. Ela solicita ferramentas homologadas.</li>
                <li>Homologação na Biblioteca Viva exige a capability global <code>livingLibrary.manage</code>.</li>
              </ul>
            </div>
          </div>
        )}

        {activeDoc === 'architecture' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              Arquitetura de Execução Futura
            </h2>
            <pre className="p-4 bg-black/40 rounded-xl text-cyan-300 font-mono text-[11px] overflow-x-auto">
              Canal (WhatsApp/Instagram) ➔ Webhook Gateway ➔ Event Intake ➔ Conversation Processor ➔ Policy Engine ➔ Agent Orchestrator ➔ Tool Gateway ➔ App Responsável (MusicScale) ➔ Audit Log (Imutável)
            </pre>
          </div>
        )}

        {activeDoc === 'security' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              Diretrizes de Segurança & Governança
            </h2>
            <p>
              Validação estrita de <code>organizationId</code> em todas as invocações de ferramentas. Bloqueio automático de tentativas de acesso cross-tenant e validação da capability <code>livingLibrary.manage</code>.
            </p>
          </div>
        )}

        {activeDoc === 'tool_protocol' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              Protocolo de Ferramentas (Tool Gateway)
            </h2>
            <p>
              Toda ferramenta deve declarar seu nível de risco (R0 a R4), esquema de entrada/saída e políticas de confirmação (automática, confirmação do usuário ou aprovação administrativa).
            </p>
          </div>
        )}

        {activeDoc === 'ai_studio' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              AI Studio Workflow
            </h2>
            <p>
              Execução em ambiente isolado <code>DEMO_MODE</code>, sem conexões externas pagas ou chaves privadas reais.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
