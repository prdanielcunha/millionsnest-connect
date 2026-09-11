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
type ComposerStyle = 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';
type ComposerObjective = 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';

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
    composerTitle: 'Composer MusicScale', tone: 'Formato', short: 'Curto', conversation: 'Conversa', audio: 'Áudio', video: 'Vídeo',
    guidance: 'Sugestão para agora', why: 'Por quê', nextYes: 'Próximo pequeno sim', usedContext: 'Contexto usado', chooseOption: 'Escolha uma opção', style: 'Estilo',
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
    composerTitle: 'MusicScale Composer', tone: 'Format', short: 'Short', conversation: 'Conversation', audio: 'Audio', video: 'Video',
    guidance: 'Suggested next move', why: 'Why', nextYes: 'Next small yes', usedContext: 'Context used', chooseOption: 'Choose an option', style: 'Style',
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
    composerTitle: 'Composer MusicScale', tone: 'Formato', short: 'Corto', conversation: 'Conversación', audio: 'Audio', video: 'Video',
    guidance: 'Sugerencia para ahora', why: 'Por qué', nextYes: 'Próximo pequeño sí', usedContext: 'Contexto usado', chooseOption: 'Elige una opción', style: 'Estilo',
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

type StageOption = { n: string; label: Record<LanguageCode,string>; objective: ComposerObjective };
const SALES_STAGES: StageOption[] = [
  { n:'1', label:{'pt-BR':'Início','en-US':'Start','es-ES':'Inicio'}, objective:'iniciar_conversa' },
  { n:'2', label:{'pt-BR':'Descoberta','en-US':'Discovery','es-ES':'Descubrimiento'}, objective:'descobrir_dor' },
  { n:'3', label:{'pt-BR':'História','en-US':'Story','es-ES':'Historia'}, objective:'contar_historia' },
  { n:'4', label:{'pt-BR':'Pedir vídeo','en-US':'Ask video','es-ES':'Pedir video'}, objective:'pedir_video' },
  { n:'5', label:{'pt-BR':'Vídeo','en-US':'Video','es-ES':'Video'}, objective:'enviar_video' },
  { n:'6', label:{'pt-BR':'Diagnóstico','en-US':'Diagnosis','es-ES':'Diagnóstico'}, objective:'diagnosticar' },
  { n:'7', label:{'pt-BR':'Resposta','en-US':'Focused reply','es-ES':'Respuesta'}, objective:'explicar_dor' },
  { n:'8', label:{'pt-BR':'Trial','en-US':'Trial','es-ES':'Prueba'}, objective:'convidar_trial' },
  { n:'9', label:{'pt-BR':'Acompanhar','en-US':'Follow trial','es-ES':'Acompañar'}, objective:'acompanhar_trial' },
  { n:'10', label:{'pt-BR':'Fechar','en-US':'Close','es-ES':'Cerrar'}, objective:'fechar' },
  { n:'↺', label:{'pt-BR':'Retomar','en-US':'Follow-up','es-ES':'Retomar'}, objective:'retomar_conversa' },
];

function radarSalesUi(lang: LanguageCode) {
  const all = {
    'pt-BR': { journey:'Etapa da conversa', journeyHelp:'Escolha onde você realmente está. O Connect adapta a mensagem ao próximo pequeno passo.', messages:'Mensagens sugeridas', tip:'Dica para esta etapa', context:'Contexto real usado', close:'Fechar', phonePlaceholder:'Número opcional — não inventamos contatos', phoneNote:'O site não consegue ler automaticamente a agenda do iPhone. Sem número, abrimos o WhatsApp para você escolher a pessoa; com número real, abrimos a conversa direto.', chooseWhatsapp:'Abrir WhatsApp e escolher contato', directWhatsapp:'Abrir conversa no WhatsApp', edit:'Edite antes de enviar', format:'Formato da abordagem' },
    'en-US': { journey:'Conversation stage', journeyHelp:'Choose where the conversation really is. Connect adapts the message to the next small step.', messages:'Suggested messages', tip:'Tip for this stage', context:'Real context used', close:'Close', phonePlaceholder:'Optional number — we never invent contacts', phoneNote:'The website cannot automatically read your iPhone contacts. Without a number, WhatsApp opens so you can choose the person; with a real number, it opens the chat directly.', chooseWhatsapp:'Open WhatsApp and choose contact', directWhatsapp:'Open WhatsApp chat', edit:'Edit before sending', format:'Approach format' },
    'es-ES': { journey:'Etapa de la conversación', journeyHelp:'Elige dónde está realmente la conversación. Connect adapta el mensaje al próximo pequeño paso.', messages:'Mensajes sugeridos', tip:'Consejo para esta etapa', context:'Contexto real usado', close:'Cerrar', phonePlaceholder:'Número opcional — nunca inventamos contactos', phoneNote:'El sitio no puede leer automáticamente los contactos del iPhone. Sin número, abrimos WhatsApp para que elijas la persona; con número real, abrimos el chat directamente.', chooseWhatsapp:'Abrir WhatsApp y elegir contacto', directWhatsapp:'Abrir chat de WhatsApp', edit:'Edita antes de enviar', format:'Formato del enfoque' },
  } as const;
  return all[lang];
}

function normalizePhoneForUse(value?: string | null): string {
  const digits=String(value||'').replace(/\D/g,'');
  if (digits.length < 10 || digits.length > 15) return '';
  if (/(0{7,}|9{8,}|1{8,})$/.test(digits)) return '';
  return digits;
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
  const [composerPlan, setComposerPlan] = useState<any | null>(null);
  const [composerStyle, setComposerStyle] = useState<ComposerStyle>('consultivo');
  const [composerObjective, setComposerObjective] = useState<ComposerObjective>('iniciar_conversa');
  const [composerError, setComposerError] = useState('');
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
      setPhones(Object.fromEntries(result.people.map(person => [person.id, normalizePhoneForUse(person.phone)])));
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

  const compose = async (
    selection = selected,
    requestedTone = tone,
    requestedStyle = composerStyle,
    requestedObjective = composerObjective,
  ) => {
    if (!selection) return;
    setDraftBusy(true);
    setCopied(false);
    setComposerError('');
    try {
      const channel = requestedTone === 'audio' ? 'audio' : requestedTone === 'video' ? 'video' : requestedObjective === 'retomar_conversa' ? 'followup' : 'texto';
      const result = await client.compose(selection.person.id, selection.signal.id, requestedTone, {
        style: requestedStyle,
        objective: requestedObjective,
        channel,
      });
      setComposerPlan(result);
      setDraft(result.draft || result.options?.[0]?.text || '');
      setError('');
    } catch (e) {
      const message = e instanceof Error ? e.message : t.error;
      setComposerError(message);
      setError(message);
    } finally {
      setDraftBusy(false);
    }
  };

  const openComposer = (person: RadarClientPerson, signal: RadarClientPerson['signals'][number]) => {
    const selection = { person, signal };
    const initialStyle: ComposerStyle = signal.type === 'unanswered_conversation' || signal.type === 'recurring_relevant_topic' ? 'pastoral' : signal.type === 'commercial_followup_due' ? 'proximo' : 'consultivo';
    const initialObjective: ComposerObjective = signal.type === 'explicit_product_interest' ? 'descobrir_dor' : 'iniciar_conversa';
    setSelected(selection);
    setDraft('');
    setComposerPlan(null);
    setComposerError('');
    setComposerStyle(initialStyle);
    setComposerObjective(initialObjective);
    setTone('curto');
    void compose(selection, 'curto', initialStyle, initialObjective);
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

  const openWhatsApp = (message: string, rawPhone?: string) => {
    const phone = normalizePhoneForUse(rawPhone);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
            <div className="mt-5 inline-flex items-start gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] px-3.5 py-3 text-xs leading-5 text-emerald-100"><ShieldCheck size={15} className="mt-0.5 shrink-0" /> {t.privacy}</div>
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
            <div className="grid gap-3 p-4 lg:grid-cols-2">{person.signals.map(signal => <div key={signal.id} className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full border border-indigo-400/15 bg-indigo-400/[0.06] px-2.5 py-1 text-[10px] font-semibold text-indigo-200">{signalLabel(signal.type, currentLang)}</span><ChevronRight size={15} className="text-slate-600" /></div><p className="mt-3 text-sm leading-6 text-slate-200">{signal.reason}</p>{signal.evidence?.[0] && <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.evidence} · {signal.evidence[0].dateKey}</div><p className="mt-1 text-xs leading-5 text-slate-400">“{signal.evidence[0].snippet}”</p></div>}<div className="mt-3 text-xs leading-5 text-slate-400"><span className="font-semibold text-slate-300">{t.next}:</span> {signal.nextAction}</div><button type="button" onClick={() => openComposer(person, signal)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-950"><MessageCircle size={15} /> {t.compose}</button></div>)}</div>
            <div className="border-t border-white/8 bg-black/10 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="text-xs text-slate-500 sm:min-w-32">{t.phone}</label><input type="tel" inputMode="tel" autoComplete="tel" value={phones[person.id] || ''} onChange={e => setPhones(prev => ({ ...prev, [person.id]: e.target.value }))} placeholder={radarSalesUi(currentLang).phonePlaceholder} className="min-h-10 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none" /><button type="button" onClick={async () => { await client.updatePerson(person.id, { phone: phones[person.id] || '' }); await refresh(); }} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-medium text-slate-300">{t.savePhone}</button></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{radarSalesUi(currentLang).phoneNote}</p></div>
          </article>
        ))}
      </section>

      {selected && (() => {
        const ui = radarSalesUi(currentLang);
        const phone = normalizePhoneForUse(phones[selected.person.id]);
        return <div className="fixed inset-0 z-[100] flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => setSelected(null)}>
          <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0d111b] shadow-2xl sm:max-w-3xl sm:rounded-[30px]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-[#0d111b]/95 px-5 py-4 backdrop-blur-xl">
              <div><div className="text-xs font-semibold tracking-wide text-indigo-300">{t.composerTitle}</div><div className="mt-1 text-base font-semibold text-white">{selected.person.displayName}</div></div>
              <button type="button" aria-label={ui.close} onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-xl text-slate-300">×</button>
            </div>
            <div className="space-y-5 p-5">
              <div><div className="text-xs font-semibold text-white">{ui.journey}</div><p className="mt-1 text-xs leading-5 text-slate-500">{ui.journeyHelp}</p><div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2">{SALES_STAGES.map(stage => <button type="button" key={stage.objective} onClick={() => { setComposerObjective(stage.objective); void compose(selected, tone, composerStyle, stage.objective); }} className={`shrink-0 rounded-xl border px-3 py-2 text-left ${composerObjective === stage.objective ? 'border-indigo-400/40 bg-indigo-400/10 text-white' : 'border-white/8 bg-white/[0.025] text-slate-400'}`}><span className="mr-1.5 text-[10px] font-semibold text-indigo-300">{stage.n}</span><span className="text-xs font-medium">{stage.label[currentLang]}</span></button>)}</div></div>
              {composerError && <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-200">{composerError}</div>}
              {composerPlan && <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-indigo-400/15 bg-indigo-400/[0.06] p-3 sm:col-span-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">{composerPlan.stageLabel} · {t.guidance}</div><p className="mt-1 text-sm leading-6 text-slate-100">{composerPlan.recommendation}</p></div><div className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="text-[10px] font-semibold uppercase text-slate-500">{t.why}</div><p className="mt-1 text-xs leading-5 text-slate-400">{composerPlan.why}</p></div><div className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="text-[10px] font-semibold uppercase text-slate-500">{t.nextYes}</div><p className="mt-1 text-xs leading-5 text-slate-400">{composerPlan.nextSmallYes}</p></div><div className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="text-[10px] font-semibold uppercase text-slate-500">{ui.tip}</div><p className="mt-1 text-xs leading-5 text-slate-400">{composerPlan.tip}</p></div></div>}
              <div className="grid gap-4 sm:grid-cols-2"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{ui.format}</div><div className="mt-2 flex flex-wrap gap-1.5">{([['curto', t.short], ['conversa', t.conversation], ['audio', t.audio], ['video', t.video]] as Array<[Tone,string]>).map(([value,label]) => <button type="button" key={value} onClick={() => { setTone(value); void compose(selected, value, composerStyle, composerObjective); }} className={`rounded-lg px-2.5 py-1.5 text-xs ${tone === value ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}>{label}</button>)}</div></div><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.style}</div><div className="mt-2 flex flex-wrap gap-1.5">{(['amigavel','profissional','descontraido','objetivo','proximo','pastoral','consultivo'] as ComposerStyle[]).map(value => <button type="button" key={value} onClick={() => { setComposerStyle(value); void compose(selected, tone, value, composerObjective); }} className={`rounded-lg px-2.5 py-1.5 text-xs ${composerStyle === value ? 'bg-white text-slate-950' : 'bg-white/5 text-slate-400'}`}>{composerStyleLabel(value,currentLang)}</button>)}</div></div></div>
              {composerPlan?.factsUsed?.length > 0 && <div className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{ui.context}</div><div className="mt-2 space-y-1.5">{composerPlan.factsUsed.map((fact:string,index:number) => <p key={`${fact}-${index}`} className="text-xs leading-5 text-slate-400">{fact}</p>)}</div></div>}
              <div><div className="mb-2 flex items-center justify-between"><div className="text-xs font-semibold text-white">{ui.messages}</div><span className="text-[10px] text-slate-500">{ui.edit}</span></div>{composerPlan?.options?.length > 0 && <div className="grid gap-2">{composerPlan.options.map((option:any,index:number) => <button type="button" key={option.id || index} onClick={() => { setDraft(option.text); setCopied(false); }} className={`rounded-xl border p-3 text-left text-xs leading-5 ${draft === option.text ? 'border-indigo-400/40 bg-indigo-400/[0.08] text-slate-100' : 'border-white/8 bg-black/15 text-slate-400'}`}><span className="mr-2 font-semibold text-indigo-300">{index+1}.</span>{option.text}</button>)}</div>}<div className="mt-3">{draftBusy ? <div className="grid min-h-28 place-items-center rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400"><div className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> {t.regenerate}…</div></div> : <textarea value={draft} onChange={e => { setDraft(e.target.value); setCopied(false); }} rows={6} className="min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-100 outline-none focus:border-indigo-400/40" />}</div></div>
              <div className="grid gap-2 sm:grid-cols-3"><button type="button" onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); }} disabled={!draft} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-200 disabled:opacity-40">{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? t.copied : t.copy}</button><button type="button" onClick={() => void compose()} className="min-h-12 rounded-xl border border-white/10 px-3 text-sm text-slate-300">{t.regenerate}</button><button type="button" onClick={() => openWhatsApp(draft, phone)} disabled={!draft} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 text-sm font-semibold text-slate-950 disabled:opacity-40"><MessageCircle size={16}/>{phone ? ui.directWhatsapp : ui.chooseWhatsapp}</button></div>
              <p className="text-[11px] leading-5 text-slate-500">{ui.phoneNote}</p>
            </div>
          </section>
        </div>;
      })()}
    </main>
  );
};