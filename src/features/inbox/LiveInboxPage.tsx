import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Inbox,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import {
  LiveInboxClient,
  type LiveInboxConversation,
  type LiveInboxMessage,
  type LiveInboxReadiness,
  type LiveInboxInternalNote,
} from '../../core/client/liveInboxClient';
import type { LanguageCode } from '../../types';
import { ConnectNestAiClient } from '../../core/client/connectNestAiClient';
import { availableInboxThreadActions, canShowInboxManagement, prepareInboxReplyAttempt, prepareInboxThreadActionAttempt, timelineDayKey, timelineDayLabel, type InboxReplyAttempt, type InboxThreadAction, type InboxThreadActionAttempt } from './liveInboxPresentation';

interface Props {
  session: LiveConnectSession;
  currentLang: LanguageCode;
  onNavigate?: (route: string) => void;
}

type ConversationFilter = 'all' | 'open' | 'resolved';

const copy = {
  'pt-BR': {
    eyebrow: 'TRABALHO',
    title: 'Atendimento',
    subtitle: 'Converse, entenda e resolva com contexto — sem transformar a Inbox em painel técnico.',
    refresh: 'Atualizar',
    loadMore: 'Carregar mais conversas',
    olderMessages: 'Ver mensagens anteriores',
    olderMessagesLoading: 'Carregando histórico…',
    loadingMore: 'Carregando…',
    all: 'Todas',
    open: 'Abertas',
    resolved: 'Resolvidas',
    search: 'Buscar conversas ou pessoas…',
    searchIndex: 'Buscando nomes com segurança…',
    searchLocal: 'Busca nesta lista; índice de nomes ainda não ativado.',
    conversation: 'Conversa',
    unidentified: 'Pessoa sem identificação',
    profileLabel: 'Nome do perfil do WhatsApp',
    conversations: 'Conversas',
    noConversation: 'Nenhuma conversa neste filtro',
    noConversationDesc: 'A Inbox só mostra registros reais e autorizados. Revise o filtro ou aguarde a entrada de uma conversa.',
    select: 'Selecione uma conversa',
    selectDesc: 'Escolha uma conversa para abrir o histórico e o contexto.',
    noMessages: 'Nenhuma mensagem persistida nesta conversa.',
    inbound: 'Pessoa',
    outbound: 'Equipe',
    today: 'Hoje',
    replyPlaceholder: 'Escreva uma resposta…',
    send: 'Enviar',
    sending: 'Enviando…',
    sent: 'Resposta aceita pelo canal oficial. Acompanhe a entrega no histórico.',
    alreadySent: 'Esta resposta já foi registrada; nenhum envio duplicado ocorreu.',
    refreshFailed: 'Resposta aceita, mas não foi possível atualizar o histórico. Use Atualizar para conferir.',
    replyHint: 'Envio oficial · auditado · sem automação silenciosa',
    suggest: 'Sugerir com IA',
    suggesting: 'Pensando…',
    suggested: 'Sugestão do NestAI pronta para revisão. Seu rascunho foi preservado.',
    applySuggestion: 'Usar sugestão',
    discardSuggestion: 'Descartar',
    replyLocked: 'Resposta indisponível',
    replyLockedDesc: 'O canal de saída ainda não está liberado para esta conversa.',
    reopenForReply: 'Reabra a conversa antes de responder pelo canal oficial.',
    context: 'Contexto da conversa',
    noteTitle: 'Notas internas',
    noteDesc: 'Visível apenas para a equipe. Nunca enviada ao cliente.',
    notePlaceholder: 'Escreva uma nota interna…',
    noteSave: 'Salvar nota',
    noteSaving: 'Salvando nota…',
    noteSaved: 'Nota interna registrada.',
    noteDuplicate: 'Esta nota já havia sido registrada.',
    claim: 'Assumir atendimento',
    waiting: 'Aguardar resposta',
    resolve: 'Resolver',
    reopen: 'Reabrir',
    archive: 'Arquivar',
    threadUpdated: 'Estado do atendimento atualizado e registrado.',
    threadDuplicate: 'A alteração já estava registrada.',
    threadRefreshFailed: 'Alteração salva, mas a lista não atualizou. Use Atualizar.',
    actionProgress: 'Salvando alteração…',
    actionsTitle: 'Gerenciar atendimento',
    actionsHint: 'As ações são confirmadas pelo MillionsNest e auditadas no servidor.',
    close: 'Fechar',
    organization: 'Organização',
    channel: 'Canal',
    responsible: 'Responsável',
    unassigned: 'Não atribuído',
    mine: 'Comigo',
    anotherAgent: 'Atendente designado',
    teamAssigned: 'Equipe designada',
    state: 'Estado',
    mode: 'Modo',
    next: 'Próximo passo',
    nextNew: 'Assuma ou responda a conversa.',
    nextInProgress: 'Continue o atendimento e registre o desfecho.',
    nextWaitingPerson: 'Acompanhe a resposta da pessoa sem duplicar contato.',
    nextWaitingTeam: 'A equipe precisa agir antes de devolver a conversa.',
    nextResolved: 'Reabra somente se houver novo trabalho.',
    nextArchived: 'Conversa arquivada. Reabra no fluxo autorizado se necessário.',
    assist: 'Consultar no Assist',
    assistDesc: 'Use uma ferramenta autorizada do ecossistema sem transformar a consulta em mensagem enviada.',
    availability: 'Disponibilidade',
    available: 'Disponível',
    controlled: 'Ativação controlada',
    blocked: 'Indisponível',
    unavailableTitle: 'Atendimento ainda não está disponível',
    unavailableDesc: 'A leitura de conversas permanece fechada até a infraestrutura real estar pronta. Nenhum dado demonstrativo será usado como fallback.',
    governance: 'Ver estado em Governança',
    safe: 'Identidade e permissão são revalidadas no servidor.',
    back: 'Voltar às conversas',
    openContext: 'Abrir contexto',
    status: {
      new: 'Novo',
      in_progress: 'Em andamento',
      waiting_person: 'Aguardando pessoa',
      waiting_team: 'Aguardando equipe',
      resolved: 'Resolvido',
      archived: 'Arquivado',
    },
    modes: {
      automatic: 'Automático',
      approval: 'Com aprovação',
      human: 'Humano',
    },
    delivery: {
      received: 'Recebida',
      queued: 'Na fila',
      sent: 'Enviada',
      delivered: 'Entregue',
      read: 'Lida',
      failed: 'Falhou',
    },
  },
  'en-US': {
    eyebrow: 'WORK',
    title: 'Support',
    subtitle: 'Talk, understand and resolve with context — without turning Inbox into a technical dashboard.',
    refresh: 'Refresh',
    loadMore: 'Load more conversations',
    olderMessages: 'View earlier messages',
    olderMessagesLoading: 'Loading history…',
    loadingMore: 'Loading…',
    all: 'All',
    open: 'Open',
    resolved: 'Resolved',
    search: 'Search conversations or people…',
    searchIndex: 'Searching names securely…',
    searchLocal: 'Searching this list; the name index is not enabled yet.',
    conversation: 'Conversation',
    unidentified: 'Unidentified contact',
    profileLabel: 'WhatsApp profile name',
    conversations: 'Conversations',
    noConversation: 'No conversations in this filter',
    noConversationDesc: 'Inbox only shows real, authorized records. Review the filter or wait for a conversation to arrive.',
    select: 'Select a conversation',
    selectDesc: 'Choose a conversation to open history and context.',
    noMessages: 'No persisted messages in this conversation.',
    inbound: 'Person',
    outbound: 'Team',
    today: 'Today',
    replyPlaceholder: 'Write a reply…',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Reply accepted by the official channel. Track delivery in the conversation.',
    alreadySent: 'This reply was already recorded; no duplicate was sent.',
    refreshFailed: 'Reply accepted, but the conversation could not refresh. Use Refresh to check.',
    replyHint: 'Official delivery · audited · no silent automation',
    suggest: 'Suggest with AI',
    suggesting: 'Thinking…',
    suggested: 'NestAI suggestion ready for review. Your draft is unchanged.',
    applySuggestion: 'Use suggestion',
    discardSuggestion: 'Discard',
    replyLocked: 'Reply unavailable',
    replyLockedDesc: 'The outbound channel is not enabled for this conversation yet.',
    reopenForReply: 'Reopen the conversation before replying through the official channel.',
    context: 'Conversation context',
    noteTitle: 'Internal notes',
    noteDesc: 'Visible only to your team. Never sent to the contact.',
    notePlaceholder: 'Write an internal note…',
    noteSave: 'Save note',
    noteSaving: 'Saving note…',
    noteSaved: 'Internal note saved.',
    noteDuplicate: 'This note was already recorded.',
    claim: 'Take ownership',
    waiting: 'Wait for reply',
    resolve: 'Resolve',
    reopen: 'Reopen',
    archive: 'Archive',
    threadUpdated: 'Conversation state updated and recorded.',
    threadDuplicate: 'This change was already recorded.',
    threadRefreshFailed: 'Change saved, but the list did not refresh. Use Refresh.',
    actionProgress: 'Saving change…',
    actionsTitle: 'Manage conversation',
    actionsHint: 'Changes are authorized by MillionsNest and audited by the server.',
    close: 'Close',
    organization: 'Organization',
    channel: 'Channel',
    responsible: 'Owner',
    unassigned: 'Unassigned',
    mine: 'Assigned to me',
    anotherAgent: 'Assigned agent',
    teamAssigned: 'Assigned team',
    state: 'State',
    mode: 'Mode',
    next: 'Next step',
    nextNew: 'Take ownership or reply to the conversation.',
    nextInProgress: 'Continue support and record the outcome.',
    nextWaitingPerson: 'Wait for the person without duplicating outreach.',
    nextWaitingTeam: 'The team needs to act before returning the conversation.',
    nextResolved: 'Reopen only if new work appears.',
    nextArchived: 'Conversation archived. Reopen through the authorized flow if needed.',
    assist: 'Consult in Assist',
    assistDesc: 'Use an authorized ecosystem tool without turning the consultation into a sent message.',
    availability: 'Availability',
    available: 'Available',
    controlled: 'Controlled activation',
    blocked: 'Unavailable',
    unavailableTitle: 'Support is not available yet',
    unavailableDesc: 'Conversation reading stays closed until real infrastructure is ready. Demo data is never used as fallback.',
    governance: 'View state in Governance',
    safe: 'Identity and permission are revalidated on the server.',
    back: 'Back to conversations',
    openContext: 'Open context',
    status: {
      new: 'New',
      in_progress: 'In progress',
      waiting_person: 'Waiting for person',
      waiting_team: 'Waiting for team',
      resolved: 'Resolved',
      archived: 'Archived',
    },
    modes: {
      automatic: 'Automatic',
      approval: 'With approval',
      human: 'Human',
    },
    delivery: {
      received: 'Received',
      queued: 'Queued',
      sent: 'Sent',
      delivered: 'Delivered',
      read: 'Read',
      failed: 'Failed',
    },
  },
  'es-ES': {
    eyebrow: 'TRABAJO',
    title: 'Atención',
    subtitle: 'Conversa, entiende y resuelve con contexto — sin convertir la bandeja en un panel técnico.',
    refresh: 'Actualizar',
    loadMore: 'Cargar más conversaciones',
    olderMessages: 'Ver mensajes anteriores',
    olderMessagesLoading: 'Cargando historial…',
    loadingMore: 'Cargando…',
    all: 'Todas',
    open: 'Abiertas',
    resolved: 'Resueltas',
    search: 'Buscar conversaciones o personas…',
    searchIndex: 'Buscando nombres de forma segura…',
    searchLocal: 'Buscando en esta lista; el índice de nombres aún no está activo.',
    conversation: 'Conversación',
    unidentified: 'Contacto sin identificar',
    profileLabel: 'Nombre del perfil de WhatsApp',
    conversations: 'Conversaciones',
    noConversation: 'No hay conversaciones en este filtro',
    noConversationDesc: 'La bandeja solo muestra registros reales y autorizados. Revisa el filtro o espera la llegada de una conversación.',
    select: 'Selecciona una conversación',
    selectDesc: 'Elige una conversación para abrir el historial y el contexto.',
    noMessages: 'No hay mensajes persistidos en esta conversación.',
    inbound: 'Persona',
    outbound: 'Equipo',
    today: 'Hoy',
    replyPlaceholder: 'Escribe una respuesta…',
    send: 'Enviar',
    sending: 'Enviando…',
    sent: 'Respuesta aceptada por el canal oficial. Consulta la entrega en el historial.',
    alreadySent: 'Esta respuesta ya estaba registrada; no se duplicó el envío.',
    refreshFailed: 'Respuesta aceptada, pero no se pudo actualizar el historial. Usa Actualizar para comprobar.',
    replyHint: 'Envío oficial · auditado · sin automatización silenciosa',
    suggest: 'Sugerir con IA',
    suggesting: 'Pensando…',
    suggested: 'Sugerencia de NestAI lista para revisar. Tu borrador se conserva.',
    applySuggestion: 'Usar sugerencia',
    discardSuggestion: 'Descartar',
    replyLocked: 'Respuesta no disponible',
    replyLockedDesc: 'El canal de salida todavía no está habilitado para esta conversación.',
    reopenForReply: 'Reabre la conversación antes de responder por el canal oficial.',
    context: 'Contexto de la conversación',
    noteTitle: 'Notas internas',
    noteDesc: 'Solo tu equipo puede verlas. Nunca se envían al contacto.',
    notePlaceholder: 'Escribe una nota interna…',
    noteSave: 'Guardar nota',
    noteSaving: 'Guardando nota…',
    noteSaved: 'Nota interna guardada.',
    noteDuplicate: 'Esta nota ya estaba registrada.',
    claim: 'Tomar atención',
    waiting: 'Esperar respuesta',
    resolve: 'Resolver',
    reopen: 'Reabrir',
    archive: 'Archivar',
    threadUpdated: 'Estado de la atención actualizado y registrado.',
    threadDuplicate: 'Esta acción ya estaba registrada.',
    threadRefreshFailed: 'Cambio guardado, pero la lista no se actualizó. Usa Actualizar.',
    actionProgress: 'Guardando cambio…',
    actionsTitle: 'Gestionar atención',
    actionsHint: 'MillionsNest autoriza y audita las acciones en el servidor.',
    close: 'Cerrar',
    organization: 'Organización',
    channel: 'Canal',
    responsible: 'Responsable',
    unassigned: 'Sin asignar',
    mine: 'A mi cargo',
    anotherAgent: 'Agente asignado',
    teamAssigned: 'Equipo asignado',
    state: 'Estado',
    mode: 'Modo',
    next: 'Próximo paso',
    nextNew: 'Asume o responde la conversación.',
    nextInProgress: 'Continúa la atención y registra el resultado.',
    nextWaitingPerson: 'Espera la respuesta sin duplicar el contacto.',
    nextWaitingTeam: 'El equipo debe actuar antes de devolver la conversación.',
    nextResolved: 'Reabre solo si aparece nuevo trabajo.',
    nextArchived: 'Conversación archivada. Reabre por el flujo autorizado si es necesario.',
    assist: 'Consultar en Assist',
    assistDesc: 'Usa una herramienta autorizada del ecosistema sin convertir la consulta en un mensaje enviado.',
    availability: 'Disponibilidad',
    available: 'Disponible',
    controlled: 'Activación controlada',
    blocked: 'No disponible',
    unavailableTitle: 'La atención todavía no está disponible',
    unavailableDesc: 'La lectura de conversaciones permanece cerrada hasta que la infraestructura real esté lista. No se usan datos demo como fallback.',
    governance: 'Ver estado en Gobernanza',
    safe: 'Identidad y permisos se revalidan en el servidor.',
    back: 'Volver a conversaciones',
    openContext: 'Abrir contexto',
    status: {
      new: 'Nuevo',
      in_progress: 'En curso',
      waiting_person: 'Esperando persona',
      waiting_team: 'Esperando equipo',
      resolved: 'Resuelta',
      archived: 'Archivada',
    },
    modes: {
      automatic: 'Automático',
      approval: 'Con aprobación',
      human: 'Humano',
    },
    delivery: {
      received: 'Recibida',
      queued: 'En cola',
      sent: 'Enviada',
      delivered: 'Entregada',
      read: 'Leída',
      failed: 'Falló',
    },
  },
} satisfies Record<LanguageCode, any>;

function shortConversationId(value: string): string {
  return value.length > 16 ? `…${value.slice(-10)}` : value;
}

function isOpenConversation(conversation: LiveInboxConversation) {
  return !['resolved', 'archived'].includes(conversation.status);
}

function nextStep(status: LiveInboxConversation['status'], t: typeof copy['pt-BR']) {
  switch (status) {
    case 'new': return t.nextNew;
    case 'in_progress': return t.nextInProgress;
    case 'waiting_person': return t.nextWaitingPerson;
    case 'waiting_team': return t.nextWaitingTeam;
    case 'resolved': return t.nextResolved;
    case 'archived': return t.nextArchived;
  }
}

export const LiveInboxPage: React.FC<Props> = ({ session, currentLang, onNavigate }) => {
  const t = copy[currentLang];
  const client = useMemo(() => new LiveInboxClient(session), [session]);
  const nestAi = useMemo(() => new ConnectNestAiClient(session, currentLang), [session, currentLang]);
  const [readiness, setReadiness] = useState<LiveInboxReadiness | null>(null);
  const [conversations, setConversations] = useState<LiveInboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<LiveInboxMessage[]>([]);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [query, setQuery] = useState('');
  const [remoteConversations, setRemoteConversations] = useState<LiveInboxConversation[]>([]);
  const [openedRemote, setOpenedRemote] = useState<LiveInboxConversation | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState<boolean | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const timelineSequenceRef = useRef(0);
  const [replySending, setReplySending] = useState(false);
  const [threadActing, setThreadActing] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ scopeKey: string; text: string } | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [internalNotes, setInternalNotes] = useState<LiveInboxInternalNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSending, setNoteSending] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const pendingReplyRef = useRef<InboxReplyAttempt | null>(null);
  const pendingNoteAttemptRef = useRef<{ scope: string; text: string; id: string } | null>(null);
  const pendingThreadActionRef = useRef<InboxThreadActionAttempt | null>(null);
  const loadSequenceRef = useRef(0);
  const selectedScopeRef = useRef('');
  selectedScopeRef.current = `${session.expectedOrganizationId}:${selectedId}`;

  const contentReady = readiness?.foundations.some(
    (item) => item.id === 'message_content_store' && item.status === 'ready',
  ) ?? false;
  const internalNotesEnabled = readiness?.internalNotesEnabled === true;
  const humanReplyReady = readiness?.foundations.some(
    (item) => item.id === 'human_reply' && item.status === 'ready',
  ) ?? false;

  const load = async () => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setLoadingMore(false);
    setError('');
    try {
      const nextReadiness = await client.getReadiness();
      if (sequence !== loadSequenceRef.current) return;
      setReadiness(nextReadiness);
      const canRead = nextReadiness.foundations.some(
        (item) => item.id === 'message_content_store' && item.status === 'ready',
      );

      if (!canRead) {
        setConversations([]);
        setNextCursor(null);
        setSelectedId('');
        setMessages([]);
        return;
      }

      const page = await client.listConversationsPage();
      if (sequence !== loadSequenceRef.current) return;
      setConversations(page.conversations);
      setNextCursor(page.nextCursor);
      setSelectedId((current) => current && page.conversations.some((item) => item.conversationId === current) ? current : '');
    } catch (e) {
      if (sequence === loadSequenceRef.current) setError(e instanceof Error ? e.message : 'INBOX_READINESS_FAILED');
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loading || loadingMore) return;
    const sequence = loadSequenceRef.current;
    setLoadingMore(true);
    try {
      const page = await client.listConversationsPage(50, nextCursor);
      if (sequence !== loadSequenceRef.current) return;
      setConversations(current => [
        ...current,
        ...page.conversations.filter(item => !current.some(old => old.conversationId === item.conversationId)),
      ]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      if (sequence === loadSequenceRef.current) {
        setError(e instanceof Error ? e.message : 'INBOX_PAGINATION_UNAVAILABLE');
      }
    } finally {
      if (sequence === loadSequenceRef.current) setLoadingMore(false);
    }
  };

  useEffect(() => {
    void load();
    return () => { loadSequenceRef.current += 1; };
  }, [client]);

  useEffect(() => {
    // A previous principal/tenant must never leave cached conversations visible
    // while the new session is loading or when its backend is unavailable.
    setReadiness(null);
    setConversations([]);
    setNextCursor(null);
    setRemoteConversations([]);
    setOpenedRemote(null);
    setSearchEnabled(null);
    setSelectedId('');
    setMessages([]);
    setInternalNotes([]);
    setNoteDraft('');
    setNoteError('');
    pendingNoteAttemptRef.current = null;
    setDrafts({});
    setSuggestion(null);
    pendingReplyRef.current = null;
    pendingThreadActionRef.current = null;
    setShowContext(false);
  }, [client]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteConversations([]);
      setSearchEnabled(null);
      setSearchBusy(false);
      return;
    }
    let cancelled = false;
    setSearchBusy(true);
    const timer = setTimeout(() => {
      void client.searchConversations(trimmed)
        .then(result => {
          if (cancelled) return;
          setRemoteConversations(result.conversations);
          setSearchEnabled(result.enabled);
        })
        .catch(() => {
          if (cancelled) return;
          setRemoteConversations([]);
          setSearchEnabled(false);
        })
        .finally(() => { if (!cancelled) setSearchBusy(false); });
    }, 360);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [client, query]);

  useEffect(() => {
    const sequence = ++timelineSequenceRef.current;
    setOlderCursor(null);
    setOlderLoading(false);
    setMessages([]);
    if (!selectedId) {
      setTimelineLoading(false);
      return;
    }

    let cancelled = false;
    setTimelineLoading(true);
    setError('');
    void client.listMessagesPage(selectedId)
      .then((page) => {
        if (cancelled || sequence !== timelineSequenceRef.current) return;
        setMessages(page.messages);
        setOlderCursor(page.olderCursor);
      })
      .catch((e) => {
        if (!cancelled && sequence === timelineSequenceRef.current) {
          setError(e instanceof Error ? e.message : 'INBOX_MESSAGES_FAILED');
        }
      })
      .finally(() => {
        if (!cancelled && sequence === timelineSequenceRef.current) setTimelineLoading(false);
      });
    return () => { cancelled = true; timelineSequenceRef.current += 1; };
  }, [client, selectedId]);

  useEffect(() => {
    setInternalNotes([]);
    setNoteDraft('');
    setNoteError('');
    pendingNoteAttemptRef.current = null;
    if (!selectedId || !internalNotesEnabled) return;
    let cancelled = false;
    setNotesLoading(true);
    void client.listInternalNotes(selectedId)
      .then(items => { if (!cancelled) setInternalNotes(items); })
      .catch(() => { if (!cancelled) setNoteError('INBOX_NOTE_READ_UNAVAILABLE'); })
      .finally(() => { if (!cancelled) setNotesLoading(false); });
    return () => { cancelled = true; };
  }, [client, selectedId, internalNotesEnabled]);

  useEffect(() => {
    if (!showContext) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowContext(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showContext]);

  const loadOlderMessages = async () => {
    if (!selectedId || !olderCursor || olderLoading || timelineLoading) return;
    const scope = selectedScopeRef.current;
    const sequence = timelineSequenceRef.current;
    setOlderLoading(true);
    setError('');
    try {
      const page = await client.listMessagesPage(selectedId, 100, olderCursor);
      if (sequence !== timelineSequenceRef.current || selectedScopeRef.current !== scope) return;
      setMessages((current) => [
        ...page.messages.filter(message => !current.some(existing => existing.messageId === message.messageId)),
        ...current,
      ]);
      setOlderCursor(page.olderCursor);
    } catch (e) {
      if (sequence === timelineSequenceRef.current && selectedScopeRef.current === scope) {
        setError(e instanceof Error ? e.message : 'INBOX_MESSAGE_PAGE_UNAVAILABLE');
      }
    } finally {
      if (sequence === timelineSequenceRef.current && selectedScopeRef.current === scope) setOlderLoading(false);
    }
  };

  const canManage = canShowInboxManagement(session.context);
  const selected = conversations.find((conversation) => conversation.conversationId === selectedId)
    ?? (openedRemote?.conversationId === selectedId ? openedRemote : null);
  const draftKey = selected ? `${session.expectedOrganizationId}:${selected.conversationId}` : '';
  const replyText = draftKey ? drafts[draftKey] || '' : '';
  const activeSuggestion = suggestion?.scopeKey === draftKey ? suggestion.text : '';

  const searchPool = query.trim().length >= 2
    ? [...conversations, ...remoteConversations.filter(remote =>
        !conversations.some(local => local.conversationId === remote.conversationId))]
    : conversations;

  const visibleConversations = searchPool
    .filter((conversation) => {
      if (filter === 'open' && !isOpenConversation(conversation)) return false;
      if (filter === 'resolved' && !['resolved', 'archived'].includes(conversation.status)) return false;
      const normalized = query.trim().toLocaleLowerCase(currentLang);
      if (!normalized) return true;
      return [
        conversation.conversationId,
        conversation.contact?.displayName || '',
        conversation.status,
        conversation.mode,
        conversation.assignedTo?.ref || '',
      ].some((value) => value.toLocaleLowerCase(currentLang).includes(normalized));
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const suggestReply = async () => {
    if (!selected || aiSuggesting || messages.length === 0 || !isOpenConversation(selected)) return;
    setAiSuggesting(true);
    setError('');
    setNotice('');
    const requestedScope = draftKey;
    try {
      const text = await nestAi.suggestReply({
        conversationId: selected.conversationId,
        messages,
        currentDraft: replyText,
      });
      if (selectedScopeRef.current === requestedScope) {
        setSuggestion({ scopeKey: requestedScope, text });
        setNotice(t.suggested);
      }
    } catch (e) {
      if (selectedScopeRef.current === requestedScope) {
        setError(e instanceof Error ? e.message : 'NESTAI_REPLY_SUGGESTION_FAILED');
      }
    } finally {
      setAiSuggesting(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !isOpenConversation(selected) || !humanReplyReady || !replyText.trim() || replySending) return;
    const submittedConversationId = selected.conversationId;
    const submittedOrgId = session.expectedOrganizationId;
    const attempt = prepareInboxReplyAttempt(
      pendingReplyRef.current,
      draftKey,
      replyText,
      () => globalThis.crypto?.randomUUID?.() || `reply-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    pendingReplyRef.current = attempt;
    setReplySending(true);
    setError('');
    setNotice('');
    try {
      const result = await client.sendReply({
        conversationId: submittedConversationId,
        requestId: attempt.requestId,
        text: attempt.text,
      });
      // A successful provider request is different from refreshing the timeline.
      pendingReplyRef.current = null;
      setSuggestion((current) => current?.scopeKey === draftKey ? null : current);
      setDrafts((current) => current[draftKey]?.trim() === attempt.text ? { ...current, [draftKey]: '' } : current);
      if (selectedScopeRef.current === draftKey) {
        setNotice(result.kind === 'duplicate' ? t.alreadySent : t.sent);
      }
      try {
        const [timeline, nextConversations] = await Promise.all([
          client.listMessagesPage(submittedConversationId),
          client.listConversations(),
        ]);
        if (selectedScopeRef.current.startsWith(`${submittedOrgId}:`)) setConversations(nextConversations);
        if (selectedScopeRef.current === draftKey) {
          timelineSequenceRef.current += 1;
          setMessages(timeline.messages);
          setOlderCursor(timeline.olderCursor);
        }
      } catch {
        if (selectedScopeRef.current === draftKey) setError(t.refreshFailed);
      }
    } catch (e) {
      // Preserve requestId after uncertain network outcomes; backend idempotency
      // can reconcile a retry without sending the same text a second time.
      if (selectedScopeRef.current === draftKey) {
        setError(e instanceof Error ? e.message : 'HUMAN_REPLY_UNAVAILABLE');
      }
    } finally {
      setReplySending(false);
    }
  };
  const runThreadAction = async (action: InboxThreadAction) => {
    if (!selected || !canManage || threadActing || replySending || !availableInboxThreadActions(selected.status).includes(action)) return;
    const scopeKey = draftKey;
    const attempt = prepareInboxThreadActionAttempt(
      pendingThreadActionRef.current,
      scopeKey,
      action,
      action === 'assign' ? session.context.user.uid : '',
      () => globalThis.crypto?.randomUUID?.() || `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    pendingThreadActionRef.current = attempt;
    setThreadActing(true);
    setNotice('');
    setError('');
    try {
      const result = await client.manageThread({
        conversationId: selected.conversationId,
        action,
        requestId: attempt.requestId,
        evidenceRef: selected.lastEvidenceRef,
        ...(action === 'assign' ? { assigneeRef: session.context.user.uid } : {}),
      });
      pendingThreadActionRef.current = null;
      if (selectedScopeRef.current !== scopeKey) return;
      setConversations((current) => current.map((item) =>
        item.conversationId === result.thread.conversationId ? result.thread : item));
      setNotice(result.outcome === 'duplicate' ? t.threadDuplicate : t.threadUpdated);
      try {
        const updated = await client.listConversations();
        if (selectedScopeRef.current === scopeKey) setConversations(updated);
      } catch {
        if (selectedScopeRef.current === scopeKey) setError(t.threadRefreshFailed);
      }
    } catch (e) {
      // Retry the same requestId after a transient failure; the event store is idempotent.
      if (selectedScopeRef.current === scopeKey) {
        setError(e instanceof Error ? e.message : 'INBOX_COMMAND_FAILED');
      }
    } finally {
      setThreadActing(false);
    }
  };

  const actionLabel: Record<InboxThreadAction, string> = {
    assign: t.claim,
    wait_for_person: t.waiting,
    resolve: t.resolve,
    reopen: t.reopen,
    archive: t.archive,
  };

  const saveInternalNote = async () => {
    if (!selected || !canManage || !internalNotesEnabled || noteSending || !noteDraft.trim()) return;
    const scope = draftKey, body = noteDraft.trim();
    let attempt = pendingNoteAttemptRef.current;
    if (!attempt || attempt.scope !== scope || attempt.text !== body) {
      attempt = {
        scope, text: body,
        id: globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      pendingNoteAttemptRef.current = attempt;
    }
    setNoteSending(true);
    setNoteError('');
    try {
      const result = await client.addInternalNote({
        conversationId: selected.conversationId, requestId: attempt.id, body,
      });
      if (selectedScopeRef.current !== scope) return;
      pendingNoteAttemptRef.current = null;
      setNoteDraft('');
      setInternalNotes(current =>
        current.some(item => item.noteId === result.note.noteId) ? current : [result.note, ...current]);
      setNotice(result.outcome === 'duplicate' ? t.noteDuplicate : t.noteSaved);
    } catch (error) {
      if (selectedScopeRef.current === scope) {
        setNoteError(error instanceof Error ? error.message : 'INBOX_NOTE_WRITE_UNAVAILABLE');
      }
    } finally {
      setNoteSending(false);
    }
  };

  const contextPanel = selected ? (
    <div className="flex h-full flex-col">
      <div className="border-b connect-divider px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#F2F5FA]">{t.context}</div>
            <div className="mt-1 font-mono text-[9px] text-[#64788D]">{shortConversationId(selected.conversationId)}</div>
          </div>
          <button
            type="button"
            onClick={() => setShowContext(false)}
            className="connect-focus grid h-9 w-9 place-items-center rounded-lg text-[#708398] hover:bg-white/[0.04] hover:text-white xl:hidden"
            aria-label={t.close}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#66D9EF]/18 bg-[#163442] text-[#66D9EF]">
            <UserRound size={17} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#EAF1F6]">{selected.contact?.displayName || t.unidentified}</div>
            <div className="mt-1 text-[11px] text-[#8096AA]">{selected.contact ? t.profileLabel : session.context.activeOrganization.name}</div>
          </div>
        </div>

        <dl className="mt-5 divide-y divide-[#27394B] border-y border-[#27394B] text-[11px]">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[#687C91]">{t.organization}</dt>
            <dd className="max-w-[180px] truncate text-right font-medium text-[#C7D2DC]">{session.context.activeOrganization.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[#687C91]">{t.channel}</dt>
            <dd className="font-medium text-[#C7D2DC]">{messages[0]?.channel || '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[#687C91]">{t.responsible}</dt>
            <dd className="max-w-[180px] truncate text-right font-medium text-[#C7D2DC]">{!selected.assignedTo ? t.unassigned : selected.assignedTo.ref === session.context.user.uid ? session.context.user.name : selected.assignedTo.type === 'team' ? t.teamAssigned : t.anotherAgent}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[#687C91]">{t.state}</dt>
            <dd className="font-medium text-[#C7D2DC]">{t.status[selected.status]}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[#687C91]">{t.mode}</dt>
            <dd className="font-medium text-[#C7D2DC]">{t.modes[selected.mode]}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <div className="text-[9px] font-semibold uppercase tracking-[.13em] text-[#6A7E93]">{t.next}</div>
          <p className="mt-2 text-xs leading-5 text-[#A7B5C3]">{nextStep(selected.status, t)}</p>
        </div>

        {internalNotesEnabled && (
          <section className="mt-5 border-t border-[#2B3A4D] pt-5" aria-label={t.noteTitle}>
            <h3 className="text-xs font-semibold text-[#EAF1F6]">{t.noteTitle}</h3>
            <p className="mt-1.5 text-[11px] leading-5 text-[#94A7BB]">{t.noteDesc}</p>
            {notesLoading && <Loader2 size={15} className="mt-3 animate-spin text-[#7EABC4]" aria-label={t.loadingMore} />}
            {noteError && <p className="mt-3 break-words text-xs text-[#FFB7C0]" role="alert">{noteError}</p>}
            <div className="mt-3 max-h-[210px] space-y-2 overflow-y-auto">
              {internalNotes.map(note => (
                <article key={note.noteId} className="rounded-lg border border-[#2C3D4F] bg-[#0D1825] p-3">
                  <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[#D9E5EF]">{note.body}</p>
                  <time className="mt-2 block text-[11px] text-[#8095A9]" dateTime={note.recordedAt}>
                    {new Date(note.recordedAt).toLocaleString(currentLang, { dateStyle: 'short', timeStyle: 'short' })}
                  </time>
                </article>
              ))}
            </div>
            {canManage && (
              <div className="mt-3 space-y-2">
                <textarea
                  aria-label={t.notePlaceholder}
                  value={noteDraft}
                  onChange={(event) => {
                    const next = event.target.value.slice(0, 2000);
                    if (pendingNoteAttemptRef.current?.text !== next.trim()) pendingNoteAttemptRef.current = null;
                    setNoteDraft(next);
                  }}
                  rows={3}
                  placeholder={t.notePlaceholder}
                  className="connect-focus min-h-[86px] w-full resize-y rounded-lg border border-[#344A5E] bg-[#101C29] p-3 text-base leading-6 text-[#E9F1F8] outline-none placeholder:text-[#71879C] md:text-sm"
                />
                <button
                  type="button"
                  onClick={() => void saveInternalNote()}
                  disabled={!noteDraft.trim() || noteSending}
                  className="connect-focus min-h-11 w-full rounded-lg border border-[#315064] bg-[#163442] px-3 text-xs font-semibold text-[#C8F2FA] disabled:opacity-40"
                >
                  {noteSending ? t.noteSaving : t.noteSave}
                </button>
              </div>
            )}
          </section>
        )}

        {canManage && selected.status !== 'archived' && (
          <section className="mt-5" aria-label={t.actionsTitle}>
            <h3 className="text-xs font-semibold text-[#E8EFF5]">{t.actionsTitle}</h3>
            <p className="mt-1.5 text-[12px] leading-5 text-[#8DA1B5]">{t.actionsHint}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {availableInboxThreadActions(selected.status).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void runThreadAction(action)}
                  disabled={threadActing || replySending || (action === 'assign' && selected.assignedTo?.ref === session.context.user.uid)}
                  className={`connect-focus min-h-11 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${action === 'resolve'
                    ? 'border-[#66D9EF]/25 bg-[#163442]/60 text-[#BBF2F9] hover:bg-[#163442]'
                    : 'border-[#2B3A4D] bg-[#111A27] text-[#C4D2DF] hover:border-[#395369] hover:bg-[#182433]'}`}
                >
                  {threadActing ? t.actionProgress : actionLabel[action]}
                </button>
              ))}
            </div>
          </section>
        )}

        {onNavigate && session.context.appAccess.some((item) => item.access) && (
          <button
            type="button"
            onClick={() => onNavigate('assist')}
            className="connect-focus mt-5 flex w-full items-center gap-3 rounded-[10px] border border-[#315064] bg-[#163442]/40 p-3 text-left transition hover:bg-[#163442]/65"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#66D9EF]/10 text-[#66D9EF]">
              <ShieldCheck size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-[#DDF8FC]">{t.assist}</span>
              <span className="mt-1 block text-[10px] leading-4 text-[#7F9AA5]">{t.assistDesc}</span>
            </span>
            <ChevronRight size={14} className="shrink-0 text-[#7DBECA]" />
          </button>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-[10px] border border-[#2B3A4D] bg-[#0C141E] p-3 text-[10px] leading-4 text-[#708398]">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#7FA4B8]" />
          {t.safe}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-4 pb-28 lg:pb-8">
      <header className="flex items-end justify-between gap-4 px-1 pt-1">
        <div>
          <div className="connect-eyebrow">{t.eyebrow}</div>
          <h1 className="connect-page-title mt-2">{t.title}</h1>
          <p className="connect-page-subtitle mt-1.5 max-w-2xl">{t.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="connect-focus grid h-9 w-9 place-items-center rounded-[9px] border border-[#2B3A4D] bg-[#111A27] text-[#8194A8] hover:text-white disabled:opacity-40"
            aria-label={t.refresh}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[#FF9AA7]/20 bg-[#FF9AA7]/[0.06] px-4 py-3 text-xs text-[#FFD0D5]">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#7CDEB3]/20 bg-[#7CDEB3]/[0.06] px-4 py-3 text-xs text-[#B9F0D6]">
          <CheckCircle2 size={15} /> {notice}
        </div>
      )}

      {!loading && !contentReady ? (
        <section className="connect-surface grid min-h-[460px] place-items-center rounded-[14px] px-6 py-12 text-center">
          <div className="max-w-lg">
            <LockKeyhole size={27} className="mx-auto text-[#75899E]" />
            <h2 className="mt-4 text-base font-semibold text-[#E8EFF5]">{t.unavailableTitle}</h2>
            <p className="mt-2 text-xs leading-5 text-[#71849A]">{t.unavailableDesc}</p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('audit')}
                className="connect-focus mt-5 inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-[#2B3A4D] bg-[#111A27] px-4 text-xs font-semibold text-[#C6D4DF] hover:bg-[#162231]"
              >
                {t.governance} <ChevronRight size={13} />
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="connect-surface grid min-h-[620px] overflow-hidden rounded-[14px] md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)_320px]">
          <aside className={`${selected ? 'hidden md:flex' : 'flex'} min-h-[620px] flex-col border-r connect-divider`}>
            <div className="border-b connect-divider p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-[#E7EEF4]">{t.conversations}</div>
                <span className="rounded-md border border-[#2B3A4D] bg-[#0D151F] px-2 py-0.5 text-[9px] text-[#75899D]">{conversations.length}</span>
              </div>

              <div className="mt-3 flex items-center gap-1">
                {([
                  ['all', t.all],
                  ['open', t.open],
                  ['resolved', t.resolved],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={`connect-focus min-h-8 flex-1 rounded-lg border px-2 text-[9px] font-semibold transition ${filter === id
                      ? 'border-[#66D9EF]/25 bg-[#163442]/70 text-[#B8F0F9]'
                      : 'border-[#27394B] text-[#708398] hover:text-[#AAB8C9]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="mt-3 flex h-9 items-center gap-2 rounded-[9px] border border-[#27394B] bg-[#0C141E] px-3 focus-within:border-[#66D9EF]/30">
                <Search size={13} className="shrink-0 text-[#62768A]" />
                <input
                  value={query}
                  aria-label={t.search}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className="min-w-0 flex-1 bg-transparent text-base text-[#D9E2EA] outline-none placeholder:text-[#526579] md:text-sm"
                />
              </label>
              {query.trim().length >= 2 && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[#8295AA]" role="status">
                  {searchBusy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                  {searchBusy ? t.searchIndex : searchEnabled === false ? t.searchLocal : ''}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-0 divide-y divide-[#263648]/60">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="animate-pulse px-4 py-4">
                      <div className="h-3 w-32 rounded bg-white/[0.05]" />
                      <div className="mt-2 h-2.5 w-44 rounded bg-white/[0.03]" />
                    </div>
                  ))}
                </div>
              ) : visibleConversations.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Inbox size={23} className="mx-auto text-[#5C7085]" />
                  <div className="mt-3 text-xs font-semibold text-[#CBD6DF]">{t.noConversation}</div>
                  <p className="mt-2 text-[10px] leading-5 text-[#61758A]">{t.noConversationDesc}</p>
                </div>
              ) : (
                <div className="divide-y divide-[#263648]/60">
                  {visibleConversations.map((conversation) => {
                    const active = selectedId === conversation.conversationId;
                    return (
                      <button
                        key={conversation.conversationId}
                        type="button"
                        onClick={() => {
                          setOpenedRemote(conversation);
                          setSelectedId(conversation.conversationId);
                          setShowContext(false);
                        }}
                        className={`connect-row connect-focus w-full px-4 py-3.5 text-left ${active ? 'connect-row-selected' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${active ? 'border-[#66D9EF]/24 bg-[#163442] text-[#66D9EF]' : 'border-[#324659] bg-[#111A27] text-[#71869A]'}`}>
                            <MessageSquareText size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13px] font-semibold text-[#E8EFF5]">{conversation.contact?.displayName || t.unidentified}</span>
                              <span className="shrink-0 text-[11px] text-[#93A5B8]">{new Date(conversation.updatedAt).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                            <span className="mt-1 block truncate text-[12px] text-[#8295AA]">
                              {t.status[conversation.status]} · {conversation.assignedTo?.ref === session.context.user.uid ? t.mine : conversation.assignedTo ? t.responsible : t.unassigned}
                            </span>
                            <span className="mt-1 block truncate text-[10px] text-[#64788D]">
                              {conversation.contact ? t.profileLabel : shortConversationId(conversation.conversationId)}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {!loading && !query.trim() && nextCursor && (
                <div className="border-t border-[#263648] p-3">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="connect-focus flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#31475A] bg-[#122031] px-3 text-xs font-semibold text-[#B8D8E8] hover:bg-[#182B3F] disabled:opacity-40"
                  >
                    {loadingMore && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                    {loadingMore ? t.loadingMore : t.loadMore}
                  </button>
                </div>
              )}
            </div>
          </aside>

          <section className={`${selected ? 'flex' : 'hidden md:flex'} min-w-0 flex-col bg-[#0B121B]/35`}>
            {!selected ? (
              <div className="grid flex-1 place-items-center px-6 py-12 text-center">
                <div className="max-w-sm">
                  <MessageSquareText size={28} className="mx-auto text-[#5B6F84]" />
                  <h2 className="mt-4 text-sm font-semibold text-[#DCE5ED]">{t.select}</h2>
                  <p className="mt-2 text-xs leading-5 text-[#667A90]">{t.selectDesc}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex min-h-[58px] items-center gap-3 border-b connect-divider px-3.5 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setSelectedId('')}
                    className="connect-focus grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#7A8EA3] hover:bg-white/[0.04] md:hidden"
                    aria-label={t.back}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#315064] bg-[#163442] text-[#66D9EF]">
                    <MessageSquareText size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[#EEF4F8]">{selected.contact?.displayName || t.unidentified}</div>
                    <div className="mt-0.5 text-[11px] text-[#899AAF]">{t.status[selected.status]} · {t.modes[selected.mode]}{selected.contact ? ` · ${t.profileLabel}` : ''}</div>
                  </div>
                  {canManage && selected.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => void runThreadAction(selected.status === 'resolved' ? 'reopen' : 'resolve')}
                      disabled={threadActing || replySending}
                      className="connect-focus inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#315064] bg-[#163442]/45 px-2.5 text-xs font-semibold text-[#B7EDF5] disabled:opacity-40"
                    >
                      {selected.status === 'resolved' ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                      <span className="hidden sm:inline">{selected.status === 'resolved' ? t.reopen : t.resolve}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowContext(true)}
                    className="connect-focus grid h-9 w-9 place-items-center rounded-lg border border-[#2B3A4D] text-[#8094A8] hover:bg-white/[0.04] xl:hidden"
                    aria-label={t.openContext}
                  >
                    <PanelRightOpen size={16} />
                  </button>
                </div>

                <div className="relative flex-1 overflow-y-auto px-3.5 py-5 sm:px-5">
                  {timelineLoading ? (
                    <div className="grid min-h-[300px] place-items-center text-[#687C91]"><Loader2 size={20} className="animate-spin" /></div>
                  ) : messages.length === 0 ? (
                    <div className="grid min-h-[300px] place-items-center px-6 text-center text-xs text-[#667A90]">{t.noMessages}</div>
                  ) : (
                    <div className="mx-auto max-w-3xl space-y-3">
                      {olderCursor && (
                        <div className="flex justify-center pb-4">
                          <button
                            type="button"
                            onClick={() => void loadOlderMessages()}
                            disabled={olderLoading}
                            className="connect-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#31475A] bg-[#122031] px-4 text-xs font-semibold text-[#B8D8E8] hover:bg-[#182B3F] disabled:opacity-40"
                          >
                            {olderLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                            {olderLoading ? t.olderMessagesLoading : t.olderMessages}
                          </button>
                        </div>
                      )}
                      {messages.map((message, index) => {
                        const outbound = message.direction === 'outbound';
                        const previous = messages[index - 1];
                        const showDay = !previous || timelineDayKey(previous.occurredAt, currentLang) !== timelineDayKey(message.occurredAt, currentLang);
                        return (
                          <React.Fragment key={message.messageId}>
                            {showDay && (
                              <div className="flex items-center gap-3 py-4 text-[11px] font-medium text-[#92A7BC]">
                                <span className="h-px flex-1 bg-[#26384A]" />
                                <time dateTime={message.occurredAt}>{timelineDayLabel(message.occurredAt, currentLang, t.today)}</time>
                                <span className="h-px flex-1 bg-[#26384A]" />
                              </div>
                            )}
                            <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                            <article className={`max-w-[88%] rounded-[14px] border px-3.5 py-3 sm:max-w-[76%] ${outbound
                              ? 'border-[#315064] bg-[#163442]/55'
                              : 'border-[#2B3A4D] bg-[#111A27]'}`}>
                              <p className="whitespace-pre-wrap break-words text-[13px] leading-5 text-[#E1E9F0]">{message.body || `[${message.messageType}]`}</p>
                              <div className="mt-2 flex items-center justify-end gap-2 text-[8px] text-[#677B90]">
                                <span>{new Date(message.occurredAt).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={message.deliveryStatus === 'failed' ? 'text-[#FF9AA7]' : ''}>{t.delivery[message.deliveryStatus]}</span>
                              </div>
                            </article>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t connect-divider bg-[#0B121B]/80 p-3 sm:p-4">
                  {humanReplyReady && isOpenConversation(selected) ? (
                    <div className="mx-auto max-w-3xl">
                      {activeSuggestion && (
                        <div className="mb-3 rounded-[12px] border border-[#315064] bg-[#122334] p-3" aria-live="polite">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#B6F1F9]">
                            <Sparkles size={14} aria-hidden="true" /> {t.suggested}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#E8EFF5]">{activeSuggestion}</p>
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSuggestion(null)}
                              className="connect-focus min-h-10 rounded-lg border border-[#365064] px-3 text-xs font-semibold text-[#AAB8C9] hover:text-white"
                            >
                              {t.discardSuggestion}
                            </button>
                            <button
                              type="button"
                              disabled={replySending}
                              onClick={() => {
                                setDrafts((current) => ({ ...current, [draftKey]: activeSuggestion }));
                                pendingReplyRef.current = null;
                                setSuggestion(null);
                                setNotice('');
                              }}
                              className="connect-accent-button connect-focus min-h-10 rounded-lg px-4 text-xs font-semibold disabled:opacity-40"
                            >
                              {t.applySuggestion}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="rounded-[12px] border border-[#31465A] bg-[#101A27] p-2 focus-within:border-[#66D9EF]/35">
                        <textarea
                          value={replyText}
                          aria-label={t.replyPlaceholder}
                          onChange={(event) => {
                            const next = event.target.value.slice(0, 4096);
                            if (pendingReplyRef.current?.scopeKey === draftKey && pendingReplyRef.current.text !== next.trim()) {
                              pendingReplyRef.current = null;
                            }
                            setDrafts((current) => ({ ...current, [draftKey]: next }));
                          }}
                          placeholder={t.replyPlaceholder}
                          rows={2}
                          className="w-full resize-none bg-transparent px-2 py-1.5 text-base leading-6 text-[#EEF4F8] outline-none placeholder:text-[#5A6E82] md:text-sm"
                        />
                        <div className="mt-1 flex items-center justify-between gap-3 border-t border-[#27394B] pt-2">
                          <span className="hidden text-[9px] text-[#5F7388] sm:block">{t.replyHint}</span>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void suggestReply()}
                              disabled={aiSuggesting || messages.length === 0}
                              className="connect-focus inline-flex min-h-9 items-center justify-center gap-2 rounded-[9px] border border-[#315064] bg-[#163442]/55 px-3 text-xs font-semibold text-[#B6F1F9] transition hover:bg-[#163442]/80 disabled:cursor-not-allowed disabled:opacity-35"
                              title={t.suggested}
                            >
                              {aiSuggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                              {aiSuggesting ? t.suggesting : t.suggest}
                            </button>
                            <button
                              type="button"
                              onClick={() => void sendReply()}
                              disabled={!replyText.trim() || replySending}
                              className="connect-accent-button connect-focus inline-flex min-h-9 items-center justify-center gap-2 rounded-[9px] px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              {replySending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                              {replySending ? t.sending : t.send}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-3xl items-start gap-2 rounded-[10px] border border-[#F1C77A]/15 bg-[#F1C77A]/[0.045] p-3 text-[10px] leading-4 text-[#B9A47B]">
                      <LockKeyhole size={13} className="mt-0.5 shrink-0 text-[#F1C77A]" />
                      <span><strong className="font-semibold text-[#E5D3AC]">{t.replyLocked}.</strong> {!isOpenConversation(selected) ? t.reopenForReply : t.replyLockedDesc}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <aside className="hidden min-h-0 border-l connect-divider xl:block">
            {contextPanel}
          </aside>
        </section>
      )}

      {showContext && selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/55 p-3 backdrop-blur-[2px] xl:hidden" role="dialog" aria-modal="true" aria-label={t.context}>
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setShowContext(false)} aria-label={t.close} />
          <aside className="connect-surface-raised relative z-10 max-h-[88dvh] w-full overflow-hidden rounded-[16px] sm:max-w-[380px]">
            {contextPanel}
          </aside>
        </div>
      )}
    </main>
  );
};
