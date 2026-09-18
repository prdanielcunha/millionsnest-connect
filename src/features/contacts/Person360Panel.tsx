import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  FileArchive,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  X,
} from 'lucide-react';
import { PersonalRadarClient } from '../../core/client/personalRadarClient';
import { LanguageCode } from '../../types';

type Props = {
  client: PersonalRadarClient;
  personId: string;
  currentLang: LanguageCode;
  onClose: () => void;
};

function shortDate(value: unknown, lang: LanguageCode) {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = Date.parse(value.length === 10 ? `${value}T12:00:00` : value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

export const Person360Panel: React.FC<Props> = ({ client, personId, currentLang, onClose }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = currentLang === 'pt-BR' ? {
    eyebrow: 'PESSOA 360°', title: 'Memória de relacionamento', loading: 'Reconstruindo contexto…',
    why: 'Por que olhar agora', next: 'Próxima ação sugerida', sources: 'Onde essa pessoa apareceu',
    recent: 'Timeline unificada', evidence: 'Evidências de identidade', signals: 'Sinais explicáveis',
    messages: 'mensagens', source: 'fonte', sourcesCount: 'fontes', first: 'Primeiro registro', last: 'Último registro',
    privacy: 'Contexto privado · não vira lead automaticamente', noMessages: 'Não há mensagens autorais suficientes para exibir.',
    noEvidence: 'Nenhuma evidência adicional de identidade disponível.', state: 'Estado do relacionamento', close: 'Fechar',
  } : currentLang === 'es-ES' ? {
    eyebrow: 'PERSONA 360°', title: 'Memoria de relación', loading: 'Reconstruyendo contexto…',
    why: 'Por qué mirar ahora', next: 'Próxima acción sugerida', sources: 'Dónde apareció esta persona',
    recent: 'Timeline unificada', evidence: 'Evidencias de identidad', signals: 'Señales explicables',
    messages: 'mensajes', source: 'fuente', sourcesCount: 'fuentes', first: 'Primer registro', last: 'Último registro',
    privacy: 'Contexto privado · no se convierte automáticamente en lead', noMessages: 'No hay suficientes mensajes propios para mostrar.',
    noEvidence: 'No hay evidencia adicional de identidad disponible.', state: 'Estado de la relación', close: 'Cerrar',
  } : {
    eyebrow: 'PERSON 360°', title: 'Relationship memory', loading: 'Reconstructing context…',
    why: 'Why look now', next: 'Suggested next action', sources: 'Where this person appeared',
    recent: 'Unified timeline', evidence: 'Identity evidence', signals: 'Explainable signals',
    messages: 'messages', source: 'source', sourcesCount: 'sources', first: 'First record', last: 'Last record',
    privacy: 'Private context · never auto-promoted to a lead', noMessages: 'There are not enough authored messages to display.',
    noEvidence: 'No additional identity evidence is available.', state: 'Relationship state', close: 'Close',
  };

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    Promise.all([client.getPersonContext(personId), client.getPersonTimeline(personId, 240)])
      .then(([result, timeline]) => { if (active) setData({ ...result, timeline: Array.isArray(timeline.items) ? timeline.items : [] }); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, personId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const person = data?.person || {};
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const messages = Array.isArray(data?.timeline) && data.timeline.length ? data.timeline : Array.isArray(data?.recentMessages) ? data.recentMessages : [];
  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];
  const signals = Array.isArray(data?.signals) ? data.signals : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={t.title}>
      <section className="max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-t-[30px] border border-white/10 bg-[#0b0f18] shadow-[0_32px_120px_rgba(0,0,0,.75)] sm:rounded-[30px]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/8 bg-[#0b0f18]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-indigo-300"><UserRoundSearch size={14} /> {t.eyebrow}</div>
            <h2 className="mt-2 truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">{person.probableName || person.displayName || t.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><ShieldCheck size={13} className="text-emerald-300/80" /> {t.privacy}</div>
          </div>
          <button onClick={onClose} aria-label={t.close} className="rounded-xl border border-white/8 p-2.5 text-slate-500 transition hover:bg-white/5 hover:text-white"><X size={17} /></button>
        </header>

        <div className="max-h-[calc(92dvh-88px)] overflow-y-auto p-4 sm:p-6">
          {loading ? <div className="grid min-h-72 place-items-center text-sm text-slate-500"><div className="text-center"><Loader2 size={24} className="mx-auto animate-spin" /><div className="mt-3">{t.loading}</div></div></div> : error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-100">{error}</div> : data && <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="text-[10px] uppercase tracking-wider text-slate-600">{t.state}</div><div className="mt-2 text-sm font-semibold text-white">{data.relationshipState?.label || '—'}</div><div className="mt-1 text-xs leading-5 text-slate-500">{data.relationshipState?.why || ''}</div></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-600"><MessageCircle size={12} /> {t.messages}</div><div className="mt-2 text-2xl font-semibold text-white">{Number(data.stats?.messageCount || 0)}</div></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-600"><FileArchive size={12} /> {Number(data.stats?.sourceCount || 0) === 1 ? t.source : t.sourcesCount}</div><div className="mt-2 text-2xl font-semibold text-white">{Number(data.stats?.sourceCount || 0)}</div></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-600"><CalendarClock size={12} /> {t.first} → {t.last}</div><div className="mt-2 text-xs font-medium text-slate-200">{shortDate(data.stats?.firstDateKey, currentLang)} → {shortDate(data.stats?.lastDateKey, currentLang)}</div></div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-indigo-400/15 bg-indigo-400/[0.045] p-4"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-200/80"><Sparkles size={13} /> {t.why}</div><p className="mt-2 text-sm leading-6 text-slate-200">{data.whyNow}</p></div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.035] p-4"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/80"><CheckCircle2 size={13} /> {t.next}</div><p className="mt-2 text-sm leading-6 text-slate-200">{data.recommendedAction}</p></div>
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><FileArchive size={14} className="text-indigo-300" /> {t.sources}</div><div className="mt-3 flex flex-wrap gap-2">{sources.length ? sources.map((source: any) => <span key={source.sourceId || source.id} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs text-slate-400"><span className="font-medium text-slate-200">{source.label}</span><span className="ml-2 text-[10px] text-slate-600">{source.kind === 'group' ? 'WhatsApp · grupo' : 'WhatsApp'}</span></span>) : <span className="text-xs text-slate-600">—</span>}</div></section>

            <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><MessageCircle size={14} className="text-indigo-300" /> {t.recent}</div>{messages.length ? <div className="mt-3 space-y-2">{messages.slice(0, 30).map((message: any, index: number) => <div key={`${message.timestampLocal || message.dateKey}-${index}`} className="rounded-xl border border-white/6 bg-black/15 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-slate-500"><span>{shortDate(message.dateKey || message.timestampLocal, currentLang)}</span><span className="text-slate-600">{message.sourceLabel || (message.type === 'follow_up' ? 'Connect' : '')}</span></div><p className="mt-1 text-xs leading-5 text-slate-300">{message.type === 'follow_up' ? `Follow-up · ${message.text}` : message.text}</p></div>)}</div> : <div className="mt-4 text-xs text-slate-600">{t.noMessages}</div>}</div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"><div className="text-xs font-semibold text-slate-300">{t.signals}</div><div className="mt-3 space-y-2">{signals.slice(0, 8).map((signal: any) => <div key={signal.id} className="rounded-xl border border-white/6 bg-black/15 p-3"><div className="text-xs leading-5 text-slate-300">{signal.reason}</div><div className="mt-1 text-[10px] leading-4 text-indigo-200/80">{signal.nextAction}</div></div>)}</div></div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"><div className="text-xs font-semibold text-slate-300">{t.evidence}</div>{evidence.length ? <div className="mt-3 space-y-2">{evidence.slice(0, 8).map((item: any, index: number) => <div key={`${item.sourceId || ''}-${item.messageIndex || index}`} className="rounded-xl border border-white/6 bg-black/15 p-3"><div className="text-[10px] font-medium text-slate-500">{shortDate(item.dateKey, currentLang)} · {item.kind || 'evidence'}</div><div className="mt-1 text-xs leading-5 text-slate-400">“{item.snippet}”</div></div>)}</div> : <div className="mt-3 text-xs text-slate-600">{t.noEvidence}</div>}</div>
              </div>
            </section>
          </div>}
        </div>
      </section>
    </div>
  );
};
