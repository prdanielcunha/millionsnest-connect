import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  ArrowRight,
  Check,
  Copy,
  Database,
  FileArchive,
  History,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRoundSearch,
  UsersRound,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import {
  PersonalRadarClient,
  PersonalSourceDetail,
  RadarConversationSummary,
} from '../../core/client/personalRadarClient';
import { LanguageCode } from '../../types';
import { Person360Panel } from '../contacts/Person360Panel';
import { openWhatsAppDraft } from '../../core/client/whatsappDelivery';

type Props = {
  session: LiveConnectSession;
  currentLang: LanguageCode;
  onNavigate: (route: string) => void;
};

function compactNumber(value: number, lang: LanguageCode) {
  return new Intl.NumberFormat(lang, { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value || 0);
}

function shortDate(value: string | null | undefined, lang: LanguageCode) {
  if (!value) return '—';
  const parsed = Date.parse(value.length === 10 ? `${value}T12:00:00` : value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function normalizePhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}

export const PersonalSourcesPage: React.FC<Props> = ({ session, currentLang, onNavigate }) => {
  const client = useMemo(() => new PersonalRadarClient(session), [session]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<RadarConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<PersonalSourceDetail | null>(null);
  const [brief, setBrief] = useState<any[]>([]);
  const [recentImports, setRecentImports] = useState<any[]>([]);
  const [totals, setTotals] = useState({ conversations: 0, people: 0, messages: 0, imports: 0 });
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selfName, setSelfName] = useState(session.context.user.name || '');
  const [loading, setLoading] = useState(true);
  const [detailBusy, setDetailBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreach, setOutreach] = useState<any[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [person360Id, setPerson360Id] = useState('');

  const t = currentLang === 'pt-BR' ? {
    eyebrow: 'COFRE PESSOAL · MEMÓRIA DE RELACIONAMENTO',
    title: 'Minhas fontes',
    subtitle: 'Importe conversas autorizadas, mantenha cada grupo separado e deixe o Connect acrescentar apenas o que é novo. Tudo continua privado ao dono.',
    privacy: 'Owner-only · sem virar lead automaticamente',
    conversations: 'Conversas', people: 'Pessoas', messages: 'Mensagens', imports: 'Importações',
    importTitle: 'Atualizar uma conversa', importHint: 'TXT ou ZIP oficial do WhatsApp. Reimporte o mesmo grupo quando quiser: o Connect elimina o que já existe.',
    yourName: 'Seu nome no WhatsApp', choose: 'Escolher arquivo', importAction: 'Importar / atualizar', importing: 'Analisando…',
    allSources: 'Conversas importadas', search: 'Buscar grupo ou conversa…', empty: 'Nenhuma conversa importada ainda.',
    incremental: 'Sincronização incremental', legacy: 'Fonte anterior', group: 'Grupo', direct: 'Conversa',
    updated: 'Atualizada', participants: 'participantes', newMessages: 'novas',
    today: 'Quem merece atenção agora', todayHint: 'Sem pontuação misteriosa: cada sugestão mostra o motivo.',
    openPeople: 'Abrir Pessoas', openRadar: 'Abrir Radar', detail: 'Detalhes da conversa', recent: 'Mensagens recentes',
    peopleHere: 'Pessoas desta conversa', history: 'Histórico de importações', prepare: 'Preparar conversas', preparing: 'Preparando…',
    prepareHint: 'Gera abordagens individuais para até 5 pessoas desta fonte. Nada é enviado automaticamente.',
    copy: 'Copiar', copied: 'Copiado', whatsapp: 'WhatsApp', delete: 'Excluir fonte', deleteConfirm: 'Excluir esta conversa importada e os dados derivados que dependem somente dela?',
    noDetail: 'Selecione uma conversa para ver participantes, pessoas, mensagens e histórico.',
    noOutreach: 'Nenhuma abordagem foi preparada para esta fonte.',
    imported: 'Importação concluída', noChanges: 'Nenhuma mensagem nova encontrada', added: 'mensagens novas adicionadas', total: 'mensagens no histórico',
    why: 'Por que agora', next: 'Próxima ação', source: 'Origem', automaticOff: 'Envio automático permanece desligado',
  } : currentLang === 'es-ES' ? {
    eyebrow: 'BÓVEDA PERSONAL · MEMORIA DE RELACIONES',
    title: 'Mis fuentes',
    subtitle: 'Importa conversaciones autorizadas, mantiene cada grupo separado y deja que Connect agregue solo lo nuevo. Todo sigue privado para el propietario.',
    privacy: 'Solo propietario · sin convertir automáticamente en lead',
    conversations: 'Conversaciones', people: 'Personas', messages: 'Mensajes', imports: 'Importaciones',
    importTitle: 'Actualizar una conversación', importHint: 'TXT o ZIP oficial de WhatsApp. Reimporta el mismo grupo: Connect elimina lo que ya existe.',
    yourName: 'Tu nombre en WhatsApp', choose: 'Elegir archivo', importAction: 'Importar / actualizar', importing: 'Analizando…',
    allSources: 'Conversaciones importadas', search: 'Buscar grupo o conversación…', empty: 'Todavía no hay conversaciones importadas.',
    incremental: 'Sincronización incremental', legacy: 'Fuente anterior', group: 'Grupo', direct: 'Conversación',
    updated: 'Actualizada', participants: 'participantes', newMessages: 'nuevos',
    today: 'Quién merece atención ahora', todayHint: 'Sin puntuación misteriosa: cada sugerencia muestra el motivo.',
    openPeople: 'Abrir Personas', openRadar: 'Abrir Radar', detail: 'Detalles de la conversación', recent: 'Mensajes recientes',
    peopleHere: 'Personas de esta conversación', history: 'Historial de importaciones', prepare: 'Preparar conversaciones', preparing: 'Preparando…',
    prepareHint: 'Genera enfoques individuales para hasta 5 personas de esta fuente. Nada se envía automáticamente.',
    copy: 'Copiar', copied: 'Copiado', whatsapp: 'WhatsApp', delete: 'Eliminar fuente', deleteConfirm: '¿Eliminar esta conversación importada y los datos derivados que dependen solo de ella?',
    noDetail: 'Selecciona una conversación para ver participantes, personas, mensajes e historial.',
    noOutreach: 'No se preparó ningún enfoque para esta fuente.',
    imported: 'Importación completada', noChanges: 'No se encontraron mensajes nuevos', added: 'mensajes nuevos añadidos', total: 'mensajes en el historial',
    why: 'Por qué ahora', next: 'Próxima acción', source: 'Origen', automaticOff: 'El envío automático permanece desactivado',
  } : {
    eyebrow: 'PERSONAL VAULT · RELATIONSHIP MEMORY',
    title: 'My sources',
    subtitle: 'Import authorized conversations, keep every group separate, and let Connect add only what is new. Everything stays private to the owner.',
    privacy: 'Owner-only · never auto-promoted to a lead',
    conversations: 'Conversations', people: 'People', messages: 'Messages', imports: 'Imports',
    importTitle: 'Update a conversation', importHint: 'Official WhatsApp TXT or ZIP. Reimport the same group whenever you want: Connect removes what already exists.',
    yourName: 'Your WhatsApp name', choose: 'Choose file', importAction: 'Import / update', importing: 'Analyzing…',
    allSources: 'Imported conversations', search: 'Search group or conversation…', empty: 'No imported conversations yet.',
    incremental: 'Incremental sync', legacy: 'Previous source', group: 'Group', direct: 'Conversation',
    updated: 'Updated', participants: 'participants', newMessages: 'new',
    today: 'Who deserves attention now', todayHint: 'No mysterious score: every suggestion explains why.',
    openPeople: 'Open People', openRadar: 'Open Radar', detail: 'Conversation details', recent: 'Recent messages',
    peopleHere: 'People in this conversation', history: 'Import history', prepare: 'Prepare conversations', preparing: 'Preparing…',
    prepareHint: 'Creates individual approaches for up to 5 people from this source. Nothing is sent automatically.',
    copy: 'Copy', copied: 'Copied', whatsapp: 'WhatsApp', delete: 'Delete source', deleteConfirm: 'Delete this imported conversation and derived data that depends only on it?',
    noDetail: 'Select a conversation to see participants, people, messages and history.',
    noOutreach: 'No outreach was prepared for this source.',
    imported: 'Import completed', noChanges: 'No new messages found', added: 'new messages added', total: 'messages in history',
    why: 'Why now', next: 'Next action', source: 'Source', automaticOff: 'Automatic sending stays disabled',
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [sourceResult, briefResult] = await Promise.all([client.getSources(), client.getRelationshipBrief()]);
      setSources(sourceResult.sources);
      setTotals(sourceResult.totals);
      setRecentImports(sourceResult.recentImports);
      setBrief(Array.isArray(briefResult.items) ? briefResult.items : []);
      setSelectedId(current => current && sourceResult.sources.some(source => source.sourceId === current)
        ? current
        : sourceResult.sources[0]?.sourceId || '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar suas fontes pessoais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [client]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let active = true;
    setDetailBusy(true);
    setOutreach([]);
    client.getSource(selectedId)
      .then(result => { if (active) setDetail(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Erro'); })
      .finally(() => { if (active) setDetailBusy(false); });
    return () => { active = false; };
  }, [client, selectedId]);

  const filteredSources = sources.filter(source => `${source.label} ${source.fileName || ''}`.toLocaleLowerCase(currentLang)
    .includes(query.trim().toLocaleLowerCase(currentLang)));
  const selected = sources.find(source => source.sourceId === selectedId) || null;

  const importFile = async () => {
    if (!file || importing) return;
    setImporting(true); setError(''); setNotice('');
    try {
      const result = await client.importWhatsApp(file, selfName.trim() ? [selfName.trim()] : []);
      const added = Number(result.addedMessageCount ?? result.messageCount ?? 0);
      const total = Number(result.totalMessageCount ?? 0);
      setNotice(added > 0
        ? `${t.imported}: ${added} ${t.added} · ${total} ${t.total}`
        : `${t.noChanges}${total ? ` · ${total} ${t.total}` : ''}`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
      if (result.conversationId) setSelectedId(result.conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setImporting(false);
    }
  };

  const prepareOutreach = async () => {
    if (!selectedId || outreachBusy) return;
    setOutreachBusy(true); setError('');
    try {
      const result = await client.prepareSourceOutreach(selectedId, { limit: 5, tone: 'curto', style: 'consultivo' });
      setOutreach(Array.isArray(result.items) ? result.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setOutreachBusy(false);
    }
  };

  const copyDraft = async (item: any) => {
    if (!item?.draft) return;
    await navigator.clipboard.writeText(item.draft);
    setCopiedId(String(item.personId));
    try { await client.updatePerson(String(item.personId), { commercialAction: 'copied', commercialDraft: item.draft }); } catch { /* draft remains usable */ }
    setTimeout(() => setCopiedId(''), 1800);
  };

  const openWhatsApp = (item: any) => {
    if (!item?.draft) return;
    openWhatsAppDraft(item.draft, item.phone);
    void client.updatePerson(String(item.personId), { commercialAction: 'whatsapp_opened', commercialDraft: item.draft }).catch(() => undefined);
  };

  const deleteSource = async () => {
    if (!selectedId || !window.confirm(t.deleteConfirm)) return;
    setDetailBusy(true); setError('');
    try {
      await client.deleteSource(selectedId);
      setSelectedId(''); setDetail(null); setOutreach([]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDetailBusy(false);
    }
  };

  const stats = [
    [t.conversations, totals.conversations, FileArchive],
    [t.people, totals.people, UsersRound],
    [t.messages, totals.messages, MessageCircle],
    [t.imports, totals.imports, History],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,.18),transparent_36%),linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))] p-5 shadow-2xl sm:p-7 lg:p-9">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-indigo-300"><Database size={15} /> {t.eyebrow}</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2 text-xs text-emerald-100"><ShieldCheck size={14} /> {t.privacy}</div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-white">{t.importTitle}</div><div className="mt-1 text-xs leading-5 text-slate-500">{t.importHint}</div></div><RefreshCw size={20} className="text-indigo-300" /></div>
            <label className="mt-4 block text-[11px] font-medium text-slate-400">{t.yourName}<input value={selfName} onChange={e => setSelfName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/40" /></label>
            <input ref={fileRef} type="file" accept=".txt,.zip,text/plain,application/zip" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200"><Upload size={15} /> <span className="truncate">{file?.name || t.choose}</span></button>
              <button onClick={() => void importFile()} disabled={!file || importing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-950 disabled:opacity-35">{importing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{importing ? t.importing : t.importAction}</button>
            </div>
          </div>
        </div>
      </section>

      {(notice || error) && <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-400/20 bg-rose-400/[0.07] text-rose-100' : 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100'}`}>{error || notice}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, value, Icon]) => <div key={label} className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[11px] text-slate-500"><Icon size={14} /> {label}</div><div className="mt-2 text-2xl font-semibold tracking-tight text-white">{compactNumber(Number(value), currentLang)}</div></div>)}
      </section>

      {brief.length > 0 && <section className="rounded-[26px] border border-indigo-400/15 bg-indigo-400/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles size={16} className="text-indigo-300" /> {t.today}</div><div className="mt-1 text-xs text-slate-500">{t.todayHint}</div></div><button onClick={() => onNavigate('radar')} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200">{t.openRadar}<ArrowRight size={14} /></button></div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{brief.slice(0, 4).map(item => <div key={item.personId} className="rounded-2xl border border-white/8 bg-black/15 p-3"><div className="text-sm font-medium text-white">{item.displayName}</div><div className="mt-2 text-xs leading-5 text-slate-400"><span className="text-slate-600">{t.why}: </span>{item.reason}</div><div className="mt-2 text-[11px] leading-5 text-indigo-200">{item.nextAction}</div></div>)}</div>
      </section>}

      <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-[26px] border border-white/10 bg-white/[0.022] p-3 sm:p-4">
          <div className="flex items-center justify-between"><div className="text-sm font-semibold text-white">{t.allSources}</div><span className="text-xs text-slate-600">{sources.length}</span></div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3"><Search size={15} className="text-slate-600" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-slate-700" /></div>
          <div className="mt-3 max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {loading ? <div className="grid min-h-32 place-items-center text-slate-600"><Loader2 size={20} className="animate-spin" /></div> : filteredSources.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-xs text-slate-600">{t.empty}</div> : filteredSources.map(source => {
              const active = selectedId === source.sourceId;
              return <button key={source.sourceId} onClick={() => setSelectedId(source.sourceId)} className={`w-full rounded-2xl border p-3 text-left transition ${active ? 'border-indigo-400/30 bg-indigo-400/[0.09]' : 'border-white/8 bg-black/10 hover:border-white/15 hover:bg-white/[0.025]'}`}>
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{source.label}</div><div className="mt-1 text-[10px] text-slate-600">{source.kind === 'group' ? t.group : source.kind === 'direct' ? t.direct : 'WhatsApp'} · {compactNumber(source.messageCount, currentLang)} {t.messages.toLocaleLowerCase(currentLang)}</div></div><span className={`rounded-lg border px-2 py-1 text-[9px] ${source.syncMode === 'incremental' ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200' : 'border-white/8 text-slate-600'}`}>{source.syncMode === 'incremental' ? t.incremental : t.legacy}</span></div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600"><span>{source.peopleCount || 0} {t.people.toLocaleLowerCase(currentLang)} · {source.participantCount} {t.participants}</span><span>{shortDate(source.lastDateKey || source.lastImportedAt, currentLang)}</span></div>
              </button>;
            })}
          </div>
        </aside>

        <section className="min-w-0 rounded-[26px] border border-white/10 bg-white/[0.022] p-4 sm:p-5">
          {!selected ? <div className="grid min-h-[420px] place-items-center px-6 text-center text-sm text-slate-600"><div><ArchiveRestore size={28} className="mx-auto mb-3" />{t.noDetail}</div></div> : detailBusy && !detail ? <div className="grid min-h-[420px] place-items-center text-slate-600"><Loader2 size={22} className="animate-spin" /></div> : <>
            <div className="flex flex-col gap-4 border-b border-white/8 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight text-white">{selected.label}</h2><span className="rounded-lg border border-white/10 bg-black/15 px-2 py-1 text-[10px] text-slate-500">{selected.importCount || 1} {t.imports.toLocaleLowerCase(currentLang)}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{selected.messageCount} {t.messages.toLocaleLowerCase(currentLang)}</span><span>{selected.peopleCount || detail?.people?.length || 0} {t.people.toLocaleLowerCase(currentLang)}</span><span>{selected.participantCount} {t.participants}</span><span>{t.updated}: {shortDate(selected.lastImportedAt || selected.updatedAt, currentLang)}</span>{Number(selected.lastAddedMessageCount || 0) > 0 && <span className="text-emerald-300">+{selected.lastAddedMessageCount} {t.newMessages}</span>}</div></div>
              <div className="flex flex-wrap gap-2"><button onClick={() => onNavigate('radar')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-slate-300"><UserRoundSearch size={14} /> {t.openRadar}</button><button onClick={() => void deleteSource()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/15 px-3 text-xs text-rose-200/70 hover:bg-rose-400/[0.06]"><Trash2 size={14} /> {t.delete}</button></div>
            </div>

            <div className="mt-4 rounded-2xl border border-indigo-400/15 bg-indigo-400/[0.035] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles size={15} className="text-indigo-300" /> {t.prepare}</div><div className="mt-1 text-xs leading-5 text-slate-500">{t.prepareHint}</div></div><button onClick={() => void prepareOutreach()} disabled={outreachBusy} className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl bg-white px-3 text-xs font-semibold text-slate-950 disabled:opacity-40">{outreachBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{outreachBusy ? t.preparing : t.prepare}</button></div><div className="mt-3 flex items-center gap-2 text-[10px] text-slate-600"><ShieldCheck size={12} /> {t.automaticOff}</div></div>

            {outreach.length > 0 && <div className="mt-4 grid gap-3 xl:grid-cols-2">{outreach.map(item => <article key={item.personId} className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="text-sm font-semibold text-white">{item.displayName}</div><div className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</div><div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-slate-300">{item.draft}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void copyDraft(item)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-2.5 text-[11px] text-slate-300">{copiedId === item.personId ? <Check size={13} /> : <Copy size={13} />}{copiedId === item.personId ? t.copied : t.copy}</button><button onClick={() => void openWhatsApp(item)} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-300 px-2.5 text-[11px] font-semibold text-slate-950"><MessageCircle size={13} /> {t.whatsapp}</button></div></article>)}</div>}

            {detail && <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/10 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><UsersRound size={14} className="text-indigo-300" /> {t.peopleHere}</div><div className="mt-3 space-y-2">{detail.people.slice(0, 12).map(person => <button type="button" key={person.id} onClick={() => setPerson360Id(person.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.018] px-3 py-2.5 text-left transition hover:border-indigo-400/20 hover:bg-indigo-400/[0.04]"><div className="min-w-0"><div className="truncate text-xs font-medium text-slate-200">{person.displayName}</div><div className="mt-0.5 text-[10px] text-slate-600">{person.messageCount} {t.messages.toLocaleLowerCase(currentLang)}{person.lastDateKey ? ` · ${shortDate(person.lastDateKey, currentLang)}` : ''}</div></div>{person.phone && <MessageCircle size={14} className="shrink-0 text-emerald-300/70" />}</button>)}</div></div>

              <div className="rounded-2xl border border-white/8 bg-black/10 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><MessageCircle size={14} className="text-indigo-300" /> {t.recent}</div><div className="mt-3 space-y-2">{detail.recentMessages.slice(0, 10).map((message, index) => <div key={`${message.timestampLocal}-${index}`} className="rounded-xl border border-white/6 bg-white/[0.018] p-3"><div className="text-[10px] font-medium text-slate-400">{message.sender} · {shortDate(message.dateKey, currentLang)}</div><div className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{message.text}</div></div>)}</div></div>

              <div className="rounded-2xl border border-white/8 bg-black/10 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><UsersRound size={14} className="text-indigo-300" /> {t.participants}</div><div className="mt-3 flex flex-wrap gap-2">{detail.participants.slice(0, 24).map(participant => <span key={participant.name} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-slate-500">{participant.name} · {participant.messageCount}</span>)}</div></div>

              <div className="rounded-2xl border border-white/8 bg-black/10 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><History size={14} className="text-indigo-300" /> {t.history}</div><div className="mt-3 space-y-2">{(detail.imports.length ? detail.imports : recentImports.filter(item => item.groupId === selectedId)).slice(0, 10).map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 px-3 py-2.5"><div className="min-w-0"><div className="truncate text-[11px] text-slate-300">{item.fileName}</div><div className="mt-0.5 text-[10px] text-slate-600">{shortDate(item.createdAt, currentLang)}</div></div><div className="shrink-0 text-right"><div className="text-[11px] font-medium text-emerald-300">+{item.addedMessageCount}</div><div className="text-[9px] text-slate-700">/ {item.incomingMessageCount}</div></div></div>)}</div></div>
            </div>}
          </>}
        </section>
      </section>

      {person360Id && <Person360Panel client={client} personId={person360Id} currentLang={currentLang} onClose={() => setPerson360Id('')} />}

      <section className="rounded-[22px] border border-white/8 bg-white/[0.018] px-4 py-3 text-[11px] leading-5 text-slate-600"><div className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>Personal Sources V2 mantém o conteúdo no Cofre Pessoal, preserva a origem de cada relacionamento, não promove contatos automaticamente para a organização e prepara abordagens somente para revisão humana.</span></div></section>
    </main>
  );
};
