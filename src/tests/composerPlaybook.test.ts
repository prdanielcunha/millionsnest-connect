import { buildComposerPlan } from '../personal/radar/composerPlaybook';
import { RadarSignal } from '../personal/radar/radarSignals';

let passed=0; let total=0;
function assert(value:unknown,message:string){ total++; if(!value) throw new Error(message); passed++; }
const signal: RadarSignal = { id:'s1', type:'explicit_product_interest', reason:'fit', nextAction:'ask', evidence:[{messageIndex:1,dateKey:'2026-09-10',sender:'Pr. João',snippet:'A escala do louvor e as cifras ficam todas espalhadas no WhatsApp.'}] };
const plan=buildComposerPlan({ person:{displayName:'Pr. João'}, signal });
assert(plan.options.length===3,'generates three message options');
assert(plan.stage===2,'fit starts with discovery instead of product dump');
assert(plan.recommendedStyle==='consultivo','fit defaults to consultative style');
assert(plan.recommendation.includes('Não apresente'),'recommends discovery before presentation');
assert(plan.factsUsed.length===1,'shows facts used');
assert(plan.nextSmallYes.length>10,'explains next small yes');
const audio=buildComposerPlan({person:{displayName:'João'},signal,channel:'audio',style:'proximo'});
assert(audio.options.length===3,'audio generates three options');
assert(audio.estimatedDurationSeconds===30,'audio includes estimated duration');
assert(audio.tip.includes('pausas'),'audio guidance stays conversational');
const pastoral: RadarSignal={...signal,id:'s2',type:'unanswered_conversation'};
assert(buildComposerPlan({person:{displayName:'Pr. Carlos'},signal:pastoral}).recommendedStyle==='pastoral','pastoral contact defaults to pastoral style');
const video=buildComposerPlan({person:{displayName:'João'},signal,objective:'pedir_video'});
assert(video.stage===4 && video.options.every(o=>/vídeo/i.test(o.text)),'permission stage asks before video');
const trial=buildComposerPlan({person:{displayName:'João'},signal,objective:'convidar_trial'});
assert(trial.stage===8 && trial.options.every(o=>/7 dias/i.test(o.text)),'trial stage uses seven-day real-organization test');

const continued=buildComposerPlan({person:{displayName:'João',lastCommercialAction:'whatsapp_opened',lastCommercialAt:'2026-09-12T12:00:00Z'},signal,style:'amigavel'});
assert(continued.options.every(option=>!/^Oi[,!]|^Olá[,!]|^Ô,/.test(option.text)),'later contacts do not restart with a first-contact greeting');
assert(continued.options.some(option=>/Voltando|Fiquei pensando|nossa conversa/i.test(option.text)),'later contacts explicitly continue prior context');
assert(continued.recommendation.includes('Continue do ponto anterior'),'continuation guidance tells Composer not to restart the conversation');
console.log(`✅ Composer Playbook: ${passed} / ${total}`);
