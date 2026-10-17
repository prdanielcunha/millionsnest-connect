import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {inspectExistingMetaRuntime} from './probe-existing-meta-profile.mjs';

// Owner supplied account metadata is NOT identity, consent or authority to send.
export async function inspectApprovedAccount({run=execFileSync,fetchImpl=fetch,policy}={}) {
  const runtime={};
  const result=await inspectExistingMetaRuntime((command,args,options)=>{
    const raw=run(command,args,options);
    if(args[0]==='run'&&args[1]==='revisions')runtime.revision=JSON.parse(raw);
    return raw;
  },fetchImpl,policy);
  return {result,revision:runtime.revision};
}

// Bounded canonical directory lookup. No user/member/message collections, no writes.
export async function inspectChannelOrganization({revision,run=execFileSync,fetchImpl=fetch}={}) {
  const unavailable=code=>({state:'BLOCKED',code,channelChanged:false,historyMoved:false,rbacChanged:false});
  const env=revision?.spec?.containers?.[0]?.env || [];
  const get=key=>env.filter(e=>e.name===key);
  const phone=get('CONNECT_WHATSAPP_PHONE_NUMBER_ID');
  const bindings=get('CONNECT_WHATSAPP_CONNECTIONS_JSON');
  if(phone.length!==1||bindings.length!==1||bindings[0].valueFrom||typeof bindings[0].value!=='string')return unavailable('CHANNEL_BINDING_REQUIRES_SECURE_REVIEW');
  let matched;
  try {
    const values=JSON.parse(bindings[0].value);
    if(!Array.isArray(values)||values.length>100)throw Error();
    matched=values.filter(b=>b?.phoneNumberId===phone[0].value&&b.enabled!==false);
    if(matched.length!==1||typeof matched[0].organizationId!=='string'||!/^[-a-zA-Z0-9_]{1,180}$/.test(matched[0].organizationId))throw Error();
  }catch{return unavailable('CHANNEL_BINDING_AMBIGUOUS');}
  let token;
  try {token=run('gcloud',['auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim();}
  catch{return unavailable('CANONICAL_DIRECTORY_CREDENTIAL_UNAVAILABLE');}
  const base='https://firestore.googleapis.com/v1/projects/millionsnest/databases/(default)/documents';
  const request=async(url,options={})=>{
    const response=await fetchImpl(url,{method:'GET',...options,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'}});
    if(!response.ok)throw Error();
    const raw=await response.text();if(Buffer.byteLength(raw)>65536)throw Error();return JSON.parse(raw);
  };
  let current,rows;
  try {
    current=await request(base+'/organizations/'+encodeURIComponent(matched[0].organizationId)+'?mask.fieldPaths=name&mask.fieldPaths=status&mask.fieldPaths=disabled&mask.fieldPaths=archived');
    rows=await request(base+':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{
      select:{fields:[{fieldPath:'name'},{fieldPath:'status'},{fieldPath:'disabled'},{fieldPath:'archived'}]},
      from:[{collectionId:'organizations'}],where:{fieldFilter:{field:{fieldPath:'name'},op:'EQUAL',value:{stringValue:'MillionsNest'}}},limit:2}})});
  }catch{return unavailable('CANONICAL_DIRECTORY_READ_UNAVAILABLE');}
  if(!Array.isArray(rows))return unavailable('CANONICAL_DIRECTORY_RESPONSE_INVALID');
  const docs=rows.filter(x=>x.document).map(x=>x.document);
  const active=d=>d?.fields?.disabled?.booleanValue!==true&&d?.fields?.archived?.booleanValue!==true&&(!d?.fields?.status?.stringValue||d.fields.status.stringValue==='active');
  const target=docs.length===1&&docs[0].fields?.name?.stringValue==='MillionsNest'&&active(docs[0])?docs[0]:null;
  const same=Boolean(target&&target.name===current.name);
  return {state:same?'VERIFIED_READ_ONLY':'REVIEW_REQUIRED',code:same?'CHANNEL_ORGANIZATION_MATCH':!target?'CANONICAL_TARGET_NOT_UNIQUELY_ACTIVE':'CHANNEL_ORGANIZATION_REBIND_REQUIRED',
    currentOrganizationIsMillionsNest:current?.fields?.name?.stringValue==='MillionsNest',canonicalTargetCount:docs.length,
    canonicalTargetUniquelyActive:Boolean(target),bindingMatchesCanonicalTarget:same,
    channelChanged:false,historyMoved:false,rbacChanged:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.env.GITHUB_REF!=='refs/heads/production'||process.env.GITHUB_REPOSITORY!=='prdanielcunha/millionsnest-connect')throw Error();
    const policy=JSON.parse(readFileSync(new URL('../config/meta-approved-account-readonly.json',import.meta.url),'utf8'));
    const {result,revision}=await inspectApprovedAccount({policy});
    console.log('CONNECT_OWNER_APPROVED_META_ACCOUNT_RESULT='+JSON.stringify(result));
    if(result.state!=='VERIFIED_READ_ONLY'){process.exitCode=2;}
    else{
      const organization=await inspectChannelOrganization({revision});
      console.log('CONNECT_CHANNEL_ORGANIZATION_READONLY_RESULT='+JSON.stringify(organization));
      if(organization.state!=='VERIFIED_READ_ONLY')process.exitCode=2;
    }
  }catch{console.log('CONNECT_OWNER_APPROVED_META_ACCOUNT_RESULT='+JSON.stringify({state:'BLOCKED',code:'PROTECTED_APPROVED_ACCOUNT_INSPECTION_FAILED',sendAttempted:false}));process.exitCode=2;}
}
