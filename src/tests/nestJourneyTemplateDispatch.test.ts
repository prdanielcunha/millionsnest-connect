import {
  createJourneyTemplateDispatchHandler,isJourneyTemplateDispatchConfigured,
} from '../core/runtime/nestJourneyTemplateDispatchHttpHandler';
import {WhatsAppConnectionRegistry} from '../core/channels/whatsappConnectionRegistry';
import type {CanonicalContextProvider} from '../core/runtime/connectCore';
import type {HumanReplyDispatchRecord} from '../core/inbox/humanReplyDispatchStore';

let assertions=0;
function equal(a:unknown,b:unknown,label:string){
  if(a!==b)throw new Error(label+': expected '+String(b)+', got '+String(a));
  assertions++;
}
const env:NodeJS.ProcessEnv={
  CONNECT_NESTJOURNEY_TEMPLATE_SEND_ENABLED:'true',
  CONNECT_NESTJOURNEY_TEMPLATE_POLICY_ACK:'APPROVED_TEMPLATE_AND_CHARGES_ACCEPTED',
  CONNECT_WHATSAPP_PROVIDER_DISPATCH_ENABLED:'true',
  CONNECT_NESTJOURNEY_TEMPLATE_NAME:'welcome_first_contact',
  CONNECT_WHATSAPP_ACCESS_TOKEN:'test-token',
  CONNECT_WHATSAPP_GRAPH_API_VERSION:'v23.0',
};
const ctx:CanonicalContextProvider={
  async resolve(){return {status:'resolved',context:{
    actorUid:'caregiver',organizationId:'org-a',globalAccess:false,
    systemRole:null,organizationRole:'care',permissions:[],capabilities:[],
    appAccess:{musicscale:false},
  }}},
};
const binding=new WhatsAppConnectionRegistry([{
  organizationId:'org-a',phoneNumberId:'meta-number-1',connectionRef:'primary',enabled:true,
}]);
function req(body:any,auth='Bearer token'){
  return{body,headers:{authorization:auth},query:{organizationId:'org-a'}} as any;
}
function res(){
  const r:any={statusCode:200,body:null,headers:{}};
  r.setHeader=(k:string,v:string)=>{r.headers[k]=v;return r};
  r.status=(s:number)=>{r.statusCode=s;return r};
  r.json=(body:unknown)=>{r.body=body;return r};
  return r;
}
const body={organizationId:'org-a',followupId:'followup-1',
  language:'pt_BR',acknowledgeTemplate:true};
let providerCalls=0,hubCalls=0,dispatchCalls=0,contentWrites=0;
let stored:HumanReplyDispatchRecord|null=null;
const dispatchStore:any={
  async begin(input:any){
    dispatchCalls++;
    if(stored)return{kind:'existing',record:stored};
    stored={...input,schemaVersion:1,dispatchId:'fixed',
      status:'dispatching',createdAt:input.now,updatedAt:input.now};
    return{kind:'created',record:stored};
  },
  async markSent(input:any){stored={...input.record,status:'sent',
    providerMessageId:input.providerMessageId};return stored},
  async markFailed(input:any){stored={...input.record,status:'failed',errorCode:input.errorCode};return stored},
  async markAmbiguous(input:any){stored={...input.record,status:'ambiguous_after_provider_accept',
    providerMessageId:input.providerMessageId,errorCode:input.errorCode};return stored},
};
const messageStore:any={
  async put(record:any){
    contentWrites++;
    equal(record.deliveryStatus,'sent','Meta accepted, not delivered yet');
    equal(record.messageType,'template','webhook-indexed template');
    return {kind:'created',record};
  }
};
const meta:any={
  async sendApprovedTemplate(input:any){
    providerCalls++;
    equal(input.templateName,'welcome_first_contact','approved template only');
    equal(input.recipientPhone,'5543999991234','server-supplied recipient only');
    return{providerMessageId:'wamid.mock1'};
  },
};
let allowed=true,consentProof=true;
const fetchImpl:typeof fetch=async(_url,init)=>{
  hubCalls++;
  equal((init?.headers as any)?.Authorization,'Bearer token','Hub receives bearer');
  equal(init?.redirect,'error','authorization cannot follow redirects');
  if(!allowed)return new Response(JSON.stringify({success:false}),{status:403});
  return new Response(JSON.stringify({
    success:true,consentContract:consentProof?'whatsapp_explicit_v1':undefined,organization:{id:'org-a'},
    followup:{id:'followup-1'},person:{phone:'5543999991234'},
  }),{status:200});
};
const handler=createJourneyTemplateDispatchHandler({
  contextProvider:ctx,hubOrigin:'https://www.millionsnest.com',
  registry:binding,dispatchStore,messageStore,provider:meta,env,fetchImpl,
});
equal(isJourneyTemplateDispatchConfigured(env),true,'explicit opt-in config');
equal(isJourneyTemplateDispatchConfigured({}),false,'default off');
{
  consentProof=false;
  const r=res();await handler(req(body),r);
  equal(r.statusCode,403,'legacy Hub cannot authorize Meta without explicit consent proof');
  equal(providerCalls,0,'no provider call without consent proof');
  equal(dispatchCalls,0,'missing initial proof consumes no dispatch');
  consentProof=true;
}
equal(isJourneyTemplateDispatchConfigured({...env,CONNECT_NESTJOURNEY_TEMPLATE_APPROVED_LANGUAGES:'zz'}),false,'invalid locale is not activated');
{
  const r=res();await handler(req({...body,language:'es'}),r);
  equal(r.statusCode,409,'unapproved locale rejected before Meta dispatch');
  equal(providerCalls,0,'no provider call for unapproved locale');
}
{
  const r=res();await handler(req({...body,acknowledgeTemplate:false}),r);
  equal(r.statusCode,400,'browser must acknowledge template');
  equal(providerCalls,0,'no send without acknowledgement');
}
{
  const r=res();await handler(req(body),r);
  equal(r.statusCode,202,'Meta acceptance returned');
  equal(r.body.deliveryStatus,'accepted_by_meta','never claims delivery');
  equal(providerCalls,1,'only one Meta message');
  equal(dispatchCalls,1,'durable attempt precedes provider call');
  equal(contentWrites,1,'accepted template indexed for delivery/read webhook');
}
{
  const r=res();await handler(req(body),r);
  equal(r.statusCode,200,'repeat accepted');
  equal(r.body.kind,'duplicate','repeats do not send');
  equal(providerCalls,1,'still one external call');
  equal(hubCalls,4,'legacy rejection plus two checks before Meta and one on repeat');
}
{
  allowed=false;
  const r=res();await handler(req(body),r);
  equal(r.statusCode,403,'revocation blocks retries');
  equal(providerCalls,1,'revoked follow-up not resent');
}
{
  const r=res();await handler(req({...body,organizationId:'org-b'}),r);
  equal(r.statusCode,409,'unmapped org has no sender');
}
// Proof must still be present after reserving the durable dispatch. A rejected
// second check consumes the attempt and must never contact Meta, even on retry.
for(const changed of ['missing_proof','wrong_proof','wrong_tenant','wrong_followup','changed_phone','revoked','redirect','timeout','malformed'] as const){
  stored=null;
  let calls=0;
  const beforeProvider=providerCalls;
  const currentHandler=createJourneyTemplateDispatchHandler({
    contextProvider:ctx,hubOrigin:'https://www.millionsnest.com',
    registry:binding,dispatchStore,messageStore,provider:meta,env,
    fetchImpl:async(_url,init)=>{
      equal(init?.redirect,'error','fresh consent check rejects redirect');
      calls++;
      if(calls===2&&['redirect','timeout'].includes(changed))throw new Error(changed);
      if(calls===2&&changed==='malformed')return new Response('not-json');
      const payload:any={success:true,consentContract:'whatsapp_explicit_v1',organization:{id:'org-a'},followup:{id:'followup-1'},person:{phone:'5543999991234'}};
      if(calls===2){
        if(changed==='missing_proof')delete payload.consentContract;
        if(changed==='wrong_proof')payload.consentContract='implicit_v0';
        if(changed==='wrong_tenant')payload.organization.id='org-b';
        if(changed==='wrong_followup')payload.followup.id='followup-other';
        if(changed==='changed_phone')payload.person.phone='5543999995678';
        if(changed==='revoked')return new Response('{}',{status:403});
      }
      return new Response(JSON.stringify(payload));
    },
  });
  const r=res();await currentHandler(req(body),r);
  equal(r.statusCode,403,changed+' immediately before Meta is rejected');
  equal(providerCalls,beforeProvider,changed+' makes no Meta call');
  equal((stored as HumanReplyDispatchRecord|null)?.status,'failed',changed+' retains failed reservation');
  const retry=res();await currentHandler(req(body),retry);
  equal(retry.statusCode,409,changed+' cannot automatically reuse consumed dispatch');
  equal(providerCalls,beforeProvider,changed+' retry makes no Meta call');
}
console.log('Official NestJourney template dispatch contract: '+assertions+' checks passed');
