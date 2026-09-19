import { buildComposerPlan } from '../personal/radar/composerPlaybook';
import { RadarSignal } from '../personal/radar/radarSignals';

let passed=0; let total=0;
function assert(value:unknown,message:string){ total++; if(!value) throw new Error(message); passed++; }
const signal: RadarSignal = { id:'s1', type:'explicit_product_interest', reason:'fit', nextAction:'ask', evidence:[{messageIndex:1,dateKey:'2026-09-10',sender:'Pr. João',snippet:'A escala do louvor e as cifras ficam todas espalhadas no WhatsApp.'}] };
const plan=buildComposerPlan({ person:{displayName:'Pr. João'}, signal });
assert(plan.options.length===3,'generates three message options');
assert(plan.stage===2,'fit starts with discovery instead of product dump');
assert(plan.recommendedStyle==='consultivo','fit defaults to consultative style');
assert(/identifique|Não presuma|descubra/i.test(plan.recommendation),'recommends role-safe discovery before presentation');
assert(plan.factsUsed.length===1,'shows facts used');
assert(plan.nextSmallYes.length>10,'explains next small yes');
const audio=buildComposerPlan({person:{displayName:'João'},signal,channel:'audio',style:'proximo'});
assert(audio.options.length===3,'audio generates three options');
assert(audio.estimatedDurationSeconds===30,'audio includes estimated duration');
assert(audio.tip.includes('pausas'),'audio guidance stays conversational');
const pastoral: RadarSignal={...signal,id:'s2',type:'unanswered_conversation'};
assert(buildComposerPlan({person:{displayName:'Pr. Carlos'},signal:pastoral}).recommendedStyle==='consultivo','an unconfirmed title never infers a pastoral role');
const pastorBridge=buildComposerPlan({person:{displayName:'Pr. Carlos',approachProfile:'pastor_bridge'},signal:pastoral});
assert(pastorBridge.recommendedStyle==='pastoral','manually confirmed pastor bridge uses respectful pastoral style');
assert(pastorBridge.options.every(option=>/respons[aá]vel|quem cuida|apresentar/i.test(option.text)),'pastor bridge asks for a safe introduction instead of pitching');
assert(/apresenta[cç][aã]o|contato do respons[aá]vel/i.test(pastorBridge.nextSmallYes),'pastor bridge next small yes is reaching the worship owner');
const worshipLeader=buildComposerPlan({person:{displayName:'João',approachProfile:'worship_leader'},signal});
assert(worshipLeader.recommendedStyle==='consultivo','worship leader starts consultatively');
assert(worshipLeader.options.some(option=>/rotina do louvor|líder para líder|realidade de vocês/i.test(option.text)),'worship leader copy starts from lived worship pain');
const unknownProfile=buildComposerPlan({person:{displayName:'João'},signal:pastoral});
assert(unknownProfile.approachProfile==='unknown','unknown is the conservative default');
assert(unknownProfile.options.some(option=>/não presumir|pessoa certa|com quem/i.test(option.text)),'unknown profile identifies the real worship owner before selling');
const video=buildComposerPlan({person:{displayName:'João'},signal,objective:'pedir_video'});
assert(video.stage===4 && video.options.every(o=>/vídeo/i.test(o.text)),'permission stage asks before video');
const trial=buildComposerPlan({person:{displayName:'João'},signal,objective:'convidar_trial'});
assert(trial.stage===8 && trial.options.every(o=>/7 dias/i.test(o.text)),'trial stage uses seven-day real-organization test');
const story=buildComposerPlan({person:{displayName:'João'},signal,objective:'contar_historia'});
assert(story.stage===3 && story.recommendedChannel==='audio','story stage recommends audio and is explicit');
const demo=buildComposerPlan({person:{displayName:'João'},signal,objective:'enviar_video',channel:'video'});
assert(demo.stage===5 && demo.options.every(o=>/MusicScale|escala|louvor/i.test(o.text)),'demo stage creates short video scripts');
const diagnosis=buildComposerPlan({person:{displayName:'João'},signal,objective:'diagnosticar'});
assert(diagnosis.stage===6 && diagnosis.options.every(o=>o.text.includes('?')),'diagnosis stage asks instead of pitching');
const styles = ['amigavel','profissional','descontraido','objetivo','proximo','pastoral','consultivo'] as const;
const styleMessages = styles.map(style => buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style}).options[0].text);
assert(new Set(styleMessages).size===styles.length,'all seven Composer styles produce visibly distinct copy');
const friendlyCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'amigavel'}).options[0].text;
const professionalCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'profissional'}).options[0].text;
const consultativeCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'consultivo'}).options[0].text;
assert(friendlyCopy!==professionalCopy && professionalCopy!==consultativeCopy && friendlyCopy!==consultativeCopy,'friendly, professional and consultative copy are not aliases');
assert(professionalCopy.startsWith('Olá, João. Tudo bem?'),'professional style uses a polished neutral greeting');
assert(/entender|gargalo|avaliar|Como vocês organizam/i.test(consultativeCopy),'consultative style uses diagnostic wording');
assert(friendlyCopy.startsWith('E aí, João!'),'friendly style opens naturally with E aí');
const pastoralCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'pastoral'}).options[0].text;
assert(pastoralCopy.startsWith('Paz, João!'),'pastoral style opens naturally with Paz');
const casualCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'descontraido'}).options[0].text;
assert(casualCopy.startsWith('Fala, João!'),'casual style has its own WhatsApp voice');
const directCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'objetivo'}).options[0].text;
assert(directCopy.startsWith('João,'),'objective style starts directly with the person');
assert(/Paz/.test(pastoralCopy) && !/Paz/.test(friendlyCopy),'pastoral greeting is reserved for pastoral tone');

const continued=buildComposerPlan({person:{displayName:'João',lastCommercialAction:'whatsapp_opened',lastCommercialAt:'2026-09-12T12:00:00Z'},signal,style:'amigavel'});
assert(continued.options.every(option=>!/^E aí|^Oi[,!]|^Olá[,!]|^Fala[,!]|^Paz[,!]/i.test(option.text)),'later contacts do not restart with a first-contact greeting');
assert(continued.options.some(option=>/Voltando|Fiquei pensando|nossa conversa/i.test(option.text)),'later contacts explicitly continue prior context');
assert(continued.recommendation.includes('Continue do ponto anterior'),'continuation guidance tells Composer not to restart the conversation');
const continuedVideo=buildComposerPlan({person:{displayName:'João',lastCommercialAction:'whatsapp_opened'},signal,objective:'enviar_video',channel:'video',style:'amigavel'});
assert(continuedVideo.options.every(option=>!/^Oi[,!]/i.test(option.text)),'later video contact does not restart with Oi');

const remembered=buildComposerPlan({
  person:{
    displayName:'João',
    lastCommercialAction:'sent_manual',
    lastCommercialAt:'2026-09-01T12:00:00Z',
    followUpAt:'2026-09-02T12:00:00Z',
    salesStage:'iniciar_conversa',
    lastCommercialDraft:'E aí, João! Tudo bem? Como vocês organizam as escalas hoje?',
    recentConversationMessages:[{dateKey:'2026-09-03',snippet:'A gente ainda faz tudo pelo WhatsApp e as cifras ficam espalhadas.'}],
  },
  signal,
  objective:'iniciar_conversa',
  style:'amigavel',
});
assert(remembered.objective!=='iniciar_conversa','existing relationship cannot silently fall back to cold first-contact objective');
assert(remembered.relationship.continuation===true,'relationship brain recognizes prior commercial history');
assert(remembered.relationship.respondedAfterLastContact===true,'relationship brain recognizes a later inbound message conservatively by date');
assert(remembered.options.every(option=>!/^E aí|^Oi[,!]|^Olá[,!]|^Fala[,!]|^Paz[,!]/i.test(option.text)),'relationship-aware messages never restart with a cold greeting');
assert(remembered.factsUsed.some(fact=>/mensagem anterior/i.test(fact)),'composer remembers prior draft to reduce repetition');
console.log(`✅ Composer Playbook: ${passed} / ${total}`);
