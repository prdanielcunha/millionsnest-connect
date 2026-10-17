import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {inspectApprovedAccount} from './inspect-approved-meta-account.mjs';
import {loadTemplateCatalog,templateSubmissionPayloads} from './whatsapp-template-catalog.mjs';
import {reviewHubSupportTemplate} from './review-hub-support-template.mjs';

// Metadata creation only; never messages, recipients, webhooks or runtime writes.
export async function submitReviewedTemplates({policy,catalog=loadTemplateCatalog(),inspect=inspectApprovedAccount,fetchImpl=fetch,operation='submit'}={}){
  if(!['submit','inspect','review_hub_support'].includes(operation))throw Error('TEMPLATE_OPERATION_INVALID');
  let authorization,version;
  const preflight=await inspect({policy,fetchImpl:async(url,options)=>{
    if(new URL(url).origin!=='https://graph.facebook.com'||options.method!=='GET')throw Error('PREFLIGHT_TRANSPORT_INVALID');
    authorization=options.headers.Authorization;version=new URL(url).pathname.split('/')[1];return fetchImpl(url,options);
  }});
  if(preflight.result?.state!=='VERIFIED_READ_ONLY'||preflight.result.checks?.phoneAccountAssociation!==true||!/^Bearer EAA[A-Za-z0-9_-]{17,8189}$/.test(authorization||'')||!/^v\d{1,3}\.\d{1,3}$/.test(version||'')||!/^\d{5,30}$/.test(policy?.wabaId||''))return{state:'BLOCKED',code:'APPROVED_ACCOUNT_PREFLIGHT_REQUIRED',created:0,sendAttempted:false};
  const payloads=templateSubmissionPayloads(catalog);
  const origin='https://graph.facebook.com',path=`/${version}/${policy.wabaId}/message_templates`;
  let requests=0,created=0,alreadyPresent=0;
  let failureStage='inventory',failedTemplate=null,lastFailure={};
  const statusCounts={APPROVED:0,PENDING:0};
  const request=async(url,init)=>{
    requests++;
    const response=await fetchImpl(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{Authorization:authorization,Accept:'application/json','Content-Type':'application/json'}});
    const reader=response.body?.getReader();if(!reader)throw Error();let size=0;const chunks=[];
    while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>262144){await reader.cancel();throw Error();}chunks.push(Buffer.from(item.value));}
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!response.ok){lastFailure={httpStatus:response.status};
      for(const [source,key] of [['code','providerErrorCode'],['error_subcode','providerErrorSubcode']]){
        const value=data?.error?.[source];if(Number.isSafeInteger(value)&&value>=0&&value<10000000000)lastFailure[key]=value;
      }
      throw Error();
    }return data;
  };
  const existing=[];let after=null;
  try{
    for(let page=0;page<3;page++){
      const url=new URL(path,origin);url.searchParams.set('fields',operation==='review_hub_support'?'id,name,language,status,category,components,rejected_reason':operation==='inspect'?'name,language,status,category,components,rejected_reason':'name,language,status,category,components');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
      const data=await request(url.toString(),{method:'GET'});
      if(!Array.isArray(data?.data)||data.data.length>100)throw Error();existing.push(...data.data);
      // Never follow paging.next (which may contain an access token).
      if(!data.paging?.next){after=null;break;}
      after=data.paging?.cursors?.after;if(typeof after!=='string'||!/^[A-Za-z0-9_=-]{1,2048}$/.test(after))throw Error();
    }
    if(after)return{state:'BLOCKED',code:'TEMPLATE_INVENTORY_REQUIRES_REVIEW',created,providerRequests:requests,sendAttempted:false};
    if(operation==='review_hub_support'){
      const result=await reviewHubSupportTemplate({payloads,existing,request,origin,version,wabaId:policy.wabaId});
      return{...result,...lastFailure,providerRequests:requests};
    }
    const pending=[],inventory=[];
    const buttonsFingerprint=buttons=>JSON.stringify((buttons??[]).map(b=>({type:b.type,text:b.text,url:b.url})));
    // Validate every existing same-name template BEFORE making any creation call.
    for(const payload of payloads){
      const matches=existing.filter(e=>e.name===payload.name&&e.language===payload.language);
      if(matches.length>1)throw Error();
      if(matches.length===1){
        const e=matches[0];const body=e.components?.find(c=>c.type==='BODY');const buttons=e.components?.find(c=>c.type==='BUTTONS');
        const expectedButtons=payload.components.find(c=>c.type==='BUTTONS');
        const extra=e.components?.some(c=>!['BODY','BUTTONS'].includes(c.type));
        if(operation==='inspect'){
          const status=['APPROVED','PENDING','REJECTED','PAUSED','DISABLED'].includes(e.status)?e.status:'OTHER';
          inventory.push({templateName:payload.name,language:payload.language,status,
            category:['UTILITY','MARKETING','AUTHENTICATION'].includes(e.category)?e.category:'OTHER',
            ...(status==='REJECTED'?{rejectionReason:['ABUSIVE_CONTENT','INCORRECT_CATEGORY','INVALID_FORMAT','PROMOTIONAL','SCAM','TAG_CONTENT_MISMATCH'].includes(e.rejected_reason)?e.rejected_reason:typeof e.rejected_reason==='undefined'||e.rejected_reason==='NONE'?'UNAVAILABLE':'OTHER'}:{}),
            definitionMatches:!extra&&body?.text===payload.components[0].text&&buttonsFingerprint(buttons?.buttons)===buttonsFingerprint(expectedButtons?.buttons),
            categoryMatches:e.category===payload.category});
          alreadyPresent++;statusCounts[status]=(statusCounts[status]||0)+1;
          continue;
        }
        if(extra||e.category!==payload.category||body?.text!==payload.components[0].text||buttonsFingerprint(buttons?.buttons)!==buttonsFingerprint(expectedButtons?.buttons)||!['APPROVED','PENDING'].includes(e.status))return{state:'BLOCKED',code:'EXISTING_TEMPLATE_REQUIRES_REVIEW',templateName:payload.name,language:payload.language,observedStatus:['APPROVED','PENDING','REJECTED','PAUSED','DISABLED'].includes(e.status)?e.status:'OTHER',observedCategory:['UTILITY','MARKETING','AUTHENTICATION'].includes(e.category)?e.category:'OTHER',created,providerRequests:requests,sendAttempted:false};
        alreadyPresent++;statusCounts[e.status]++;
      }else pending.push(payload);
    }
    if(operation==='inspect')return{state:'VERIFIED_CATALOG_READ_ONLY',expected:payloads.length,alreadyPresent,missing:pending.length,
      statusCounts,inventory,missingModels:pending.map(p=>({templateName:p.name,language:p.language})),allApproved:statusCounts.APPROVED===payloads.length&&inventory.every(e=>e.definitionMatches&&e.categoryMatches),providerRequests:requests,sendAttempted:false,activationPerformed:false};
    failureStage='create';
    for(const payload of pending){
      failedTemplate={templateName:payload.name,language:payload.language};
      const data=await request(origin+path,{method:'POST',body:JSON.stringify(payload)});
      if(typeof data?.id!=='string'||!/^\d{1,40}$/.test(data.id)||!['APPROVED','PENDING'].includes(data.status)||data.category!==payload.category)throw Error();
      created++;statusCounts[data.status]++;
    }
    return{state:'SUBMITTED_FOR_META_REVIEW',created,alreadyPresent,statusCounts,providerRequests:requests,approvalRequired:statusCounts.APPROVED!==payloads.length,sendAttempted:false,activationPerformed:false};
  }catch{return{state:'REVIEW_REQUIRED',code:'TEMPLATE_METADATA_REQUEST_FAILED_OR_AMBIGUOUS',created,alreadyPresent,statusCounts,failureStage,...(failedTemplate??{}),...lastFailure,providerRequests:requests,automaticRetry:false,sendAttempted:false,activationPerformed:false};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let result;
  try{
    if(process.env.GITHUB_REF!=='refs/heads/production'||process.env.GITHUB_REPOSITORY!=='prdanielcunha/millionsnest-connect')throw Error();
    const policy=JSON.parse(readFileSync(new URL('../config/meta-approved-account-readonly.json',import.meta.url),'utf8'));
    result=await submitReviewedTemplates({policy,operation:process.env.CONNECT_TEMPLATE_OPERATION||'submit'});
  }catch{result={state:'BLOCKED',code:'PROTECTED_TEMPLATE_SUBMISSION_FAILED',sendAttempted:false};}
  console.log('CONNECT_META_REVIEWED_TEMPLATE_CATALOG_RESULT='+JSON.stringify(result));
  if(!['SUBMITTED_FOR_META_REVIEW','VERIFIED_CATALOG_READ_ONLY','HUB_SUPPORT_SUBMITTED_FOR_REVIEW'].includes(result.state))process.exitCode=2;
}
