import assert from 'node:assert/strict';
import {loadTemplateCatalog,templateSubmissionPayloads} from './whatsapp-template-catalog.mjs';
import {reviewHubSupportTemplate} from './review-hub-support-template.mjs';
import {submitReviewedTemplates} from './submit-reviewed-meta-templates.mjs';
const payloads=templateSubmissionPayloads(loadTemplateCatalog());
const targets=payloads.filter(p=>p.name==='mn_hub_support_update_v1');
const prior={...structuredClone(targets[0]),id:'1234',status:'REJECTED',rejected_reason:'INCORRECT_CATEGORY'};
prior.components[0].text='Olá! A equipe MillionsNest tem uma atualização sobre seu pedido de ajuda com acesso ou uso dos aplicativos. Responda para continuarmos o atendimento. Nunca precisamos da sua senha ou de códigos de verificação por WhatsApp.';
let count=0,inventory,posts,reads,ambiguous,drift,afterEdit,rejectReadback;
function reset(){inventory=[structuredClone(prior)];posts=[];reads=[];ambiguous=false;drift=false;afterEdit=false;rejectReadback=false;}
const request=async(url,init)=>{
 const u=new URL(url);assert.equal(u.origin,'https://graph.facebook.com');assert(!u.pathname.endsWith('/messages'));
 if(init.method==='GET'){
  reads.push(u.pathname);assert.equal(u.pathname,'/v23.0/1234');
  if(!afterEdit)return{...structuredClone(prior),...(drift?{status:'APPROVED'}:{})};
  return{...structuredClone(targets[0]),id:'1234',status:rejectReadback?'REJECTED':'PENDING'};
 }
 assert.equal(init.method,'POST');const body=JSON.parse(init.body);posts.push({path:u.pathname,body});
 if(ambiguous)throw Error('private-provider-error');
 if(u.pathname==='/v23.0/1234'){assert.deepEqual(body,{category:'UTILITY',components:targets[0].components});afterEdit=true;return{success:true};}
 assert.equal(u.pathname,'/v23.0/98765/message_templates');assert(targets.slice(1).some(p=>JSON.stringify(p)===JSON.stringify(body)));return{id:'987',category:'UTILITY',status:'PENDING'};
};
const run=()=>reviewHubSupportTemplate({payloads,existing:inventory,request,origin:'https://graph.facebook.com',version:'v23.0',wabaId:'98765'});
reset();let r=await run();assert.equal(r.state,'HUB_SUPPORT_SUBMITTED_FOR_REVIEW');assert.equal(r.updated,1);assert.equal(r.created,2);assert.equal(posts.length,3);assert.equal(reads.length,2);assert.equal(r.sendAttempted,false);count++;
// Retry reconciles updated models without editing or recreating them.
reset();inventory=targets.map((p,i)=>({...p,id:String(100+i),status:'PENDING'}));r=await run();assert.equal(r.created,0);assert.equal(r.updated,0);assert.equal(posts.length,0);count++;
for(const mutate of [e=>e.status='APPROVED',e=>e.status='PENDING',e=>e.status='DISABLED',e=>e.rejected_reason='SCAM',e=>e.rejected_reason='INVALID_FORMAT',e=>e.id='../messages',e=>e.category='MARKETING',e=>e.components[0].text='Foreign definition',e=>e.components.push({type:'HEADER',text:'private'}),e=>e.components[1].buttons[0].url='https://evil.test/']){
 reset();mutate(inventory[0]);r=await run();assert.equal(r.state,'BLOCKED');assert.equal(posts.length,0);count++;
}
reset();inventory.push({...structuredClone(prior)});r=await run();assert.equal(r.state,'BLOCKED');assert.equal(posts.length,0);count++;
reset();inventory.push({...structuredClone(targets[2]),id:'555',status:'REJECTED',rejected_reason:'INCORRECT_CATEGORY'});r=await run();assert.equal(r.state,'BLOCKED');assert.equal(posts.length,0);count++;
// A stale status between inventory and edit blocks the write.
reset();drift=true;r=await run();assert.equal(r.state,'BLOCKED');assert.equal(posts.length,0);count++;
// Ambiguous update or failed readback stops before creating the remaining locales.
reset();ambiguous=true;r=await run();assert.equal(r.state,'REVIEW_REQUIRED');assert.equal(r.automaticRetry,false);assert.equal(posts.length,1);assert(!JSON.stringify(r).includes('private-provider-error'));count++;
reset();rejectReadback=true;r=await run();assert.equal(r.state,'REVIEW_REQUIRED');assert.equal(r.created,0);assert.equal(posts.length,1);count++;
// Other app templates are never edited or considered approval for this family.
reset();inventory.push({...structuredClone(payloads[0]),id:'777',status:'REJECTED'});r=await run();assert.equal(r.created,2);assert(posts.every(p=>p.path!=='/v23.0/777'));count++;
// Existing owner account/phone preflight still applies to the new operation.
r=await submitReviewedTemplates({policy:{wabaId:'98765'},operation:'review_hub_support',inspect:async()=>({result:{state:'PARTIAL_READ_ONLY'}}),fetchImpl:async()=>{throw Error('must not fetch');}});assert.equal(r.state,'BLOCKED');count++;
// Exercise the protected submitter transport, bounded inventory and revision together.
reset();let inventoryReads=0;
const auth='Bearer EAAsynthetic_readonly_meta_token_0000000';
r=await submitReviewedTemplates({policy:{wabaId:'98765'},operation:'review_hub_support',
 inspect:async({fetchImpl})=>{await fetchImpl('https://graph.facebook.com/v23.0/111',{method:'GET',headers:{Authorization:auth}});return{result:{state:'VERIFIED_READ_ONLY',checks:{phoneAccountAssociation:true}}};},
 fetchImpl:async(url,init)=>{
  const u=new URL(url);if(u.pathname==='/v23.0/111')return Response.json({id:'111'});
  assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,auth);assert.equal(init.cache,'no-store');
  if(u.pathname.endsWith('/message_templates')&&init.method==='GET'){
   inventoryReads++;assert.equal(u.searchParams.get('fields'),'id,name,language,status,category,components,rejected_reason');return Response.json({data:inventory});
  }
  return Response.json(await request(url,init));
 }});
assert.equal(inventoryReads,1);assert.equal(r.state,'HUB_SUPPORT_SUBMITTED_FOR_REVIEW');assert.equal(r.updated,1);assert.equal(r.created,2);assert.equal(r.providerRequests,6);count++;
console.log(`Hub rejected-template correction: ${count} cases PASS; exact predecessor, fresh status, safe readback, no retries/sends, foreign definitions immutable.`);
