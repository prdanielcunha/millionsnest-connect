import {readFileSync} from 'node:fs';
export const PRODUCT_ORIGINS={musicscale:'https://musicscale.millionsnest.com',nestfinance:'https://nestfinance.millionsnest.com',nestjourney:'https://nestjourney.millionsnest.com',hub:'https://www.millionsnest.com'};
const scenarios={musicscale:['scale_published','presence_pending','support_update'],nestfinance:['document_pending','support_update'],nestjourney:['followup_due','requested_contact','support_update','birthday_greeting'],hub:['support_update']};
export function validateTemplateCatalog(catalog){
  if(catalog?.schemaVersion!==1||catalog.sendEnabled!==false||!Array.isArray(catalog.entries)||catalog.entries.length!==30)throw Error('TEMPLATE_CATALOG_INVALID');
  const seen=new Set();
  for(const e of catalog.entries){
    const p=e?.payload,scenario=e?.key?.split('.')[1];
    if(!Object.hasOwn(scenarios,e?.product)||!scenarios[e.product].includes(scenario)||e.key!==e.product+'.'+scenario||
      e.deliveryEnabled!==false||e.approvalStatus!=='NOT_SUBMITTED'||
      e.requiredConsent!==(scenario==='birthday_greeting'?'birthday_whatsapp_optin_v1':'whatsapp_explicit_v1')||
      e.requiresFreshSourceAuthority!==true||e.requiresActiveRequest!==(scenario!=='birthday_greeting')||
      p?.name!==`mn_${e.product}_${scenario}_v1`||!['pt_BR','en_US','es'].includes(p.language)||
      p.category!==(['requested_contact','birthday_greeting'].includes(scenario)?'MARKETING':'UTILITY')||Object.keys(p).some(k=>!['name','language','category','components'].includes(k)))throw Error('TEMPLATE_ENTRY_INVALID');
    const key=p.name+':'+p.language;if(seen.has(key))throw Error('TEMPLATE_DUPLICATE');seen.add(key);
    const c=p.components;
    if(!Array.isArray(c)||c.length!==(scenario==='requested_contact'||scenario==='birthday_greeting'?1:2)||c[0]?.type!=='BODY'||typeof c[0].text!=='string'||
      c[0].text.length<30||c[0].text.length>1024||/[{}\u0000-\u001f]/.test(c[0].text)||/https?:\/\//i.test(c[0].text)||Object.keys(c[0]).some(k=>!['type','text'].includes(k)))throw Error('TEMPLATE_BODY_INVALID');
    if(c.length===2){const b=c[1];const button=b?.buttons?.[0];
      if(b.type!=='BUTTONS'||b.buttons?.length!==1||button.type!=='URL'||button.url!==PRODUCT_ORIGINS[e.product]+'/'||typeof button.text!=='string'||button.text.length>25||Object.keys(button).some(k=>!['type','text','url'].includes(k)))throw Error('TEMPLATE_BUTTON_INVALID');
    }
  }
  return catalog;
}
export function loadTemplateCatalog(){return validateTemplateCatalog(JSON.parse(readFileSync(new URL('../config/whatsapp-template-catalog.v1.json',import.meta.url),'utf8')));}
// Creates provider-ready metadata only. No transport, recipients, identity grants or flags.
export function templateSubmissionPayloads(catalog=loadTemplateCatalog()){return validateTemplateCatalog(catalog).entries.map(e=>structuredClone(e.payload));}
