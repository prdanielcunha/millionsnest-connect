import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Inbox,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import {
  LiveInboxClient,
  type LiveInboxConversation,
  type LiveInboxMessage,
  type LiveInboxReadiness,
} from '../../core/client/liveInboxClient';
import type { LanguageCode } from '../../types';

interface Props {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}

const copy = {
  'pt-BR': {
    eyebrow: 'TRABALHO · CAIXA DE ENTRADA',
    title: 'Atendimento real, sem conversas de mentira.',
    subtitle: 'A Inbox mostra somente conversas persistidas pelo Connect. Nenhum contato, mensagem ou contador é inventado para preencher a tela.',
    refresh: 'Atualizar',
    blocked: 'Bloqueada',
    controlled: 'Ativação controlada',
    available: 'Disponível',
    storage: 'Persistência',
    durable: 'Inbox durável',
    auth: 'Autoridade',
    yes: 'Ligada',
    no: 'Desligada',
    ready: 'Pronto',
    gated: 'Protegido por gate',
    next: 'Próxima etapa',
    foundations: 'Fundações da Inbox',
    blockers: 'O que ainda impede o fluxo completo',
    noFake: 'Sem fallback para dados demo',
    noFakeDesc: 'Se nenhuma conversa real chegou, a Inbox fica vazia. Isso é intencional.',
    privacy: 'PII separada do estado da conversa',
    privacyDesc: 'Corpo de mensagem fica em storage sensível. Metadados canônicos de thread continuam sem telefone, nome ou texto.',
    conversations: 'Conversas',
    timeline: 'Mensagens',
    empty: 'Nenhuma conversa real ainda',
    emptyDesc: 'A estrutura está pronta para leitura. A primeira conversa aparecerá quando uma ingestão oficial habilitada persistir dados reais.',
    select: 'Selecione uma conversa',
    selectDesc: 'Escolha uma conversa ao lado para abrir a linha do tempo.',
    noMessages: 'Nenhuma mensagem persistida para esta conversa.',
    inbound: 'Pessoa',
    outbound: 'Equipe',
    replyLocked: 'Resposta humana ainda protegida',
    replyLockedDesc: 'A leitura já pode ser real. O envio continuará indisponível até o provider oficial de saída passar pelo próprio gate.',
    replyPlaceholder: 'Escreva uma resposta…',
    replySend: 'Enviar',
    replySending: 'Enviando…',
    replySent: 'Resposta enviada pelo canal oficial.',
    replyHint: 'Envio oficial · auditado · sem automação silenciosa',
    updated: 'Atualizada',
    events: 'eventos',
    storageStates: {
      read_write_confirmed: 'Leitura e gravação confirmadas',
      read_only: 'Somente leitura',
      denied_or_missing: 'Permissões ausentes',
      unknown: 'Não confirmado',
    },
    foundationLabels: {
      thread_state_machine: 'Máquina de estados',
      durable_event_store: 'Event store durável',
      authority: 'RBAC / autoridade',
      message_content_store: 'Conteúdo de mensagens',
      provider_ingestion: 'Ingestão de canal',
      human_reply: 'Resposta humana',
    },
  },
  'en-US': {
    eyebrow: 'WORK · INBOX',
    title: 'Real support, without fake conversations.',
    subtitle: 'Inbox shows only conversations persisted by Connect. No contact, message or counter is invented to fill the surface.',
    refresh: 'Refresh',
    blocked: 'Blocked',
    controlled: 'Controlled activation',
    available: 'Available',
    storage: 'Persistence',
    durable: 'Durable Inbox',
    auth: 'Authority',
    yes: 'On',
    no: 'Off',
    ready: 'Ready',
    gated: 'Gated',
    next: 'Next step',
    foundations: 'Inbox foundations',
    blockers: 'What still blocks the complete flow',
    noFake: 'No demo-data fallback',
    noFakeDesc: 'If no real conversation has arrived, Inbox stays empty. That is intentional.',
    privacy: 'PII separated from conversation state',
    privacyDesc: 'Message bodies stay in sensitive storage. Canonical thread metadata remains free of phone, name and message text.',
    conversations: 'Conversations',
    timeline: 'Messages',
    empty: 'No real conversations yet',
    emptyDesc: 'The read path is ready. The first conversation will appear when enabled official ingestion persists real data.',
    select: 'Select a conversation',
    selectDesc: 'Choose a conversation to open its timeline.',
    noMessages: 'No persisted messages for this conversation.',
    inbound: 'Person',
    outbound: 'Team',
    replyLocked: 'Human reply is still gated',
    replyLockedDesc: 'Reading can already be real. Sending remains unavailable until the official outbound provider passes its own gate.',
    replyPlaceholder: 'Write a reply…',
    replySend: 'Send',
    replySending: 'Sending…',
    replySent: 'Reply sent through the official channel.',
    replyHint: 'Official delivery · audited · no silent automation',
    updated: 'Updated',
    events: 'events',
    storageStates: {
      read_write_confirmed: 'Read and write confirmed',
      read_only: 'Read only',
      denied_or_missing: 'Permissions missing',
      unknown: 'Not confirmed',
    },
    foundationLabels: {
      thread_state_machine: 'State machine',
      durable_event_store: 'Durable event store',
      authority: 'RBAC / authority',
      message_content_store: 'Message content',
      provider_ingestion: 'Channel ingestion',
      human_reply: 'Human reply',
    },
  },
  'es-ES': {
    eyebrow: 'TRABAJO · BANDEJA DE ENTRADA',
    title: 'Atención real, sin conversaciones falsas.',
    subtitle: 'Inbox muestra solo conversaciones persistidas por Connect. No inventa contactos, mensajes ni contadores para llenar la pantalla.',
    refresh: 'Actualizar',
    blocked: 'Bloqueada',
    controlled: 'Activación controlada',
    available: 'Disponible',
    storage: 'Persistencia',
    durable: 'Inbox duradera',
    auth: 'Autoridad',
    yes: 'Activa',
    no: 'Desactivada',
    ready: 'Listo',
    gated: 'Protegido por gate',
    next: 'Próxima etapa',
    foundations: 'Fundaciones de Inbox',
    blockers: 'Qué impide el flujo completo',
    noFake: 'Sin fallback de datos demo',
    noFakeDesc: 'Si no llegó una conversación real, Inbox queda vacía. Es intencional.',
    privacy: 'PII separada del estado de la conversación',
    privacyDesc: 'El cuerpo del mensaje queda en storage sensible. Los metadatos canónicos siguen sin teléfono, nombre ni texto.',
    conversations: 'Conversaciones',
    timeline: 'Mensajes',
    empty: 'Todavía no hay conversaciones reales',
    emptyDesc: 'La lectura está lista. La primera conversación aparecerá cuando una ingestión oficial habilitada persista datos reales.',
    select: 'Selecciona una conversación',
    selectDesc: 'Elige una conversación para abrir su línea de tiempo.',
    noMessages: 'No hay mensajes persistidos para esta conversación.',
    inbound: 'Persona',
    outbound: 'Equipo',
    replyLocked: 'La respuesta humana sigue protegida',
    replyLockedDesc: 'La lectura ya puede ser real. El envío seguirá desactivado hasta que el provider oficial pase su propio gate.',
    replyPlaceholder: 'Escribe una respuesta…',
    replySend: 'Enviar',
    replySending: 'Enviando…',
    replySent: 'Respuesta enviada por el canal oficial.',
    replyHint: 'Envío oficial · auditado · sin automatización silenciosa',
    updated: 'Actualizada',
    events: 'eventos',
    storageStates: {
      read_write_confirmed: 'Lectura y escritura confirmadas',
      read_only: 'Solo lectura',
      denied_or_missing: 'Permisos ausentes',
      unknown: 'No confirmado',
    },
    foundationLabels: {
      thread_state_machine: 'Máquina de estados',
      durable_event_store: 'Event store duradero',
      authority: 'RBAC / autoridad',
      message_content_store: 'Contenido de mensajes',
      provider_ingestion: 'Ingestión de canal',
      human_reply: 'Respuesta humana',
    },
  },
} satisfies Record<LanguageCode, any>;

const blockerLabels: Record<string, Record<LanguageCode, string>> = {
  durable_storage_not_ready: {
    'pt-BR': 'A identidade de runtime ainda não possui leitura/gravação Firestore confirmada.',
    'en-US': 'The runtime identity still lacks confirmed Firestore read/write access.',
    'es-ES': 'La identidad de runtime aún no tiene lectura/escritura Firestore confirmada.',
  },
  durable_inbox_disabled: {
    'pt-BR': 'A Inbox durável está desligada.',
    'en-US': 'Durable Inbox is disabled.',
    'es-ES': 'Inbox duradera está desactivada.',
  },
  message_content_store_not_mounted: {
    'pt-BR': 'A store sensível de conteúdo ainda não está montada.',
    'en-US': 'The sensitive message-content store is not mounted yet.',
    'es-ES': 'La store sensible de contenido aún no está montada.',
  },
  provider_ingestion_not_mounted: {
    'pt-BR': 'A ingestão do canal oficial ainda não está ativada.',
    'en-US': 'Official channel ingestion is not active yet.',
    'es-ES': 'La ingestión del canal oficial aún no está activa.',
  },
  human_reply_not_mounted: {
    'pt-BR': 'A boundary de resposta humana ainda não está ativa.',
    'en-US': 'The human-reply boundary is not active yet.',
    'es-ES': 'La boundary de respuesta humana aún no está activa.',
  },
};

function shortConversationId(value: string): string {
  return value.length > 18 ? `…${value.slice(-12)}` : value;
}

export const LiveInboxPage: React.FC<Props> = ({ session, currentLang }) => {
  const t = copy[currentLang];
  const client = useMemo(() => new LiveInboxClient(session), [session]);
  const [data, setData] = useState<LiveInboxReadiness | null>(null);
  const [conversations, setConversations] = useState<LiveInboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<LiveInboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const readiness = await client.getReadiness();
      setData(readiness);
      const contentReady = readiness.foundations.some(
        (item) => item.id === 'message_content_store' && item.status === 'ready',
      );
      if (contentReady) {
        const next = await client.listConversations();
        setConversations(next);
        setSelectedId((current) =>
          current && next.some((conversation) => conversation.conversationId === current)
            ? current
            : next[0]?.conversationId || '',
        );
      } else {
        setConversations([]);
        setSelectedId('');
        setMessages([]);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [client]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    void client.listMessages(selectedId)
      .then((next) => { if (!cancelled) setMessages(next); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : t.error); })
      .finally(() => { if (!cancelled) setTimelineLoading(false); });
    return () => { cancelled = true; };
  }, [client, selectedId]);

  const stateLabel = data?.state === 'available'
    ? t.available
    : data?.state === 'controlled'
      ? t.controlled
      : t.blocked;
  const contentReady = data?.foundations.some(
    (item) => item.id === 'message_content_store' && item.status === 'ready',
  ) ?? false;
  const selected = conversations.find((conversation) => conversation.conversationId === selectedId) ?? null;
  const humanReplyReady = data?.foundations.some(
    (item) => item.id === 'human_reply' && item.status === 'ready',
  ) ?? false;

  const sendReply = async () => {
    if (!selected || !humanReplyReady || !replyText.trim() || replySending) return;
    setReplySending(true);
    setError('');
    setNotice('');
    try {
      await client.sendReply({
        conversationId: selected.conversationId,
        requestId: globalThis.crypto?.randomUUID?.() || `reply-${Date.now()}`,
        text: replyText.trim(),
      });
      setReplyText('');
      setNotice(t.replySent);
      const [nextMessages, nextConversations] = await Promise.all([
        client.listMessages(selected.conversationId),
        client.listConversations(),
      ]);
      setMessages(nextMessages);
      setConversations(nextConversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'HUMAN_REPLY_UNAVAILABLE');
    } finally {
      setReplySending(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_0%_0%,rgba(99,102,241,.17),transparent_34%),radial-gradient(circle_at_90%_0%,rgba(34,211,238,.07),transparent_28%),rgba(255,255,255,.025)] p-5 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300"><Inbox size={14} /> {t.eyebrow}</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-amber-100">
              <CircleDashed size={12} /> {stateLabel}
            </div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t.refresh}
          </button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">{t.error} <span className="text-rose-100/55">{error}</span></div>}
      {notice && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-100">{notice}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.storage}</div>
          <div className="mt-2 text-sm font-semibold text-white">{data ? t.storageStates[data.storageState] : loading ? '…' : '—'}</div>
        </article>
        <article className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.durable}</div>
          <div className="mt-2 text-sm font-semibold text-white">{data?.durableInboxEnabled ? t.yes : t.no}</div>
        </article>
        <article className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.auth}</div>
          <div className="mt-2 text-sm font-semibold text-white">{data?.authoritySource || '—'}</div>
        </article>
      </section>

      {contentReady && (
        <section className="grid min-h-[520px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.018] lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-white/[0.07] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-4 py-4 sm:px-5">
              <div className="text-sm font-semibold text-white">{t.conversations}</div>
              <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[9px] font-semibold text-slate-500">{conversations.length}</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto lg:max-h-[620px]">
              {conversations.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <MessageSquareText size={24} className="mx-auto text-slate-700" />
                  <div className="mt-3 text-sm font-semibold text-slate-300">{t.empty}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{t.emptyDesc}</p>
                </div>
              ) : conversations.map((conversation) => (
                <button
                  key={conversation.conversationId}
                  type="button"
                  onClick={() => setSelectedId(conversation.conversationId)}
                  className={`block w-full border-t border-white/[0.05] px-4 py-4 text-left transition sm:px-5 ${selectedId === conversation.conversationId ? 'bg-indigo-400/[0.07]' : 'hover:bg-white/[0.025]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">WhatsApp · {shortConversationId(conversation.conversationId)}</div>
                      <div className="mt-1 text-[10px] text-slate-600">{t.updated} {new Date(conversation.updatedAt).toLocaleString(currentLang)}</div>
                    </div>
                    <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-500">{conversation.status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
                    <span>{conversation.mode}</span>
                    <span>{conversation.sourceEventCount} {t.events}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex min-h-[420px] flex-col">
            <div className="border-b border-white/[0.07] px-4 py-4 sm:px-6">
              <div className="text-sm font-semibold text-white">{t.timeline}</div>
              {selected && <div className="mt-1 font-mono text-[9px] text-slate-600">{selected.conversationId}</div>}
            </div>

            {!selected ? (
              <div className="grid flex-1 place-items-center px-6 py-16 text-center">
                <div>
                  <UsersRound size={28} className="mx-auto text-slate-700" />
                  <div className="mt-3 text-sm font-semibold text-slate-300">{t.select}</div>
                  <p className="mt-2 text-xs text-slate-600">{t.selectDesc}</p>
                </div>
              </div>
            ) : timelineLoading ? (
              <div className="grid flex-1 place-items-center text-slate-600"><Loader2 size={22} className="animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="grid flex-1 place-items-center px-6 py-16 text-center text-sm text-slate-600">{t.noMessages}</div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
                {messages.map((message) => (
                  <div key={message.messageId} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <article className={`max-w-[88%] rounded-2xl border px-4 py-3 sm:max-w-[72%] ${message.direction === 'outbound' ? 'border-indigo-400/15 bg-indigo-400/[0.07]' : 'border-white/[0.08] bg-white/[0.035]'}`}>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                        {message.direction === 'outbound' ? t.outbound : t.inbound} · {message.channel}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{message.body || `[${message.messageType}]`}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-600">
                        <span>{new Date(message.occurredAt).toLocaleString(currentLang)}</span>
                        <span>{message.deliveryStatus}</span>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-white/[0.07] bg-black/10 px-4 py-3 sm:px-6">
              {humanReplyReady && selected ? (
                <div className="space-y-2.5">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value.slice(0, 4096))}
                    placeholder={t.replyPlaceholder}
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-white/[0.09] bg-black/20 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-700 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-400/10"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[10px] text-slate-600">{t.replyHint}</div>
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={!replyText.trim() || replySending}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {replySending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {replySending ? t.replySending : t.replySend}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <LockKeyhole size={13} className="mt-0.5 shrink-0 text-amber-200" />
                  <span><strong className="font-semibold text-slate-300">{t.replyLocked}.</strong> {t.replyLockedDesc}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck size={16} className="text-indigo-300" /> {t.foundations}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.foundations || []).map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/[0.07] bg-black/10 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-300">{t.foundationLabels[item.id]}</span>
                {item.status === 'ready'
                  ? <CheckCircle2 size={14} className="text-emerald-300" />
                  : <CircleDashed size={14} className={item.status === 'gated' ? 'text-amber-200' : 'text-slate-600'} />}
              </div>
              <div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                {item.status === 'ready' ? t.ready : item.status === 'gated' ? t.gated : t.next}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-[26px] border border-amber-300/15 bg-amber-300/[0.04] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-50"><LockKeyhole size={16} /> {t.blockers}</div>
          <div className="mt-4 space-y-2">
            {(data?.blockers || []).length ? (data?.blockers || []).map((blocker) => (
              <div key={blocker} className="flex items-start gap-2 text-xs leading-5 text-amber-50/55">
                <CircleDashed size={12} className="mt-1 shrink-0" />
                {blockerLabels[blocker]?.[currentLang] || blocker}
              </div>
            )) : <div className="text-xs text-emerald-200">{t.ready}</div>}
          </div>
        </article>

        <div className="space-y-3">
          <article className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><UsersRound size={16} className="text-indigo-300" /> {t.noFake}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t.noFakeDesc}</p>
          </article>
          <article className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><MessageSquareText size={16} className="text-cyan-300" /> {t.privacy}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t.privacyDesc}</p>
          </article>
        </div>
      </section>
    </main>
  );
};
