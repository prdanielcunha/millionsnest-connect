import React, { useState, useReducer, useEffect, useRef } from 'react';
import {
  prepareDemoToolInvocation,
  classifyDemoToolFlow,
  createDemoConfirmationEvidence,
  buildDemoToolInvocationContext,
  PendingDemoToolInvocation,
} from '../../demo/confirmations/demoToolFlow';
import { DemoToolConfirmationDialog } from '../../components/common/DemoToolConfirmationDialog';
import {
  Search,
  Filter,
  Send,
  Paperclip,
  Bot,
  User,
  AlertTriangle,
  CheckCircle,
  Tag,
  Sparkles,
  ArrowLeft,
  Info,
  Wrench,
  Link2,
  X,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import {
  EffectiveEcosystemContext,
  Conversation,
  UnifiedMessage,
  ConversationMode,
  Contact,
  ToolDefinition,
  LanguageCode,
} from '../../types';
import {
  mockConversations,
  mockMessages,
  mockContacts,
  mockTools,
} from '../../demo/mockData';
import { ToolGatewayService } from '../../core/services/toolGateway';
import { getInboxUxText } from '../../i18n/inboxUx';
import { inboxMobileUiReducer, InboxMobileUiState } from './inboxMobileState';
import { InboxFilterSheet } from './InboxFilterSheet';
import { InboxQuickToolsSheet } from './InboxQuickToolsSheet';

interface InboxPageProps {
  context: EffectiveEcosystemContext;
  currentLang?: LanguageCode;
  onNavigate: (route: string) => void;
}

type InboxNotice = {
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
} | null;

export const InboxPage: React.FC<InboxPageProps> = ({ context, currentLang = 'pt-BR' as LanguageCode, onNavigate }) => {
  const t = getInboxUxText(currentLang as LanguageCode);
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>('cnv_01');
  const [messagesMap, setMessagesMap] = useState<Record<string, UnifiedMessage[]>>(mockMessages);
  const [filterMode, setFilterMode] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isInternalNote, setIsInternalNote] = useState<boolean>(false);
  const [notice, setNotice] = useState<InboxNotice>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [pendingTool, setPendingTool] = useState<PendingDemoToolInvocation | null>(null);

  const [mobileState, dispatchMobile] = useReducer(inboxMobileUiReducer, {
    view: 'list',
    filtersOpen: false,
    quickToolsOpen: false,
  });

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || conversations[0];
  const activeContact: Contact = mockContacts.find((cnt) => cnt.id === activeConversation.contactId) || mockContacts[0];
  const currentMessages = messagesMap[activeConversation.id] || [];

  useEffect(() => {
    dispatchMobile({ type: 'CHANGE_ORG' });
    setPendingTool(null);
  }, [context.activeOrganization.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

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
      senderType: 'human_agent',
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
    setNotice({ kind: 'success', message: t.noExternalCall });
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
      setNotice({ kind: 'error', message: 'appAccess missing or inactive for ' + tool.appId });
      return;
    }

    const resolution = classifyDemoToolFlow(tool, pending);

    if (resolution.kind === 'execute_directly') {
      const baseInvokeCtx = buildDemoToolInvocationContext(resolution.pending, context);
      const invokeCtx = { ...baseInvokeCtx, locale: currentLang };
      const gatewayResult = ToolGatewayService.invokeTool(context, tool, resolution.pending.args, invokeCtx);
      
      const toolMsg: UnifiedMessage = {
        id: `msg_tool_${Date.now()}`,
        conversationId: activeConversation.id,
        senderType: 'agent',
        senderName: 'Tool Gateway (Demo)',
        content: `${t.simulatedTool} **${tool.title}**. ${t.noExternalCall}`,
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
      setNotice({ kind: 'warning', message: t.policyBlocked + ' ' + resolution.reason });
    }
  };

  const handleConfirmTool = () => {
    if (!pendingTool) return;
    
    const evidence = createDemoConfirmationEvidence(
      pendingTool,
      pendingTool.tool.confirmationPolicy === 'explicit' ? 'explicit_click' : 'simple_click'
    );
    
    const baseInvokeCtx = buildDemoToolInvocationContext(pendingTool, context, evidence);
    const invokeCtx = { ...baseInvokeCtx, locale: currentLang };
    const gatewayResult = ToolGatewayService.invokeTool(context, pendingTool.tool, pendingTool.args, invokeCtx);
    
    const toolMsg: UnifiedMessage = {
      id: `msg_tool_${Date.now()}`,
      conversationId: activeConversation.id,
      senderType: 'agent',
      senderName: 'Tool Gateway (Demo)',
      content: `${t.simulatedTool} **${pendingTool.tool.title}**. ${t.noExternalCall}`,
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
    <div className="flex-1 min-h-0 flex flex-col bg-[#0E131F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
      
      {/* Notices */}
      {notice && (
        <div 
          role={notice.kind === 'error' || notice.kind === 'warning' ? 'alert' : 'status'}
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg text-sm font-medium shadow-lg flex items-center gap-3 ${
            notice.kind === 'error' ? 'bg-rose-500/90 text-white' :
            notice.kind === 'warning' ? 'bg-amber-500/90 text-white' :
            'bg-emerald-500/90 text-white'
          }`}
        >
          {notice.message}
          <button onClick={() => setNotice(null)} className="opacity-80 hover:opacity-100" aria-label="Fechar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Toolbar (lg:hidden) */}
      <div className="lg:hidden p-3 bg-[#121824] border-b border-white/10 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h1 className="text-sm font-bold text-white">{t.title}</h1>
            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-mono uppercase border border-amber-500/30">
              DEMO_MODE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatchMobile({ type: 'OPEN_FILTERS' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 rounded-lg text-xs text-gray-300 font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-expanded={mobileState.filtersOpen}
              aria-controls="mobile-filters-sheet"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{t.filters}</span>
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-[#1A2234] border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 p-1 text-gray-400 hover:text-white"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Toolbar (hidden lg:flex) */}
      <div className="hidden lg:flex p-3 bg-[#121824] border-b border-white/10 items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-400" /> {t.filters}:
          </span>
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
              onClick={() => setFilterMode(f.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                filterMode === f.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-[#1A2234] text-gray-400 hover:text-gray-200 focus:ring-2 focus:ring-indigo-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[#1A2234] p-1 rounded-lg border border-white/5">
          {['all', 'whatsapp', 'instagram', 'inapp'].map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-2 py-0.5 rounded text-[11px] uppercase font-semibold transition ${
                channelFilter === ch ? 'bg-indigo-500/30 text-indigo-300' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {ch === 'whatsapp' ? t.channelWhatsappDemo : ch === 'instagram' ? t.channelInstagramDemo : ch === 'inapp' ? t.channelInAppDemo : t.allChannels}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Pane Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* Pane 1: Conversations List */}
        <div
          className={`w-full lg:w-80 xl:w-96 bg-[#121824] border-r border-white/10 flex-col ${
            mobileState.view === 'list' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Search box for desktop */}
          <div className="hidden lg:block p-3 border-b border-white/10 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-[#1A2234] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/5 pb-safe">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 flex flex-col items-center gap-3">
                <MessageSquare className="w-8 h-8 text-gray-600" />
                <div>
                  <div className="font-semibold text-gray-400">{t.emptyStateTitle}</div>
                  <div className="mt-1">{t.emptyStateDesc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setFilterMode('all'); setChannelFilter('all'); setSearchQuery(''); }}
                  className="mt-2 px-4 py-2 bg-[#1A2234] hover:bg-[#222C42] rounded-lg text-xs font-semibold text-white transition focus:ring-2 focus:ring-indigo-500"
                >
                  {t.clearFilters}
                </button>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c.id === activeConversation.id;
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      if (pendingTool && pendingTool.conversationId !== c.id) {
                        setPendingTool(null);
                      }
                      setActiveConversationId(c.id);
                      dispatchMobile({ type: 'OPEN_CHAT' });
                    }}
                    aria-current={isActive ? 'true' : undefined}
                    className={`w-full text-left p-3 min-h-[72px] transition flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
                      isActive ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-white/5 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {c.contactAvatar ? (
                        <img
                          src={c.contactAvatar}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold border border-indigo-500/30">
                          {c.contactName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
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

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white truncate">
                          {c.contactName}
                        </span>
                        <span className="text-xs text-gray-500 font-numeric shrink-0">
                          {new Date(c.lastMessageAt).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {c.lastMessageSnippet}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2 overflow-x-hidden">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border whitespace-nowrap ${
                            c.mode === 'automatico'
                              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                              : c.mode === 'com_aprovacao'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {c.mode === 'automatico' ? t.modeAuto : c.mode === 'com_aprovacao' ? t.modeApproval : t.modeHuman}
                        </span>

                        {c.priority === 'alta' || c.priority === 'urgente' ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-semibold border border-rose-500/30 whitespace-nowrap">
                            Alta
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Pane 2: Conversation View & Composer */}
        <div
          className={`flex-1 min-w-0 flex-col bg-[#0B0E14] ${
            mobileState.view === 'chat' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Active Conversation Header */}
          <div className="p-2 sm:p-3 bg-[#121824] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => dispatchMobile({ type: 'OPEN_LIST' })}
                  className="lg:hidden w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
                  aria-label={t.back}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                {activeConversation.contactAvatar ? (
                  <img
                    src={activeConversation.contactAvatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold border border-indigo-500/30 shrink-0">
                    {activeConversation.contactName.substring(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white truncate">
                      {activeConversation.contactName}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-numeric truncate mt-0.5">
                    <span className="uppercase font-mono text-[10px] bg-white/5 px-1 rounded text-gray-300 shrink-0">
                      {activeConversation.channel}
                    </span>
                    <span className="truncate">{activeConversation.channelIdentifier}</span>
                  </div>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => dispatchMobile({ type: 'OPEN_CONTEXT' })}
                className="lg:hidden w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white bg-[#1A2234] border border-white/10 rounded-lg shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label={t.context}
              >
                <Info className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              <div className="flex bg-[#1A2234] border border-white/10 rounded-lg p-1 w-full sm:w-auto">
                {(['automatico', 'com_aprovacao', 'humano'] as ConversationMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={activeConversation.mode === mode}
                    onClick={() => handleModeChange(mode)}
                    className={`flex-1 sm:flex-none min-h-[36px] sm:min-h-[auto] px-2 py-1 text-xs font-semibold rounded-md transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      activeConversation.mode === mode
                        ? mode === 'humano'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    {mode === 'automatico' ? t.modeAuto : mode === 'com_aprovacao' ? t.modeApproval : t.modeHuman}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode Alert Banner if Human Mode is Active */}
          {activeConversation.mode === 'humano' && (
            <div className="bg-rose-950/40 border-b border-rose-500/20 px-4 py-3 text-sm text-rose-200 flex items-start sm:items-center gap-3 shrink-0">
              <User className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
              <span className="leading-tight">
                <strong>{t.modeHuman}:</strong> {t.humanBanner}
              </span>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {currentMessages.map((msg) => {
              const isContact = msg.senderType === 'contact';
              const isInternal = msg.isInternalNote;

              if (isInternal) {
                return (
                  <div key={msg.id} className="mx-auto max-w-md w-full bg-amber-950/30 border border-amber-500/20 rounded-xl p-3 sm:p-4 text-sm text-amber-200 space-y-2">
                    <div className="flex items-center justify-between font-semibold border-b border-amber-500/20 pb-2">
                      <span className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm">
                        <Tag className="w-4 h-4" /> {t.internalNote} • {msg.senderName}
                      </span>
                      <span className="text-xs text-amber-400/60 font-numeric shrink-0 ml-2">
                        {new Date(msg.createdAt).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-amber-100/90 whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] sm:max-w-xl ${
                    isContact ? 'items-start' : 'items-end ml-auto'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs text-gray-500 font-mono pl-1 pr-1">
                    <span className="font-semibold text-gray-400">{msg.senderName}</span>
                    <span>•</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                      isContact
                        ? 'bg-[#1A2234] text-gray-200 rounded-tl-none border border-white/5'
                        : 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/10'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Tool Invocation Attachment Card */}
                    {msg.toolInvocation && (
                      <div className="mt-3 p-3 rounded-xl bg-black/30 border border-white/10 text-sm space-y-2 max-w-full">
                        <div className="flex items-center justify-between font-mono text-xs text-cyan-300 flex-wrap gap-2">
                          <span className="flex items-center gap-1.5 font-bold">
                            <Wrench className="w-4 h-4 text-cyan-400" /> Tool Gateway • {msg.toolInvocation.toolName}
                          </span>
                          <span className="px-1.5 py-0.5 bg-cyan-500/20 rounded border border-cyan-500/30 uppercase text-[10px]">
                            {msg.toolInvocation.riskLevel}
                          </span>
                        </div>

                        {msg.toolInvocation.status === 'executed' ? (
                          <div className="bg-emerald-950/40 text-emerald-200 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-emerald-500/20">
                            <CheckCircle className="w-4 h-4 text-emerald-400 inline mr-1.5 align-text-bottom" />
                            <pre className="whitespace-pre-wrap break-all inline">{JSON.stringify(msg.toolInvocation.result, null, 2)}</pre>
                          </div>
                        ) : (
                          <div className="bg-rose-950/40 text-rose-200 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-rose-500/20">
                            <AlertTriangle className="w-4 h-4 text-rose-400 inline mr-1.5 align-text-bottom" />
                            {msg.toolInvocation.error || 'Falha'}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-2 bg-white/5 p-1.5 rounded text-center">
                          {t.gatewaySimulated}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Tool Trigger Bar (Desktop) & Button (Mobile) */}
          <div className="px-4 py-2 bg-[#121824] border-t border-white/10 shrink-0">
            <div className="hidden lg:flex items-center gap-3 overflow-x-auto pb-1">
              <span className="text-gray-400 font-semibold text-xs shrink-0 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> {t.quickTools}:
              </span>
              <button
                type="button"
                onClick={() => handleSimulateTool('listSchedules')}
                className="px-3 py-1.5 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-cyan-300 rounded-lg font-mono text-xs shrink-0 transition focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                listSchedules (R1)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateTool('createScheduleDraft')}
                className="px-3 py-1.5 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-amber-300 rounded-lg font-mono text-xs shrink-0 transition focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                createScheduleDraft (R2)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateTool('addSongToLivingLibrary')}
                className="px-3 py-1.5 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-rose-300 rounded-lg font-mono text-xs shrink-0 transition focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                addSongToLivingLibrary (R3)
              </button>
            </div>
            <button
              type="button"
              onClick={() => dispatchMobile({ type: 'OPEN_QUICK_TOOLS' })}
              className="lg:hidden w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 text-indigo-300 rounded-xl font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Wrench className="w-4 h-4" />
              {t.quickTools}
            </button>
          </div>

          {/* Message Composer */}
          <div className="p-3 sm:p-4 bg-[#121824] border-t border-white/10 space-y-3 shrink-0 pb-safe">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px] sm:min-h-0">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="rounded border-gray-600 bg-[#1A2234] text-amber-500 focus:ring-indigo-500 w-5 h-5 sm:w-4 sm:h-4"
                />
                <span className={`text-sm sm:text-xs ${isInternalNote ? 'text-amber-400 font-semibold' : 'text-gray-400'}`}>
                  {t.internalNote}
                </span>
              </label>

              <div className="bg-indigo-500/10 text-indigo-300 text-[10px] px-2 py-1 rounded border border-indigo-500/20">
                {t.demoNotice}
              </div>
            </div>

            <div className="flex items-end gap-2">
              <button 
                type="button"
                className="w-11 h-11 shrink-0 flex items-center justify-center text-gray-500 cursor-not-allowed rounded-xl bg-[#1A2234] border border-white/10"
                aria-label={t.attachmentsPlanned}
                aria-disabled="true"
                disabled
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isInternalNote ? t.internalNote + '...' : t.typeMessage}
                rows={1}
                className={`flex-1 min-h-[44px] max-h-32 resize-none bg-[#1A2234] border rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none transition focus:ring-2 ${
                  isInternalNote ? 'border-amber-500/50 bg-amber-950/20 focus:ring-amber-500' : 'border-white/10 focus:ring-indigo-500'
                }`}
              />

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                aria-label={isInternalNote ? t.saveNote : t.sendSimulated}
                className={`w-11 h-11 sm:w-auto sm:px-4 shrink-0 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition focus:outline-none focus:ring-2 ${
                  !inputMessage.trim()
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : isInternalNote
                    ? 'bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 focus:ring-indigo-500'
                }`}
              >
                <span className="hidden sm:inline">{isInternalNote ? t.saveNote : t.sendSimulated}</span>
                <Send className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Pane 3: Context Sidebar */}
        <div
          className={`w-full lg:w-80 bg-[#121824] border-l border-white/10 flex-col overflow-y-auto pb-safe ${
            mobileState.view === 'context' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#121824]/95 backdrop-blur border-b border-white/10 p-3 flex items-center justify-between shrink-0 min-h-[60px]">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" /> {t.context}
            </h3>
            <button
              type="button"
              onClick={() => dispatchMobile({ type: 'OPEN_CHAT' })}
              className="lg:hidden w-11 h-11 flex items-center justify-center text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label={t.back}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Contact Identity Card */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {activeContact.avatarUrl ? (
                  <img
                    src={activeContact.avatarUrl}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500/30"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold text-xl border-2 border-indigo-500/30">
                    {activeContact.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-base font-bold text-white">{activeContact.name}</h4>
                  <span className="text-sm text-gray-400 block font-numeric mt-0.5">
                    {activeContact.phone || activeContact.instagramHandle}
                  </span>
                </div>
              </div>

              {/* MillionsNest Identity Link Status */}
              <div className="p-3.5 rounded-xl bg-[#1A2234] border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1.5 font-medium">
                    <Link2 className="w-4 h-4 text-indigo-400" /> {t.bindingStatus}:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase font-mono border ${
                      activeContact.linkingStatus === 'vinculado'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {activeContact.linkingStatus}
                  </span>
                </div>

                {activeContact.linkingStatus === 'vinculado' ? (
                  <div className="text-xs text-gray-300 bg-black/20 p-3 rounded-lg border border-white/5 space-y-1">
                    <div className="font-semibold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> {t.demoBinding}
                    </div>
                    <div className="font-mono text-[11px] break-all">{t.localId}: {activeContact.identities[0]?.linkedUserId}</div>
                    <div className="text-[10px] text-gray-500 mt-2">{t.scenarioOnly}</div>
                  </div>
                ) : (
                  <div className="text-xs text-amber-200/90 bg-amber-950/30 p-3 rounded-lg border border-amber-500/20 space-y-1">
                    <div className="font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {t.authorityNotice}</div>
                    <div>{t.noBindingNotice}</div>
                    <div className="text-[10px] opacity-70 mt-1">{t.reauthNotice}.</div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Intelligence Insights */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> {t.summary}
              </h4>

              <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-4 text-sm">
                <div>
                  <span className="text-gray-400 text-xs block mb-1">{t.intent}:</span>
                  <span className="font-semibold text-cyan-300 font-mono bg-cyan-500/10 px-2 py-1 rounded inline-block border border-cyan-500/20">
                    {activeConversation.aiIntent || 'consulta_geral'}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 text-xs block mb-1">{t.summary}:</span>
                  <p className="text-gray-200 leading-relaxed bg-white/5 p-3 rounded-lg text-sm">
                    {activeConversation.aiSummary || 'Atendimento em andamento.'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-2 text-right">{t.generatedSummary}</p>
                </div>

                {/* Sentiment Disclaimer Warning Banner */}
                <div className="bg-indigo-950/40 border border-indigo-500/20 p-3 rounded-lg text-xs text-indigo-200/90 space-y-1.5">
                  <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0" /> {t.sentiment}
                  </div>
                  <p className="text-[11px] text-indigo-200/70 leading-relaxed">
                    Sinal de sentimento é um auxiliar estatístico e não representa prova factual nem autoridade de decisão.
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Tags */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t.tags}
              </h4>
              <div className="flex flex-wrap gap-2">
                {activeContact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-gray-300 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <InboxFilterSheet 
        isOpen={mobileState.filtersOpen}
        onClose={() => dispatchMobile({ type: 'CLOSE_FILTERS' })}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        channelFilter={channelFilter}
        setChannelFilter={setChannelFilter}
        currentLang={currentLang}
      />

      <InboxQuickToolsSheet
        isOpen={mobileState.quickToolsOpen}
        onClose={() => dispatchMobile({ type: 'CLOSE_QUICK_TOOLS' })}
        onSimulateTool={handleSimulateTool}
        currentLang={currentLang}
      />

      <DemoToolConfirmationDialog
        pending={pendingTool}
        isOpen={!!pendingTool}
        onConfirm={handleConfirmTool}
        onCancel={handleCancelTool}
      />
    </div>
  );
};
