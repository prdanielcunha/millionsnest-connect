import { buildWhatsAppDraftUrl } from '../core/client/whatsappDelivery';
import {
  buildFirstContactMessage,
  isSafeJourneyReturnUrl,
  resolveJourneyFollowupId,
  refreshAuthorizedJourneyFollowup,
} from '../features/journey/journeyFollowup';

let passed=0;
function equal(actual:unknown,expected:unknown,message:string){if(actual!==expected)throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);passed++;}

equal(resolveJourneyFollowupId('/journey-followup/first-contact-care1'),'first-contact-care1','valid route resolves');
equal(resolveJourneyFollowupId('/journey-followup/../care1'),null,'unsafe route does not resolve');
const pt=buildFirstContactMessage({locale:'pt-BR',personName:'João da Silva',senderName:'Carlos Souza',organizationName:'OBPC'});
equal(pt.includes('Oi, João.'),true,'message is personalized by first name');
equal(pt.includes('Aqui é Carlos, da OBPC.'),true,'sender and church are explicit');
equal(pt.includes('orar por você ou pela sua família'),true,'source care invitation is preserved');
const url=buildWhatsAppDraftUrl(pt,'+55 (43) 99999-1234');
equal(url.startsWith('https://wa.me/5543999991234?text='),true,'WhatsApp opens a draft URL');
equal(isSafeJourneyReturnUrl('https://nestjourney.millionsnest.com/followup-runtime?followup=first-contact-care1'),true,'canonical return accepted');
equal(isSafeJourneyReturnUrl('https://evil.example/followup-runtime?followup=first-contact-care1'),false,'external return rejected');

console.log(`Journey Resolve Loop client contract: ${passed} checks passed.`);


async function testFreshJourneyAuthorization(){
  let requests=0;
  let noStore=false;
  const allowed={
    success:true,
    organization:{id:'org-a',name:'Local church'},
    followup:{id:'followup-1',careRequestId:'care-1',congregationId:'unit-a',dueAt:null},
    person:{name:'Test Person',phone:'+5543999991234'},
    returnTo:'https://nestjourney.millionsnest.com/followup-runtime?followup=followup-1',
  };
  const provider:typeof fetch=async (_input,init)=>{
    requests++;
    noStore=init?.cache==='no-store'
      && (init.headers as Record<string,string>)?.Authorization==='Bearer test-id-token';
    return new Response(JSON.stringify(allowed),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const ctx=await refreshAuthorizedJourneyFollowup({
    organizationId:'org-a',followupId:'followup-1',idToken:'test-id-token',fetchImpl:provider,
  });
  equal(ctx.followup.id,'followup-1','fresh action checks same follow-up');
  equal(requests,1,'an action makes a new authorization HTTP call');
  equal(noStore,true,'bearer token and no-store are required');
  const denied:typeof fetch=async()=>new Response(JSON.stringify({
    success:false,code:'CONSENT_REVOKED',
  }),{status:403});
  let revoked=false;
  try{
    await refreshAuthorizedJourneyFollowup({
      organizationId:'org-a',followupId:'followup-1',idToken:'test-id-token',fetchImpl:denied,
    });
  }catch{revoked=true}
  equal(revoked,true,'revoked contact blocks action');
  let mismatch=false;
  try{
    await refreshAuthorizedJourneyFollowup({
      organizationId:'org-a',followupId:'followup-1',idToken:'test-id-token',
      fetchImpl:async()=>new Response(JSON.stringify({
        ...allowed,organization:{id:'org-b',name:'Wrong church'},
      }),{status:200}),
    });
  }catch{mismatch=true}
  equal(mismatch,true,'a mismatched tenant blocks action');
}
await testFreshJourneyAuthorization();
