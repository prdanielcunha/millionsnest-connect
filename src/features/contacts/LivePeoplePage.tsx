import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ContactRound, FileUp, Loader2, MessageCircle, Plus, Search, Send, Users } from 'lucide-react';
import { PersonalRadarClient, RadarClientPerson } from '../../core/client/personalRadarClient';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import { LanguageCode } from '../../types';

type Objective = 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';
type Tone = 'curto' | 'conversa' | 'audio' | 'video';

const STAGES: Array<{ objective: Objective; pt: string; en: string; es: string }> = [
  { objective: 'iniciar_conversa', pt: 'Início', en: 'Start', es: 'Inicio' },
  { objective: 'descobrir_dor', pt: 'Descoberta', en: 'Discovery', es: 'Descubrimiento' },
  { objective: 'contar_historia', pt: 'História', en: 'Story', es: 'Historia' },
  { objective: 'pedir_video', pt: 'Pedir vídeo', en: 'Ask video', es: 'Pedir video' },
  { objective: 'enviar_video', pt: 'Vídeo', en: 'Video', es: 'Video' },
  { objective: 'diagnosticar', pt: 'Diagnóstico', en: 'Diagnosis', es: 'Diagnóstico' },
  { objective: 'explicar_dor', pt: 'Resposta', en: 'Focused reply', es: 'Respuesta' },
  { objective: 'convidar_trial', pt: 'Trial', en: 'Trial', es: 'Prueba' },
  { objective: 'acompanhar_trial', pt: 'Acompanhar', en: 'Follow-up', es: 'Acompañar' },
  { objective: 'fechar', pt: 'Fechar', en: 'Close', es: 'Cerrar' },
  { objective: 'retomar_conversa', pt: 'Retomar', en: 'Resume', es: 'Retomar' },
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
  const [objective, setObjective] = useState<Objective>('iniciar_conversa');
  const [tone, setTone] = useState<Tone>('curto');
  const [plan, setPlan] = useState<any | null>(null);
  const [draft, setDraft] = useState('');

  const text = currentLang === 'pt-BR' ? {
    title: 'Pessoas', subtitle: 'Sua base pessoal unificada para conversar com qualquer contato — vindo de grupos, conversas importadas, agenda ou cadastro manual.',
    add: 'Adicionar contato', import: 'Importar contatos do iPhone (.vcf)', search: 'Buscar pessoa, telefone ou origem…', empty: 'Nenhuma pessoa encontrada.',
    stage: 'Etapa da conversa', stageHelp: 'O Connect guarda a etapa de cada pessoa e adapta a próxima abordagem.', messages: 'Mensagens para esta etapa', generate: 'Gerar mensagens',
    whatsapp: 'Enviar pelo WhatsApp', mark: 'Marcar como enviado', chooser: 'Sem número: o WhatsApp abre para você escolher o contato.', save: 'Salvar pessoa', sources: 'Origem', noSignal: 'Contato disponível para abordagem direta.',
  } : currentLang === 'es-ES' ? {
    title: 'Personas', subtitle: 'Tu base personal unificada para conversar con cualquier contacto — desde grupos, conversaciones importadas, agenda o alta manual.',
    add: 'Agregar contacto', import: 'Importar contactos del iPhone (.vcf)', search: 'Buscar persona, teléfono u origen…', empty: 'No se encontraron personas.',
    stage: 'Etapa de la conversación', stageHelp: 'Connect guarda la etapa de cada persona y adapta el próximo enfoque.', messages: 'Mensajes para esta etapa', generate: 'Generar mensajes',
    whatsapp: 'Enviar por WhatsApp', mark: 'Marcar como enviado', chooser: 'Sin número: WhatsApp se abre para que elijas el contacto.', save: 'Guardar persona', sources: 'Origen', noSignal: 'Contacto disponible para enfoque directo.',
  } : {
    title: 'People', subtitle: 'Your unified personal people base for contacting anyone — from groups, imported conversations, contacts or manual entry.',
    add: 'Add contact', import: 'Import iPhone contacts (.vcf)', search: 'Search person, phone or source…', empty: 'No people found.',
    stage: 'Conversation stage', stageHelp: 'Connect stores each person’s stage and adapts the next approach.', messages: 'Messages for this stage', generate: 'Generate messages',
    whatsapp: 'Send with WhatsApp', mark: 'Mark as sent', chooser: 'No number: WhatsApp opens so you can choose the contact.', save: 'Save person', sources: 'Source', noSignal: 'Contact available for direct outreach.',
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await client.getPeople();
      setPeople(result.people);
      setSelectedId(prev => prev || result.people[0]?.id || '');
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
    setPlan(null); setDraft('');
  }, [selectedId]);

  const filtered = people.filter(person => {
    const hay = `${person.displayName} ${person.phone || ''} ${(person.sourceKinds || []).join(' ')}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  const createContact = async () => {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try {
      await client.importContacts([{ name: name.trim(), phone: normalizePhone(phone) || undefined }]);
      setName(''); setPhone(''); setNotice('Contato salvo.'); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); }
    finally { setBusy(false); }
  };

  const importVcf = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const contacts = parseVCard(await file.text());
      if (!contacts.length) throw new Error('Nenhum contato válido encontrado no arquivo.');
      const result = await client.importContacts(contacts);
      setNotice(`${result.imported || contacts.length} contatos processados.`); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const generate = async (nextObjective = objective, nextTone = tone) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      await client.updatePerson(selected.id, { salesStage: nextObjective });
      const signalId = selected.signals?.[0]?.id || 'direct_contact';
      const result = await client.compose(selected.id, signalId, nextTone, {
        objective: nextObjective,
        channel: nextTone === 'audio' ? 'audio' : nextTone === 'video' ? 'video' : nextObjective === 'retomar_conversa' ? 'followup' : 'texto',
        style: nextObjective === 'iniciar_conversa' || nextObjective === 'descobrir_dor' ? 'consultivo' : 'proximo',
      });
      setPlan(result); setDraft(result.draft || result.options?.[0]?.text || ''); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); }
    finally { setBusy(false); }
  };

  const openWhatsApp = async () => {
    if (!selected || !draft) return;
    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'whatsapp_opened' });
    const number = normalizePhone(selected.phone);
    const url = number ? `https://wa.me/${number}?text=${encodeURIComponent(draft)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(draft)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const markSent = async () => {
    if (!selected) return;
    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'sent_manual', followUpDays: 2 });
    setNotice(currentLang === 'pt-BR' ? 'Envio registrado. O Connect vai priorizar o acompanhamento.' : currentLang === 'es-ES' ? 'Envío registrado. Connect priorizará el seguimiento.' : 'Send recorded. Connect will prioritize follow-up.');
    await refresh();
  };

  return <main className="mx-auto w-full max-w-7xl space-y-5 pb-24">
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold tracking-[.16em] text-indigo-300"><Users size={15}/> RELATIONSHIP INTELLIGENCE</div><h1 className="mt-2 text-3xl font-semibold text-white">{text.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{text.subtitle}</p></div><div className="hidden rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-right sm:block"><div className="text-2xl font-semibold text-white">{people.length}</div><div className="text-[11px] text-slate-500">{text.title}</div></div></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input value={name} onChange={e=>setName(e.target.value)} placeholder={text.add} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"/><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="WhatsApp/telefone" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"/><button disabled={!name.trim()||busy} onClick={()=>void createContact()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 disabled:opacity-40"><Plus size={16}/>{text.save}</button></div>
          <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={e=>void importVcf(e.target.files?.[0]||null)}/>
          <button onClick={()=>fileRef.current?.click()} disabled={busy} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-400/[0.06] text-sm font-medium text-indigo-200"><FileUp size={16}/>{text.import}</button>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={text.search} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white outline-none"/></div>
          <div className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto">{loading ? <div className="grid h-28 place-items-center"><Loader2 className="animate-spin text-slate-500"/></div> : filtered.length===0 ? <p className="p-4 text-sm text-slate-500">{text.empty}</p> : filtered.map(person=><button key={person.id} onClick={()=>setSelectedId(person.id)} className={`w-full rounded-2xl border p-3 text-left ${selectedId===person.id?'border-indigo-400/35 bg-indigo-400/[0.08]':'border-white/8 bg-black/10 hover:bg-white/[0.03]'}`}><div className="flex items-center justify-between gap-3"><div><div className="font-medium text-white">{person.displayName}</div><div className="mt-1 text-xs text-slate-500">{person.phone||'Sem telefone'} · {(person.sourceKinds||[person.sourceId?.startsWith('wa_')?'whatsapp_export':'manual']).join(' + ')}</div></div>{person.salesStage&&<span className="rounded-full border border-indigo-400/20 px-2 py-1 text-[10px] text-indigo-200">{label(STAGES.find(s=>s.objective===person.salesStage)||STAGES[0],currentLang)}</span>}</div></button>)}</div>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">{!selected ? <div className="grid min-h-80 place-items-center text-sm text-slate-500">{text.empty}</div> : <div className="space-y-5">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ContactRound size={18} className="text-indigo-300"/><h2 className="text-xl font-semibold text-white">{selected.displayName}</h2></div><p className="mt-1 text-xs text-slate-500">{selected.phone||'WhatsApp sem número salvo'} · {text.sources}: {(selected.sourceKinds||[]).join(', ')||'conversa importada'}</p></div>{selected.followUpAt&&<span className="rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-1 text-[10px] text-amber-200">Follow-up {new Date(selected.followUpAt).toLocaleDateString(currentLang)}</span>}</div>
        <div><div className="text-sm font-semibold text-white">{text.stage}</div><p className="mt-1 text-xs text-slate-500">{text.stageHelp}</p><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{STAGES.map(stage=><button key={stage.objective} onClick={()=>{setObjective(stage.objective);void generate(stage.objective,tone)}} className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${objective===stage.objective?'border-indigo-400/40 bg-indigo-400/[0.09] text-indigo-100':'border-white/10 text-slate-400'}`}>{label(stage,currentLang)}</button>)}</div></div>
        <div><div className="mb-2 text-sm font-semibold text-white">{text.messages}</div><div className="flex flex-wrap gap-2">{(['curto','conversa','audio','video'] as Tone[]).map(item=><button key={item} onClick={()=>{setTone(item);void generate(objective,item)}} className={`rounded-xl border px-3 py-2 text-xs ${tone===item?'border-white/25 bg-white/[0.07] text-white':'border-white/10 text-slate-400'}`}>{item==='curto'?'Curto':item==='conversa'?'Conversa':item==='audio'?'Áudio':'Vídeo'}</button>)}<button disabled={busy} onClick={()=>void generate()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40">{busy?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>} {text.generate}</button></div></div>
        {plan?.guidance&&<div className="rounded-2xl border border-indigo-400/15 bg-indigo-400/[0.05] p-3 text-xs leading-5 text-slate-300"><div className="font-semibold text-indigo-200">{plan.guidance.title||'Próximo passo'}</div><div className="mt-1">{plan.guidance.why||plan.guidance.tip}</div></div>}
        {Array.isArray(plan?.options)&&plan.options.length>0&&<div className="grid gap-2 sm:grid-cols-3">{plan.options.slice(0,3).map((option:any,index:number)=><button key={index} onClick={()=>setDraft(option.text)} className="rounded-2xl border border-white/10 bg-black/15 p-3 text-left text-xs leading-5 text-slate-300 hover:border-indigo-400/25"><div className="mb-1 font-semibold text-white">Opção {index+1}</div>{option.text}</button>)}</div>}
        <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={7} placeholder={text.noSignal} className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white outline-none focus:border-indigo-400/30"/>
        <div className="grid gap-2 sm:grid-cols-2"><button disabled={!draft} onClick={()=>void openWhatsApp()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-slate-950 disabled:opacity-40"><MessageCircle size={17}/>{text.whatsapp}</button><button disabled={!draft} onClick={()=>void markSent()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-sm font-semibold text-emerald-200 disabled:opacity-40"><Check size={17}/>{text.mark}</button></div>
        {!selected.phone&&<p className="text-xs text-slate-500">{text.chooser}</p>}
      </div>}</div>
    </section>
    {notice&&<div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-3 text-sm text-emerald-200">{notice}</div>}{error&&<div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-sm text-red-200">{error}</div>}
  </main>;
};
