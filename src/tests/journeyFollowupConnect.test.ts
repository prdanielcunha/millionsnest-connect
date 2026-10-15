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


async function verifyFreshAuthorizationContract(){
  const success={
    success:true,
    organization:{id:'org-a',name:'Church'},
    followup:{id:'care-1',careRequestId:'request-1',congregationId:'campus',dueAt:null},
    person:{name:'Sample Person',phone:'5543999991234'},
    returnTo:'https://nestjourney.millionsnest.com/followup-runtime?followup=care-1',
  };
  let count=0;
  const fetchImpl:typeof fetch=async(_url,opts)=>{
    count++;
    equal(opts?.cache,'no-store','fresh request does not use cached context');
    equal((opts?.headers as Record<string,string>).Authorization,'Bearer test-token','authenticated request used');
    return new Response(JSON.stringify(success),{status:200});
  };
  await refreshAuthorizedJourneyFollowup({
    organizationId:'org-a',followupId:'care-1',idToken:'test-token',fetchImpl,
  });
  equal(count,1,'fresh authorization obtains a server response per action');
  let blocked=false;
  try{
    await refreshAuthorizedJourneyFollowup({
      organizationId:'org-a',followupId:'care-1',idToken:'test-token',
      fetchImpl:async()=>new Response(JSON.stringify({success:false,code:'CONSENT_REVOKED'}),{status:403}),
    });
  }catch{blocked=true}
  equal(blocked,true,'revocation blocks copy or draft action');
  blocked=false;
  try{
    await refreshAuthorizedJourneyFollowup({
      organizationId:'org-a',followupId:'care-1',idToken:'test-token',
      fetchImpl:async()=>new Response(JSON.stringify({...success,organization:{id:'org-other',name:'Other'}}),{status:200}),
    });
  }catch{blocked=true}
  equal(blocked,true,'foreign tenant response is rejected');
}
await verifyFreshAuthorizationContract();

console.log(`Journey Resolve Loop client contract: ${passed} checks passed.`);
