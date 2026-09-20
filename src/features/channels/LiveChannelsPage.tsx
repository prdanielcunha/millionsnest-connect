import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import {
  LiveChannelClient,
  type LiveChannelReadiness,
  type LiveChannelReadinessItem,
} from '../../core/client/liveChannelClient';
import type { LanguageCode } from '../../types';

interface LiveChannelsPageProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}

const copy = {
  'pt-BR': {
    eyebrow: 'OPERAÇÃO · CANAIS',
    title: 'Canais reais, sem fingir conexão.',
    subtitle: 'O Connect mostra o que está realmente ativo, o que está tecnicamente preparado e o que ainda depende de credenciais, IAM ou ativação deliberada.',
    refresh: 'Atualizar status',
    security: 'Segredos ficam somente no servidor',
    securityDesc: 'Tokens, app secret e verify token nunca aparecem no navegador. Esta tela recebe apenas estados e bloqueios seguros.',
    storage: 'Persistência da Inbox',
    storageLabels: {
      read_write_confirmed: 'Leitura e gravação confirmadas',
      read_only: 'Somente leitura',
      denied_or_missing: 'Permissões ausentes',
      unknown: 'Estado não confirmado',
    },
    active: 'Ativo',
    blocked: 'Bloqueado',
    planned: 'Planejado',
    configured: 'Configurado',
    receive: 'Receber',
    send: 'Enviar',
    yes: 'Sim',
    no: 'Não',
    blockers: 'O que falta',
    noBlockers: 'Sem bloqueios',
    foundation: 'Capacidades preparadas',
    error: 'Não foi possível consultar o estado dos canais.',
    empty: 'Nenhum canal retornado pelo Core.',
    waNote: 'O WhatsApp só será marcado como ativo quando webhook oficial, credenciais, Inbox durável e armazenamento estiverem prontos. O envio real permanece separado até a boundary de provider ser implementada.',
    inappNote: 'O canal in-app usa o Connect Core e o Tool Gateway já publicados para consultas reais ao MusicScale.',
  },
  'en-US': {
    eyebrow: 'OPERATIONS · CHANNELS',
    title: 'Real channels, without pretending they are connected.',
    subtitle: 'Connect shows what is actually active, what is technically prepared and what still depends on credentials, IAM or deliberate activation.',
    refresh: 'Refresh status',
    security: 'Secrets stay server-side only',
    securityDesc: 'Tokens, app secret and verify token never reach the browser. This surface receives safe status and blocker information only.',
    storage: 'Inbox persistence',
    storageLabels: {
      read_write_confirmed: 'Read and write confirmed',
      read_only: 'Read only',
      denied_or_missing: 'Permissions missing',
      unknown: 'State not confirmed',
    },
    active: 'Active',
    blocked: 'Blocked',
    planned: 'Planned',
    configured: 'Configured',
    receive: 'Receive',
    send: 'Send',
    yes: 'Yes',
    no: 'No',
    blockers: 'What is missing',
    noBlockers: 'No blockers',
    foundation: 'Prepared capabilities',
    error: 'Could not load channel readiness.',
    empty: 'Core returned no channels.',
    waNote: 'WhatsApp is marked active only when the official webhook, credentials, durable Inbox and storage are ready. Real sending stays separate until the provider boundary is implemented.',
    inappNote: 'The in-app channel uses the published Connect Core and Tool Gateway for real MusicScale queries.',
  },
  'es-ES': {
    eyebrow: 'OPERACIÓN · CANALES',
    title: 'Canales reales, sin fingir conexión.',
    subtitle: 'Connect muestra qué está realmente activo, qué está técnicamente preparado y qué todavía depende de credenciales, IAM o activación deliberada.',
    refresh: 'Actualizar estado',
    security: 'Los secretos quedan solo en el servidor',
    securityDesc: 'Tokens, app secret y verify token nunca llegan al navegador. Esta pantalla recibe solo estados y bloqueos seguros.',
    storage: 'Persistencia de Inbox',
    storageLabels: {
      read_write_confirmed: 'Lectura y escritura confirmadas',
      read_only: 'Solo lectura',
      denied_or_missing: 'Permisos ausentes',
      unknown: 'Estado no confirmado',
    },
    active: 'Activo',
    blocked: 'Bloqueado',
    planned: 'Planeado',
    configured: 'Configurado',
    receive: 'Recibir',
    send: 'Enviar',
    yes: 'Sí',
    no: 'No',
    blockers: 'Qué falta',
    noBlockers: 'Sin bloqueos',
    foundation: 'Capacidades preparadas',
    error: 'No fue posible consultar el estado de los canales.',
    empty: 'Core no devolvió canales.',
    waNote: 'WhatsApp solo se marcará activo cuando webhook oficial, credenciales, Inbox duradera y almacenamiento estén listos. El envío real permanece separado hasta implementar la boundary del provider.',
    inappNote: 'El canal in-app usa Connect Core y Tool Gateway ya publicados para consultas reales a MusicScale.',
  },
} satisfies Record<LanguageCode, any>;

const blockerLabels: Record<string, Record<LanguageCode, string>> = {
  provider_credentials_missing: {
    'pt-BR': 'Credenciais oficiais da Meta ainda não configuradas',
    'en-US': 'Official Meta credentials are not configured yet',
    'es-ES': 'Las credenciales oficiales de Meta aún no están configuradas',
  },
  webhook_disabled: {
    'pt-BR': 'Webhook oficial ainda está desligado',
    'en-US': 'Official webhook is still disabled',
    'es-ES': 'El webhook oficial todavía está desactivado',
  },
  durable_inbox_disabled: {
    'pt-BR': 'Inbox durável ainda está protegida pelo gate de ativação',
    'en-US': 'Durable Inbox is still protected by its activation gate',
    'es-ES': 'Inbox duradera sigue protegida por su gate de activación',
  },
  durable_storage_not_ready: {
    'pt-BR': 'Runtime do Connect ainda não possui persistência Firestore confirmada',
    'en-US': 'Connect runtime does not yet have confirmed Firestore persistence',
    'es-ES': 'El runtime de Connect aún no tiene persistencia Firestore confirmada',
  },
  message_content_store_not_mounted: {
    'pt-BR': 'Store sensível de conteúdo da Inbox ainda não está ativada',
    'en-US': 'Sensitive Inbox message-content store is not active yet',
    'es-ES': 'La store sensible de contenido de Inbox aún no está activa',
  },
  provider_ingestion_not_mounted: {
    'pt-BR': 'Bridge do webhook oficial para a Inbox ainda não está ativado',
    'en-US': 'Official webhook-to-Inbox bridge is not active yet',
    'es-ES': 'El bridge del webhook oficial hacia Inbox aún no está activo',
  },
  provider_connection_not_mapped: {
    'pt-BR': 'Número oficial ainda não está vinculado a uma organização do MillionsNest',
    'en-US': 'Official number is not mapped to a MillionsNest organization yet',
    'es-ES': 'El número oficial aún no está vinculado a una organización de MillionsNest',
  },
  provider_dispatch_disabled: {
    'pt-BR': 'Dispatch oficial ainda está desligado por feature gate',
    'en-US': 'Official dispatch is still disabled by its feature gate',
    'es-ES': 'El dispatch oficial sigue desactivado por feature gate',
  },
  provider_policy_ack_missing: {
    'pt-BR': 'Regras vigentes da Meta ainda não foram confirmadas para ativação',
    'en-US': 'Current Meta rules have not yet been acknowledged for activation',
    'es-ES': 'Las reglas vigentes de Meta aún no fueron confirmadas para activación',
  },
  human_reply_disabled: {
    'pt-BR': 'Resposta humana oficial ainda está desligada',
    'en-US': 'Official human reply is still disabled',
    'es-ES': 'La respuesta humana oficial sigue desactivada',
  },
  core_context_not_configured: {
    'pt-BR': 'Contexto do Hub/MusicScale não está configurado',
    'en-US': 'Hub/MusicScale context is not configured',
    'es-ES': 'El contexto Hub/MusicScale no está configurado',
  },
  adapter_not_implemented: {
    'pt-BR': 'Adapter oficial ainda não implementado',
    'en-US': 'Official adapter is not implemented yet',
    'es-ES': 'El adapter oficial aún no está implementado',
  },
};

function channelIcon(id: LiveChannelReadinessItem['id']) {
  if (id === 'whatsapp') return Smartphone;
  if (id === 'inapp') return MessageSquareText;
  return Radio;
}

export const LiveChannelsPage: React.FC<LiveChannelsPageProps> = ({
  session,
  currentLang,
}) => {
  const t = copy[currentLang];
  const client = useMemo(() => new LiveChannelClient(session), [session]);
  const [data, setData] = useState<LiveChannelReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const next = await client.getReadiness();
      setData(next);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [client]);

  const statusLabel = (status: LiveChannelReadinessItem['status']) =>
    status === 'active' ? t.active : status === 'blocked' ? t.blocked : t.planned;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,.08),transparent_30%),radial-gradient(circle_at_92%_5%,rgba(99,102,241,.16),transparent_34%),rgba(255,255,255,.025)] p-5 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
              <Radio size={14} /> {t.eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t.refresh}
          </button>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_.7fr]">
        <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">{t.security}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">{t.securityDesc}</p>
            </div>
          </div>
        </article>

        <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-black/15 text-slate-300">
              <LockKeyhole size={18} />
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.storage}</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {data ? t.storageLabels[data.storageState] : loading ? '…' : '—'}
              </div>
            </div>
          </div>
        </article>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">
          {t.error} <span className="text-rose-100/55">{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="grid min-h-52 place-items-center text-slate-600"><Loader2 size={22} className="animate-spin" /></div>
      ) : data?.channels?.length ? (
        <section className="grid gap-3 md:grid-cols-2">
          {data.channels.map((channel) => {
            const Icon = channelIcon(channel.id);
            const note = channel.id === 'whatsapp' ? t.waNote : channel.id === 'inapp' ? t.inappNote : '';
            return (
              <article key={channel.id} className="rounded-[26px] border border-white/[0.085] bg-white/[0.025] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-black/15 text-slate-200">
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-white">{channel.name}</h2>
                      <div className="mt-1 text-[10px] text-slate-600">{channel.id}</div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                    channel.status === 'active'
                      ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200'
                      : channel.status === 'blocked'
                        ? 'border-amber-300/15 bg-amber-300/[0.06] text-amber-100'
                        : 'border-white/[0.08] bg-white/[0.03] text-slate-500'
                  }`}>
                    {statusLabel(channel.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    [t.configured, channel.configured],
                    [t.receive, channel.receiveReady],
                    [t.send, channel.sendReady],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-white/[0.07] bg-black/10 p-3">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</div>
                      <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${value ? 'text-emerald-200' : 'text-slate-500'}`}>
                        {value ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
                        {value ? t.yes : t.no}
                      </div>
                    </div>
                  ))}
                </div>

                {note && <p className="mt-4 text-xs leading-5 text-slate-500">{note}</p>}

                <div className="mt-4 border-t border-white/[0.07] pt-4">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{t.blockers}</div>
                  <div className="mt-2 space-y-1.5">
                    {channel.blockers.length ? channel.blockers.map((blocker) => (
                      <div key={blocker} className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                        {blockerLabels[blocker]?.[currentLang] || blocker}
                      </div>
                    )) : (
                      <div className="text-xs text-emerald-200">{t.noBlockers}</div>
                    )}
                  </div>
                </div>

                {channel.capabilities.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{t.foundation}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {channel.capabilities.map((capability) => (
                        <span key={capability} className="rounded-lg border border-white/[0.07] bg-black/10 px-2 py-1 font-mono text-[9px] text-slate-500">
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-600">{t.empty}</div>
      )}
    </main>
  );
};
