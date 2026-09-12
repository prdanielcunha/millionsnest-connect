import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  CalendarClock,
  Check,
  CircleAlert,
  ContactRound,
  DatabaseZap,
  FileUp,
  Filter,
  Link2,
  Loader2,
  Merge,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  UsersRound,
  X,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import { AudienceDefinition, PersonalIntelligenceClient } from '../../core/client/personalIntelligenceClient';
import { PersonalRadarClient, RadarClientPerson, RadarConversationSummary } from '../../core/client/personalRadarClient';
import { LanguageCode } from '../../types';
import { Person360Panel } from '../contacts/Person360Panel';

type Props = { session: LiveConnectSession; currentLang: LanguageCode };
type Tab = 'identity' | 'audiences' | 'followups' | 'connections';

function dateTimeLocal(hours = 24) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function shortDate(value: unknown, lang: LanguageCode) {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = Date.parse(value.length === 10 ? `${value}T12:00:00` : value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: 'short', year: 'numeric', hour: value.includes('T') ? '2-digit' : undefined, minute: value.includes('T') ? '2-digit' : undefined }).format(parsed);
}

export const RelationshipIntelligencePage: React.FC<Props> = ({ session, currentLang }) => {
  const intelligence = useMemo(() => new PersonalIntelligenceClient(session), [session]);
  const radar = useMemo(() => new PersonalRadarClient(session), [session]);
  const vcardRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('identity');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [identity, setIdentity] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [audiences, setAudiences] = useState<any[]>([]);
  const [sources, setSources] = useState<RadarConversationSummary[]>([]);
  const [people, setPeople] = useState<RadarClientPerson[]>([]);
  const [health, setHealth] = useState<any | null>(null);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [person360Id, setPerson360Id] = useState('');
  const [audienceName, setAudienceName] = useState('');
  const [definition, setDefinition] = useState<AudienceDefinition>({ activeWithinDays: 180, minMessages: 1 });
  const [preview, setPreview] = useState<any[]>([]);
  const [followPersonId, setFollowPersonId] = useState('');
  const [followAt, setFollowAt] = useState(dateTimeLocal(24));
  const [followNote, setFollowNote] = useState('');

  const t = currentLang === 'pt-BR' ? {
    eyebrow: 'RELATIONSHIP INTELLIGENCE', title: 'Central de inteligência', subtitle: 'Identidade, audiências, timeline, follow-ups e conexões — sempre com evidência, origem e controle manual.',
    identity: 'Revisar identidades', audiences: 'Audiências inteligentes', followups: 'Follow-ups', connections: 'Fontes e conexões', refresh: 'Atualizar',
    privacy: 'Privado ao dono · sem scraping · sem disparo automático', pending: 'pendências', noIdentity: 'Nenhuma identidade precisa de revisão agora.',
    probable: 'Nome provável', current: 'Identificação atual', evidence: 'Evidência', contact: 'Agenda', confirm: 'Confirmar nome', reject: 'Não é esse nome', merge: 'Unir pessoas', separate: 'Manter separadas', open360: 'Abrir Pessoa 360°',
    audienceHint: 'Monte segmentos usando apenas sinais e histórico autorizados. O resultado é uma lista para revisão — nunca um disparo.', source: 'Fonte / grupo', allSources: 'Todas as fontes', query: 'Assunto ou termo', signal: 'Sinal', anySignal: 'Qualquer sinal', active: 'Ativo nos últimos dias', minMessages: 'Mín. mensagens', favorites: 'Somente favoritos', preview: 'Pré-visualizar', save: 'Salvar audiência', saved: 'Audiências salvas', noPreview: 'Defina os filtros e gere uma prévia.', people: 'pessoas',
    followHint: 'Programe o próximo toque sem transformar relacionamento em funil automático.', person: 'Pessoa', when: 'Quando', note: 'Nota', schedule: 'Agendar', due: 'Pendentes', complete: 'Concluir', clear: 'Remover', overdue: 'Atrasado', noFollow: 'Nenhum follow-up pendente.',
    health: 'Saúde das importações', connectors: 'Conexões', contactsImport: 'Importar contatos do iPhone', contactsHint: 'Exporte seus Contatos como vCard (.vcf) e envie aqui. O Connect usa telefone exato como sugestão de identidade, nunca como merge automático.', chooseVcf: 'Escolher .vcf', importVcf: 'Importar vCard', healthy: 'Saudável', attention: 'Requer atenção', empty: 'Sem dados', conversations: 'conversas', imports: 'importações', stale: 'fontes sem atualização >30 dias',
    connected: 'Conectado', ready: 'Pronto', authorization: 'Precisa de autorização', apiReady: 'API pronta', disabled: 'Não ativado', toolGateway: 'A ponte de ferramentas está pronta no backend; a conexão externa com o ChatGPT continua dependente de autorização explícita.',
  } : currentLang === 'es-ES' ? {
    eyebrow: 'RELATIONSHIP INTELLIGENCE', title: 'Centro de inteligencia', subtitle: 'Identidad, audiencias, timeline, seguimientos y conexiones — siempre con evidencia, origen y control manual.',
    identity: 'Revisar identidades', audiences: 'Audiencias inteligentes', followups: 'Seguimientos', connections: 'Fuentes y conexiones', refresh: 'Actualizar',
    privacy: 'Privado para el propietario · sin scraping · sin envío automático', pending: 'pendientes', noIdentity: 'Ninguna identidad necesita revisión ahora.',
    probable: 'Nombre probable', current: 'Identificación actual', evidence: 'Evidencia', contact: 'Contactos', confirm: 'Confirmar nombre', reject: 'No es ese nombre', merge: 'Unir personas', separate: 'Mantener separadas', open360: 'Abrir Persona 360°',
    audienceHint: 'Crea segmentos usando solo señales e historial autorizados. El resultado es una lista para revisar, nunca un envío.', source: 'Fuente / grupo', allSources: 'Todas las fuentes', query: 'Tema o término', signal: 'Señal', anySignal: 'Cualquier señal', active: 'Activo en los últimos días', minMessages: 'Mín. mensajes', favorites: 'Solo favoritos', preview: 'Previsualizar', save: 'Guardar audiencia', saved: 'Audiencias guardadas', noPreview: 'Define los filtros y genera una vista previa.', people: 'personas',
    followHint: 'Programa el próximo contacto sin convertir la relación en un embudo automático.', person: 'Persona', when: 'Cuándo', note: 'Nota', schedule: 'Programar', due: 'Pendientes', complete: 'Completar', clear: 'Eliminar', overdue: 'Atrasado', noFollow: 'No hay seguimientos pendientes.',
    health: 'Salud de importaciones', connectors: 'Conexiones', contactsImport: 'Importar contactos del iPhone', contactsHint: 'Exporta tus Contactos como vCard (.vcf) y súbelo aquí. Connect usa el teléfono exacto como sugerencia de identidad, nunca como unión automática.', chooseVcf: 'Elegir .vcf', importVcf: 'Importar vCard', healthy: 'Saludable', attention: 'Requiere atención', empty: 'Sin datos', conversations: 'conversaciones', imports: 'importaciones', stale: 'fuentes sin actualización >30 días',
    connected: 'Conectado', ready: 'Listo', authorization: 'Necesita autorización', apiReady: 'API lista', disabled: 'No activado', toolGateway: 'El puente de herramientas está listo en el backend; la conexión externa con ChatGPT sigue dependiendo de autorización explícita.',
  } : {
    eyebrow: 'RELATIONSHIP INTELLIGENCE', title: 'Intelligence center', subtitle: 'Identity, audiences, timeline, follow-ups and connections — always with evidence, provenance and manual control.',
    identity: 'Review identities', audiences: 'Smart audiences', followups: 'Follow-ups', connections: 'Sources & connections', refresh: 'Refresh',
    privacy: 'Owner-private · no scraping · no automatic sending', pending: 'pending', noIdentity: 'No identity needs review right now.',
    probable: 'Probable name', current: 'Current identifier', evidence: 'Evidence', contact: 'Contacts', confirm: 'Confirm name', reject: 'Not this name', merge: 'Merge people', separate: 'Keep separate', open360: 'Open Person 360°',
    audienceHint: 'Build segments using only authorized signals and history. The result is a review list, never a send.', source: 'Source / group', allSources: 'All sources', query: 'Topic or term', signal: 'Signal', anySignal: 'Any signal', active: 'Active within days', minMessages: 'Min. messages', favorites: 'Favorites only', preview: 'Preview', save: 'Save audience', saved: 'Saved audiences', noPreview: 'Set filters and generate a preview.', people: 'people',
    followHint: 'Schedule the next touch without turning relationships into an automatic funnel.', person: 'Person', when: 'When', note: 'Note', schedule: 'Schedule', due: 'Pending', complete: 'Complete', clear: 'Remove', overdue: 'Overdue', noFollow: 'No pending follow-ups.',
    health: 'Import health', connectors: 'Connections', contactsImport: 'Import iPhone contacts', contactsHint: 'Export Contacts as a vCard (.vcf) and upload it here. Connect uses an exact phone match as identity evidence, never as an automatic merge.', chooseVcf: 'Choose .vcf', importVcf: 'Import vCard', healthy: 'Healthy', attention: 'Needs attention', empty: 'No data', conversations: 'conversations', imports: 'imports', stale: 'sources not updated >30 days',
    connected: 'Connected', ready: 'Ready', authorization: 'Needs authorization', apiReady: 'API ready', disabled: 'Not enabled', toolGateway: 'The tool bridge is ready in the backend; external ChatGPT connection still requires explicit authorization.',
  };

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [review, follow, saved, sourceResult, radarResult, healthResult, caps] = await Promise.all([
        intelligence.getIdentityReview(), intelligence.getFollowUps(), intelligence.listAudiences(), radar.getSources(), radar.getRadar(), intelligence.getImportHealth(), intelligence.getCapabilities(),
      ]);
      setIdentity(Array.isArray(review.items) ? review.items : []);
      setFollowups(Array.isArray(follow.items) ? follow.items : []);
      setAudiences(Array.isArray(saved.items) ? saved.items : []);
      setSources(sourceResult.sources || []);
      setPeople(radarResult.people || []);
      setHealth(healthResult);
      setCapabilities(Array.isArray(caps.connectors) ? caps.connectors : []);
      setFollowPersonId(current => current || radarResult.people?.[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [intelligence, radar]);

  const act = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key); setError(''); setNotice('');
    try { await action(); setNotice(success); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(''); }
  };

  const previewAudience = async () => {
    setBusy('preview'); setError('');
    try { const result = await intelligence.previewAudience(definition); setPreview(result.items || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(''); }
  };

  const saveAudience = async () => {
    if (!audienceName.trim()) return;
    await act('save-audience', () => intelligence.saveAudience(audienceName.trim(), definition), currentLang === 'pt-BR' ? 'Audiência salva.' : 'Audience saved.');
    setAudienceName('');
  };

  const schedule = async () => {
    if (!followPersonId || !followAt) return;
    await act('schedule', () => intelligence.updateFollowUp(followPersonId, { action: 'schedule', dueAt: new Date(followAt).toISOString(), note: followNote }), currentLang === 'pt-BR' ? 'Follow-up agendado.' : 'Follow-up scheduled.');
    setFollowNote(''); setFollowAt(dateTimeLocal(24));
  };

  const importVCard = async (file: File | null) => {
    if (!file) return;
    await act('vcard', () => intelligence.importVCard(file), currentLang === 'pt-BR' ? 'Contatos importados. As correspondências exatas por telefone agora aparecem na revisão de identidade.' : 'Contacts imported.');
    if (vcardRef.current) vcardRef.current.value = '';
  };

  const tabs: Array<[Tab, string, React.ElementType]> = [
    ['identity', t.identity, ContactRound], ['audiences', t.audiences, UsersRound], ['followups', t.followups, CalendarClock], ['connections', t.connections, Link2],
  ];

  const healthLabel = health?.status === 'healthy' ? t.healthy : health?.status === 'attention' ? t.attention : t.empty;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.18),transparent_35%),linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))] p-5 shadow-2xl sm:p-7 lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-indigo-300"><BrainCircuit size={15} /> {t.eyebrow}</div><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p><div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-300/80"><ShieldCheck size={13} /> {t.privacy}</div></div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.07] disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {t.refresh}</button>
        </div>
      </section>

      {(error || notice) && <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-rose-400/20 bg-rose-400/[0.06] text-rose-100' : 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-100'}`}>{error || notice}</div>}

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-2 sm:grid-cols-4">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition ${tab === id ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}><Icon size={14} /> {label}{id === 'identity' && identity.length > 0 ? <span className="rounded-full bg-indigo-400/15 px-1.5 py-0.5 text-[9px]">{identity.length}</span> : null}</button>)}</div>

      {loading ? <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin text-slate-500" /></div> : tab === 'identity' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><div className="text-sm font-semibold text-white">{t.identity}</div><div className="text-xs text-slate-600">{identity.length} {t.pending}</div></div>
          {!identity.length ? <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-slate-500">{t.noIdentity}</div> : identity.map(item => <article key={item.personId} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div className="min-w-0"><div className="text-[10px] uppercase tracking-wider text-slate-600">{t.current}</div><div className="mt-1 text-lg font-semibold text-white">{item.currentDisplayName || item.phone || '—'}</div>{item.probableName && <div className="mt-2 flex items-center gap-2 text-sm text-indigo-200"><Sparkles size={14} /> {t.probable}: <strong>{item.probableName}</strong><span className="text-[10px] text-slate-500">{item.probableNameConfidence}</span></div>}<div className="mt-3 flex flex-wrap gap-2">{(item.sources || []).map((source: any) => <span key={source.sourceId} className="rounded-lg border border-white/7 bg-black/15 px-2.5 py-1 text-[10px] text-slate-500">{source.label}</span>)}</div></div>
              <div className="flex flex-wrap gap-2">{item.probableName && <><button disabled={Boolean(busy)} onClick={() => void act(`confirm-${item.personId}`, () => intelligence.reviewProbableName(item.personId, 'confirm'), currentLang === 'pt-BR' ? 'Nome confirmado.' : 'Name confirmed.')} className="rounded-xl bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200"><Check size={13} className="mr-1 inline" />{t.confirm}</button><button disabled={Boolean(busy)} onClick={() => void act(`reject-${item.personId}`, () => intelligence.reviewProbableName(item.personId, 'reject'), currentLang === 'pt-BR' ? 'Hipótese rejeitada.' : 'Hypothesis rejected.')} className="rounded-xl border border-white/8 px-3 py-2 text-xs text-slate-400"><X size={13} className="mr-1 inline" />{t.reject}</button></>}<button onClick={() => setPerson360Id(item.personId)} className="rounded-xl border border-white/8 px-3 py-2 text-xs text-slate-300">{t.open360}</button></div></div>
            {(item.contactSuggestions?.length || item.evidence?.length || item.candidates?.length) ? <div className="mt-4 grid gap-3 lg:grid-cols-3">{item.contactSuggestions?.length ? <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.035] p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/70">{t.contact}</div>{item.contactSuggestions.map((contact: any) => <div key={contact.contactId} className="mt-2 text-xs text-slate-300"><strong>{contact.displayName}</strong><div className="text-[10px] text-slate-600">telefone exato · {contact.phones?.[0]}</div></div>)}</div> : null}{item.evidence?.length ? <div className="rounded-xl border border-white/7 bg-black/15 p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.evidence}</div>{item.evidence.slice(0, 3).map((ev: any, index: number) => <div key={`${ev.sourceId}-${ev.messageIndex}-${index}`} className="mt-2 text-xs leading-5 text-slate-400">“{ev.snippet}”</div>)}</div> : null}{item.candidates?.length ? <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/70">Possíveis correspondências</div>{item.candidates.map((candidate: any) => <div key={candidate.personId} className="mt-2 rounded-lg border border-white/6 p-2"><div className="text-xs font-medium text-slate-200">{candidate.displayName}</div><div className="mt-2 flex gap-2"><button onClick={() => void act(`merge-${item.personId}`, () => radar.resolveIdentity(item.personId, candidate.personId, 'merge'), currentLang === 'pt-BR' ? 'Pessoas unidas.' : 'People merged.')} className="text-[10px] text-emerald-300"><Merge size={11} className="mr-1 inline" />{t.merge}</button><button onClick={() => void act(`split-${item.personId}`, () => radar.resolveIdentity(item.personId, candidate.personId, 'keep_separate'), currentLang === 'pt-BR' ? 'Pessoas mantidas separadas.' : 'People kept separate.')} className="text-[10px] text-slate-500"><Split size={11} className="mr-1 inline" />{t.separate}</button></div></div>)}</div> : null}</div> : null}
          </article>)}
        </section>
      ) : tab === 'audiences' ? (
        <section className="grid gap-4 xl:grid-cols-[390px_1fr]">
          <div className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><Filter size={15} className="text-indigo-300" />{t.audiences}</div><p className="mt-2 text-xs leading-5 text-slate-500">{t.audienceHint}</p></div><label className="block text-[10px] uppercase tracking-wider text-slate-600">{t.source}<select value={definition.sourceId || ''} onChange={e => setDefinition(d => ({ ...d, sourceId: e.target.value || undefined }))} className="mt-1 w-full rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200"><option value="">{t.allSources}</option>{sources.map(source => <option key={source.sourceId} value={source.sourceId}>{source.label}</option>)}</select></label><label className="block text-[10px] uppercase tracking-wider text-slate-600">{t.query}<div className="relative mt-1"><Search size={13} className="absolute left-3 top-3 text-slate-600" /><input value={definition.query || ''} onChange={e => setDefinition(d => ({ ...d, query: e.target.value || undefined }))} className="w-full rounded-xl border border-white/8 bg-[#0c111b] py-2.5 pl-9 pr-3 text-xs text-slate-200" placeholder="MusicScale, louvor, escala…" /></div></label><label className="block text-[10px] uppercase tracking-wider text-slate-600">{t.signal}<select value={definition.signalType || ''} onChange={e => setDefinition(d => ({ ...d, signalType: e.target.value || undefined }))} className="mt-1 w-full rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200"><option value="">{t.anySignal}</option><option value="explicit_product_interest">explicit_product_interest</option><option value="commercial_followup_due">commercial_followup_due</option><option value="unanswered_conversation">unanswered_conversation</option><option value="recurring_relevant_topic">recurring_relevant_topic</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-[10px] uppercase tracking-wider text-slate-600">{t.active}<input type="number" min={0} max={3650} value={definition.activeWithinDays || 0} onChange={e => setDefinition(d => ({ ...d, activeWithinDays: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200" /></label><label className="text-[10px] uppercase tracking-wider text-slate-600">{t.minMessages}<input type="number" min={0} value={definition.minMessages || 0} onChange={e => setDefinition(d => ({ ...d, minMessages: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200" /></label></div><label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={Boolean(definition.favoritesOnly)} onChange={e => setDefinition(d => ({ ...d, favoritesOnly: e.target.checked }))} />{t.favorites}</label><button onClick={() => void previewAudience()} disabled={busy === 'preview'} className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy === 'preview' ? <Loader2 size={14} className="mx-auto animate-spin" /> : t.preview}</button><div className="flex gap-2"><input value={audienceName} onChange={e => setAudienceName(e.target.value)} placeholder="Nome da audiência" className="min-w-0 flex-1 rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200" /><button onClick={() => void saveAudience()} className="rounded-xl border border-white/8 px-3 text-slate-300"><Save size={14} /></button></div><div><div className="text-[10px] uppercase tracking-wider text-slate-600">{t.saved}</div><div className="mt-2 space-y-2">{audiences.slice(0, 8).map(audience => <div key={audience.id} className="flex items-center justify-between rounded-lg border border-white/6 bg-black/15 px-3 py-2 text-xs text-slate-300"><button className="truncate text-left" onClick={() => { setDefinition(audience.definition || {}); setAudienceName(audience.name || ''); }}>{audience.name}</button><button onClick={() => void act(`delete-${audience.id}`, () => intelligence.deleteAudience(audience.id), currentLang === 'pt-BR' ? 'Audiência removida.' : 'Audience removed.')} className="text-slate-700 hover:text-rose-300"><X size={13} /></button></div>)}</div></div></div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"><div className="flex items-center justify-between"><div className="text-sm font-semibold text-white">Preview</div><div className="text-xs text-slate-600">{preview.length} {t.people}</div></div>{preview.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{preview.map(item => <button key={item.personId} onClick={() => setPerson360Id(item.personId)} className="rounded-xl border border-white/7 bg-black/15 p-3 text-left transition hover:border-indigo-400/20"><div className="text-sm font-medium text-slate-200">{item.displayName}</div><div className="mt-1 text-[10px] text-slate-600">{item.messageCount} mensagens · {shortDate(item.lastDateKey, currentLang)}</div>{item.evidence?.[0]?.snippet ? <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">“{item.evidence[0].snippet}”</div> : item.signals?.[0]?.reason ? <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.signals[0].reason}</div> : null}</button>)}</div> : <div className="grid min-h-64 place-items-center text-sm text-slate-600">{t.noPreview}</div>}</div>
        </section>
      ) : tab === 'followups' ? (
        <section className="space-y-4"><div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><CalendarClock size={15} className="text-indigo-300" />{t.followups}</div><p className="mt-2 text-xs text-slate-500">{t.followHint}</p><div className="mt-4 grid gap-2 md:grid-cols-[1.2fr_1fr_1.5fr_auto]"><select value={followPersonId} onChange={e => setFollowPersonId(e.target.value)} className="rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200"><option value="">{t.person}</option>{people.map(person => <option key={person.id} value={person.id}>{person.probableName || person.displayName}</option>)}</select><input type="datetime-local" value={followAt} onChange={e => setFollowAt(e.target.value)} className="rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200" /><input value={followNote} onChange={e => setFollowNote(e.target.value)} placeholder={t.note} className="rounded-xl border border-white/8 bg-[#0c111b] px-3 py-2.5 text-xs text-slate-200" /><button onClick={() => void schedule()} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white">{t.schedule}</button></div></div><div><div className="mb-2 text-sm font-semibold text-white">{t.due}</div>{followups.length ? <div className="space-y-2">{followups.map(item => <div key={item.personId} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${item.overdue ? 'border-amber-400/20 bg-amber-400/[0.035]' : 'border-white/7 bg-white/[0.02]'}`}><button onClick={() => setPerson360Id(item.personId)} className="text-left"><div className="text-sm font-medium text-slate-200">{item.displayName}</div><div className="mt-1 text-[10px] text-slate-500">{shortDate(item.dueAt, currentLang)} {item.overdue ? `· ${t.overdue}` : ''}</div>{item.note && <div className="mt-1 text-xs text-slate-500">{item.note}</div>}</button><div className="flex gap-2"><button onClick={() => void act(`complete-${item.personId}`, () => intelligence.updateFollowUp(item.personId, { action: 'complete' }), currentLang === 'pt-BR' ? 'Follow-up concluído.' : 'Follow-up completed.')} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-[10px] text-emerald-200">{t.complete}</button><button onClick={() => void act(`clear-${item.personId}`, () => intelligence.updateFollowUp(item.personId, { action: 'clear' }), currentLang === 'pt-BR' ? 'Follow-up removido.' : 'Follow-up removed.')} className="rounded-lg border border-white/7 px-3 py-2 text-[10px] text-slate-500">{t.clear}</button></div></div>)}</div> : <div className="rounded-xl border border-white/7 bg-white/[0.02] p-8 text-center text-sm text-slate-600">{t.noFollow}</div>}</div></section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2"><div className="space-y-4"><div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><DatabaseZap size={15} className="text-indigo-300" />{t.health}</div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/7 bg-black/15 p-3"><div className="text-[10px] text-slate-600">Status</div><div className="mt-1 text-xs font-medium text-slate-200">{healthLabel}</div></div><div className="rounded-xl border border-white/7 bg-black/15 p-3"><div className="text-[10px] text-slate-600">{t.conversations}</div><div className="mt-1 text-lg font-semibold text-white">{health?.totals?.conversations || 0}</div></div><div className="rounded-xl border border-white/7 bg-black/15 p-3"><div className="text-[10px] text-slate-600">{t.imports}</div><div className="mt-1 text-lg font-semibold text-white">{health?.totals?.imports || 0}</div></div></div>{health?.totals?.staleSources > 0 && <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-3 text-xs text-amber-100"><CircleAlert size={14} /> {health.totals.staleSources} {t.stale}</div>}</div><div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><FileUp size={15} className="text-indigo-300" />{t.contactsImport}</div><p className="mt-2 text-xs leading-5 text-slate-500">{t.contactsHint}</p><input ref={vcardRef} type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={e => void importVCard(e.target.files?.[0] || null)} className="mt-4 block w-full text-xs text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-500/15 file:px-3 file:py-2 file:text-xs file:font-medium file:text-indigo-200" />{busy === 'vcard' && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" />{t.importVcf}</div>}</div></div><div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Link2 size={15} className="text-indigo-300" />{t.connectors}</div><div className="mt-4 space-y-2">{capabilities.map(connector => { const status = connector.connected ? t.connected : connector.status === 'ready' ? t.ready : connector.status === 'api_ready' ? t.apiReady : connector.status === 'needs_authorization' ? t.authorization : t.disabled; return <div key={connector.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/7 bg-black/15 px-3 py-3"><div><div className="text-xs font-medium text-slate-200">{connector.label}</div><div className="mt-1 text-[10px] text-slate-600">{connector.mode}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-medium ${connector.connected ? 'bg-emerald-400/10 text-emerald-200' : connector.status === 'api_ready' || connector.status === 'ready' ? 'bg-indigo-400/10 text-indigo-200' : 'bg-white/5 text-slate-500'}`}>{status}</span></div>; })}</div><div className="mt-4 rounded-xl border border-indigo-400/12 bg-indigo-400/[0.035] p-3 text-xs leading-5 text-slate-400"><BrainCircuit size={13} className="mr-2 inline text-indigo-300" />{t.toolGateway}</div></div></section>
      )}

      {person360Id && <Person360Panel client={radar} personId={person360Id} currentLang={currentLang} onClose={() => setPerson360Id('')} />}
    </main>
  );
};
