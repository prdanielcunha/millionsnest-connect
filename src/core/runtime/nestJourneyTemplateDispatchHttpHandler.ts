import express from 'express';
import {createHash} from 'node:crypto';
import type {CanonicalContextProvider} from './connectCore';
import type {MetaWhatsAppProvider} from '../channels/metaWhatsAppProvider';
import type {WhatsAppConnectionRegistry} from '../channels/whatsappConnectionRegistry';
import type {HumanReplyDispatchStore} from '../inbox/humanReplyDispatchStore';
import {normalizeWhatsAppPhone} from '../client/whatsappDelivery';
import {createMessageEvidenceRef,createProviderMessageIndexId,type ConnectMessageContentStore} from '../inbox/messageContentStore';

export type JourneyTemplateLanguage='pt_BR'|'en_US'|'es';
export interface JourneyTemplateDispatchOptions {
  contextProvider:CanonicalContextProvider;
  hubOrigin:string;
  provider?:MetaWhatsAppProvider|null;
  registry?:WhatsAppConnectionRegistry|null;
  dispatchStore?:HumanReplyDispatchStore|null;
  messageStore?:ConnectMessageContentStore|null;
  env?:NodeJS.ProcessEnv;
  fetchImpl?:typeof fetch;
}
const SAFE_ID=/^[A-Za-z0-9._:-]{1,180}$/;
const SAFE_TEMPLATE=/^[a-z0-9_]{1,512}$/;
const LANGUAGES=new Set<JourneyTemplateLanguage>(['pt_BR','en_US','es']);
function validString(input:unknown):string{
  return typeof input==='string'&&SAFE_ID.test(input)?input:'';
}
export function isJourneyTemplateDispatchConfigured(env:NodeJS.ProcessEnv){
  return env.CONNECT_NESTJOURNEY_TEMPLATE_SEND_ENABLED==='true'
    && env.CONNECT_NESTJOURNEY_TEMPLATE_POLICY_ACK==='APPROVED_TEMPLATE_AND_CHARGES_ACCEPTED'
    && env.CONNECT_WHATSAPP_PROVIDER_DISPATCH_ENABLED==='true'
    && SAFE_TEMPLATE.test(env.CONNECT_NESTJOURNEY_TEMPLATE_NAME||'')
    && Boolean(env.CONNECT_WHATSAPP_ACCESS_TOKEN?.trim())
    && /^v\d{1,3}\.\d{1,3}$/.test(env.CONNECT_WHATSAPP_GRAPH_API_VERSION||'');
}
function toPublicError(e:unknown):{status:number;code:string}{
  const code=e instanceof Error?e.message:'UNKNOWN';
  if(code==='DISPATCH_IN_PROGRESS'||code==='PREVIOUSLY_FAILED'||code==='REVIEW_REQUIRED')
    return{status:409,code};
  if(code.startsWith('WHATSAPP_PROVIDER_REJECTED:'))
    return{status:502,code:'WHATSAPP_PROVIDER_REJECTED'};
  if(code==='WHATSAPP_PROVIDER_TIMEOUT')return{status:504,code};
  return{status:503,code:'DISPATCH_UNAVAILABLE'};
}

export function createJourneyTemplateReadinessHandler(options:JourneyTemplateDispatchOptions){
  const env=options.env||process.env;
  return async (req:express.Request,res:express.Response)=>{
    res.setHeader('Cache-Control','no-store');
    const token=req.headers.authorization;
    const organizationId=validString(req.query.organizationId);
    if(typeof token!=='string'||!/^Bearer\s+\S+$/i.test(token.trim()))
      return res.status(401).json({success:false,code:'AUTH_REQUIRED'});
    if(!organizationId)return res.status(400).json({success:false,code:'INVALID_REQUEST'});
    let canonical;
    try{
      canonical=await options.contextProvider.resolve({
        authToken:token,requestedOrganizationId:organizationId,
      });
    }catch{return res.status(503).json({success:false,code:'CONTEXT_UNAVAILABLE'})}
    if(canonical.status!=='resolved'||canonical.context.organizationId!==organizationId)
      return res.status(403).json({success:false,code:'CANONICAL_ACCESS_DENIED'});
    const sender=options.registry?.resolveOnlyForOrganization(organizationId);
    const ready=Boolean(isJourneyTemplateDispatchConfigured(env)
      && options.provider&&options.dispatchStore&&options.messageStore&&sender);
    return res.status(200).json({
      success:true,ready,
      // Template names are configuration metadata, not actual message content.
      ...(ready?{templateName:env.CONNECT_NESTJOURNEY_TEMPLATE_NAME}:{}),
    });
  };
}

/** Official, parameter-free, Meta-approved template only. Never dispatch client-supplied text.
 * Hub authorization is rechecked immediately before provider dispatch. One
 * durable ID per followup blocks repeats even after browser reload.
 */
export function createJourneyTemplateDispatchHandler(options:JourneyTemplateDispatchOptions){
  const env=options.env||process.env;
  const fetchImpl=options.fetchImpl??globalThis.fetch.bind(globalThis);
  const hubOrigin=new URL(options.hubOrigin).origin;
  return async (req:express.Request,res:express.Response)=>{
    res.setHeader('Cache-Control','no-store');
    const authorization=req.headers.authorization||'';
    if(typeof authorization!=='string'||!/^Bearer\s+\S+$/i.test(authorization.trim()))
      return res.status(401).json({success:false,code:'AUTH_REQUIRED'});
    if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||
      Object.keys(req.body).some(k=>!['organizationId','followupId','language','acknowledgeTemplate'].includes(k)))
      return res.status(400).json({success:false,code:'INVALID_REQUEST'});
    const organizationId=validString(req.body.organizationId);
    const followupId=validString(req.body.followupId);
    const language=req.body.language as JourneyTemplateLanguage;
    if(!organizationId||!followupId||!LANGUAGES.has(language)||req.body.acknowledgeTemplate!==true)
      return res.status(400).json({success:false,code:'INVALID_REQUEST'});
    if(!isJourneyTemplateDispatchConfigured(env)||!options.provider||!options.registry||!options.dispatchStore||!options.messageStore)
      return res.status(409).json({success:false,code:'OFFICIAL_TEMPLATE_NOT_CONFIGURED'});
    const sender=options.registry.resolveOnlyForOrganization(organizationId);
    if(!sender)return res.status(409).json({success:false,code:'SENDER_UNAVAILABLE_OR_AMBIGUOUS'});
    let canonical;
    try{canonical=await options.contextProvider.resolve({
      authToken:authorization,requestedOrganizationId:organizationId,
    })}catch{return res.status(503).json({success:false,code:'CONTEXT_UNAVAILABLE'})}
    if(canonical.status!=='resolved'||canonical.context.organizationId!==organizationId)
      return res.status(403).json({success:false,code:'CANONICAL_ACCESS_DENIED'});
    let live:unknown;
    try{
      const url=new URL('/api/ecosystem/connect/nestjourney/followup-context',hubOrigin);
      url.searchParams.set('organizationId',organizationId);
      url.searchParams.set('followupId',followupId);
      const response=await fetchImpl(url.toString(),{
        method:'GET',
        headers:{Authorization:authorization,Accept:'application/json','Cache-Control':'no-store'},
        cache:'no-store',signal:AbortSignal.timeout(8000),
      });
      if(!response.ok)return res.status(403).json({success:false,code:'FOLLOWUP_NOT_AUTHORIZED'});
      live=await response.json();
    }catch{return res.status(503).json({success:false,code:'HUB_CONTEXT_UNAVAILABLE'})}
    const value=live as {
      success?:boolean;organization?:{id?:string};followup?:{id?:string};
      person?:{phone?:string};
    }|null;
    const phone=normalizeWhatsAppPhone(value?.person?.phone);
    if(value?.success!==true||value.organization?.id!==organizationId||
      value.followup?.id!==followupId||!phone)
      return res.status(403).json({success:false,code:'FOLLOWUP_NOT_AUTHORIZED'});
    const templateName=env.CONNECT_NESTJOURNEY_TEMPLATE_NAME!;
    const bodyFingerprint=createHash('sha256').update(JSON.stringify([
      organizationId,followupId,phone,sender.phoneNumberId,templateName,language,
    ])).digest('hex');
    const requestId='first-contact-'+followupId;
    let dispatch;
    try{
      const begun=await options.dispatchStore.begin({
        organizationId,conversationId:'journey-'+followupId,
        requestId,bodyFingerprint,now:new Date().toISOString(),
      });
      dispatch=begun.record;
      if(begun.kind==='existing'){
        if(dispatch.status==='sent'&&dispatch.providerMessageId)
          return res.status(200).json({success:true,kind:'duplicate',
            providerMessageId:dispatch.providerMessageId,deliveryStatus:'accepted_by_meta'});
        if(dispatch.status==='dispatching')throw new Error('DISPATCH_IN_PROGRESS');
        if(dispatch.status==='ambiguous_after_provider_accept')throw new Error('REVIEW_REQUIRED');
        throw new Error('PREVIOUSLY_FAILED');
      }
    }catch(e){
      const failure=toPublicError(e);
      return res.status(failure.status).json({success:false,code:failure.code});
    }
    // Revalidate consent/assignment once more AFTER reserving the durable
    // dispatch, immediately before the external Meta send.
    try{
      const currentUrl=new URL('/api/ecosystem/connect/nestjourney/followup-context',hubOrigin);
      currentUrl.searchParams.set('organizationId',organizationId);
      currentUrl.searchParams.set('followupId',followupId);
      const current=await fetchImpl(currentUrl.toString(),{
        method:'GET',
        headers:{Authorization:authorization,Accept:'application/json','Cache-Control':'no-store'},
        cache:'no-store',signal:AbortSignal.timeout(8000),
      });
      const payload=current.ok?await current.json().catch(()=>null):null;
      if(!current.ok||payload?.success!==true
        ||payload?.organization?.id!==organizationId
        ||payload?.followup?.id!==followupId
        ||normalizeWhatsAppPhone(payload?.person?.phone)!==phone)
        throw new Error('FOLLOWUP_FRESH_AUTH_REJECTED');
    }catch{
      // No Meta call was made, but retain the consumed request ID. A new
      // authorization requires a reviewed new follow-up, never a second send.
      try{await options.dispatchStore.markFailed({
        record:dispatch,errorCode:'FRESH_AUTH_REJECTED',
        now:new Date().toISOString(),
      })}catch{/* dispatching status still blocks accidental retry */ }
      return res.status(403).json({success:false,code:'FOLLOWUP_NOT_AUTHORIZED'});
    }
    // A dispatching record exists before calling Meta. Ambiguous acceptance
    // never gets an automatic retry; requests with this followup ID are blocked.
    try{
      const providerResult=await options.provider.sendApprovedTemplate({
        phoneNumberId:sender.phoneNumberId,recipientPhone:phone,templateName,language,
      });
      try{
        const at=new Date().toISOString();
        const providerMessageId=providerResult.providerMessageId;
        await options.messageStore.put({
          schemaVersion:1,organizationId,conversationId:'journey-'+followupId,
          messageId:createProviderMessageIndexId('whatsapp',providerMessageId),
          channel:'whatsapp',direction:'outbound',providerMessageId,
          senderRef:sender.phoneNumberId,recipientRef:phone,
          messageType:'template',body:'Approved Meta template: '+templateName,
          occurredAt:at,recordedAt:at,deliveryStatus:'sent',
          deliveryUpdatedAt:at,
          evidenceRef:createMessageEvidenceRef('whatsapp',providerMessageId),
        });
        await options.dispatchStore.markSent({
          record:dispatch,providerMessageId,
          now:new Date().toISOString(),
        });
      }catch{
        try{await options.dispatchStore.markAmbiguous({
          record:dispatch,providerMessageId:providerResult.providerMessageId,
          errorCode:'PERSISTENCE_AFTER_META_ACCEPT',
          now:new Date().toISOString(),
        })}catch{/* block retry because dispatch remains durable */ }
        return res.status(503).json({success:false,code:'PROVIDER_ACCEPTED_AUDIT_INCOMPLETE'});
      }
      return res.status(202).json({success:true,kind:'accepted',
        providerMessageId:providerResult.providerMessageId,
        deliveryStatus:'accepted_by_meta'});
    }catch(e){
      // A timeout may mean Meta accepted a message. Conservatively keep the
      // dispatch ambiguous instead of permitting a second send.
      try{await options.dispatchStore.markAmbiguous({
        record:dispatch,providerMessageId:'',errorCode:'PROVIDER_RESULT_UNCERTAIN',
        now:new Date().toISOString(),
      })}catch{/* block further dispatch if storage is unavailable */ }
      const failure=toPublicError(e);
      return res.status(failure.status).json({success:false,code:failure.code});
    }
  };
}
