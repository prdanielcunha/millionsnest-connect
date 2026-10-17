import assert from 'node:assert/strict';
import {inspectChannelOrganization} from './inspect-approved-meta-account.mjs';
const currentId='synthetic-old-org',targetId='synthetic-target-org';
const doc=id=>({name:`projects/millionsnest/databases/(default)/documents/organizations/${id}`,fields:{name:{stringValue:id===currentId?'Synthetic church':'MillionsNest'},status:{stringValue:'active'}}});
const revision={spec:{containers:[{env:[{name:'CONNECT_WHATSAPP_PHONE_NUMBER_ID',value:'12345'},{name:'CONNECT_WHATSAPP_CONNECTIONS_JSON',value:JSON.stringify([{phoneNumberId:'12345',organizationId:currentId,enabled:true}])}]}]}};
let count=0;
async function probe({current=doc(currentId),rows=[{document:doc(targetId)}],rev=revision,deny=false}={}){
 let calls=0;const result=await inspectChannelOrganization({revision:rev,run:(cmd,args)=>{assert.equal(cmd,'gcloud');assert.deepEqual(args,['auth','print-access-token']);return'synthetic-cloud-token';},fetchImpl:async(url,init)=>{
  calls++;assert.equal(new URL(url).origin,'https://firestore.googleapis.com');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer synthetic-cloud-token');
  if(deny)return new Response('{}',{status:403});
  if(init.method==='POST'){assert(url.endsWith(':runQuery'));const query=JSON.parse(init.body).structuredQuery;assert.equal(query.limit,2);assert.deepEqual(query.from,[{collectionId:'organizations'}]);assert.equal(query.where.fieldFilter.value.stringValue,'MillionsNest');assert.equal(query.select.fields.length,4);return Response.json(rows);}
  assert.equal(init.method,'GET');assert(url.includes('/organizations/'+currentId+'?'));return Response.json(current);
 }});assert.equal(result.channelChanged,false);assert.equal(result.historyMoved,false);assert.equal(result.rbacChanged,false);for(const secret of [currentId,targetId,'Synthetic church','synthetic-cloud-token'])assert(!JSON.stringify(result).includes(secret));count++;return{result,calls};
}
let {result}=await probe();assert.equal(result.code,'CHANNEL_ORGANIZATION_REBIND_REQUIRED');assert.equal(result.canonicalTargetUniquelyActive,true);
({result}=await probe({current:doc(targetId)}));assert.equal(result.state,'VERIFIED_READ_ONLY');
for(const rows of [[],[{document:doc(targetId)},{document:doc(targetId)}],[{document:{...doc(targetId),fields:{name:{stringValue:'MillionsNest'},disabled:{booleanValue:true}}}}]]){({result}=await probe({rows}));assert.equal(result.code,'CANONICAL_TARGET_NOT_UNIQUELY_ACTIVE');}
({result}=await probe({deny:true}));assert.equal(result.code,'CANONICAL_DIRECTORY_READ_UNAVAILABLE');
({result}=await probe({rev:{}}));assert.equal(result.code,'CHANNEL_BINDING_REQUIRES_SECURE_REVIEW');
for(const raw of ['not-json',JSON.stringify([{phoneNumberId:'12345',organizationId:'../users'}]),JSON.stringify([{phoneNumberId:'12345',organizationId:currentId},{phoneNumberId:'12345',organizationId:targetId}])]){
 const rev=structuredClone(revision);rev.spec.containers[0].env[1].value=raw;const r=await probe({rev});assert.equal(r.calls,0);assert.equal(r.result.code,'CHANNEL_BINDING_AMBIGUOUS');}
console.log(`Approved-account canonical channel diagnostic: ${count} synthetic cases PASS; exact-name bounded directory query only, no writes, no identities in output.`);
