import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, HeartHandshake, Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import type { LanguageCode } from '../../types';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import { buildWhatsAppDraftUrl, normalizeWhatsAppPhone } from '../../core/client/whatsappDelivery';
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
    copy: 'Copiar',
    return: 'Voltar e registrar resultado',
    ruleTitle: 'Envio não é resolução',
    rule: 'Abrir o WhatsApp apenas prepara a conversa. O Connect não marca a mensagem como enviada e não encerra o cuidado. Depois do contato, volte ao NestJourney e registre somente o resultado observado.',
    source: 'Roteiro baseado no Manual de Cuidado e Conexão Raiz e Mesa 2026.',
    back: 'Voltar ao NestJourney',
    templateHeading:'Envio oficial pelo Connect',templateInfo:'Somente template previamente aprovado pela Meta, em português. Pode gerar cobrança por mensagem. A confirmação significa aceite pela Meta, não entrega.',templateAck:'Revisei o template aprovado na Meta e aceito a possível cobrança pelo envio.',templateSend:'Enviar template oficial',templateSending:'Enviando com autorização atualizada…',templateAccepted:'Template aceito pela Meta. Acompanhe o status de entrega pela caixa de entrada.',templateFailed:'O envio não foi confirmado. Não tente reenviar automaticamente: verifique a situação no atendimento.',
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
    copy: 'Copy',
    return: 'Return and record outcome',
    ruleTitle: 'Opening a channel is not resolution',
    rule: 'Opening WhatsApp only prepares the conversation. Connect does not mark the message as sent and does not close the care item. After contact, return to NestJourney and record only the observed outcome.',
    source: 'Script based on the Raiz e Mesa 2026 Care & Connection Manual.',
    back: 'Back to NestJourney',
    templateHeading:'Official Connect delivery',templateInfo:'Only a previously approved Meta template, in Portuguese. Messaging charges may apply. Accepted by Meta does not mean delivered.',templateAck:'I reviewed the approved template at Meta and accept potential messaging fees.',templateSend:'Send official template',templateSending:'Checking authorization and sending…',templateAccepted:'Meta accepted the template. Follow delivery in the inbox.',templateFailed:'Delivery acceptance is not confirmed. Check the inbox before attempting another send.',
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
    copy: 'Copiar',
    return: 'Volver y registrar resultado',
    ruleTitle: 'Abrir el canal no es resolución',
    rule: 'Abrir WhatsApp solo prepara la conversación. Connect no marca el mensaje como enviado ni cierra el cuidado. Después del contacto, vuelve a NestJourney y registra solamente el resultado observado.',
    source: 'Guion basado en el Manual de Cuidado y Conexión Raiz e Mesa 2026.',
    back: 'Volver a NestJourney',
    templateHeading:'Envío oficial de Connect',templateInfo:'Solo una plantilla aprobada por Meta, en portugués. Puede tener un coste. La aceptación por Meta no confirma la entrega.',templateAck:'Revisé la plantilla aprobada en Meta y acepto los posibles costes.',templateSend:'Enviar plantilla oficial',templateSending:'Comprobando autorización y enviando…',templateAccepted:'Meta aceptó la plantilla. Compruebe la entrega en la bandeja.',templateFailed:'El envío no está confirmado. Verifique el estado antes de un nuevo intento.',
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
  const [revalidating,setRevalidating]=useState(false);
  const actionBusy=useRef(false);
  const [templateReady,setTemplateReady]=useState(false);
  const [templateName,setTemplateName]=useState('');
  const [templateAcknowledged,setTemplateAcknowledged]=useState(false);
  const [templateSending,setTemplateSending]=useState(false);
  const [templateOutcome,setTemplateOutcome]=useState<'accepted'|'failed'|null>(null);

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


  async function authorizeManualAction(action:'copy'|'whatsapp'){
    if(actionBusy.current||!context||!followupId||!message.trim())return;
    actionBusy.current=true;setRevalidating(true);setCopied(false);
    try{
      const fresh=await refreshAuthorizedJourneyFollowup({
        organizationId:session.expectedOrganizationId,followupId,idToken:session.idToken,
      });
      const from=normalizeWhatsAppPhone(context.person.phone);
      const to=normalizeWhatsAppPhone(fresh.person.phone);
      if(!to||from!==to||fresh.followup.careRequestId!==context.followup.careRequestId)
        throw new Error('FOLLOWUP_RECIPIENT_CHANGED');
      if(action==='copy'){
        await navigator.clipboard.writeText(message);
        setCopied(true);
        window.setTimeout(()=>setCopied(false),1800);
      }else{
        const url=buildWhatsAppDraftUrl(message,fresh.person.phone);
        if(!url)throw new Error('INVALID_WHATSAPP_DRAFT');
        window.location.assign(url);
      }
    }catch{
      // Fail closed: do not expose an actionable draft once authorization fails.
      setMessage('');setContext(null);setState('error');
    }finally{
      actionBusy.current=false;setRevalidating(false);
    }
  }


  useEffect(()=>{
    let alive=true;
    const query=new URLSearchParams({organizationId:session.expectedOrganizationId});
    void fetch('/api/core/nestjourney/followup/template-readiness?'+query.toString(),{
      method:'GET',headers:{Authorization:'Bearer '+session.idToken,Accept:'application/json','Cache-Control':'no-store'},cache:'no-store',
    }).then(async response=>response.ok?response.json():null).then(payload=>{
      if(!alive)return;
      setTemplateReady(payload?.success===true&&payload?.ready===true&&typeof payload?.templateName==='string');
      setTemplateName(typeof payload?.templateName==='string'?payload.templateName:'');
    }).catch(()=>{if(alive)setTemplateReady(false)});
    return()=>{alive=false};
  },[session.expectedOrganizationId,session.idToken]);

  async function sendOfficialTemplate(){
    if(actionBusy.current||!context||!followupId||!templateReady||!templateAcknowledged)return;
    actionBusy.current=true;setTemplateSending(true);setTemplateOutcome(null);
    try{
      const response=await fetch('/api/core/nestjourney/followup/send-template',{
        method:'POST',headers:{Authorization:'Bearer '+session.idToken,'Content-Type':'application/json',Accept:'application/json','Cache-Control':'no-store'},cache:'no-store',
        body:JSON.stringify({organizationId:session.expectedOrganizationId,followupId,language:'pt_BR',acknowledgeTemplate:true}),
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok||result?.success!==true||!['accepted','duplicate'].includes(result?.kind))throw new Error('TEMPLATE_DISPATCH_UNCONFIRMED');
      setTemplateOutcome('accepted');setTemplateAcknowledged(false);
    }catch{
      setTemplateOutcome('failed');setTemplateAcknowledged(false);
    }finally{actionBusy.current=false;setTemplateSending(false);}
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
            <button type="button" disabled={revalidating} onClick={() => void authorizeManualAction('copy')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.05]">
              {copied ? <CheckCircle2 size={14}/> : <Copy size={14}/>} {copied ? t.copied : t.copy}
            </button>
          </div>
          <textarea id="journey-first-contact" value={message} onChange={(event)=>setMessage(event.target.value)} maxLength={1800} className="mt-3 min-h-[260px] w-full resize-y rounded-2xl border border-white/10 bg-[#090a0e] p-4 text-sm leading-6 text-slate-100 outline-none transition focus:border-white/20"/>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t.editHint}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={revalidating||!message.trim()} onClick={()=>void authorizeManualAction('whatsapp')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              <MessageCircle size={17}/>{t.openWhatsApp}<ExternalLink size={14}/>
            </button>
            <button type="button" onClick={goBack} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white">
              <ArrowLeft size={16}/>{t.return}
            </button>
          </div>
          {templateReady?<section className="mt-6 border-t border-white/10 pt-5" aria-label={t.templateHeading}>
            <h2 className="text-sm font-semibold">{t.templateHeading}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-400">{t.templateInfo}</p>
            <p className="mt-2 text-xs font-medium text-slate-300">{templateName} · pt_BR</p>
            <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-slate-300">
              <input type="checkbox" checked={templateAcknowledged} disabled={templateSending||templateOutcome==='accepted'} onChange={event=>setTemplateAcknowledged(event.target.checked)} className="mt-1"/>
              <span>{t.templateAck}</span>
            </label>
            <button type="button" onClick={()=>void sendOfficialTemplate()} disabled={!templateAcknowledged||templateSending||revalidating||templateOutcome==='accepted'} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {templateSending?t.templateSending:t.templateSend}
            </button>
            {templateOutcome?<p role="status" className="mt-3 text-xs leading-5 text-slate-300">{templateOutcome==='accepted'?t.templateAccepted:t.templateFailed}</p>:null}
          </section>:null}
          <p className="mt-5 text-[11px] leading-5 text-slate-600">{t.source}</p>
        </div>
      </div>
    </section>
  </main>;
}
