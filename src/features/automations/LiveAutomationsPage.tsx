import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import { LiveChannelClient, type LiveChannelReadiness } from '../../core/client/liveChannelClient';
import {
  CONNECT_AUTOMATION_CATALOG,
  automationBlockers,
  type ConnectAutomationDefinition,
} from '../../core/automations/automationCatalog';
import type { LanguageCode } from '../../types';

interface Props {
  session: LiveConnectSession;
  currentLang: LanguageCode;
  onNavigate: (route: string) => void;
}

const copy = {
  'pt-BR': {
    eyebrow: 'OPERAÇÃO · AUTOMAÇÕES',
    title: 'Eventos viram comunicação — só quando todos os gates permitem.',
    subtitle: 'Nada de automação “mágica” ou execução simulada. Aqui você vê os contratos reais preparados, o que bloqueia cada fluxo e qual canal será usado.',
    refresh: 'Atualizar readiness',
    prepared: 'Contrato preparado',
    blocked: 'Bloqueado',
    planned: 'Próxima fase',
    trigger: 'Gatilho',
    action: 'Ação',
    channel: 'Canal',
    idempotency: 'Idempotência',
    cost: 'Política de custo',
    audit: 'Auditoria obrigatória',
    blockers: 'Bloqueios atuais',
    noExecution: 'Execução continua desligada',
    noExecutionDesc: 'O Connect ainda não monta o worker de automações nem recebe eventos oficiais do MusicScale. Isso impede disparos acidentais antes de Inbox/canais estarem prontos.',
    channels: 'Ver canais',
    error: 'Não foi possível validar os canais agora.',
  },
  'en-US': {
    eyebrow: 'OPERATIONS · AUTOMATIONS',
    title: 'Events become communication — only when every gate allows it.',
    subtitle: 'No “magic” automation or fake execution. This surface shows prepared contracts, current blockers and the channel each flow will use.',
    refresh: 'Refresh readiness',
    prepared: 'Contract prepared',
    blocked: 'Blocked',
    planned: 'Next phase',
    trigger: 'Trigger',
    action: 'Action',
    channel: 'Channel',
    idempotency: 'Idempotency',
    cost: 'Cost policy',
    audit: 'Audit required',
    blockers: 'Current blockers',
    noExecution: 'Execution remains disabled',
    noExecutionDesc: 'Connect does not yet mount the automation worker or receive official MusicScale events. This prevents accidental dispatch before Inbox/channels are ready.',
    channels: 'View channels',
    error: 'Could not validate channels right now.',
  },
  'es-ES': {
    eyebrow: 'OPERACIÓN · AUTOMATIZACIONES',
    title: 'Los eventos se convierten en comunicación — solo cuando todos los gates lo permiten.',
    subtitle: 'Nada de automatización “mágica” ni ejecución falsa. Aquí ves contratos preparados, bloqueos actuales y el canal de cada flujo.',
    refresh: 'Actualizar readiness',
    prepared: 'Contrato preparado',
    blocked: 'Bloqueado',
    planned: 'Próxima fase',
    trigger: 'Gatillo',
    action: 'Acción',
    channel: 'Canal',
    idempotency: 'Idempotencia',
    cost: 'Política de costo',
    audit: 'Auditoría obligatoria',
    blockers: 'Bloqueos actuales',
    noExecution: 'La ejecución sigue desactivada',
    noExecutionDesc: 'Connect todavía no monta el worker de automatizaciones ni recibe eventos oficiales de MusicScale. Esto evita envíos accidentales antes de que Inbox/canales estén listos.',
    channels: 'Ver canales',
    error: 'No fue posible validar los canales ahora.',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

const blockerCopy: Record<string, Record<LanguageCode, string>> = {
  event_source_not_mounted: {
    'pt-BR': 'Fonte de eventos do app ainda não montada no Connect',
    'en-US': 'App event source is not mounted in Connect yet',
    'es-ES': 'La fuente de eventos de la app aún no está montada en Connect',
  },
  execution_worker_not_mounted: {
    'pt-BR': 'Worker de execução ainda não montado',
    'en-US': 'Execution worker is not mounted yet',
    'es-ES': 'El worker de ejecución aún no está montado',
  },
  whatsapp_dispatch_not_ready: {
    'pt-BR': 'Dispatch oficial do WhatsApp ainda não está pronto',
    'en-US': 'Official WhatsApp dispatch is not ready yet',
    'es-ES': 'El dispatch oficial de WhatsApp aún no está listo',
  },
  inapp_channel_not_ready: {
    'pt-BR': 'Canal in-app não está saudável',
    'en-US': 'In-app channel is not healthy',
    'es-ES': 'El canal in-app no está saludable',
  },
  cross_app_phase_not_started: {
    'pt-BR': 'Integração cross-app ainda pertence à fase seguinte',
    'en-US': 'Cross-app integration belongs to the next phase',
    'es-ES': 'La integración cross-app pertenece a la próxima fase',
  },
};

function maturityLabel(definition: ConnectAutomationDefinition, lang: LanguageCode) {
  const t = copy[lang];
  return definition.maturity === 'prepared'
    ? t.prepared
    : definition.maturity === 'blocked'
      ? t.blocked
      : t.planned;
}

export const LiveAutomationsPage: React.FC<Props> = ({
  session,
  currentLang,
  onNavigate,
}) => {
  const t = copy[currentLang];
  const client = useMemo(() => new LiveChannelClient(session), [session]);
  const [readiness, setReadiness] = useState<LiveChannelReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setReadiness(await client.getReadiness());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [client]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_0%_0%,rgba(99,102,241,.16),transparent_34%),radial-gradient(circle_at_90%_15%,rgba(34,211,238,.07),transparent_30%),rgba(255,255,255,.025)] p-5 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
              <Workflow size={14} /> {t.eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t.refresh}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[24px] border border-amber-300/15 bg-amber-300/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] text-amber-100">
            <LockKeyhole size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold text-amber-50">{t.noExecution}</div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-50/50">{t.noExecutionDesc}</p>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate('channels')} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.04]">
          {t.channels} <ArrowRight size={13} />
        </button>
      </section>

      {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">{t.error} <span className="text-rose-100/50">{error}</span></div>}

      <section className="grid gap-3 lg:grid-cols-2">
        {CONNECT_AUTOMATION_CATALOG.map((definition) => {
          const blockers = automationBlockers(definition, readiness?.channels || []);
          const isPlanned = definition.maturity === 'planned';
          return (
            <article key={definition.id} className="rounded-[26px] border border-white/[0.085] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-indigo-300">{definition.sourceApp}</div>
                  <h2 className="mt-2 break-words font-mono text-sm font-semibold text-white">{definition.id}</h2>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] ${
                  isPlanned
                    ? 'border-white/[0.08] bg-white/[0.03] text-slate-500'
                    : definition.maturity === 'prepared'
                      ? 'border-indigo-400/15 bg-indigo-400/[0.06] text-indigo-100'
                      : 'border-amber-300/15 bg-amber-300/[0.06] text-amber-100'
                }`}>
                  {maturityLabel(definition, currentLang)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  [t.trigger, definition.trigger],
                  [t.action, definition.action],
                  [t.channel, definition.targetChannel],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/10 p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</div>
                    <div className="mt-2 break-words font-mono text-[10px] leading-4 text-slate-300">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{t.idempotency}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{definition.idempotency}</div>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{t.cost}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <ShieldCheck size={13} className="text-emerald-300" /> {definition.costPolicy}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-white/[0.07] pt-4">
                <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  <Zap size={11} /> {t.blockers}
                </div>
                <div className="mt-2 space-y-1.5">
                  {blockers.map((blocker) => (
                    <div key={blocker} className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                      <CircleDashed size={12} className="mt-1 shrink-0" />
                      {blockerCopy[blocker]?.[currentLang] || blocker}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] font-medium text-emerald-200/70">
                  <CheckCircle2 size={12} /> {t.audit}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
};
