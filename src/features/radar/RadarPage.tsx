import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Check, ChevronDown, Copy, FileArchive, Filter, Loader2, MessageCircle,
  Radar, Search, ShieldCheck, Sparkles, Star, Upload, UserRoundCheck, UsersRound, X,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import {
  PersonalRadarClient,
  RadarClientPerson,
  RadarManualPriority,
  RadarPotentialLevel,
} from '../../core/client/personalRadarClient';
import { LanguageCode } from '../../types';

interface RadarPageProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}

type Tone = 'curto' | 'conversa' | 'audio' | 'video';
type ComposerStyle = 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';
type FilterMode = 'all' | 'favorites' | 'priority' | 'very_high' | 'review';

type SelectedSignal = {
  person: RadarClientPerson;
  signal: RadarClientPerson['signals'][number];
};

const copy = {
  'pt-BR': {
    eyebrow: 'RADAR · RELATIONSHIP INTELLIGENCE',
    title: 'As pessoas certas, no momento certo.',
    subtitle: 'O Connect organiza as conversas, encontra sinais reais de potencial e deixa sua decisão acima da automação.',
    privacy: 'Cofre pessoal · privado · nenhuma pessoa vira lead automaticamente.',
    importTitle: 'Trazer conversa do WhatsApp', importHint: 'TXT ou ZIP exportado pelo WhatsApp · até 5 MB',
    selfName: 'Seu nome no export', choose: 'Escolher arquivo', importing: 'Analisando pessoas, conversas e duplicidades…',
    importAction: 'Importar e analisar', imported: 'Importação concluída', dedup: 'Esse arquivo já estava no seu cofre. Nada foi duplicado.',
    people: 'Pessoas', messages: 'mensagens', merged: 'contatos reaproveitados', review: 'para revisar',
    empty: 'Nenhuma pessoa priorizada ainda', emptyDesc: 'Importe uma conversa autorizada para o Connect organizar os contatos e explicar por que alguém merece sua atenção.',
    search: 'Buscar no histórico', searchPlaceholder: 'Pessoa, assunto, louvor, escala…', searchAction: 'Buscar', noSearch: 'Nenhum resultado.',
    all: 'Todos', favorites: 'Favoritos', priority: 'Prioritários', veryHigh: 'Muito alto', duplicates: 'Revisar identidade',
    potential: 'Potencial', auto: 'sugerido', priorityLabel: 'Prioridade', normal: 'Normal', important: 'Importante', priorityTop: 'Prioritário',
    unknown: 'Sem evidência', low: 'Baixo', medium: 'Médio', high: 'Alto', very_high: 'Muito alto',
    identityPossible: 'Pode ser a mesma pessoa', merge: 'É a mesma', separate: 'São diferentes', undo: 'Desfazer vínculo',
    identityMerged: 'Pessoas vinculadas. O histórico foi preservado.', identitySeparate: 'Certo. O Connect vai manter essas pessoas separadas.',
    evidence: 'Por que apareceu', next: 'Próximo passo', compose: 'Criar abordagem', promote: 'Virar oportunidade', promoted: 'Oportunidade marcada',
    phone: 'WhatsApp/telefone', snooze: 'Falar depois', ignore: 'Não relevante',
    composerTitle: 'Composer MusicScale', tone: 'Formato', short: 'Curto', conversation: 'Conversa', audio: 'Áudio', video: 'Vídeo',
    guidance: 'Sugestão para agora', why: 'Por quê', nextYes: 'Próximo pequeno sim', usedContext: 'Contexto usado', chooseOption: 'Escolha uma opção', style: 'Estilo',
    regenerate: 'Gerar', copy: 'Copiar', copied: 'Copiado', whatsapp: 'Abrir WhatsApp', noPhone: 'Adicione o telefone para abrir o WhatsApp.',
    error: 'Não foi possível concluir esta operação.', noAuto: 'O envio continua manual.', saved: 'Salvo', saving: 'Salvando…',
  },
  'en-US': {
    eyebrow: 'RADAR · RELATIONSHIP INTELLIGENCE', title: 'The right people, at the right moment.',
    subtitle: 'Connect organizes conversations, finds explainable potential signals, and keeps your judgment above automation.',
    privacy: 'Personal vault · private · nobody becomes a lead automatically.',
    importTitle: 'Bring a WhatsApp conversation', importHint: 'WhatsApp TXT or ZIP export · up to 5 MB', selfName: 'Your name in the export', choose: 'Choose file', importing: 'Analyzing people, conversations and duplicates…', importAction: 'Import and analyze', imported: 'Import complete', dedup: 'This file was already in your vault. Nothing was duplicated.',
    people: 'People', messages: 'messages', merged: 'contacts reused', review: 'to review', empty: 'No prioritized people yet', emptyDesc: 'Import an authorized conversation so Connect can organize contacts and explain why someone deserves attention.',
    search: 'Search history', searchPlaceholder: 'Person, topic, worship, schedule…', searchAction: 'Search', noSearch: 'No results.',
    all: 'All', favorites: 'Favorites', priority: 'Priority', veryHigh: 'Very high', duplicates: 'Review identity', potential: 'Potential', auto: 'suggested', priorityLabel: 'Priority', normal: 'Normal', important: 'Important', priorityTop: 'Priority', unknown: 'Not enough evidence', low: 'Low', medium: 'Medium', high: 'High', very_high: 'Very high',
    identityPossible: 'May be the same person', merge: 'Same person', separate: 'Different people', undo: 'Undo link', identityMerged: 'People linked. History was preserved.', identitySeparate: 'Got it. Connect will keep these people separate.',
    evidence: 'Why they surfaced', next: 'Next step', compose: 'Create approach', promote: 'Make opportunity', promoted: 'Opportunity marked', phone: 'WhatsApp/phone', snooze: 'Talk later', ignore: 'Not relevant',
    composerTitle: 'MusicScale Composer', tone: 'Format', short: 'Short', conversation: 'Conversation', audio: 'Audio', video: 'Video', guidance: 'Suggested next move', why: 'Why', nextYes: 'Next small yes', usedContext: 'Context used', chooseOption: 'Choose an option', style: 'Style', regenerate: 'Generate', copy: 'Copy', copied: 'Copied', whatsapp: 'Open WhatsApp', noPhone: 'Add a phone number to open WhatsApp.', error: 'Could not complete this operation.', noAuto: 'Sending stays manual.', saved: 'Saved', saving: 'Saving…',
  },
  'es-ES': {
    eyebrow: 'RADAR · RELATIONSHIP INTELLIGENCE', title: 'Las personas correctas, en el momento correcto.',
    subtitle: 'Connect organiza conversaciones, encuentra señales explicables de potencial y mantiene tu decisión por encima de la automatización.',
    privacy: 'Cofre personal · privado · nadie se convierte en lead automáticamente.', importTitle: 'Traer conversación de WhatsApp', importHint: 'Exportación TXT o ZIP de WhatsApp · hasta 5 MB', selfName: 'Tu nombre en la exportación', choose: 'Elegir archivo', importing: 'Analizando personas, conversaciones y duplicados…', importAction: 'Importar y analizar', imported: 'Importación completa', dedup: 'Este archivo ya estaba en tu cofre. Nada fue duplicado.',
    people: 'Personas', messages: 'mensajes', merged: 'contactos reutilizados', review: 'para revisar', empty: 'Aún no hay personas priorizadas', emptyDesc: 'Importa una conversación autorizada para que Connect organice los contactos y explique por qué alguien merece atención.',
    search: 'Buscar en el historial', searchPlaceholder: 'Persona, tema, alabanza, escala…', searchAction: 'Buscar', noSearch: 'Sin resultados.', all: 'Todos', favorites: 'Favoritos', priority: 'Prioritarios', veryHigh: 'Muy alto', duplicates: 'Revisar identidad', potential: 'Potencial', auto: 'sugerido', priorityLabel: 'Prioridad', normal: 'Normal', important: 'Importante', priorityTop: 'Prioritario', unknown: 'Sin evidencia', low: 'Bajo', medium: 'Medio', high: 'Alto', very_high: 'Muy alto',
    identityPossible: 'Puede ser la misma persona', merge: 'Es la misma', separate: 'Son diferentes', undo: 'Deshacer vínculo', identityMerged: 'Personas vinculadas. El historial fue preservado.', identitySeparate: 'Listo. Connect mantendrá estas personas separadas.', evidence: 'Por qué apareció', next: 'Siguiente paso', compose: 'Crear enfoque', promote: 'Crear oportunidad', promoted: 'Oportunidad marcada', phone: 'WhatsApp/teléfono', snooze: 'Hablar después', ignore: 'No relevante', composerTitle: 'Composer MusicScale', tone: 'Formato', short: 'Corto', conversation: 'Conversación', audio: 'Audio', video: 'Video', guidance: 'Sugerencia para ahora', why: 'Por qué', nextYes: 'Próximo pequeño sí', usedContext: 'Contexto usado', chooseOption: 'Elige una opción', style: 'Estilo', regenerate: 'Generar', copy: 'Copiar', copied: 'Copiado', whatsapp: 'Abrir WhatsApp', noPhone: 'Agrega el teléfono para abrir WhatsApp.', error: 'No fue posible completar esta operación.', noAuto: 'El envío sigue siendo manual.', saved: 'Guardado', saving: 'Guardando…',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

const potentialOrder: RadarPotentialLevel[] = ['very_high', 'high', 'medium', 'low', 'unknown'];
const priorityOrder: RadarManualPriority[] = ['normal', 'important', 'priority'];

function composerStyleLabel(style: ComposerStyle, lang: LanguageCode): string {
  const labels: Record<ComposerStyle, Record<LanguageCode, string>> = {
    amigavel: { 'pt-BR': 'Amigável', 'en-US': 'Friendly', 'es-ES': 'Amigable' },
    profissional: { 'pt-BR': 'Profissional', 'en-US': 'Professional', 'es-ES': 'Profesional' },
    descontraido: { 'pt-BR': 'Descontraído', 'en-US': 'Casual', 'es-ES': 'Relajado' },
    objetivo: { 'pt-BR': 'Objetivo', 'en-US': 'Direct', 'es-ES': 'Directo' },
    proximo: { 'pt-BR': 'Próximo', 'en-US': 'Personal', 'es-ES': 'Cercano' },
    pastoral: { 'pt-BR': 'Pastoral', 'en-US': 'Pastoral', 'es-ES': 'Pastoral' },
    consultivo: { 'pt-BR': 'Consultivo', 'en-US': 'Consultative', 'es-ES': 'Consultivo' },
  };
  return labels[style][lang];
}

function potentialClasses(level: RadarPotentialLevel) {
  if (level === 'very_high') return 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100';
  if (level === 'high') return 'border-indigo-400/25 bg-indigo-400/10 text-indigo-100';
  if (level === 'medium') return 'border-sky-400/25 bg-sky-400/10 text-sky-100';
  if (level === 'low') return 'border-white/10 bg-white/[0.04] text-slate-300';
  return 'border-white/10 bg-transparent text-slate-500';
}

export const RadarPage: React.FC<RadarPageProps> = ({ session, currentLang }) => {
  const t = copy[currentLang];
  const client = useMemo(() => new PersonalRadarClient(session), [session]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selfName, setSelfName] = useState(session.context.user.name || '');
  const [people, setPeople] = useState<RadarClientPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selected, setSelected] = useState<SelectedSignal | null>(null);
  const [tone, setTone] = useState<Tone>('curto');
  const [draft, setDraft] = useState('');
  const [composerPlan, setComposerPlan] = useState<any | null>(null);
  const [composerStyle, setComposerStyle] = useState<ComposerStyle>('consultivo');
  const [draftBusy, setDraftBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [promoted, setPromoted] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [lastMergeId, setLastMergeId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await client.getRadar();
      setPeople(result.people);
      setPhones(Object.fromEntries(result.people.map(person => [person.id, person.phone || ''])));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [client]);

  const patchPerson = async (person: RadarClientPerson, update: Parameters<PersonalRadarClient['updatePerson']>[1]) => {
    const previous = people;
    const optimistic = people.map(item => item.id === person.id ? { ...item, ...update } : item);
    setPeople(optimistic);
    setSaving(current => ({ ...current, [person.id]: true }));
    try {
      const result = await client.updatePerson(person.id, update);
      if (result.person) setPeople(current => current.map(item => item.id === person.id ? result.person : item));
      setError('');
    } catch (e) {
      setPeople(previous);
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setSaving(current => ({ ...current, [person.id]: false }));
    }
  };

  const importFile = async () => {
    if (!file || importing) return;
    setImporting(true); setError(''); setNotice('');
    try {
      const result = await client.importWhatsApp(file, selfName.trim() ? [selfName.trim()] : []);
      if (result.status === 'deduplicated') setNotice(t.dedup);
      else setNotice(`${t.imported} · ${result.messageCount} ${t.messages} · ${result.mergedPeopleCount || 0} ${t.merged} · ${result.identityReviewCount || 0} ${t.review}`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setImporting(false);
    }
  };

  const compose = async (selection = selected, requestedTone = tone, requestedStyle = composerStyle) => {
    if (!selection) return;
    setDraftBusy(true); setCopied(false);
    try {
      const result = await client.compose(selection.person.id, selection.signal.id, requestedTone, { style: requestedStyle });
      setComposerPlan(result);
      setDraft(result.draft || result.options?.[0]?.text || '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setDraftBusy(false);
    }
  };

  const openComposer = (person: RadarClientPerson) => {
    const signal = person.signals?.[0];
    if (!signal) return;
    const selection = { person, signal };
    setSelected(selection); setDraft(''); setComposerPlan(null); setTone('curto');
    const initialStyle: ComposerStyle = signal.type === 'unanswered_conversation' || signal.type === 'recurring_relevant_topic'
      ? 'pastoral' : signal.type === 'commercial_followup_due' ? 'proximo' : 'consultivo';
    setComposerStyle(initialStyle);
    setTimeout(() => void compose(selection, 'curto', initialStyle), 0);
  };

  const resolveIdentity = async (person: RadarClientPerson, candidatePersonId: string, action: 'merge' | 'keep_separate') => {
    try {
      const result = await client.resolveIdentity(person.id, candidatePersonId, action);
      setNotice(action === 'merge' ? t.identityMerged : t.identitySeparate);
      setLastMergeId(action === 'merge' ? result.mergeId || null : null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    }
  };

  const undoMerge = async () => {
    if (!lastMergeId) return;
    try {
      await client.undoIdentityMerge(lastMergeId);
      setLastMergeId(null); setNotice('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    }
  };

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setSearchBusy(true);
    try {
      const result = await client.search(query.trim());
      setSearchResults(Array.isArray(result.matches) ? result.matches : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setSearchBusy(false);
    }
  };

  const visiblePeople = useMemo(() => people.filter(person => {
    if (filter === 'favorites') return Boolean(person.favorite);
    if (filter === 'priority') return person.manualPriority === 'priority';
    if (filter === 'very_high') return (person.manualPotential || person.effectivePotential || person.automaticPotential) === 'very_high';
    if (filter === 'review') return Boolean(person.identityReview?.length);
    return true;
  }), [people, filter]);

  const filterItems: Array<[FilterMode, string]> = [
    ['all', t.all], ['favorites', t.favorites], ['priority', t.priority], ['very_high', t.veryHigh], ['review', t.duplicates],
  ];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-32 lg:pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.16),transparent_34%),linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))] p-5 shadow-2xl sm:p-7 lg:p-9">
        <div className="relative grid gap-7 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-indigo-300"><Radar size={15} /> {t.eyebrow}</div>
            <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2 text-xs text-emerald-100"><ShieldCheck size={14} /> {t.privacy}</div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-white">{t.importTitle}</div><div className="mt-1 text-xs text-slate-500">{t.importHint}</div></div><FileArchive size={20} className="text-indigo-300" /></div>
            <label className="mt-4 block text-[11px] font-medium text-slate-400">{t.selfName}<input value={selfName} onChange={e => setSelfName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/40" /></label>
            <input ref={fileRef} type="file" accept=".txt,.zip,text/plain,application/zip" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200"><Upload size={15} /> {file?.name || t.choose}</button>
              <button onClick={() => void importFile()} disabled={!file || importing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-950 disabled:opacity-35">{importing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{importing ? t.importing : t.importAction}</button>
            </div>
          </div>
        </div>
      </section>

      {(notice || error) && <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-400/20 bg-rose-400/[0.07] text-rose-100' : 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100'}`}><div className="flex items-center gap-2">{error ? <AlertCircle size={16} /> : <Check size={16} />}{error || notice}</div>{lastMergeId && !error && <button onClick={() => void undoMerge()} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium">{t.undo}</button>}</div>}

      <section className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterItems.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-medium transition ${filter === value ? 'border-indigo-400/30 bg-indigo-400/15 text-indigo-100' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:text-white'}`}>{label}</button>)}
        </div>
        <div className="flex min-w-0 gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-2 lg:w-[430px]"><Search size={17} className="ml-2 mt-2 text-slate-500" /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && void runSearch()} placeholder={t.searchPlaceholder} className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-slate-600" /><button onClick={() => void runSearch()} disabled={searchBusy || query.trim().length < 2} className="rounded-xl bg-white/[0.07] px-3 text-xs font-medium text-slate-200 disabled:opacity-30">{searchBusy ? <Loader2 size={14} className="animate-spin" /> : t.searchAction}</button></div>
      </section>

      {searchResults && <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4"><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-white">{t.search}</div><button onClick={() => setSearchResults(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={16} /></button></div>{searchResults.length ? <div className="grid gap-2 md:grid-cols-2">{searchResults.slice(0, 12).map((result, index) => <div key={`${result.sourceId}-${index}`} className="rounded-2xl border border-white/8 bg-black/15 p-3"><div className="text-xs font-medium text-slate-200">{result.sender} · {result.dateKey}</div><div className="mt-1 text-xs leading-5 text-slate-500">{result.snippet}</div></div>)}</div> : <div className="text-sm text-slate-500">{t.noSearch}</div>}</section>}

      {loading ? <div className="flex min-h-52 items-center justify-center text-slate-500"><Loader2 size={22} className="animate-spin" /></div> : visiblePeople.length === 0 ? <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center"><UsersRound size={28} className="mx-auto text-slate-600" /><div className="mt-4 text-base font-semibold text-white">{t.empty}</div><div className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{t.emptyDesc}</div></div> : <section className="grid gap-3 xl:grid-cols-2">
        {visiblePeople.map(person => {
          const effectivePotential = (person.manualPotential || person.effectivePotential || person.automaticPotential || 'unknown') as RadarPotentialLevel;
          const candidate = person.identityReview?.[0];
          const primarySignal = person.signals?.[0];
          return <article key={person.id} className={`group relative overflow-hidden rounded-[26px] border p-4 transition sm:p-5 ${person.favorite ? 'border-indigo-400/25 bg-indigo-400/[0.055] shadow-[0_18px_60px_rgba(79,70,229,.08)]' : 'border-white/10 bg-white/[0.028] hover:border-white/15 hover:bg-white/[0.04]'}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-sm font-semibold text-white">{person.displayName?.slice(0, 1)?.toUpperCase() || '?'}</div>
              <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><h2 className="truncate text-base font-semibold text-white">{person.displayName}</h2>{saving[person.id] && <Loader2 size={13} className="animate-spin text-indigo-300" />}</div><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500"><span>{person.messageCount || 0} {t.messages}</span>{person.lastDateKey && <span>{person.lastDateKey}</span>}{person.sourceIds && person.sourceIds.length > 1 && <span>{person.sourceIds.length} fontes</span>}</div></div>
              <button onClick={() => void patchPerson(person, { favorite: !person.favorite })} aria-label={t.favorites} className={`rounded-xl border p-2.5 transition ${person.favorite ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-white/8 text-slate-600 hover:text-slate-200'}`}><Star size={17} fill={person.favorite ? 'currentColor' : 'none'} /></button>
            </div>

            {candidate && <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-3"><div className="flex items-center gap-2 text-xs font-semibold text-amber-100"><UserRoundCheck size={15} /> {t.identityPossible}</div><div className="mt-1 text-xs text-amber-100/70">{candidate.displayName} · {candidate.confidence}%</div><div className="mt-3 flex gap-2"><button onClick={() => void resolveIdentity(person, candidate.personId, 'merge')} className="rounded-xl bg-amber-200 px-3 py-2 text-[11px] font-semibold text-slate-950">{t.merge}</button><button onClick={() => void resolveIdentity(person, candidate.personId, 'keep_separate')} className="rounded-xl border border-amber-200/15 px-3 py-2 text-[11px] font-medium text-amber-50">{t.separate}</button></div></div>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="rounded-2xl border border-white/8 bg-black/15 p-3"><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{t.potential}</span><div className="mt-2 flex items-center gap-2"><span className={`rounded-lg border px-2 py-1 text-[11px] ${potentialClasses(effectivePotential)}`}>{t[effectivePotential]}</span><select value={person.manualPotential || ''} onChange={e => void patchPerson(person, { manualPotential: e.target.value ? e.target.value as RadarPotentialLevel : null })} className="min-w-0 flex-1 appearance-none bg-transparent text-right text-[11px] text-slate-400 outline-none"><option value="">{t.auto}</option>{potentialOrder.map(level => <option key={level} value={level}>{t[level]}</option>)}</select><ChevronDown size={12} className="text-slate-600" /></div></label>
              <label className="rounded-2xl border border-white/8 bg-black/15 p-3"><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{t.priorityLabel}</span><div className="mt-2 flex items-center gap-2"><select value={person.manualPriority || 'normal'} onChange={e => void patchPerson(person, { manualPriority: e.target.value as RadarManualPriority })} className="w-full appearance-none bg-transparent text-sm font-medium text-slate-200 outline-none">{priorityOrder.map(value => <option key={value} value={value}>{value === 'normal' ? t.normal : value === 'important' ? t.important : t.priorityTop}</option>)}</select><ChevronDown size={12} className="text-slate-600" /></div></label>
            </div>

            {primarySignal && <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-3"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600"><Sparkles size={12} /> {t.evidence}</div><p className="mt-2 text-sm leading-5 text-slate-300">{primarySignal.reason}</p>{primarySignal.evidence?.[0]?.snippet && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">“{primarySignal.evidence[0].snippet}”</p>}<div className="mt-3 text-xs text-indigo-200">{t.next}: {primarySignal.nextAction}</div></div>}

            <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => openComposer(person)} disabled={!primarySignal} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-950 disabled:opacity-30"><Sparkles size={14} /> {t.compose}</button><button onClick={async () => { await client.promote(person.id); setPromoted(current => ({ ...current, [person.id]: true })); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-slate-300"><UserRoundCheck size={14} /> {promoted[person.id] ? t.promoted : t.promote}</button><button onClick={() => void patchPerson(person, { radarState: 'snoozed', snoozeDays: 7 })} className="min-h-10 rounded-xl border border-white/8 px-3 text-xs text-slate-500 hover:text-white">{t.snooze}</button><button onClick={() => void patchPerson(person, { notRelevant: true })} className="min-h-10 rounded-xl border border-white/8 px-3 text-xs text-slate-600 hover:text-rose-200">{t.ignore}</button></div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-black/10 px-3 py-2"><MessageCircle size={13} className="text-slate-600" /><input value={phones[person.id] || ''} onChange={e => setPhones(current => ({ ...current, [person.id]: e.target.value }))} onBlur={() => { const value = phones[person.id]?.trim() || ''; if (value !== (person.phone || '')) void patchPerson(person, { phone: value || null }); }} placeholder={t.phone} className="min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-700" /></div>
          </article>;
        })}
      </section>}

      {selected && <section className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-5xl rounded-[28px] border border-indigo-400/20 bg-[#0b0f18]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,.6)] backdrop-blur-2xl sm:inset-x-5 sm:p-5 lg:bottom-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-indigo-200">{t.composerTitle}</div><div className="mt-1 text-sm font-medium text-white">{selected.person.displayName}</div></div><button onClick={() => setSelected(null)} className="rounded-xl border border-white/8 p-2 text-slate-500 hover:text-white"><X size={16} /></button></div><div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t.style}</div><div className="mt-2 flex flex-wrap gap-1.5">{(['amigavel','profissional','objetivo','proximo','pastoral','consultivo'] as ComposerStyle[]).map(style => <button key={style} onClick={() => { setComposerStyle(style); void compose(selected, tone, style); }} className={`rounded-lg px-2.5 py-1.5 text-[11px] ${composerStyle === style ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}>{composerStyleLabel(style, currentLang)}</button>)}</div><div className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t.tone}</div><div className="mt-2 flex flex-wrap gap-1.5">{([['curto',t.short],['conversa',t.conversation],['audio',t.audio],['video',t.video]] as Array<[Tone,string]>).map(([value,label]) => <button key={value} onClick={() => { setTone(value); void compose(selected, value, composerStyle); }} className={`rounded-lg px-2.5 py-1.5 text-[11px] ${tone === value ? 'bg-white text-slate-950' : 'bg-white/5 text-slate-400'}`}>{label}</button>)}</div></div><div className="min-w-0"><textarea value={draft} onChange={e => setDraft(e.target.value)} className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-100 outline-none focus:border-indigo-400/30" placeholder={draftBusy ? t.regenerate : ''} />{composerPlan?.why && <div className="mt-2 text-xs leading-5 text-slate-500"><span className="text-slate-400">{t.why}:</span> {composerPlan.why}</div>}<div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); }} disabled={!draft} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-slate-200 disabled:opacity-40">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t.copied : t.copy}</button><button onClick={() => void compose()} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs text-slate-300">{draftBusy ? <Loader2 size={14} className="animate-spin" /> : t.regenerate}</button>{phones[selected.person.id] ? <button onClick={() => window.open(`https://wa.me/${(phones[selected.person.id] || '').replace(/\D/g, '')}?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer')} disabled={!draft} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-3 text-xs font-semibold text-slate-950 disabled:opacity-40"><MessageCircle size={15} /> {t.whatsapp}</button> : <span className="text-xs text-slate-600">{t.noPhone}</span>}<span className="ml-auto hidden text-[10px] text-slate-600 sm:inline">{t.noAuto}</span></div></div></div></section>}
    </main>
  );
};
