import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleDashed,
  CloudCog,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import { LiveOperationsClient, type OperationalReadiness } from '../../core/client/liveOperationsClient';
import type { LanguageCode } from '../../types';

interface Props {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}

const copy = {
  'pt-BR': {
    eyebrow: 'GOVERNANÇA · AUDITORIA E SAÚDE',
    title: 'Saúde operacional do Connect, sem caixa-preta.',
    subtitle: 'Veja release, gates, persistência, auditoria e postura de rollback usando sinais reais do Core. Nenhum segredo ou conteúdo de mensagem aparece aqui.',
    refresh: 'Atualizar',
    release: 'Release',
    storage: 'Persistência',
    overall: 'Estado geral',
    flags: 'Feature gates',
    gates: 'Controles operacionais',
    audit: 'Auditoria estruturada',
    auditDesc: 'Core e Tool Gateway emitem logs PII-minimizados e fatos canônicos para ações de ferramenta.',
    rollback: 'Rollback',
    rollbackDesc: 'Releases imutáveis e feature flags permitem recuar sem migração destrutiva nas fatias atuais.',
    error: 'Não foi possível consultar a saúde operacional.',
    ready: 'Pronto',
    controlled: 'Controlado',
    blocked: 'Bloqueado',
    on: 'Ligado',
    off: 'Desligado',
    generated: 'Atualizado',
  },
  'en-US': {
    eyebrow: 'GOVERNANCE · AUDIT & HEALTH',
    title: 'Connect operational health, without a black box.',
    subtitle: 'Inspect release, gates, persistence, audit and rollback posture using real Core signals. No secret or message content appears here.',
    refresh: 'Refresh',
    release: 'Release',
    storage: 'Persistence',
    overall: 'Overall state',
    flags: 'Feature gates',
    gates: 'Operational controls',
    audit: 'Structured audit',
    auditDesc: 'Core and Tool Gateway emit PII-minimized logs and canonical facts for tool actions.',
    rollback: 'Rollback',
    rollbackDesc: 'Immutable releases and feature flags allow safe rollback without destructive migration in current slices.',
    error: 'Could not load operational health.',
    ready: 'Ready',
    controlled: 'Controlled',
    blocked: 'Blocked',
    on: 'On',
    off: 'Off',
    generated: 'Updated',
  },
  'es-ES': {
    eyebrow: 'GOBERNANZA · AUDITORÍA Y SALUD',
    title: 'Salud operativa de Connect, sin caja negra.',
    subtitle: 'Consulta release, gates, persistencia, auditoría y rollback con señales reales del Core. Aquí no se muestran secretos ni contenido de mensajes.',
    refresh: 'Actualizar',
    release: 'Release',
    storage: 'Persistencia',
    overall: 'Estado general',
    flags: 'Feature gates',
    gates: 'Controles operativos',
    audit: 'Auditoría estructurada',
    auditDesc: 'Core y Tool Gateway emiten logs minimizados de PII y hechos canónicos para acciones de herramientas.',
    rollback: 'Rollback',
    rollbackDesc: 'Releases inmutables y feature flags permiten retroceder sin migración destructiva en las fases actuales.',
    error: 'No fue posible consultar la salud operativa.',
    ready: 'Listo',
    controlled: 'Controlado',
    blocked: 'Bloqueado',
    on: 'Activo',
    off: 'Inactivo',
    generated: 'Actualizado',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

const gateLabels: Record<string, Record<LanguageCode, string>> = {
  core: { 'pt-BR': 'Connect Core', 'en-US': 'Connect Core', 'es-ES': 'Connect Core' },
  tool_gateway: { 'pt-BR': 'Tool Gateway · MusicScale', 'en-US': 'Tool Gateway · MusicScale', 'es-ES': 'Tool Gateway · MusicScale' },
  structured_audit: { 'pt-BR': 'Auditoria estruturada', 'en-US': 'Structured audit', 'es-ES': 'Auditoría estructurada' },
  canonical_facts: { 'pt-BR': 'Fatos canônicos', 'en-US': 'Canonical facts', 'es-ES': 'Hechos canónicos' },
  channels: { 'pt-BR': 'Canais oficiais', 'en-US': 'Official channels', 'es-ES': 'Canales oficiales' },
  inbox: { 'pt-BR': 'Inbox durável', 'en-US': 'Durable Inbox', 'es-ES': 'Inbox duradera' },
  automations: { 'pt-BR': 'Automações', 'en-US': 'Automations', 'es-ES': 'Automatizaciones' },
  rollback: { 'pt-BR': 'Rollback', 'en-US': 'Rollback', 'es-ES': 'Rollback' },
};

const storageLabels: Record<string, Record<LanguageCode, string>> = {
  read_write_confirmed: { 'pt-BR': 'Leitura/gravação confirmadas', 'en-US': 'Read/write confirmed', 'es-ES': 'Lectura/escritura confirmadas' },
  read_only: { 'pt-BR': 'Somente leitura', 'en-US': 'Read only', 'es-ES': 'Solo lectura' },
  denied_or_missing: { 'pt-BR': 'Permissões ausentes', 'en-US': 'Permissions missing', 'es-ES': 'Permisos ausentes' },
  unknown: { 'pt-BR': 'Não confirmado', 'en-US': 'Not confirmed', 'es-ES': 'No confirmado' },
};

export const LiveOperationsPage: React.FC<Props> = ({ session, currentLang }) => {
  const t = copy[currentLang];
  const client = useMemo(() => new LiveOperationsClient(session), [session]);
  const [data, setData] = useState<OperationalReadiness | null>(null);
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

  const statusLabel = (status: 'ready' | 'controlled' | 'blocked') =>
    status === 'ready' ? t.ready : status === 'controlled' ? t.controlled : t.blocked;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.17),transparent_34%),radial-gradient(circle_at_90%_0%,rgba(34,211,238,.07),transparent_30%),rgba(255,255,255,.025)] p-5 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300"><Activity size={14} /> {t.eyebrow}</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t.refresh}
          </button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">{t.error} <span className="text-rose-100/55">{error}</span></div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.release}</div>
          <div className="mt-2 truncate font-mono text-xs font-semibold text-white">{data?.releaseSha || '—'}</div>
        </article>
        <article className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.storage}</div>
          <div className="mt-2 text-sm font-semibold text-white">{data ? storageLabels[data.storageState]?.[currentLang] || data.storageState : '—'}</div>
        </article>
        <article className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.overall}</div>
          <div className="mt-2 text-sm font-semibold text-white">{data ? statusLabel(data.overall) : '—'}</div>
        </article>
        <article className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.generated}</div>
          <div className="mt-2 text-xs font-semibold text-white">{data?.generatedAt ? new Date(data.generatedAt).toLocaleString(currentLang) : '—'}</div>
        </article>
      </section>

      <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><CloudCog size={16} className="text-indigo-300" /> {t.gates}</div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {(data?.gates || []).map((gate) => (
            <article key={gate.id} className="rounded-2xl border border-white/[0.07] bg-black/10 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-300">{gateLabels[gate.id]?.[currentLang] || gate.id}</div>
                {gate.status === 'ready'
                  ? <CheckCircle2 size={14} className="text-emerald-300" />
                  : <CircleDashed size={14} className={gate.status === 'controlled' ? 'text-amber-200' : 'text-rose-300'} />}
              </div>
              <div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.11em] text-slate-600">{statusLabel(gate.status)}</div>
              <div className="mt-2 break-words font-mono text-[9px] leading-4 text-slate-600">{gate.detail}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck size={16} className="text-emerald-300" /> {t.audit}</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{t.auditDesc}</p>
        </article>
        <article className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><RotateCcw size={16} className="text-cyan-300" /> {t.rollback}</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{t.rollbackDesc}</p>
        </article>
        <article className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="text-sm font-semibold text-white">{t.flags}</div>
          <div className="mt-3 space-y-2 font-mono text-[10px] text-slate-500">
            <div className="flex justify-between gap-3"><span>durableInbox</span><span className={data?.flags.durableInbox ? 'text-emerald-200' : 'text-slate-600'}>{data?.flags.durableInbox ? t.on : t.off}</span></div>
            <div className="flex justify-between gap-3"><span>whatsappWebhook</span><span className={data?.flags.whatsappWebhook ? 'text-emerald-200' : 'text-slate-600'}>{data?.flags.whatsappWebhook ? t.on : t.off}</span></div>
            <div className="flex justify-between gap-3"><span>outboundValidation</span><span className={data?.flags.whatsappOutboundValidation ? 'text-emerald-200' : 'text-slate-600'}>{data?.flags.whatsappOutboundValidation ? t.on : t.off}</span></div>
          </div>
        </article>
      </section>
    </main>
  );
};
