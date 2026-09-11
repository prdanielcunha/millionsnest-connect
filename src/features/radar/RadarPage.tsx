import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Check, ChevronRight, Copy, FileArchive, Loader2, MessageCircle,
  Radar, Search, ShieldCheck, Sparkles, Trash2, Upload, UserRoundCheck,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import { PersonalRadarClient, RadarClientPerson } from '../../core/client/personalRadarClient';
import { LanguageCode } from '../../types';

interface RadarPageProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}

type Tone = 'curto' | 'conversa' | 'audio' | 'video';

type SelectedSignal = {
  person: RadarClientPerson;
  signal: RadarClientPerson['signals'][number];
};

const copy = {
  'pt-BR': {
    eyebrow: 'RADAR · RELATIONSHIP INTELLIGENCE', title: 'Com quem vale conversar primeiro?',
    subtitle: 'O Radar prioriza quem já mostrou uma dor que o MusicScale resolve, depois quem já tem relação com você, pastores/líderes e, por último, os demais contatos pastorais — sempre com evidência e contexto.',
    privacy: 'Cofre pessoal: visível somente para sua conta. Nada vira oportunidade comercial automaticamente.',
    importTitle: 'Importar conversa', importHint: 'TXT ou ZIP exportado pelo próprio WhatsApp · até 5 MB',
    selfName: 'Seu nome como aparece no export', choose: 'Escolher TXT ou ZIP', importing: 'Analisando com segurança…',
    importAction: 'Importar e analisar', imported: 'Importação concluída', dedup: 'Este arquivo já estava no seu cofre. Nenhuma duplicação foi criada.',
    people: 'Pessoas priorizadas', messages: 'mensagens',
    signals: 'motivos com evidência', empty: 'Nenhum contato prioritário ainda', emptyDesc: 'Importe uma conversa autorizada. O Radar só mostra pessoas quando encontra um motivo real para priorizá-las.',
    evidence: 'Evidência', next: 'Próximo passo', compose: 'Criar abordagem', promote: 'Promover manualmente', promoted: 'Oportunidade marcada',
    phone: 'WhatsApp/telefone', savePhone: 'Salvar', snooze: 'Adiar 7 dias', ignore: 'Ignorar', sourceDelete: 'Excluir fonte',
    composerTitle: 'Composer MusicScale', tone: 'Tom', short: 'Curto', conversation: 'Conversa', audio: 'Áudio', video: 'Vídeo',
    regenerate: 'Gerar', copy: 'Copiar', copied: 'Copiado', whatsapp: 'Abrir WhatsApp', noPhone: 'Adicione o telefone para abrir o WhatsApp.',
    search: 'Pesquisar no seu histórico', searchPlaceholder: 'Pessoa, termo, escala, WhatsApp…', searchAction: 'Buscar', noSearch: 'Nenhum resultado.',
    deleteConfirm: 'Excluir esta fonte e todos os dados derivados dela do seu cofre pessoal?',
    error: 'Não foi possível concluir esta operação.', noAuto: 'O envio é sempre manual neste piloto.',
  },
  'en-US': {
    eyebrow: 'RADAR · RELATIONSHIP INTELLIGENCE', title: 'Who should you talk to first?',
    subtitle: 'Radar prioritizes people who already showed a problem MusicScale can solve, then people who already know you, pastors/leaders, and finally other pastoral contacts — always with evidence and context.',
    privacy: 'Personal vault: visible only to your account. Nothing becomes a commercial opportunity automatically.',
    importTitle: 'Import conversation', importHint: 'TXT or ZIP exported by WhatsApp · up to 5 MB',
    selfName: 'Your name as it appears in the export', choose: 'Choose TXT or ZIP', importing: 'Analyzing securely…',
    importAction: 'Import and analyze', imported: 'Import complete', dedup: 'This file was already in your vault. No duplicate was created.',
    people: 'Prioritized people', messages: 'messages',
    signals: 'evidence-backed reasons', empty: 'No priority contact yet', emptyDesc: 'Import an authorized conversation. Radar only surfaces people when there is a real reason to prioritize them.',
    evidence: 'Evidence', next: 'Next step', compose: 'Create approach', promote: 'Promote manually', promoted: 'Opportunity marked',
    phone: 'WhatsApp/phone', savePhone: 'Save', snooze: 'Snooze 7 days', ignore: 'Ignore', sourceDelete: 'Delete source',
    composerTitle: 'MusicScale Composer', tone: 'Tone', short: 'Short', conversation: 'Conversation', audio: 'Audio', video: 'Video',
    regenerate: 'Generate', copy: 'Copy', copied: 'Copied', whatsapp: 'Open WhatsApp', noPhone: 'Add a phone number to open WhatsApp.',
    search: 'Search your history', searchPlaceholder: 'Person, term, schedule, WhatsApp…', searchAction: 'Search', noSearch: 'No results.',
    deleteConfirm: 'Delete this source and all data derived from it from your personal vault?',
    error: 'Could not complete this operation.', noAuto: 'Sending is always manual in this pilot.',
  },
  'es-ES': {
    eyebrow: 'RADAR · RELATIONSHIP INTELLIGENCE', title: '¿Con quién conviene hablar primero?',
    subtitle: 'Radar prioriza a quienes ya mostraron un problema que MusicScale puede resolver, luego a quienes ya tienen relación contigo, pastores/líderes y, por último, otros contactos pastorales — siempre con evidencia y contexto.',
    privacy: 'Cofre personal: visible solo para tu cuenta. Nada se convierte automáticamente en oportunidad comercial.',
    importTitle: 'Importar conversación', importHint: 'TXT o ZIP exportado por WhatsApp · hasta 5 MB',
    selfName: 'Tu nombre como aparece en la exportación', choose: 'Elegir TXT o ZIP', importing: 'Analizando de forma segura…',
    importAction: 'Importar y analizar', imported: 'Importación completa', dedup: 'Este archivo ya estaba en tu cofre. No se creó ningún duplicado.',
    people: 'Personas priorizadas', messages: 'mensajes',
    signals: 'motivos con evidencia', empty: 'Aún no hay contactos prioritarios', emptyDesc: 'Importa una conversación autorizada. Radar solo muestra personas cuando encuentra un motivo real para priorizarlas.',
    evidence: 'Evidencia', next: 'Siguiente paso', compose: 'Crear enfoque', promote: 'Promover manualmente', promoted: 'Oportunidad marcada',
    phone: 'WhatsApp/teléfono', savePhone: 'Guardar', snooze: 'Posponer 7 días', ignore: 'Ignorar', sourceDelete: 'Eliminar fuente',
    composerTitle: 'Composer MusicScale', tone: 'Tono', short: 'Corto', conversation: 'Conversación', audio: 'Audio', video: 'Video',
    regenerate: 'Generar', copy: 'Copiar', copied: 'Copiado', whatsapp: 'Abrir WhatsApp', noPhone: 'Agrega el teléfono para abrir WhatsApp.',
    search: 'Buscar en tu historial', searchPlaceholder: 'Persona, término, escala, WhatsApp…', searchAction: 'Buscar', noSearch: 'Sin resultados.',
    deleteConfirm: '¿Eliminar esta fuente y todos los datos derivados de ella de tu cofre personal?',
    error: 'No fue posible completar esta operación.', noAuto: 'El envío siempre es manual en este piloto.',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

function signalLabel(type: string, lang: LanguageCode): string {
  const labels: Record<string, Record<LanguageCode, string>> = {
    explicit_product_interest: { 'pt-BR': 'Potencial MusicScale', 'en-US': 'MusicScale fit', 'es-ES': 'Potencial MusicScale' },
    commercial_followup_due: { 'pt-BR': 'Relacionamento ativo', 'en-US': 'Existing relationship', 'es-ES': 'Relación existente' },
    unanswered_conversation: { 'pt-BR': 'Pastor / líder', 'en-US': 'Pastor / leader', 'es-ES': 'Pastor / líder' },
    recurring_relevant_topic: { 'pt-BR': 'Contato pastoral', 'en-US': 'Pastoral contact', 'es-ES': 'Contacto pastoral' },
  };
  return labels[type]?.[lang] || type;
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
  const [selected, setSelected] = useState<SelectedSignal | null>(null);
  const [tone, setTone] = useState<Tone>('curto');
  const [draft, setDraft] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [promoted, setPromoted] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

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

  const importFile = async () => {
    if (!file || importing) return;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const result = await client.importWhatsApp(file, selfName.trim() ? [selfName.trim()] : []);
      setNotice(result.status === 'deduplicated' ? t.dedup : `${t.imported} · ${result.messageCount} ${t.messages}`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setImporting(false);
    }
  };

  const compose = async (selection = selected, requestedTone = tone) => {
    if (!selection) return;
    setDraftBusy(true);
    setCopied(false);
    try {
      const result = await client.compose(selection.person.id, selection.signal.id, requestedTone);
      setDraft(result.draft || '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setDraftBusy(false);
    }
  };

  const openComposer = (person: RadarClientPerson, signal: RadarClientPerson['signals'][number]) => {
    const selection = { person, signal };
    setSelected(selection);
    setDraft('');
    setTone('curto');
    setTimeout(() => void compose(selection, 'curto'), 0);
  };

  const snoozePerson = async (person: RadarClientPerson) => {
    try {
      await client.updatePerson(person.id, { radarState: 'snoozed', snoozeDays: 7 });
      if (selected?.person.id === person.id) setSelected(null);
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

  const totalSignals = people.reduce((sum, person) => sum + (person.signals?.length || 0), 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 pb-28 lg:pb-10">
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl sm:p-7 lg:p-9">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-indigo-300"><Radar size={15} /> {t.eyebrow}</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{t.subtitle}</p>
            <div className="mt-5 inline-flex items-start gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] px-3.5 py-3 text-xs leading-5 text-emerald-100">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" /> {t.privacy}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="text-2xl font-semibold text-white">{people.length}</div><div className="mt-1 text-[11px] text-slate-400">{t.people}</div></div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="text-2xl font-semibold text-white">{totalSignals}</div><div className="mt-1 text-[11px] text-slate-400">{t.signals}</div></div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-300"><Upload size={18} /></div><div><h2 className="font-semibold text-white">{t.importTitle}</h2><p className="text-xs text-slate-500">{t.importHint}</p></div></div>
          <label className="mt-5 block text-xs font-medium text-slate-300">{t.selfName}<input value={selfName} onChange={e => setSelfName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/40" /></label>
          <input ref={fileRef} type="file" accept=".txt,.zip,text/plain,application/zip" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.025] px-4 text-sm text-slate-300 hover:bg-white/[0.045]"><FileArchive size={17} /> {file?.name || t.choose}</button>
          <button type="button" disabled={!file || importing} onClick={() => void importFile()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-35">{importing ? <><Loader2 size={16} className="animate-spin" /> {t.importing}</> : <><Sparkles size={16} /> {t.importAction}</>}</button>
          {notice && <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-2.5 text-xs text-emerald-200">{notice}</div>}
        </div>

        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Search size={17} /> {t.search}</div>
          <form onSubmit={e => { e.preventDefault(); void runSearch(); }} className="mt-4 flex gap-2"><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-indigo-400/40" /><button disabled={searchBusy || query.trim().length < 2} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 disabled:opacity-35">{searchBusy ? <Loader2 size={16} className="animate-spin" /> : t.searchAction}</button></form>
          {searchResults !== null && <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{searchResults.length === 0 ? <p className="text-sm text-slate-500">{t.noSearch}</p> : searchResults.map((result, index) => <div key={`${result.sourceId}-${index}`} className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="flex justify-between gap-3 text-xs"><span className="font-medium text-white">{result.sender}</span><span className="text-slate-500">{result.dateKey}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{result.snippet}</p></div>)}</div>}
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-2xl border border-red-400/15 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200"><AlertCircle size={17} className="mt-0.5 shrink-0" /> {error}</div>}

      <section className="space-y-4">
        {loading ? <div className="grid min-h-52 place-items-center rounded-[26px] border border-white/10 bg-white/[0.025]"><Loader2 className="animate-spin text-slate-400" /></div> : people.length === 0 ? <div className="rounded-[26px] border border-white/10 bg-white/[0.025] p-10 text-center"><Radar className="mx-auto text-slate-600" /><h3 className="mt-4 font-semibold text-white">{t.empty}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{t.emptyDesc}</p></div> : people.map(person => (
          <article key={person.id} className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03]">
            <div className="flex flex-col gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-lg font-semibold text-white">{person.displayName}</h3><p className="mt-1 text-xs text-slate-500">{person.lastDateKey || '—'} · {person.messageCount || 0} {t.messages}</p></div>
              <div className="flex flex-wrap gap-2"><button onClick={async () => { await client.promote(person.id); setPromoted(prev => ({ ...prev, [person.id]: true })); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 text-xs font-medium text-emerald-200"><UserRoundCheck size={15} /> {promoted[person.id] ? t.promoted : t.promote}</button><button onClick={() => void snoozePerson(person)} className="min-h-10 rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] px-3 text-xs text-indigo-200">{t.snooze}</button><button onClick={async () => { await client.updatePerson(person.id, { radarState: 'ignored' }); if (selected?.person.id === person.id) setSelected(null); await refresh(); }} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs text-slate-400">{t.ignore}</button><button title={t.sourceDelete} onClick={async () => { if (window.confirm(t.deleteConfirm)) { await client.deleteSource(person.sourceId); if (selected?.person.sourceId === person.sourceId) setSelected(null); await refresh(); } }} className="grid h-10 w-10 place-items-center rounded-xl border border-red-400/10 text-red-300/70 hover:bg-red-400/5"><Trash2 size={15} /></button></div>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2">{person.signals.map(signal => <div key={signal.id} className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full border border-indigo-400/15 bg-indigo-400/[0.06] px-2.5 py-1 text-[10px] font-semibold text-indigo-200">{signalLabel(signal.type, currentLang)}</span><ChevronRight size={15} className="text-slate-600" /></div><p className="mt-3 text-sm leading-6 text-slate-200">{signal.reason}</p>{signal.evidence?.[0] && <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.evidence} · {signal.evidence[0].dateKey}</div><p className="mt-1 text-xs leading-5 text-slate-400">“{signal.evidence[0].snippet}”</p></div>}<div className="mt-3 text-xs leading-5 text-slate-400"><span className="font-semibold text-slate-300">{t.next}:</span> {signal.nextAction}</div><button onClick={() => openComposer(person, signal)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-950"><MessageCircle size={15} /> {t.compose}</button></div>)}</div>
            <div className="flex flex-col gap-2 border-t border-white/8 bg-black/10 p-4 sm:flex-row sm:items-center"><label className="text-xs text-slate-500 sm:min-w-32">{t.phone}</label><input value={phones[person.id] || ''} onChange={e => setPhones(prev => ({ ...prev, [person.id]: e.target.value }))} placeholder="5543999999999" className="min-h-10 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none" /><button onClick={async () => { await client.updatePerson(person.id, { phone: phones[person.id] }); await refresh(); }} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-medium text-slate-300">{t.savePhone}</button></div>
          </article>
        ))}
      </section>

      {selected && <section className="sticky bottom-4 z-30 rounded-[26px] border border-indigo-400/20 bg-[#101522]/95 p-4 shadow-2xl backdrop-blur-2xl sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className="lg:w-60"><div className="text-xs font-semibold text-indigo-200">{t.composerTitle}</div><div className="mt-1 text-sm font-medium text-white">{selected.person.displayName}</div><div className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.tone}</div><div className="mt-2 flex flex-wrap gap-1.5">{([['curto', t.short], ['conversa', t.conversation], ['audio', t.audio], ['video', t.video]] as Array<[Tone, string]>).map(([value, label]) => <button key={value} onClick={() => { setTone(value); void compose(selected, value); }} className={`rounded-lg px-2.5 py-1.5 text-xs ${tone === value ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}>{label}</button>)}</div></div><div className="min-w-0 flex-1"><div className="min-h-24 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-100">{draftBusy ? <div className="flex items-center gap-2 text-slate-400"><Loader2 size={15} className="animate-spin" /> {t.regenerate}…</div> : draft}</div><div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); }} disabled={!draft} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-slate-200 disabled:opacity-40">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t.copied : t.copy}</button><button onClick={() => void compose()} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs text-slate-300">{t.regenerate}</button>{phones[selected.person.id] ? <button onClick={() => window.open(`https://wa.me/${(phones[selected.person.id] || '').replace(/\D/g, '')}?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer')} disabled={!draft} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-400 px-3 text-xs font-semibold text-slate-950 disabled:opacity-40"><MessageCircle size={15} /> {t.whatsapp}</button> : <span className="text-xs text-slate-500">{t.noPhone}</span>}<span className="ml-auto text-[10px] text-slate-500">{t.noAuto}</span></div></div></div></section>}
    </main>
  );
};