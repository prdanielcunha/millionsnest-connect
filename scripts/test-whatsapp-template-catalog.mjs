import assert from 'node:assert/strict';
import {loadTemplateCatalog,validateTemplateCatalog,templateSubmissionPayloads} from './whatsapp-template-catalog.mjs';
import {submitReviewedTemplates} from './submit-reviewed-meta-templates.mjs';
const catalog=loadTemplateCatalog(),payloads=templateSubmissionPayloads(catalog);
let count=0;
assert.equal(payloads.length,27);assert.equal(new Set(payloads.map(p=>p.name)).size,9);count++;
for(const language of ['pt_BR','en_US','es']){assert.equal(payloads.filter(p=>p.language===language).length,9);count++;}
for(const mutate of [c=>c.sendEnabled=true,c=>c.entries[0].deliveryEnabled=true,c=>c.entries[0].payload.components[0].text='Hello {{1}}',c=>c.entries[0].payload.components[1].buttons[0].url='https://evil.test/',c=>c.entries[0].payload.category='MARKETING',c=>c.entries[0].payload.language='pt',c=>c.entries[0].requiresFreshSourceAuthority=false,c=>c.entries[0].payload.to='recipient',c=>c.entries[0].payload.components[0].text='https://evil.test/',c=>c.entries[1]=structuredClone(c.entries[0])]){const c=structuredClone(catalog);mutate(c);assert.throws(()=>validateTemplateCatalog(c));count++;}
const policy={wabaId:'123456789'},auth='Bearer EAAsynthetic_readonly_meta_token_0000000';
let calls=[],posts=0,inventory=[],failure=false,ambiguous=false;
const inspect=async({fetchImpl})=>{await fetchImpl('https://graph.facebook.com/v23.0/111?fields=id',{method:'GET',headers:{Authorization:auth}});return{result:{state:'VERIFIED_READ_ONLY',checks:{phoneAccountAssociation:true}}};};
const fetchImpl=async(url,init)=>{
 const u=new URL(url);assert.equal(u.origin,'https://graph.facebook.com');assert(!url.includes(auth));assert(!u.pathname.endsWith('/messages'));calls.push(init.method+':'+u.pathname);
 if(u.pathname==='/v23.0/111')return Response.json({id:'111'});
 assert.equal(u.pathname,'/v23.0/123456789/message_templates');assert.equal(init.headers.Authorization,auth);assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
 if(init.method==='GET')return Response.json({data:inventory});
 assert.equal(init.method,'POST');posts++;const payload=JSON.parse(init.body);assert(!('to'in payload));assert(payloads.some(p=>JSON.stringify(p)===JSON.stringify(payload)));
 if(ambiguous)throw Error('secret-provider-error');if(failure)return Response.json({error:{message:'secret-provider-error'}},{status:403});
 return Response.json({id:String(100+posts),status:'PENDING',category:payload.category});
};
let result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.state,'SUBMITTED_FOR_META_REVIEW');assert.equal(posts,27);assert.equal(result.sendAttempted,false);count++;
inventory=payloads.map(p=>({...p,status:'PENDING'}));posts=0;result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.created,0);assert.equal(result.alreadyPresent,27);assert.equal(posts,0);count++;
inventory=payloads.map(p=>({...p,status:'APPROVED'}));result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.alreadyPresent,27);count++;
inventory=payloads.map(p=>({...p,status:'APPROVED'}));inventory[26].components=[{type:'BODY',text:'Existing private content'}];result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.code,'EXISTING_TEMPLATE_REQUIRES_REVIEW');assert.equal(posts,0);assert(!JSON.stringify(result).includes('Existing private'));count++;
for(const status of ['REJECTED','PAUSED','DISABLED']){inventory=payloads.map(p=>({...p,status}));result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.state,'BLOCKED');assert.equal(posts,0);count++;}
inventory=[];failure=true;posts=0;result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.state,'REVIEW_REQUIRED');assert.equal(posts,1);assert.equal(result.automaticRetry,false);assert(!JSON.stringify(result).includes('secret-provider'));count++;
failure=false;ambiguous=true;posts=0;result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.state,'REVIEW_REQUIRED');assert.equal(posts,1);count++;
posts=0;result=await submitReviewedTemplates({policy,catalog,inspect:async()=>({result:{state:'PARTIAL_READ_ONLY'}}),fetchImpl});assert.equal(result.state,'BLOCKED');assert.equal(posts,0);count++;
// Untrusted paging.next is never fetched, even when it includes a token or foreign host.
const pages=[];result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl:async(url,init)=>{
 if(url.includes('/111?'))return Response.json({id:'111'});pages.push(url);return Response.json({data:[],paging:{next:'https://evil.test/?access_token=secret',cursors:{after:'../messages'}}});
}});assert.equal(result.state,'REVIEW_REQUIRED');assert.equal(pages.length,1);assert(pages.every(url=>new URL(url).origin==='https://graph.facebook.com'));count++;

// Metadata property order is not a content conflict; no POST is allowed in inspect mode.
ambiguous=false;failure=false;inventory=payloads.map(p=>({...p,status:'APPROVED',components:p.components.map(c=>c.type==='BUTTONS'?{type:'BUTTONS',buttons:c.buttons.map(b=>({url:b.url,text:b.text,type:b.type}))}:c)}));posts=0;
result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl,operation:'inspect'});assert.equal(result.state,'VERIFIED_CATALOG_READ_ONLY');assert.equal(result.allApproved,true);assert.equal(result.statusCounts.APPROVED,27);assert.equal(posts,0);count++;
inventory=payloads.slice(0,24).map(p=>({...p,status:'PENDING'}));result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl,operation:'inspect'});assert.equal(result.missing,3);assert.equal(result.statusCounts.PENDING,24);assert.equal(result.allApproved,false);assert.equal(posts,0);count++;
inventory=[];failure=true;result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.failureStage,'create');assert.equal(result.httpStatus,403);assert.equal(result.templateName,payloads[0].name);assert.equal(result.language,'pt_BR');assert.equal(result.created,0);assert(!JSON.stringify(result).includes('secret-provider-error'));count++;

// Read-only inventory must report ALL category changes, not stop after the first;
// the write path must still reject mismatches before any creation.
failure=false;posts=0;inventory=payloads.slice(0,24).map(p=>({...p,category:'MARKETING',status:'PENDING'}));
result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl,operation:'inspect'});assert.equal(result.state,'VERIFIED_CATALOG_READ_ONLY');assert.equal(result.inventory.length,24);assert.equal(result.missingModels.length,3);assert.equal(result.inventory.filter(e=>!e.categoryMatches).length,21);assert.equal(result.allApproved,false);assert.equal(posts,0);count++;
result=await submitReviewedTemplates({policy,catalog,inspect,fetchImpl});assert.equal(result.code,'EXISTING_TEMPLATE_REQUIRES_REVIEW');assert.equal(posts,0);count++;
console.log(`Humanized app template catalog: ${count} synthetic cases PASS; 27 payloads / 9 scenarios / 3 locales; default-off, no parameters/recipients, idempotent creation, no edit/delete/send, ambiguity stops.`);
