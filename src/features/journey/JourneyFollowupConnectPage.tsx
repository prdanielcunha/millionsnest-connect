import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, HeartHandshake, Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import type { LanguageCode } from '../../types';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import { buildWhatsAppDraftUrl,normalizeWhatsAppPhone } from '../../core/client/whatsappDelivery';
import {
  buildFirstContactMessage,
  isSafeJourneyReturnUrl,
  resolveJourneyFollowupId,
  refreshAuthorizedJourneyFollowup,
  type NestJourneyFollowupContext,
} from './journeyFollowup';

const copy = {
  'pt-BR': {
    kicker: 'NestJourney · Resolve Loop',
    title: 'Preparar primeiro contato',
    subtitle: 'O Connect prepara o canal. O NestJourney continua sendo a fonte da tarefa, do prazo e do resultado.',
    loading: 'Confirmando o acompanhamento…',
    error: 'Não foi possível confirmar este acompanhamento. Volte ao NestJourney e tente novamente.',
    recipient: 'Pessoa',
    due: 'Prazo do cuidado',
    message: 'Mensagem sugerida',
    editHint: 'Revise antes de abrir o WhatsApp. Você pode ajustar a saudação sem registrar detalhes íntimos no sistema.',
    openWhatsApp: 'Abrir conversa no WhatsApp',
    copied: 'Mensagem copiada',
    official: 'Enviar primeiro contato pelo WhatsApp oficial',
    officialConfirm: 'Este botão solicita à Meta o envio do TEMPLATE APROVADO da sua igreja, que pode ser diferente do texto exibido e gerar cobrança pela Meta. Confirma o envio único?',
    officialAccepted: 'A Meta aceitou a solicitação. Isso NÃO confirma entrega. Aguarde o status no canal oficial e registre o resultado no NestJourney.',
    officialDuplicate: 'Este acompanhamento já tem solicitação aceita pela Meta; nenhuma nova mensagem foi enviada.',
    officialError: 'Não foi possível confirmar o envio oficial. Não tente novamente com outra tarefa ou ID; peça revisão do registro para evitar duplicação.',
    officialTemplate: 'Template oficial aprovado:',
    copy: 'Copiar',
    return: 'Voltar e registrar resultado',
    ruleTitle: 'Envio não é resolução',
    rule: 'Abrir o WhatsApp apenas prepara a conversa. O Connect não marca a mensagem como enviada e não encerra o cuidado. Depois do contato, volte ao NestJourney e registre somente o resultado observado.',
    source: 'Roteiro baseado no Manual de Cuidado e Conexão Raiz e Mesa 2026.',
    back: 'Voltar ao NestJourney',
  },
  'en-US': {
    kicker: 'NestJourney · Resolve Loop',
    title: 'Prepare first contact',
    subtitle: 'Connect prepares the channel. NestJourney remains the source of the task, deadline, and outcome.',
    loading: 'Confirming follow-up…',
    error: 'This follow-up could not be confirmed. Return to NestJourney and try again.',
    recipient: 'Person',
    due: 'Care deadline',
    message: 'Suggested message',
    editHint: 'Review it before opening WhatsApp. You may adjust the greeting without storing intimate details in the system.',
    openWhatsApp: 'Open WhatsApp conversation',
    copied: 'Message copied',
    official: 'Send approved WhatsApp first-contact template',
    officialConfirm: 'Meta will receive your church-approved TEMPLATE, which may differ from the draft shown and may incur provider charges. Confirm this one-time request?',
    officialAccepted: 'Meta accepted the request. This does NOT confirm delivery. Check the official channel status and record the outcome in NestJourney.',
    officialDuplicate: 'This follow-up was already accepted by Meta; no additional message was sent.',
    officialError: 'Official send status cannot be confirmed. Do not retry using another task or ID; request a review to prevent duplicate messages.',
    officialTemplate: 'Approved official template:',
    copy: 'Copy',
    return: 'Return and record outcome',
    ruleTitle: 'Opening a channel is not resolution',
    rule: 'Opening WhatsApp only prepares the conversation. Connect does not mark the message as sent and does not close the care item. After contact, return to NestJourney and record only the observed outcome.',
    source: 'Script based on the Raiz e Mesa 2026 Care & Connection Manual.',
    back: 'Back to NestJourney',
  },
  'es-ES': {
    kicker: 'NestJourney · Resolve Loop',
    title: 'Preparar primer contacto',
    subtitle: 'Connect prepara el canal. NestJourney sigue siendo la fuente de la tarea, el plazo y el resultado.',
    loading: 'Confirmando acompañamiento…',
    error: 'No se pudo confirmar este acompañamiento. Vuelve a NestJourney e inténtalo de nuevo.',
    recipient: 'Persona',
    due: 'Plazo del cuidado',
    message: 'Mensaje sugerido',
    editHint: 'Revísalo antes de abrir WhatsApp. Puedes ajustar el saludo sin guardar detalles íntimos en el sistema.',
    openWhatsApp: 'Abrir conversación en WhatsApp',
    copied: 'Mensaje copiado',
    official: 'Enviar primer contacto por WhatsApp oficial',
    officialConfirm: 'Esta acción solicita a Meta enviar la PLANTILLA APROBADA de la iglesia, que puede diferir del borrador y tener cargos. ¿Confirmar envío único?',
    officialAccepted: 'Meta aceptó la solicitud; NO significa entrega. Compruebe el estado oficial y registre el resultado en NestJourney.',
    officialDuplicate: 'Meta ya aceptó esta solicitud; no se ha enviado otro mensaje.',
    officialError: 'No se puede confirmar el envío. No repita con otra tarea o ID; solicite revisión para evitar duplicados.',
    officialTemplate: 'Plantilla oficial aprobada:',
    copy: 'Copiar',
    return: 'Volver y registrar resultado',
    ruleTitle: 'Abrir el canal no es resolución',
    rule: 'Abrir WhatsApp solo prepara la conversación. Connect no marca el mensaje como enviado ni cierra el cuidado. Después del contacto, vuelve a NestJourney y registra solamente el resultado observado.',
    source: 'Guion basado en el Manual de Cuidado y Conexión Raiz e Mesa 2026.',
    back: 'Volver a NestJourney',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

function formatDue(value: string | null, locale: LanguageCode) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString(locale);
}

export function JourneyFollowupConnectPage({
  session,
  currentLang,
}: {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}) {
  const t = copy[currentLang];
  const followupId = useMemo(() => resolveJourneyFollowupId(window.location.pathname), []);
  const [context, setContext] = useState<NestJourneyFollowupContext | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const [authorizing,setAuthorizing]=useState(false);
  const [templateInfo,setTemplateInfo]=useState<{ready:boolean;templateName?:string}>({ready:false});
  const [officialResult,setOfficialResult]=useState<'accepted'|'duplicate'|'error'|null>(null);
  const actionGuard=useRef(false);

  useEffect(() => {
    if (!followupId) {
      setState('error');
      return;
    }
    let mounted = true;
    const query = new URLSearchParams({
      organizationId: session.expectedOrganizationId,
      followupId,
    });
    fetch(`/api/core/nestjourney/followup?${query.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.idToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      },
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.success !== true) throw new Error(payload?.code || 'FOLLOWUP_CONTEXT_FAILED');
        return payload as NestJourneyFollowupContext;
      })
      .then((payload) => {
        if (!mounted) return;
        setContext(payload);
        setMessage(buildFirstContactMessage({
          locale: currentLang,
          personName: payload.person.name,
          senderName: session.context.user.name,
          organizationName: payload.organization.name,
        }));
        setState('ready');
      })
      .catch(() => {
        if (!mounted) return;
        setState('error');
      });
    return () => { mounted = false; };
  }, [currentLang, followupId, session]);

  useEffect(()=>{
    if(!context||!followupId){setTemplateInfo({ready:false});return}
    let active=true
    const url='/api/core/nestjourney/followup/template-readiness?'+
      new URLSearchParams({organizationId:session.expectedOrganizationId}).toString()
    void fetch(url,{
      method:'GET',
      headers:{Authorization:'Bearer '+session.idToken,Accept:'application/json'},
      cache:'no-store',
    }).then(r=>r.ok?r.json():null).then(result=>{
      if(active)setTemplateInfo({
        ready:result?.success===true&&result?.ready===true
          && Array.isArray(result?.approvedLanguages)
          && result.approvedLanguages.includes(currentLang==='en-US'?'en_US':currentLang==='es-ES'?'es':'pt_BR'),
        templateName:typeof result?.templateName==='string'?result.templateName:undefined,
      })
    }).catch(()=>{if(active)setTemplateInfo({ready:false})})
    return()=>{active=false}
  },[context,followupId,currentLang,session.idToken,session.expectedOrganizationId])

  async function sendOfficialTemplate(){
    if(!templateInfo.ready||!followupId||!context||actionGuard.current)return
    if(!window.confirm(t.officialConfirm))return
    actionGuard.current=true;setAuthorizing(true);setOfficialResult(null)
    try{
      const language: 'pt_BR'|'en_US'|'es' =
        currentLang==='en-US'?'en_US':currentLang==='es-ES'?'es':'pt_BR'
      const r=await fetch('/api/core/nestjourney/followup/send-template',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',Accept:'application/json',
          Authorization:'Bearer '+session.idToken,
        },
        cache:'no-store',
        body:JSON.stringify({
          organizationId:session.expectedOrganizationId,followupId,language,
          acknowledgeTemplate:true,
        }),
      })
      const result=await r.json().catch(()=>null)
      if(!r.ok||result?.success!==true)throw new Error('TEMPLATE_NOT_CONFIRMED')
      setOfficialResult(result.kind==='duplicate'?'duplicate':'accepted')
    }catch{
      setOfficialResult('error')
    }finally{
      actionGuard.current=false;setAuthorizing(false)
    }
  }

  async function authorizeAndPerform(action:'copy'|'whatsapp') {
    if(actionGuard.current||!followupId||!context||!message.trim())return;
    actionGuard.current=true;setAuthorizing(true);setCopied(false);
    try {
      const fresh=await refreshAuthorizedJourneyFollowup({
        organizationId:session.expectedOrganizationId,
        followupId,
        idToken:session.idToken,
      });
      // A changed recipient requires human re-review. Do not silently redirect.
      if(fresh.person.phone!==context.person.phone||
        !normalizeWhatsAppPhone(fresh.person.phone))
        throw new Error('RECIPIENT_CHANGED_OR_INVALID');
      if(action==='copy'){
        await navigator.clipboard.writeText(message);
        setCopied(true);
        window.setTimeout(()=>setCopied(false),1800);
      }else{
        const url=buildWhatsAppDraftUrl(message,fresh.person.phone);
        if(!url)throw new Error('WHATSAPP_DRAFT_INVALID');
        // Use same-tab navigation after async verification: popup blockers can
        // prevent opening a new window once the click's user activation expires.
        window.location.assign(url);
      }
    }catch(error){
      // Fail closed: cached PII and a stale draft must not remain actionable.
      console.error('NestJourney fresh consent check rejected manual action',error instanceof Error?error.message:'DENIED');
      setMessage('');setContext(null);setState('error');
    }finally{
      actionGuard.current=false;setAuthorizing(false);
    }
  }

  function goBack() {
    if (context && isSafeJourneyReturnUrl(context.returnTo)) {
      window.location.assign(context.returnTo);
      return;
    }
    window.location.assign('https://nestjourney.millionsnest.com/followup-runtime');
  }

  if (state === 'loading') {
    return <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl place-items-center px-5 py-12 text-white">
      <div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="animate-spin" size={18}/>{t.loading}</div>
    </main>;
  }

  if (state === 'error' || !context) {
    return <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-3xl place-items-center px-5 py-12 text-white">
      <section className="w-full rounded-[28px] border border-white/10 bg-white/[0.035] p-7 text-center shadow-2xl backdrop-blur-xl sm:p-10">
        <ShieldCheck className="mx-auto text-slate-400" size={26}/>
        <h1 className="mt-4 text-xl font-semibold">{t.error}</h1>
        <button type="button" onClick={goBack} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950"><ArrowLeft size={16}/>{t.back}</button>
      </section>
    </main>;
  }

  return <main className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-5xl px-4 py-6 text-white sm:px-6 sm:py-10">
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.035] shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><HeartHandshake size={15}/>{t.kicker}</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t.subtitle}</p>
      </div>

      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <span className="text-xs text-slate-500">{t.recipient}</span>
            <strong className="mt-1 block text-lg">{context.person.name}</strong>
            <span className="mt-4 block text-xs text-slate-500">{t.due}</span>
            <strong className="mt-1 block text-sm font-medium text-slate-200">{formatDue(context.followup.dueAt, currentLang)}</strong>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-slate-400" size={18}/>
              <div><strong className="text-sm">{t.ruleTitle}</strong><p className="mt-2 text-xs leading-5 text-slate-400">{t.rule}</p></div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="journey-first-contact" className="text-sm font-semibold">{t.message}</label>
            <button type="button" disabled={authorizing} onClick={() => void authorizeAndPerform('copy')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.05]">
              {copied ? <CheckCircle2 size={14}/> : <Copy size={14}/>} {copied ? t.copied : t.copy}
            </button>
          </div>
          <textarea id="journey-first-contact" value={message} onChange={(event)=>setMessage(event.target.value)} maxLength={1800} className="mt-3 min-h-[260px] w-full resize-y rounded-2xl border border-white/10 bg-[#090a0e] p-4 text-sm leading-6 text-slate-100 outline-none transition focus:border-white/20"/>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t.editHint}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={authorizing||!message.trim()} onClick={()=>void authorizeAndPerform('whatsapp')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              <MessageCircle size={17}/>{t.openWhatsApp}<ExternalLink size={14}/>
            </button>
            <button type="button" onClick={goBack} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white">
              <ArrowLeft size={16}/>{t.return}
            </button>
          </div>
          {templateInfo.ready?<div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="mb-2 text-xs text-slate-400">{t.officialTemplate} <strong>{templateInfo.templateName||'—'}</strong></p>
            <button type="button" disabled={authorizing} onClick={()=>void sendOfficialTemplate()}
              className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl border border-sky-300/30 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100 disabled:opacity-50">
              {authorizing?<Loader2 size={16} className="animate-spin"/>:<MessageCircle size={16}/>}
              {t.official}
            </button>
            {officialResult?<p role="status" className="mt-3 text-xs leading-5 text-slate-200">
              {officialResult==='accepted'?t.officialAccepted:officialResult==='duplicate'?t.officialDuplicate:t.officialError}
            </p>:null}
          </div>:null}
          <p className="mt-5 text-[11px] leading-5 text-slate-600">{t.source}</p>
        </div>
      </div>
    </section>
  </main>;
}
