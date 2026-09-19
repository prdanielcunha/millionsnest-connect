import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Inbox,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import { LiveInboxClient, type LiveInboxReadiness } from '../../core/client/liveInboxClient';
import type { LanguageCode } from '../../types';

interface Props {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}

const copy = {
  'pt-BR': {
    eyebrow: 'TRABALHO · CAIXA DE ENTRADA',
    title: 'Atendimento real, sem conversas de mentira.',
    subtitle: 'A Inbox só mostra atendimento quando persistência, conteúdo da mensagem, ingestão de canal e resposta humana estiverem realmente conectados. Enquanto isso, você vê exatamente o que já está pronto e o que ainda bloqueia a ativação.',
    refresh: 'Atualizar readiness',
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
    blockers: 'O que ainda impede atendimento real',
    noFake: 'Sem fallback para dados demo',
    noFakeDesc: 'No modo live, o Connect não reutiliza mock de conversas. Isso evita parecer funcional quando uma integração ainda não está pronta.',
    privacy: 'Conteúdo separado do estado da conversa',
    privacyDesc: 'O event store canônico guarda apenas estado, roteamento e referências estáveis. Corpo de mensagem e PII exigem uma store própria com retenção e regras de sensibilidade.',
    error: 'Não foi possível consultar a readiness da Inbox.',
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
    subtitle: 'Inbox only shows support when persistence, message content, channel ingestion and human reply are actually connected. Until then, it shows exactly what is ready and what still blocks activation.',
    refresh: 'Refresh readiness',
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
    blockers: 'What still blocks real support',
    noFake: 'No fallback to demo data',
    noFakeDesc: 'In live mode, Connect never reuses mock conversations. This avoids looking functional before integrations are truly ready.',
    privacy: 'Message content is separate from thread state',
    privacyDesc: 'The canonical event store keeps only state, routing and stable references. Message bodies and PII require their own store with retention and sensitivity rules.',
    error: 'Could not load Inbox readiness.',
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
    subtitle: 'Inbox solo muestra atención cuando persistencia, contenido del mensaje, ingestión de canal y respuesta humana están realmente conectados. Hasta entonces, muestra exactamente qué está listo y qué bloquea la activación.',
    refresh: 'Actualizar readiness',
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
    blockers: 'Qué impide la atención real',
    noFake: 'Sin fallback a datos demo',
    noFakeDesc: 'En modo live, Connect no reutiliza conversaciones mock. Así no parece funcional antes de que las integraciones estén realmente listas.',
    privacy: 'El contenido está separado del estado de la conversación',
    privacyDesc: 'El event store canónico guarda solo estado, routing y referencias estables. Cuerpo de mensaje y PII requieren una store propia con retención y reglas de sensibilidad.',
    error: 'No fue posible consultar la readiness de Inbox.',
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
    'pt-BR': 'A flag da Inbox durável continua desligada até o gate de IAM passar.',
    'en-US': 'The durable Inbox flag stays off until the IAM gate passes.',
    'es-ES': 'La flag de Inbox duradera sigue desactivada hasta que pase el gate de IAM.',
  },
  message_content_store_not_mounted: {
    'pt-BR': 'A store separada para corpo das mensagens/PII ainda não está montada.',
    'en-US': 'The separate message body / PII store is not mounted yet.',
    'es-ES': 'La store separada para cuerpo de mensajes/PII aún no está montada.',
  },
  provider_ingestion_not_mounted: {
    'pt-BR': 'A ingestão do canal oficial ainda não está ligada à Inbox.',
    'en-US': 'Official channel ingestion is not wired into Inbox yet.',
    'es-ES': 'La ingestión del canal oficial aún no está conectada a Inbox.',
  },
  human_reply_not_mounted: {
    'pt-BR': 'A boundary de resposta humana ainda não está ativa.',
    'en-US': 'The human-reply boundary is not active yet.',
    'es-ES': 'La boundary de respuesta humana aún no está activa.',
  },
};

export const LiveInboxPage: React.FC<Props> = ({ session, currentLang }) => {
  const t = copy[currentLang];
  const client = useMemo(() => new LiveInboxClient(session), [session]);
  const [data, setData] = useState<LiveInboxReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setData(await client.getReadiness());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [client]);

  const stateLabel = data?.state === 'available'
    ? t.available
    : data?.state === 'controlled'
      ? t.controlled
      : t.blocked;

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
            {(data?.blockers || []).map((blocker) => (
              <div key={blocker} className="flex items-start gap-2 text-xs leading-5 text-amber-50/55">
                <CircleDashed size={12} className="mt-1 shrink-0" />
                {blockerLabels[blocker]?.[currentLang] || blocker}
              </div>
            ))}
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
