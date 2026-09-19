import { buildWhatsAppDraftUrl } from '../core/client/whatsappDelivery';
import {
  buildFirstContactMessage,
  isSafeJourneyReturnUrl,
  resolveJourneyFollowupId,
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
