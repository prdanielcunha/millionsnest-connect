import { listInternalAutomationJobs, type InternalAutomationJobView } from '../../core/client/liveAutomationJobsClient';
import React, { useEffect, useMemo, useState, useRef } from 'react';
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
import { OperationWorkspaceHeader } from '../live/OperationWorkspaceHeader';

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
    noExecution: 'Automações dos aplicativos ainda não liberadas',
    noExecutionDesc: 'As automações de membros e ações dos aplicativos ainda dependem dos seus contratos e permissões oficiais. A fila de alertas internos aparece abaixo quando estiver habilitada.',
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
    noExecution: 'App automations are not released yet',
    noExecutionDesc: 'Member notifications and app actions still require official contracts and permissions. The internal alert queue appears below when enabled.',
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
    noExecution: 'Automatizaciones de aplicaciones aún no habilitadas',
    noExecutionDesc: 'Las notificaciones a miembros y acciones de aplicaciones necesitan contratos y permisos oficiales. La cola interna aparece abajo cuando está habilitada.',
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

  const sequence = useRef(0);
  const scope = `${session.expectedOrganizationId}:${session.context.user.uid}`;
  const [queue, setQueue] = useState<{ scope: string; jobs: InternalAutomationJobView[] } | null>(null);
  const [queueError, setQueueError] = useState(false);
  const jobs = queue?.scope === scope ? queue.jobs : null;
  const q = currentLang === 'pt-BR'
    ? { title: 'Fila de alertas internos', hint: 'Avaliado não significa entregue no aparelho. Falhas ambíguas exigem revisão; nenhum reenvio comercial acontece aqui.', empty: 'Nenhum alerta registrado nesta organização.', pending: 'Aguardando', processing: 'Em processamento', complete: 'Avaliado', needs_review: 'Precisa de revisão', error: 'Não foi possível consultar a fila agora.', attempts: 'Tentativas' }
    : currentLang === 'es-ES'
      ? { title: 'Cola de avisos internos', hint: 'Evaluado no significa recibido en el dispositivo. Los fallos ambiguos necesitan revisión; no hay reenvíos comerciales.', empty: 'Sin avisos registrados en esta organización.', pending: 'Pendiente', processing: 'Procesando', complete: 'Evaluado', needs_review: 'Necesita revisión', error: 'No se pudo consultar la cola.', attempts: 'Intentos' }
      : { title: 'Internal alert queue', hint: 'Evaluated does not mean delivered to a device. Ambiguous failures need review; no commercial resend occurs here.', empty: 'No alerts recorded for this organization.', pending: 'Pending', processing: 'Processing', complete: 'Evaluated', needs_review: 'Needs review', error: 'Could not read the queue.', attempts: 'Attempts' };

  const load = async () => {
    const current = ++sequence.current;
    setLoading(true); setQueueError(false);
    const [channels, internal] = await Promise.allSettled([client.getReadiness(), listInternalAutomationJobs(session)]);
    if (current !== sequence.current) return;
    if (channels.status === 'fulfilled') { setReadiness(channels.value); setError(''); }
    else setError(t.error);
    if (internal.status === 'fulfilled') setQueue(internal.value === null ? null : { scope, jobs: internal.value });
    else { setQueue(null); setQueueError(true); }
    setLoading(false);
  };

  useEffect(() => { void load(); return () => { sequence.current++; }; }, [client]);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-4 pb-28 lg:pb-8">
      <OperationWorkspaceHeader currentLang={currentLang} activeRoute="automations" onNavigate={onNavigate} />
      <section className="connect-surface flex flex-col gap-3 rounded-[12px] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2 connect-eyebrow"><Workflow size={13} /> {t.eyebrow}</div>
          <div className="mt-1.5 text-sm font-semibold text-[#E7EEF4]">{t.title}</div>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#72869A]">{t.subtitle}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="connect-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#2B3A4D] bg-[#111A27] px-3.5 text-xs font-semibold text-[#C8D4DE] hover:bg-[#172332] disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t.refresh}
        </button>
      </section>

      <section className="flex flex-col gap-4 rounded-[12px] border border-amber-300/15 bg-amber-300/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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

      {jobs !== null && <section className="connect-surface rounded-xl border border-[#2B3A4D] p-4" aria-label={q.title}>
        <h2 className="text-sm font-semibold text-[#E7EEF4]">{q.title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#8DA1B5]">{q.hint}</p>
        {jobs.length === 0 ? <p className="mt-3 text-xs text-[#8DA1B5]">{q.empty}</p> : <ul className="mt-3 divide-y divide-[#2B3A4D]">{jobs.map(job => <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
          <span className="text-[#C8D4DE]">{job.sourceApp === 'whatsapp' ? 'WhatsApp' : job.sourceApp} · {new Date(job.occurredAt).toLocaleString(currentLang)}</span>
          <span className={job.state === 'needs_review' ? 'text-amber-200' : 'text-[#8DA1B5]'}>{q[job.state]} · {q.attempts}: {job.attempts}</span>
        </li>)}</ul>}
      </section>}
      {queueError && <p role="status" className="text-xs text-amber-200">{q.error}</p>}

      {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">{t.error} <span className="text-rose-100/50">{error}</span></div>}

      <section className="grid gap-3 lg:grid-cols-2">
        {CONNECT_AUTOMATION_CATALOG.map((definition) => {
          const blockers = automationBlockers(definition, readiness?.channels || []);
          const isPlanned = definition.maturity === 'planned';
          return (
            <article key={definition.id} className="rounded-[14px] border border-white/[0.085] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-cyan-300">{definition.sourceApp}</div>
                  <h2 className="mt-2 break-words font-mono text-sm font-semibold text-white">{definition.id}</h2>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] ${
                  isPlanned
                    ? 'border-white/[0.08] bg-white/[0.03] text-slate-500'
                    : definition.maturity === 'prepared'
                      ? 'border-cyan-400/15 bg-cyan-400/[0.06] text-cyan-100'
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
