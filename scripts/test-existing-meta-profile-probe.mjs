import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { probeExistingMetaProfile, inspectExistingMetaRuntime } from './probe-existing-meta-profile.mjs';
const release='b587bc1652329766feb993a7660e33b205ae9a97',image='us-central1-docker.pkg.dev/millionsnest/millionsnest-web/connect-api';
const token='EAAsynthetic_TOKEN_for_readonly_unit_test_0000',phone='123456789101112',waba='987654321012345';
const base={status:{conditions:[{type:'Ready',status:'True'}],latestReadyRevisionName:'connect-api-fixture',latestCreatedRevisionName:'connect-api-fixture',traffic:[{percent:100,revisionName:'connect-api-fixture'}]},spec:{template:{spec:{containers:[{image:`${image}:${release}`}]}}}};
const rev={metadata:{name:'connect-api-fixture'},status:{conditions:[{type:'Ready',status:'True'}],imageDigest:`${image}@sha256:${'a'.repeat(64)}`},spec:{serviceAccountName:'mn-connect-runtime@millionsnest.iam.gserviceaccount.com',containers:[{image:`${image}:${release}`,env:[
 {name:'CONNECT_AUTOMATION_EXECUTION_ENABLED',value:'false'},{name:'CONNECT_WEB_PUSH_ENABLED',value:'false'},
 {name:'CONNECT_WHATSAPP_ACCESS_TOKEN',value:token},{name:'CONNECT_WHATSAPP_GRAPH_API_VERSION',value:'v23.0'},
 {name:'CONNECT_WHATSAPP_PHONE_NUMBER_ID',value:phone},{name:'CONNECT_WHATSAPP_WABA_ID',value:waba}]}]}};
let count=0,calls=[];
const fresh=()=>structuredClone(rev);
const safeOutput=result=>{const s=JSON.stringify(result);for(const value of [token,phone,waba,'private business name','raw-error-message'])assert(!s.includes(value));};
const fetchImpl=async(url,init)=>{
 calls.push(url);assert.equal(new URL(url).origin,'https://graph.facebook.com');assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.body,undefined);
 assert.equal(init.headers.Authorization,'Bearer '+token);assert(!url.includes(token));assert(!new URL(url).pathname.endsWith('/messages'));
 if(url.includes('message_templates'))return Response.json({data:[{status:'APPROVED',name:'private business name'},{status:'PENDING'}],paging:{next:'https://evil.test/?token='+token}});
 return Response.json({id:url.includes(phone)?phone:waba});
};
let result=await probeExistingMetaProfile(base,rev,{fetchImpl});assert.equal(result.state,'VERIFIED_READ_ONLY');assert.equal(calls.length,3);assert.deepEqual(result.templateStatusesFirstPage,{APPROVED:1,PENDING:1});assert.equal(result.operationalCertification,false);assert.equal(result.sendAttempted,false);safeOutput(result);count++;
for(const mutate of [
 r=>r.spec.serviceAccountName='wrong@millionsnest.iam.gserviceaccount.com',
 r=>r.status.conditions[0].status='False',
 r=>r.spec.containers[0].image=image+':old',
 r=>r.spec.containers[0].env[0].value='true',
 r=>r.spec.containers[0].env[1].value='true',
 r=>r.spec.containers[0].env.push({...r.spec.containers[0].env[1]}),
 r=>r.spec.containers[0].env=r.spec.containers[0].env.filter(x=>!x.name.endsWith('ACCESS_TOKEN')),
 r=>r.spec.containers[0].env.find(x=>x.name.endsWith('GRAPH_API_VERSION')).value='v23.0/../../messages',
 r=>r.spec.containers[0].env.find(x=>x.name.endsWith('PHONE_NUMBER_ID')).value='../messages',
 r=>r.spec.containers[0].env.find(x=>x.name.endsWith('ACCESS_TOKEN')).value='{"privateKey":"never-send"}',
 r=>r.spec.containers[0].env.find(x=>x.name.endsWith('ACCESS_TOKEN')).value='worker-secret-with-no-meta-prefix',
]){const x=fresh();mutate(x);calls=[];result=await probeExistingMetaProfile(base,x,{fetchImpl,readSecret:()=>assert.fail('no secret access')});assert.equal(result.state,'BLOCKED');assert.equal(calls.length,0);safeOutput(result);count++;}
let x=fresh();x.spec.containers[0].env=x.spec.containers[0].env.filter(e=>!e.name.endsWith('WABA_ID'));calls=[];
result=await probeExistingMetaProfile(base,x,{fetchImpl});assert.equal(result.state,'PARTIAL_READ_ONLY');assert.equal(result.code,'DEFAULT_WABA_METADATA_NOT_CONFIGURED');assert.equal(calls.length,1);safeOutput(result);count++;
x=fresh();let e=x.spec.containers[0].env.find(e=>e.name.endsWith('ACCESS_TOKEN'));delete e.value;e.valueFrom={secretKeyRef:{name:'existing-meta-token',key:'1'}};let reads=0;
result=await probeExistingMetaProfile(base,x,{fetchImpl,readSecret:(name,version)=>{reads++;assert.equal(name,'existing-meta-token');assert.equal(version,'1');return token;}});assert.equal(result.state,'VERIFIED_READ_ONLY');assert.equal(reads,1);safeOutput(result);count++;
calls=[];result=await probeExistingMetaProfile(base,x,{fetchImpl,readSecret:()=>{throw Error('raw-error-message '+token);}});assert.equal(result.code,'EXISTING_TOKEN_REFERENCE_UNREADABLE');assert.equal(calls.length,0);safeOutput(result);count++;
e.valueFrom.secretKeyRef.name='projects/other-project/secrets/execution-bundle';calls=[];result=await probeExistingMetaProfile(base,x,{fetchImpl,readSecret:()=>assert.fail()});assert.equal(result.code,'TOKEN_REFERENCE_INVALID');assert.equal(calls.length,0);count++;
for(const response of [Response.json({error:{code:190,message:'raw-error-message '+token}},{status:401}),Response.json({id:'wrong'}),new Response('not-json'),new Response('x'.repeat(65537)),Response.json({data:{}})]){
 result=await probeExistingMetaProfile(base,rev,{fetchImpl:async()=>response});assert.equal(result.state,'BLOCKED');safeOutput(result);count++;
}
result=await probeExistingMetaProfile(base,rev,{fetchImpl:async()=>{throw Error('raw-error-message '+token);}});assert.equal(result.code,'META_READ_REQUEST_FAILED');safeOutput(result);count++;
const commands=[];result=await inspectExistingMetaRuntime((command,args)=>{commands.push(args);assert.equal(command,'gcloud');assert(args.includes('describe'));return JSON.stringify(args[1]==='services'?base:rev);},fetchImpl);assert.equal(result.state,'VERIFIED_READ_ONLY');assert.equal(commands.length,2);safeOutput(result);count++;
const split=structuredClone(base);split.status.traffic=[{percent:90,revisionName:'connect-api-fixture'},{percent:10,revisionName:'connect-api-old'}];calls=[];result=await probeExistingMetaProfile(split,rev,{fetchImpl});assert.equal(result.state,'BLOCKED');assert.equal(calls.length,0);count++;
const approved={wabaId:waba,phoneIdSha256:createHash('sha256').update(phone).digest('hex')};
x=fresh();x.spec.containers[0].env=x.spec.containers[0].env.filter(e=>!e.name.endsWith('WABA_ID'));
calls=[];result=await probeExistingMetaProfile(base,x,{approvedAccount:approved,fetchImpl:async(url,init)=>url.includes('/phone_numbers?')?(calls.push(url),Response.json({data:[{id:phone}]})):fetchImpl(url,init)});
assert.equal(result.state,'VERIFIED_READ_ONLY');assert.equal(result.checks.phoneAccountAssociation,true);assert.equal(calls.length,4);safeOutput(result);count++;
for(const override of [{...approved,wabaId:'../messages'},{...approved,phoneIdSha256:'b'.repeat(64)}]){
 calls=[];result=await probeExistingMetaProfile(base,x,{approvedAccount:override,fetchImpl});assert.equal(result.code,'OWNER_APPROVED_ACCOUNT_MISMATCH');assert.equal(calls.length,0);count++;
}
for(const data of [{data:[]},{data:[{id:'other'}]},{data:{}},{data:Array(26).fill({id:phone})}]){
 result=await probeExistingMetaProfile(base,x,{approvedAccount:approved,fetchImpl:async(url,init)=>url.includes('/phone_numbers?')?Response.json(data):fetchImpl(url,init)});
 assert.equal(result.code,'PHONE_NOT_CONFIRMED_IN_APPROVED_ACCOUNT');safeOutput(result);count++;
}
console.log(`Meta read-only probe: ${count} contract cases PASS; fixed GET-only origin, no sends, no redirects/paging, scoped existing secret, safe logs, missing config/access and runtime drift denied. Synthetic transport only.`);
