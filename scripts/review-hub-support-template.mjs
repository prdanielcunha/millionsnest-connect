// A narrowly scoped, one-time correction of our rejected Hub pt_BR template.
// Pending/approved/foreign definitions are immutable. No alternate names or sends.
const previousBody='Olá! A equipe MillionsNest tem uma atualização sobre seu pedido de ajuda com acesso ou uso dos aplicativos. Responda para continuarmos o atendimento. Nunca precisamos da sua senha ou de códigos de verificação por WhatsApp.';
const name='mn_hub_support_update_v1';
const locales=['pt_BR','en_US','es'];
const validId=id=>typeof id==='string'&&/^\d{1,40}$/.test(id);
const normalize=p=>({name:p.name,language:p.language,category:p.category,components:(p.components??[]).map(c=>c.type==='BODY'?{type:c.type,text:c.text}:c.type==='BUTTONS'?{type:c.type,buttons:c.buttons?.map(b=>({type:b.type,text:b.text,url:b.url}))}:{type:c.type})});
const same=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
export async function reviewHubSupportTemplate({payloads,existing,request,origin,version,wabaId}){
  const targets=payloads.filter(p=>p.name===name);
  const blocked=()=>({state:'BLOCKED',code:'HUB_SUPPORT_REVISION_REQUIRES_REVIEW',created:0,updated:0,sendAttempted:false,activationPerformed:false});
  if(targets.length!==3||locales.some(l=>targets.filter(p=>p.language===l&&p.category==='UTILITY').length!==1))return blocked();
  const plans=[];
  // Validate the complete affected family before the first write.
  for(const p of targets){
    const matches=existing.filter(e=>e.name===name&&e.language===p.language);
    if(matches.length>1)return blocked();
    if(!matches.length){plans.push({kind:'create',payload:p});continue;}
    const e=matches[0];
    if(same(e,p)&&['APPROVED','PENDING'].includes(e.status))continue;
    const prior=structuredClone(p);prior.components[0].text=previousBody;
    if(p.language!=='pt_BR'||e.status!=='REJECTED'||e.rejected_reason!=='INCORRECT_CATEGORY'||
      !validId(e.id)||!same(e,prior))return blocked();
    plans.unshift({kind:'update',payload:p,prior,id:e.id});
  }
  let created=0,updated=0;
  try{
    for(const plan of plans){
      if(plan.kind==='update'){
        // Fresh read of exactly the inventory-owned ID, immediately before edit.
        const url=origin+`/${version}/${plan.id}`;
        const current=await request(url+'?fields=id,name,language,status,category,components,rejected_reason',{method:'GET'});
        if(current.id!==plan.id||current.status!=='REJECTED'||current.rejected_reason!=='INCORRECT_CATEGORY'||!same(current,plan.prior))return{...blocked(),created,updated};
        const response=await request(url,{method:'POST',body:JSON.stringify({category:'UTILITY',components:plan.payload.components})});
        if(response.success!==true)throw Error();
        updated++;
        const verified=await request(url+'?fields=id,name,language,status,category,components',{method:'GET'});
        if(verified.id!==plan.id||!same(verified,plan.payload)||!['PENDING','APPROVED'].includes(verified.status))throw Error();
      }else{
        const response=await request(origin+`/${version}/${wabaId}/message_templates`,{method:'POST',body:JSON.stringify(plan.payload)});
        if(!validId(response.id)||!['PENDING','APPROVED'].includes(response.status)||response.category!=='UTILITY')throw Error();
        created++;
      }
    }
    return{state:'HUB_SUPPORT_SUBMITTED_FOR_REVIEW',created,updated,alreadyPresent:targets.length-plans.length,approvalRequired:true,sendAttempted:false,activationPerformed:false};
  }catch{return{state:'REVIEW_REQUIRED',code:'HUB_SUPPORT_REVISION_FAILED_OR_AMBIGUOUS',created,updated,automaticRetry:false,sendAttempted:false,activationPerformed:false};}
}
