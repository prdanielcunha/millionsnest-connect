/**
 * MillionsNest Connect - Inbox Page
 * 3-pane layout on desktop, stackable on mobile.
 */

import React, { useState } from 'react';
import { 
  prepareDemoToolInvocation, 
  classifyDemoToolFlow, 
  createDemoConfirmationEvidence, 
  buildDemoToolInvocationContext, 
  PendingDemoToolInvocation 
} from '../../demo/confirmations/demoToolFlow';
import { DemoToolConfirmationDialog } from '../../components/common/DemoToolConfirmationDialog';
import {
  Search,
  Filter,
  Send,
  Paperclip,
  ShieldCheck,
  Bot,
  User,
  AlertTriangle,
  CheckCircle,
  Tag,
  Clock,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Info,
  Wrench,
  Link2,
} from 'lucide-react';
import {
  EffectiveEcosystemContext,
  Conversation,
  UnifiedMessage,
  ConversationMode,
  ConversationChannel,
  Contact,
  DemoConfirmationEvidence,
  ToolDefinition,
} from '../../types';
import {
  mockConversations,
  mockMessages,
  mockContacts,
  mockTools,
} from '../../demo/mockData';
import { ToolGatewayService } from '../../core/services/toolGateway';

interface InboxPageProps {
  context: EffectiveEcosystemContext;
  onNavigate: (route: string) => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({ context, onNavigate }) => {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>('cnv_01');
  const [messagesMap, setMessagesMap] = useState<Record<string, UnifiedMessage[]>>(mockMessages);
  const [filterMode, setFilterMode] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isInternalNote, setIsInternalNote] = useState<boolean>(false);
  
  const [pendingTool, setPendingTool] = useState<{ tool: ToolDefinition, args: Record<string, unknown> } | null>(null);
  
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'context'>('list');

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  React.useEffect(() => {
    setPendingTool(null);
  }, [activeConversationId, context.activeOrganization.id]);
  const activeContact: Contact = mockContacts.find((cnt) => cnt.id === activeConversation.contactId) || mockContacts[0];
  const currentMessages = messagesMap[activeConversation.id] || [];

  // Filter conversations list
  const filteredConversations = conversations.filter((c) => {
    if (searchQuery && !c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) && !c.lastMessageSnippet.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (filterMode === 'mine' && c.assignedToUserId !== context.user.uid) return false;
    if (filterMode === 'unassigned' && c.assignedToUserId) return false;
    if (filterMode === 'waiting_human' && c.status !== 'aguardando_humano') return false;
    if (filterMode === 'automatic' && c.mode !== 'automatico') return false;
    if (filterMode === 'resolved' && c.status !== 'resolvido') return false;
    return true;
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: UnifiedMessage = {
      id: `msg_${Date.now()}`,
      conversationId: activeConversation.id,
      senderType: isInternalNote ? 'human_agent' : 'human_agent',
      senderName: context.user.name,
      content: inputMessage,
      createdAt: new Date().toISOString(),
      isInternalNote,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), newMessage],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, lastMessageSnippet: inputMessage, lastMessageAt: new Date().toISOString() }
          : c
      )
    );

    setInputMessage('');
  };

  const handleModeChange = (newMode: ConversationMode) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id ? { ...c, mode: newMode } : c
      )
    );
  };

  const handleSimulateTool = (toolName: string) => {
    const tool = mockTools.find((t) => t.name === toolName);
    if (!tool) return;

    const pending = prepareDemoToolInvocation(
      context,
      tool,
      { organizationId: context.activeOrganization.id },
      activeConversation.channel,
      activeConversation.id
    );

    if (!pending) {
      alert("Acesso negado: appAccess ausente ou inativo para " + tool.appId);
      return;
    }

    const resolution = classifyDemoToolFlow(tool, pending);

    if (resolution.kind === 'execute_directly') {
      const invokeCtx = buildDemoToolInvocationContext(resolution.pending, context);
      const gatewayResult = ToolGatewayService.invokeTool(context, tool, resolution.pending.args, invokeCtx);
      
      const toolMsg: UnifiedMessage = {
        id: `msg_tool_${Date.now()}`,
        conversationId: activeConversation.id,
        senderType: 'agent',
        senderName: 'Suporte MusicScale (Agente IA)',
        content: `Disparando execução da ferramenta **${tool.title}** pelo Tool Gateway...`,
        createdAt: new Date().toISOString(),
        toolInvocation: {
          toolId: tool.id,
          toolName: tool.name,
          appId: tool.appId,
          args: resolution.pending.args,
          status: gatewayResult.result?.status === 'success' ? 'executed' : (gatewayResult.result?.status === 'needs_confirmation' ? 'requested' : 'failed'),
          riskLevel: tool.riskLevel,
          requiresApproval: tool.confirmationPolicy === 'human_approval' || tool.confirmationPolicy === 'strong',
          executedAt: new Date().toISOString(),
          result: gatewayResult.result?.data || gatewayResult.result?.humanSummary,
          error: gatewayResult.result?.status !== 'success' ? gatewayResult.result?.humanSummary : undefined,
        },
      };
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversation.id]: [...(prev[activeConversation.id] || []), toolMsg],
      }));
    } else if (resolution.kind === 'confirmation_required') {
      setPendingTool(resolution.pending);
    } else {
      alert("Ação bloqueada no modo demonstração: " + resolution.reason);
    }
  };

  const handleConfirmTool = () => {
    if (!pendingTool) return;
    
    const evidence = createDemoConfirmationEvidence(
      pendingTool,
      pendingTool.tool.confirmationPolicy === 'explicit' ? 'explicit_click' : 'simple_click'
    );
    
    const invokeCtx = buildDemoToolInvocationContext(pendingTool, context, evidence);
    const gatewayResult = ToolGatewayService.invokeTool(context, pendingTool.tool, pendingTool.args, invokeCtx);
    
    const toolMsg: UnifiedMessage = {
      id: `msg_tool_${Date.now()}`,
      conversationId: activeConversation.id,
      senderType: 'agent',
      senderName: 'Suporte MusicScale (Agente IA)',
      content: `Disparando execução da ferramenta **${pendingTool.tool.title}** após confirmação...`,
      createdAt: new Date().toISOString(),
      toolInvocation: {
        toolId: pendingTool.tool.id,
        toolName: pendingTool.tool.name,
        appId: pendingTool.tool.appId,
        args: pendingTool.args,
        status: gatewayResult.result?.status === 'success' ? 'executed' : (gatewayResult.result?.status === 'needs_confirmation' ? 'requested' : 'failed'),
        riskLevel: pendingTool.tool.riskLevel,
        requiresApproval: pendingTool.tool.confirmationPolicy === 'human_approval' || pendingTool.tool.confirmationPolicy === 'strong',
        executedAt: new Date().toISOString(),
        result: gatewayResult.result?.data || gatewayResult.result?.humanSummary,
        error: gatewayResult.result?.status !== 'success' ? gatewayResult.result?.humanSummary : undefined,
      },
    };
    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), toolMsg],
    }));
    setPendingTool(null);
  };

  const handleCancelTool = () => {
    setPendingTool(null);
  };

  return (
    <>
    <div className="h-[calc(100vh-8.5rem)] flex flex-col bg-[#0E131F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Filter Header Bar */}
      <div className="p-3 bg-[#121824] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-gray-400 font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-400" /> Filtros:
          </span>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'mine', label: 'Minhas' },
            { id: 'unassigned', label: 'Não Atribuídas' },
            { id: 'waiting_human', label: 'Aguardando Humano' },
            { id: 'automatic', label: 'Automação Ativa' },
            { id: 'resolved', label: 'Resolvidas' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                filterMode === f.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-[#1A2234] text-gray-400 hover:text-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Channel filter tabs */}
        <div className="flex items-center gap-1 bg-[#1A2234] p-1 rounded-lg border border-white/5">
          {['all', 'whatsapp', 'instagram', 'inapp'].map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-2 py-0.5 rounded text-[11px] uppercase font-semibold transition ${
                channelFilter === ch ? 'bg-indigo-500/30 text-indigo-300' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Pane Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pane 1: Conversations List */}
        <div
          className={`w-full md:w-80 lg:w-96 bg-[#121824] border-r border-white/10 flex flex-col ${
            mobileView !== 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search box */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por contato ou mensagem..."
                className="w-full bg-[#1A2234] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Conversations Scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">
                Nenhuma conversa encontrada neste filtro.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c.id === activeConversation.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveConversationId(c.id);
                      setMobileView('chat');
                    }}
                    className={`p-3 cursor-pointer transition flex items-start gap-3 ${
                      isActive ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={c.contactAvatar}
                        alt={c.contactName}
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#121824] ${
                          c.channel === 'whatsapp'
                            ? 'bg-emerald-400'
                            : c.channel === 'instagram'
                            ? 'bg-pink-500'
                            : 'bg-cyan-400'
                        }`}
                      ></span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">
                          {c.contactName}
                        </span>
                        <span className="text-[10px] text-gray-500 font-numeric">
                          {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {c.lastMessageSnippet}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                            c.mode === 'automatico'
                              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                              : c.mode === 'com_aprovacao'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {c.mode === 'automatico' ? 'IA Ativa' : c.mode === 'com_aprovacao' ? 'Aprovação' : 'Humano'}
                        </span>

                        {c.priority === 'alta' || c.priority === 'urgente' ? (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-semibold border border-rose-500/30">
                            Alta
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pane 2: Conversation View & Composer */}
        <div
          className={`flex-1 flex flex-col bg-[#0B0E14] ${
            mobileView === 'chat' ? 'flex' : mobileView === 'list' ? 'hidden md:flex' : 'hidden lg:flex'
          }`}
        >
          {/* Active Conversation Header */}
          <div className="p-3 bg-[#121824] border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileView('list')}
                className="md:hidden p-1 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <img
                src={activeConversation.contactAvatar}
                alt={activeConversation.contactName}
                className="w-9 h-9 rounded-full object-cover border border-white/10"
              />

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">
                    {activeConversation.contactName}
                  </h2>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-white/5 text-gray-400 rounded">
                    {activeConversation.channel}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-numeric">
                  {activeConversation.channelIdentifier}
                </span>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">Modo:</span>
              <div className="flex bg-[#1A2234] border border-white/10 rounded-lg p-0.5">
                {(['automatico', 'com_aprovacao', 'humano'] as ConversationMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                      activeConversation.mode === mode
                        ? mode === 'humano'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {mode === 'automatico' ? 'Automático' : mode === 'com_aprovacao' ? 'Aprovação' : 'Humano'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setMobileView('context')}
                className="lg:hidden p-2 text-gray-400 hover:text-white bg-[#1A2234] border border-white/10 rounded-lg"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mode Alert Banner if Human Mode is Active */}
          {activeConversation.mode === 'humano' && (
            <div className="bg-rose-950/40 border-b border-rose-500/20 px-4 py-2 text-xs text-rose-200 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Modo Humano Ativado:</strong> A resposta automática de agentes de IA está pausada para esta conversa. O atendimento é 100% conduzido pela equipe.
              </span>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentMessages.map((msg) => {
              const isContact = msg.senderType === 'contact';
              const isInternal = msg.isInternalNote;

              if (isInternal) {
                return (
                  <div key={msg.id} className="mx-auto max-w-lg bg-amber-950/30 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200 space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Tag className="w-3.5 h-3.5" /> Nota Interna • {msg.senderName}
                      </span>
                      <span className="text-[10px] text-amber-400/60 font-numeric">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-amber-100/90">{msg.content}</p>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-xl ${
                    isContact ? 'items-start' : 'items-end ml-auto'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-gray-500 font-mono">
                    <span>{msg.senderName}</span>
                    <span>•</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isContact
                        ? 'bg-[#1A2234] text-gray-200 rounded-tl-none border border-white/5'
                        : 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Tool Invocation Attachment Card if present */}
                    {msg.toolInvocation && (
                      <div className="mt-3 p-2.5 rounded-xl bg-black/30 border border-white/10 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[10px] text-cyan-300">
                          <span className="flex items-center gap-1 font-bold">
                            <Wrench className="w-3 h-3 text-cyan-400" /> Tool Gateway • {msg.toolInvocation.toolName}
                          </span>
                          <span className="px-1.5 py-0.2 bg-cyan-500/20 rounded border border-cyan-500/30 uppercase">
                            {msg.toolInvocation.riskLevel}
                          </span>
                        </div>

                        {msg.toolInvocation.status === 'executed' ? (
                          <div className="bg-emerald-950/40 text-emerald-200 p-2 rounded text-[11px] font-mono">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
                            {JSON.stringify(msg.toolInvocation.result, null, 2)}
                          </div>
                        ) : (
                          <div className="bg-rose-950/40 text-rose-200 p-2 rounded text-[11px] font-mono">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 inline mr-1" />
                            {msg.toolInvocation.error || 'Execução falhou ou bloqueada'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Tool Trigger Bar */}
          <div className="px-4 py-2 bg-[#121824] border-t border-white/10 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-gray-400 font-semibold text-[11px] shrink-0">Invocação rápida de ferramentas:</span>
            <button
              onClick={() => handleSimulateTool('listSchedules')}
              className="px-2.5 py-1 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-indigo-300 rounded-md font-mono text-[11px] shrink-0 transition"
            >
              listSchedules (R1)
            </button>
            <button
              onClick={() => handleSimulateTool('createScheduleDraft')}
              className="px-2.5 py-1 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-amber-300 rounded-md font-mono text-[11px] shrink-0 transition"
            >
              createScheduleDraft (R2)
            </button>
            <button
              onClick={() => handleSimulateTool('addSongToLivingLibrary')}
              className="px-2.5 py-1 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-cyan-300 rounded-md font-mono text-[11px] shrink-0 transition"
            >
              addSongToLivingLibrary (R3)
            </button>
          </div>

          {/* Message Composer */}
          <div className="p-3 bg-[#121824] border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="rounded border-gray-600 bg-[#1A2234] text-amber-500 focus:ring-0"
                />
                <span className={isInternalNote ? 'text-amber-400 font-semibold' : ''}>
                  Nota Interna (Visível apenas para a equipe)
                </span>
              </label>

              <span className="text-[11px] text-gray-500">
                Pressione Enter para enviar
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-white rounded-lg bg-[#1A2234] border border-white/10">
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isInternalNote ? 'Escreva uma nota interna...' : 'Escreva uma mensagem...'}
                className={`flex-1 bg-[#1A2234] border rounded-xl px-4 py-2.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition ${
                  isInternalNote ? 'border-amber-500/50 bg-amber-950/20' : 'border-white/10'
                }`}
              />

              <button
                onClick={handleSendMessage}
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition ${
                  isInternalNote
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                }`}
              >
                <span>{isInternalNote ? 'Salvar Nota' : 'Enviar'}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Pane 3: Context Sidebar */}
        <div
          className={`w-full lg:w-80 bg-[#121824] border-l border-white/10 p-4 overflow-y-auto space-y-5 ${
            mobileView === 'context' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Contexto do Contato
            </h3>
            <button
              onClick={() => setMobileView('chat')}
              className="lg:hidden text-xs text-indigo-400"
            >
              Voltar ao Chat
            </button>
          </div>

          {/* Contact Identity Card */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={activeContact.avatarUrl}
                alt={activeContact.name}
                className="w-12 h-12 rounded-full object-cover border border-indigo-500/30"
              />
              <div>
                <h4 className="text-sm font-bold text-white">{activeContact.name}</h4>
                <span className="text-xs text-gray-400 block font-numeric">
                  {activeContact.phone || activeContact.instagramHandle}
                </span>
              </div>
            </div>

            {/* MillionsNest Identity Link Status */}
            <div className="p-3 rounded-xl bg-[#1A2234] border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1.5 font-medium">
                  <Link2 className="w-3.5 h-3.5 text-indigo-400" /> Identidade MillionsNest:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    activeContact.linkingStatus === 'vinculado'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {activeContact.linkingStatus}
                </span>
              </div>

              {activeContact.linkingStatus === 'vinculado' ? (
                <div className="text-[11px] text-gray-300 font-mono bg-black/20 p-2 rounded">
                  ID: usr_mn_8812 (Igreja Central Londrina)
                </div>
              ) : (
                <div className="text-[11px] text-amber-200/80 bg-amber-950/30 p-2 rounded">
                  Aviso: Telefone/Instagram não constituem autoridade de permissão. Exige autenticação prévia.
                </div>
              )}
            </div>
          </div>

          {/* AI Intelligence Insights */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Resumo da Inteligência
            </h4>

            <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-2 text-xs">
              <div>
                <span className="text-gray-400 text-[11px] block">Intenção Identificada:</span>
                <span className="font-semibold text-cyan-300 font-mono">
                  {activeConversation.aiIntent || 'consulta_geral'}
                </span>
              </div>

              <div>
                <span className="text-gray-400 text-[11px] block">Resumo do Atendimento:</span>
                <p className="text-gray-300 mt-0.5 leading-relaxed">
                  {activeConversation.aiSummary || 'Atendimento em andamento.'}
                </p>
              </div>

              {/* Sentiment Disclaimer Warning Banner */}
              <div className="bg-indigo-950/40 border border-indigo-500/20 p-2.5 rounded-lg text-[11px] text-indigo-200/90 space-y-1">
                <div className="font-semibold text-indigo-300 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Sinal de Sentimento Auxiliar
                </div>
                <p className="text-[10px] text-indigo-200/70">
                  Sinal de sentimento é um auxiliar estatístico e não representa prova factual nem autoridade de decisão.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Tags */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Etiquetas
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {activeContact.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 text-[11px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

      <DemoToolConfirmationDialog
        pending={pendingTool}
        isOpen={!!pendingTool}
        onConfirm={handleConfirmTool}
        onCancel={handleCancelTool}
      />
    </>
  );
};
