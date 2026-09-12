import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clipboard, ContactRound, FileUp, Loader2, MessageCircle, Plus, Save, Search, Send, Smartphone, Users } from 'lucide-react';
import { PersonalRadarClient, RadarClientPerson } from '../../core/client/personalRadarClient';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import { LanguageCode } from '../../types';

type Objective = 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';
type Tone = 'curto' | 'conversa' | 'audio' | 'video';
type Style = 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';

type SavedModel = { id: string; label: string; text: string; objective: Objective; tone: Tone; createdAt: string };

const STAGES: Array<{ objective: Objective; pt: string; en: string; es: string; hintPt: string }> = [
  { objective: 'iniciar_conversa', pt: 'Início', en: 'Start', es: 'Inicio', hintPt: 'Abra a conversa sem vender.' },
  { objective: 'descobrir_dor', pt: 'Descoberta', en: 'Discovery', es: 'Descubrimiento', hintPt: 'Entenda como a igreja organiza louvor e onde dói.' },
  { objective: 'contar_historia', pt: 'História', en: 'Story', es: 'Historia', hintPt: 'Conte a origem do MusicScale de forma humana.' },
  { objective: 'pedir_video', pt: 'Pedir vídeo', en: 'Ask video', es: 'Pedir video', hintPt: 'Peça permissão antes de enviar demonstração.' },
  { objective: 'enviar_video', pt: 'Vídeo', en: 'Video', es: 'Video', hintPt: 'Envie demonstração curta, com contexto.' },
  { objective: 'diagnosticar', pt: 'Diagnóstico', en: 'Diagnosis', es: 'Diagnóstico', hintPt: 'Descubra o que realmente ajudaria aquela igreja.' },
  { objective: 'explicar_dor', pt: 'Resposta', en: 'Focused reply', es: 'Respuesta', hintPt: 'Explique só a função ligada à dor citada.' },
  { objective: 'convidar_trial', pt: 'Trial', en: 'Trial', es: 'Prueba', hintPt: 'Convide para testar 7 dias quando houver intenção.' },
  { objective: 'acompanhar_trial', pt: 'Acompanhar', en: 'Follow-up', es: 'Acompañar', hintPt: 'Acompanhe sem pressionar.' },
  { objective: 'fechar', pt: 'Fechar', en: 'Close', es: 'Cerrar', hintPt: 'Ajude a tomar a próxima decisão.' },
  { objective: 'retomar_conversa', pt: 'Retomar', en: 'Resume', es: 'Retomar', hintPt: 'Retome de forma natural após silêncio.' },
];

const STYLES: Array<{ value: Style; label: string }> = [
  { value: 'consultivo', label: 'Consultivo' }, { value: 'proximo', label: 'Próximo' }, { value: 'pastoral', label: 'Pastoral' },
  { value: 'amigavel', label: 'Amigável' }, { value: 'profissional', label: 'Profissional' }, { value: 'descontraido', label: 'Descontraído' }, { value: 'objetivo', label: 'Objetivo' },
];

function label(stage: (typeof STAGES)[number], lang: LanguageCode) {
  return lang === 'pt-BR' ? stage.pt : lang === 'es-ES' ? stage.es : stage.en;
}
function normalizePhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}
function parseVCard(text: string): Array<{ name: string; phone?: string }> {
  const cards = text.replace(/\r\n?/g, '\n').split(/BEGIN:VCARD/i).slice(1);
  return cards.map(card => {
    const lines = card.split('\n');
    const fn = lines.find(line => /^FN(?:;[^:]*)?:/i.test(line));
    const n = lines.find(line => /^N(?:;[^:]*)?:/i.test(line));
    const tel = lines.find(line => /^TEL(?:;[^:]*)?:/i.test(line));
    const rawName = (fn || n || '').split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
    const name = rawName.includes(';') ? rawName.split(';').filter(Boolean).reverse().join(' ').trim() : rawName;
    const phone = tel ? normalizePhone(tel.split(':').slice(1).join(':')) : '';
    return { name, phone: phone || undefined };
  }).filter(item => item.name).slice(0, 500);
}
function sourceLabel(kind: string) {
  if (kind === 'whatsapp_export') return 'WhatsApp importado';
  if (kind === 'contacts_import') return 'Agenda / contato';
  return kind || 'Manual';
}
function stripEmoji(value: string) {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim();
}

export const LivePeoplePage: React.FC<{ session: LiveConnectSession; currentLang: LanguageCode }> = ({ session, currentLang }) => {
  const client = useMemo(() => new PersonalRadarClient(session), [session]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [people, setPeople] = useState<RadarClientPerson[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [objective, setObjective] = useState<Objective>('iniciar_conversa');
  const [tone, setTone] = useState<Tone>('curto');
  const [style, setStyle] = useState<Style>('consultivo');
  const [followUpDays, setFollowUpDays] = useState(2);
  const [plan, setPlan] = useState<any | null>(null);
  const [draft, setDraft] = useState('');
  const [models, setModels] = useState<SavedModel[]>([]);

  const text = currentLang === 'pt-BR' ? {
    title: 'Pessoas', subtitle: 'Todos os seus relacionamentos em um só lugar. Escolha a pessoa, veja a etapa e saiba exatamente o que falar agora.',
    add: 'Nome do contato', import: 'Importar contatos do iPhone (.vcf)', search: 'Buscar pessoa, telefone ou origem…', empty: 'Nenhuma pessoa encontrada.',
    stage: 'Etapa da conversa', messages: 'O que enviar agora', generate: 'Gerar 3 mensagens', whatsapp: 'Abrir WhatsApp', mark: 'Marcar como enviado',
    chooser: 'Sem número salvo: o WhatsApp abre com o texto pronto para você escolher o contato.', save: 'Salvar pessoa', sources: 'Origem', phone: 'Telefone / WhatsApp', savePhone: 'Salvar número', models: 'Modelos na nuvem', saveModel: 'Salvar como modelo', copy: 'Copiar', followup: 'Lembrar em', days: 'dias', timeline: 'Status comercial', noSignal: 'Contato disponível para abordagem direta.'
  } : currentLang === 'es-ES' ? {
    title: 'Personas', subtitle: 'Todas tus relaciones en un solo lugar. Elige la persona, mira la etapa y sabe exactamente qué decir ahora.',
    add: 'Nombre del contacto', import: 'Importar contactos del iPhone (.vcf)', search: 'Buscar persona, teléfono u origen…', empty: 'No se encontraron personas.',
    stage: 'Etapa de la conversación', messages: 'Qué enviar ahora', generate: 'Generar 3 mensajes', whatsapp: 'Abrir WhatsApp', mark: 'Marcar como enviado',
    chooser: 'Sin número guardado: WhatsApp abre con el texto listo para que elijas el contacto.', save: 'Guardar persona', sources: 'Origen', phone: 'Teléfono / WhatsApp', savePhone: 'Guardar número', models: 'Modelos en la nube', saveModel: 'Guardar como modelo', copy: 'Copiar', followup: 'Recordar en', days: 'días', timeline: 'Estado comercial', noSignal: 'Contacto disponible para contacto directo.'
  } : {
    title: 'People', subtitle: 'All your relationships in one place. Pick a person, see the stage and know exactly what to say next.',
    add: 'Contact name', import: 'Import iPhone contacts (.vcf)', search: 'Search person, phone or source…', empty: 'No people found.',
    stage: 'Conversation stage', messages: 'What to send now', generate: 'Generate 3 messages', whatsapp: 'Open WhatsApp', mark: 'Mark as sent',
    chooser: 'No saved number: WhatsApp opens with the text ready so you can choose the contact.', save: 'Save person', sources: 'Source', phone: 'Phone / WhatsApp', savePhone: 'Save number', models: 'Cloud models', saveModel: 'Save as model', copy: 'Copy', followup: 'Remind in', days: 'days', timeline: 'Commercial status', noSignal: 'Contact available for direct outreach.'
  };

  const storageKey = `mn-connect-message-models:${session.actorUid || 'me'}`;
  useEffect(() => {
    let active = true;
    const loadCloudModels = async () => {
      try {
        let remote = await client.getMessageModels();
        let cloud = remote.models as SavedModel[];
        let legacy: SavedModel[] = [];
        try {
          const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
          legacy = Array.isArray(parsed) ? parsed.slice(0, 30) : [];
        } catch { legacy = []; }
        if (legacy.length) {
          for (const model of legacy) {
            const duplicate = cloud.some(item => item.text === model.text && item.objective === model.objective && item.tone === model.tone);
            if (!duplicate && model.text && model.objective && model.tone) {
              await client.saveMessageModel({ label: model.label || 'Modelo migrado', text: model.text, objective: model.objective, tone: model.tone });
            }
          }
          localStorage.removeItem(storageKey);
          remote = await client.getMessageModels();
          cloud = remote.models as SavedModel[];
        }
        if (active) setModels(cloud);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar os modelos da nuvem.');
      }
    };
    void loadCloudModels();
    return () => { active = false; };
  }, [client, storageKey]);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await client.getPeople();
      setPeople(result.people);
      setSelectedId(prev => prev && result.people.some(p => p.id === prev) ? prev : result.people[0]?.id || '');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [client]);

  const selected = people.find(person => person.id === selectedId) || null;
  useEffect(() => {
    if (!selected) return;
    const known = STAGES.some(stage => stage.objective === selected.salesStage) ? selected.salesStage as Objective : 'iniciar_conversa';
    setObjective(known);
    setEditPhone(selected.phone || '');
    setPlan(null);
    setDraft('');
  }, [selectedId]);

  const filtered = people.filter(person => `${person.displayName} ${person.phone || ''} ${(person.sourceKinds || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  const currentStage = STAGES.find(item => item.objective === objective) || STAGES[0];

  const createContact = async () => {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try { await client.importContacts([{ name: name.trim(), phone: normalizePhone(phone) || undefined }]); setName(''); setPhone(''); setNotice('Contato salvo.'); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  };
  const importVcf = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setError('');
    try { const contacts = parseVCard(await file.text()); if (!contacts.length) throw new Error('Nenhum contato válido encontrado no arquivo.'); const result = await client.importContacts(contacts); setNotice(`${result.imported || contacts.length} contatos processados.`); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const savePhone = async () => {
    if (!selected) return;
    const normalized = normalizePhone(editPhone);
    if (!normalized) { setError('Digite um número válido com DDD e país quando necessário.'); return; }
    setBusy(true); try { await client.updatePerson(selected.id, { phone: normalized }); setNotice('Número salvo.'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  };
  const generate = async (nextObjective = objective, nextTone = tone, nextStyle = style) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      await client.updatePerson(selected.id, { salesStage: nextObjective });
      const signalId = selected.signals?.[0]?.id || 'direct_contact';
      const result = await client.compose(selected.id, signalId, nextTone, {
        objective: nextObjective,
        channel: nextTone === 'audio' ? 'audio' : nextTone === 'video' ? 'video' : nextObjective === 'retomar_conversa' ? 'followup' : 'texto',
        style: nextStyle,
      });
      setPlan(result);
      setDraft(result.draft || result.options?.[0]?.text || '');
      setPeople(current => current.map(person => person.id === selected.id ? { ...person, salesStage: nextObjective } : person));
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  };

  const selectStage = (nextObjective: Objective) => {
    setObjective(nextObjective);
    setPlan(null);
    setDraft('');
    void generate(nextObjective, tone, style);
  };
  const copyDraft = async () => {
    if (!selected || !draft) return;
    await navigator.clipboard.writeText(draft);
    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'copied' });
    setNotice('Mensagem copiada.'); await refresh();
  };
  const openWhatsApp = async () => {
    if (!selected || !draft) return;
    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'whatsapp_opened' });
    const number = normalizePhone(selected.phone);
    const url = number ? `https://wa.me/${number}?text=${encodeURIComponent(draft)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(draft)}`;
    window.open(url, '_blank', 'noopener,noreferrer'); await refresh();
  };
  const markSent = async () => {
    if (!selected) return;
    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'sent_manual', followUpDays });
    setNotice(`Envio registrado. Acompanhamento em ${followUpDays} dia${followUpDays === 1 ? '' : 's'}.`); await refresh();
  };
  const saveModel = async () => {
    if (!draft.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await client.saveMessageModel({
        label: `${label(currentStage, currentLang)} · ${tone}`,
        text: draft.trim(),
        objective,
        tone,
      });
      setModels(previous => [result.model as SavedModel, ...previous.filter(item => item.id !== result.model.id)].slice(0, 30));
      localStorage.removeItem(storageKey);
      setNotice('Modelo salvo na nuvem do Firebase.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o modelo na nuvem.');
    } finally { setBusy(false); }
  };
  const applyTransform = (kind: 'short' | 'human' | 'professional' | 'objective' | 'noemoji' | 'cta') => {
    if (!draft) return;
    if (kind === 'noemoji') { setDraft(stripEmoji(draft)); return; }
    if (kind === 'cta') { setDraft(value => /\?\s*$/.test(value.trim()) ? value : `${value.trim()}\n\nSe fizer sentido, quer que eu te mostre rapidinho?`); return; }
    const targetStyle: Style = kind === 'human' ? 'proximo' : kind === 'professional' ? 'profissional' : kind === 'objective' ? 'objetivo' : style;
    const targetTone: Tone = kind === 'short' ? 'curto' : tone;
    setStyle(targetStyle); setTone(targetTone); void generate(objective, targetTone, targetStyle);
  };

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 overflow-x-hidden pb-24">
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold tracking-[.16em] text-indigo-300"><Users size={15}/> RELATIONSHIP INTELLIGENCE</div><h1 className="mt-2 text-3xl font-semibold text-white">{text.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{text.subtitle}</p></div><div className="hidden rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-right sm:block"><div className="text-2xl font-semibold text-white">{people.length}</div><div className="text-[11px] text-slate-500">{text.title}</div></div></div>
    </section>

    {(error || notice) && <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-400/20 bg-red-400/[0.06] text-red-200' : 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200'}`}>{error || notice}</div>}

    <section className="grid gap-4 lg:grid-cols-[.86fr_1.14fr]">
      <div className="min-w-0 space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input value={name} onChange={e=>setName(e.target.value)} placeholder={text.add} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"/><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="WhatsApp/telefone" inputMode="tel" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"/><button disabled={!name.trim()||busy} onClick={()=>void createContact()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 disabled:opacity-40"><Plus size={16}/>{text.save}</button></div>
          <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={e=>void importVcf(e.target.files?.[0]||null)}/>
          <button onClick={()=>fileRef.current?.click()} disabled={busy} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-400/[0.06] text-sm font-medium text-indigo-200"><FileUp size={16}/>{text.import}</button>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={text.search} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white outline-none"/></div>
          <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto">{loading ? <div className="grid h-28 place-items-center"><Loader2 className="animate-spin text-slate-500"/></div> : filtered.length===0 ? <p className="p-4 text-sm text-slate-500">{text.empty}</p> : filtered.map(person=><button key={person.id} onClick={()=>setSelectedId(person.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId===person.id?'border-indigo-400/35 bg-indigo-400/[0.08]':'border-white/8 bg-black/10 hover:bg-white/[0.03]'}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium text-white">{person.displayName}</div><div className="mt-1 truncate text-xs text-slate-500">{person.phone||'Sem telefone'} · {(person.sourceKinds||[person.sourceId?.startsWith('wa_')?'whatsapp_export':'manual']).map(sourceLabel).join(' + ')}</div></div>{person.salesStage&&<span className="shrink-0 rounded-full border border-indigo-400/20 px-2 py-1 text-[10px] text-indigo-200">{label(STAGES.find(s=>s.objective===person.salesStage)||STAGES[0],currentLang)}</span>}</div></button>)}</div>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">{!selected ? <div className="grid min-h-80 place-items-center text-sm text-slate-500">{text.empty}</div> : <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><ContactRound size={18} className="text-indigo-300"/><h2 className="text-xl font-semibold text-white">{selected.displayName}</h2></div><div className="mt-2 flex max-w-full flex-wrap gap-2">{(selected.sourceKinds||[selected.sourceId?.startsWith('wa_')?'whatsapp_export':'manual']).map(kind=><span key={kind} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[11px] text-slate-400">{sourceLabel(kind)}</span>)}</div></div><div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-slate-400"><div>{text.timeline}</div><div className="mt-1 font-medium text-white">{selected.lastCommercialAction === 'sent_manual' ? 'Enviado manualmente' : selected.lastCommercialAction === 'whatsapp_opened' ? 'WhatsApp aberto' : selected.lastCommercialAction === 'copied' ? 'Mensagem copiada' : 'Sem ação registrada'}</div>{selected.followUpAt&&<div className="mt-1 text-indigo-200">Follow-up: {new Date(selected.followUpAt).toLocaleDateString()}</div>}</div></div>

        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Smartphone size={16}/>{text.phone}</div><div className="flex min-w-0 gap-2"><input value={editPhone} onChange={e=>setEditPhone(e.target.value)} inputMode="tel" placeholder="55 43 99999-9999" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"/><button onClick={()=>void savePhone()} disabled={busy} className="shrink-0 rounded-xl border border-white/10 px-3 text-sm font-medium text-white disabled:opacity-40">{text.savePhone}</button></div></div>

        <section><div className="mb-3"><h3 className="text-sm font-semibold text-white">{text.stage}</h3><p className="mt-1 text-xs text-slate-500">{currentStage.hintPt}</p></div><div className="flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{STAGES.map((stage,index)=><button key={stage.objective} disabled={busy && objective===stage.objective} onClick={()=>selectStage(stage.objective)} className={`min-w-[104px] shrink-0 snap-start rounded-xl border px-3 py-2 text-left transition ${objective===stage.objective?'border-indigo-400/50 bg-indigo-400/[0.12] text-indigo-100 shadow-[0_0_0_1px_rgba(129,140,248,.08)]':'border-white/10 bg-black/10 text-slate-400 hover:bg-white/[0.03]'} disabled:opacity-60`}><div className="text-[10px] opacity-60">{index+1}</div><div className="text-xs font-medium">{label(stage,currentLang)}</div></button>)}</div></section>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-black/15 p-4"><div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><h3 className="text-sm font-semibold text-white">{text.messages}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{busy ? 'Preparando a melhor abordagem para esta etapa…' : currentStage.hintPt}</p></div><button onClick={()=>void generate()} disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto">{busy?<Loader2 size={15} className="animate-spin"/>:<MessageCircle size={15}/>} {text.generate}</button></div>
          <div className="mt-4 flex max-w-full flex-wrap gap-2">{(['curto','conversa','audio','video'] as Tone[]).map(value=><button key={value} onClick={()=>{setTone(value); if(plan) void generate(objective,value,style);}} className={`rounded-lg border px-3 py-1.5 text-xs ${tone===value?'border-white/25 bg-white/10 text-white':'border-white/10 text-slate-400'}`}>{value==='curto'?'Curta':value==='conversa'?'Conversa':value==='audio'?'Áudio':'Vídeo'}</button>)}</div>
          <div className="mt-2 flex flex-wrap gap-2">{STYLES.map(item=><button key={item.value} onClick={()=>{setStyle(item.value); if(plan) void generate(objective,tone,item.value);}} className={`rounded-lg border px-3 py-1.5 text-xs ${style===item.value?'border-indigo-400/35 bg-indigo-400/[0.08] text-indigo-100':'border-white/10 text-slate-500'}`}>{item.label}</button>)}</div>

          {!plan && !busy && <button onClick={()=>void generate()} className="mt-4 w-full rounded-2xl border border-dashed border-indigo-400/25 bg-indigo-400/[0.04] p-4 text-left transition hover:bg-indigo-400/[0.07]"><div className="text-sm font-medium text-indigo-100">Gerar mensagem para {label(currentStage,currentLang)}</div><div className="mt-1 text-xs leading-5 text-slate-500">Toque aqui ou escolha uma etapa acima. O Connect prepara 3 opções editáveis e depois você abre o WhatsApp com o texto pronto.</div></button>}
          {plan && <div className="mt-4 space-y-3"><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Sugestão para agora</div><div className="mt-1 text-sm text-white">{plan.recommendation||plan.stageLabel||label(currentStage,currentLang)}</div></div><div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Próximo pequeno sim</div><div className="mt-1 text-sm text-white">{plan.nextSmallYes||'Avance somente um passo.'}</div></div></div>
            {Array.isArray(plan.options)&&plan.options.length>0&&<div className="grid gap-2">{plan.options.slice(0,3).map((option:any,index:number)=><button key={index} onClick={()=>setDraft(option.text||'')} className={`rounded-xl border p-3 text-left text-sm leading-6 ${draft===(option.text||'')?'border-indigo-400/35 bg-indigo-400/[0.08] text-white':'border-white/10 bg-black/10 text-slate-300'}`}><span className="mr-2 text-[10px] text-indigo-300">OPÇÃO {index+1}</span>{option.text}</button>)}</div>}
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={7} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white outline-none"/>
            <div className="flex flex-wrap gap-2">{[['short','Encurtar'],['human','Mais humano'],['professional','Mais profissional'],['objective','Mais objetivo'],['noemoji','Sem emojis'],['cta','CTA leve']].map(([kind,labelText])=><button key={kind} onClick={()=>applyTransform(kind as any)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04]">{labelText}</button>)}</div>
            {Array.isArray(plan.factsUsed)&&plan.factsUsed.length>0&&<div className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Contexto usado</div><div className="mt-2 space-y-1 text-xs text-slate-400">{plan.factsUsed.map((fact:string,index:number)=><div key={index}>• {fact}</div>)}</div></div>}
            <div className="grid gap-2 sm:grid-cols-2"><button onClick={()=>void copyDraft()} disabled={!draft} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-medium text-white disabled:opacity-40"><Clipboard size={16}/>{text.copy}</button><button onClick={()=>void saveModel()} disabled={!draft||busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-medium text-white disabled:opacity-40"><Save size={16}/>{text.saveModel}</button></div>
            <button onClick={()=>void openWhatsApp()} disabled={!draft} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-40"><Send size={17}/>{text.whatsapp}</button>{!normalizePhone(selected.phone)&&<p className="text-center text-xs text-slate-500">{text.chooser}</p>}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3"><span className="text-xs text-slate-500">{text.followup}</span><select value={followUpDays} onChange={e=>setFollowUpDays(Number(e.target.value))} className="min-h-10 flex-1 bg-transparent text-sm text-white outline-none"><option value={1}>1 {text.days}</option><option value={2}>2 {text.days}</option><option value={3}>3 {text.days}</option><option value={7}>7 {text.days}</option><option value={14}>14 {text.days}</option><option value={30}>30 {text.days}</option></select></div><button onClick={()=>void markSent()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-sm font-medium text-emerald-200"><Check size={16}/>{text.mark}</button></div>
          </div>}
        </section>

        {models.length>0&&<section><h3 className="mb-2 text-sm font-semibold text-white">{text.models}</h3><div className="flex gap-2 overflow-x-auto pb-2">{models.slice(0,8).map(model=><button key={model.id} onClick={()=>{setObjective(model.objective);setTone(model.tone);setDraft(model.text);setPlan({options:[{text:model.text}],stageLabel:model.label});}} className="w-56 shrink-0 rounded-xl border border-white/10 bg-black/10 p-3 text-left"><div className="text-xs font-medium text-indigo-200">{model.label}</div><div className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{model.text}</div></button>)}</div></section>}
      </div>}</div>
    </section>
  </main>;
};
