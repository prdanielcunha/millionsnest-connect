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
let allowed=true;
const fetchImpl:typeof fetch=async(_url,init)=>{
  hubCalls++;
  equal((init?.headers as any)?.Authorization,'Bearer token','Hub receives bearer');
  if(!allowed)return new Response(JSON.stringify({success:false}),{status:403});
  return new Response(JSON.stringify({
    success:true,organization:{id:'org-a'},
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
  equal(hubCalls,2,'Hub consent rechecked for each click');
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
console.log('Official NestJourney template dispatch contract: '+assertions+' checks passed');
