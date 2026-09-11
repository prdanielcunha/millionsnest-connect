import fs from 'node:fs';

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path, value){ fs.writeFileSync(path,value); }
function replaceOnce(source, search, replacement, label){
  if (!source.includes(search)) throw new Error(`missing:${label}`);
  return source.replace(search,replacement);
}

// Service: replace the old four-template composer with the source-defined playbook.
{
  const path='src/personal/radar/personalRadarService.ts';
  let s=read(path);
  s=replaceOnce(s,
    "import { deriveRadarPeople, RadarPerson, RadarSignal } from './radarSignals';\n",
    "import { deriveRadarPeople, RadarPerson, RadarSignal } from './radarSignals';\nimport { buildComposerPlan, ComposerChannel, ComposerObjective, ComposerStyle } from './composerPlaybook';\n",
    'service-import');

  const helperStart=s.indexOf('function firstName(displayName: string): string {');
  const helperEnd=s.indexOf('function isActivelySnoozed(', helperStart);
  if(helperStart<0||helperEnd<0) throw new Error('missing:legacy-composer-helpers');
  s=s.slice(0,helperStart)+`function legacyComposerPreferences(tone: RadarComposerTone): { style?: ComposerStyle; channel?: ComposerChannel; objective?: ComposerObjective } {\n  if (tone === 'audio') return { channel: 'audio', style: 'proximo' };\n  if (tone === 'video') return { channel: 'texto', objective: 'pedir_video', style: 'amigavel' };\n  if (tone === 'conversa') return { channel: 'texto', objective: 'descobrir_dor', style: 'consultivo' };\n  return { channel: 'texto', style: 'objetivo' };\n}\n\n`+s.slice(helperEnd);

  const composeRegex=/  async compose\([\s\S]*?\n  async deleteSource\(/;
  if(!composeRegex.test(s)) throw new Error('missing:compose-method');
  s=s.replace(composeRegex,`  async compose(\n    request: RadarRequestContext,\n    personDocumentId: string,\n    signalId: string,\n    tone: RadarComposerTone,\n    preferences: { style?: ComposerStyle; channel?: ComposerChannel; objective?: ComposerObjective } = {},\n  ) {\n    const context = await this.resolvePilotContext(request);\n    const person = await this.vault.get(request.authToken, context.actorUid, ['personalPeople', personDocumentId]);\n    if (!person) throw new Error('PERSON_NOT_FOUND');\n    const signals = Array.isArray(person.signals) ? person.signals as RadarSignal[] : [];\n    const signal = signals.find(item => item?.id === signalId);\n    if (!signal) throw new Error('SIGNAL_NOT_FOUND');\n    if (!['curto', 'conversa', 'audio', 'video'].includes(tone)) throw new Error('COMPOSER_TONE_INVALID');\n\n    const legacy = legacyComposerPreferences(tone);\n    const plan = buildComposerPlan({\n      person,\n      signal,\n      style: preferences.style || legacy.style,\n      channel: preferences.channel || legacy.channel,\n      objective: preferences.objective || legacy.objective,\n    });\n    return {\n      draft: plan.options[0]?.text || '',\n      options: plan.options,\n      stage: plan.stage,\n      stageLabel: plan.stageLabel,\n      objective: plan.objective,\n      recommendedChannel: plan.recommendedChannel,\n      recommendedStyle: plan.recommendedStyle,\n      recommendation: plan.recommendation,\n      why: plan.why,\n      tip: plan.tip,\n      nextSmallYes: plan.nextSmallYes,\n      estimatedDurationSeconds: plan.estimatedDurationSeconds || null,\n      factsUsed: plan.factsUsed,\n      tone,\n      personId: personDocumentId,\n      signalId,\n      phone: person.phone || null,\n      evidence: signal.evidence || [],\n      automaticSend: false,\n    };\n  }\n\n  async deleteSource(`);
  write(path,s);
}

// HTTP: accept explicit style/channel/objective while keeping legacy tone compatibility.
{
  const path='src/personal/radar/personalRadarHttp.ts';
  let s=read(path);
  s=replaceOnce(s,
    "import { PersonalRadarService, RadarComposerTone } from './personalRadarService';\n",
    "import { PersonalRadarService, RadarComposerTone } from './personalRadarService';\nimport { ComposerChannel, ComposerObjective, ComposerStyle } from './composerPlaybook';\n",
    'http-import');
  s=replaceOnce(s,
`        String(body.tone || 'curto') as RadarComposerTone,\n      );`,
`        String(body.tone || 'curto') as RadarComposerTone,\n        {\n          style: typeof body.style === 'string' ? body.style as ComposerStyle : undefined,\n          channel: typeof body.channel === 'string' ? body.channel as ComposerChannel : undefined,\n          objective: typeof body.objective === 'string' ? body.objective as ComposerObjective : undefined,\n        },\n      );`,
    'http-compose-call');
  write(path,s);
}

// Client: expose Composer v2 controls.
{
  const path='src/core/client/personalRadarClient.ts';
  let s=read(path);
  const old=`  async compose(personId: string, signalId: string, tone: 'curto' | 'conversa' | 'audio' | 'video') {\n    const response = await fetch('/api/personal/composer/draft', {\n      method: 'POST',\n      headers: this.headers(true),\n      body: JSON.stringify({\n        organizationId: this.session.expectedOrganizationId,\n        personId,\n        signalId,\n        tone,\n      }),\n    });\n    return parseResponse(response);\n  }`;
  const next=`  async compose(\n    personId: string,\n    signalId: string,\n    tone: 'curto' | 'conversa' | 'audio' | 'video',\n    preferences: {\n      style?: 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';\n      channel?: 'texto' | 'audio' | 'video' | 'followup';\n      objective?: 'iniciar_conversa' | 'descobrir_dor' | 'pedir_video' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';\n    } = {},\n  ) {\n    const response = await fetch('/api/personal/composer/draft', {\n      method: 'POST',\n      headers: this.headers(true),\n      body: JSON.stringify({\n        organizationId: this.session.expectedOrganizationId,\n        personId,\n        signalId,\n        tone,\n        ...preferences,\n      }),\n    });\n    return parseResponse(response);\n  }`;
  s=replaceOnce(s,old,next,'client-compose');
  write(path,s);
}

// UI: turn the existing Composer into a guided commercial copilot with 3 drafts and style controls.
{
  const path='src/features/radar/RadarPage.tsx';
  let s=read(path);
  s=replaceOnce(s,
    "type Tone = 'curto' | 'conversa' | 'audio' | 'video';\n",
    "type Tone = 'curto' | 'conversa' | 'audio' | 'video';\ntype ComposerStyle = 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';\n",
    'ui-style-type');

  s=replaceOnce(s,
    "    composerTitle: 'Composer MusicScale', tone: 'Tom', short: 'Curto', conversation: 'Conversa', audio: 'Áudio', video: 'Vídeo',\n",
    "    composerTitle: 'Composer MusicScale', tone: 'Formato', short: 'Curto', conversation: 'Conversa', audio: 'Áudio', video: 'Vídeo',\n    guidance: 'Sugestão para agora', why: 'Por quê', nextYes: 'Próximo pequeno sim', usedContext: 'Contexto usado', chooseOption: 'Escolha uma opção', style: 'Estilo',\n",
    'ui-copy-pt');
  s=replaceOnce(s,
    "    composerTitle: 'MusicScale Composer', tone: 'Tone', short: 'Short', conversation: 'Conversation', audio: 'Audio', video: 'Video',\n",
    "    composerTitle: 'MusicScale Composer', tone: 'Format', short: 'Short', conversation: 'Conversation', audio: 'Audio', video: 'Video',\n    guidance: 'Suggested next move', why: 'Why', nextYes: 'Next small yes', usedContext: 'Context used', chooseOption: 'Choose an option', style: 'Style',\n",
    'ui-copy-en');
  s=replaceOnce(s,
    "    composerTitle: 'Composer MusicScale', tone: 'Tono', short: 'Corto', conversation: 'Conversación', audio: 'Audio', video: 'Video',\n",
    "    composerTitle: 'Composer MusicScale', tone: 'Formato', short: 'Corto', conversation: 'Conversación', audio: 'Audio', video: 'Video',\n    guidance: 'Sugerencia para ahora', why: 'Por qué', nextYes: 'Próximo pequeño sí', usedContext: 'Contexto usado', chooseOption: 'Elige una opción', style: 'Estilo',\n",
    'ui-copy-es');

  s=replaceOnce(s,
    "  const [draft, setDraft] = useState('');\n  const [draftBusy, setDraftBusy] = useState(false);\n",
    "  const [draft, setDraft] = useState('');\n  const [composerPlan, setComposerPlan] = useState<any | null>(null);\n  const [composerStyle, setComposerStyle] = useState<ComposerStyle>('consultivo');\n  const [draftBusy, setDraftBusy] = useState(false);\n",
    'ui-state');

  s=replaceOnce(s,
    "      const result = await client.compose(selection.person.id, selection.signal.id, requestedTone);\n      setDraft(result.draft || '');\n",
    "      const result = await client.compose(selection.person.id, selection.signal.id, requestedTone, { style: composerStyle });\n      setComposerPlan(result);\n      setDraft(result.draft || result.options?.[0]?.text || '');\n",
    'ui-compose-call');
  s=replaceOnce(s,
    "    setDraft('');\n    setTone('curto');\n",
    "    setDraft('');\n    setComposerPlan(null);\n    setComposerStyle(signal.type === 'unanswered_conversation' || signal.type === 'recurring_relevant_topic' ? 'pastoral' : signal.type === 'commercial_followup_due' ? 'proximo' : 'consultivo');\n    setTone('curto');\n",
    'ui-open-composer');

  const marker=`<div className=\"min-w-0 flex-1\"><div className=\"min-h-24 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-100\">`;
  if(!s.includes(marker)) throw new Error('missing:ui-composer-marker');
  const insert=`<div className=\"min-w-0 flex-1\">{composerPlan && <div className=\"mb-3 grid gap-2 sm:grid-cols-3\"><div className=\"rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] p-3 sm:col-span-3\"><div className=\"text-[10px] font-semibold uppercase tracking-wider text-indigo-300\">{t.guidance} · {composerPlan.stageLabel}</div><p className=\"mt-1 text-xs leading-5 text-slate-200\">{composerPlan.recommendation}</p></div><div className=\"rounded-xl border border-white/8 bg-black/15 p-3\"><div className=\"text-[10px] font-semibold uppercase tracking-wider text-slate-500\">{t.why}</div><p className=\"mt-1 text-xs leading-5 text-slate-400\">{composerPlan.why}</p></div><div className=\"rounded-xl border border-white/8 bg-black/15 p-3\"><div className=\"text-[10px] font-semibold uppercase tracking-wider text-slate-500\">{t.nextYes}</div><p className=\"mt-1 text-xs leading-5 text-slate-400\">{composerPlan.nextSmallYes}</p></div><div className=\"rounded-xl border border-white/8 bg-black/15 p-3\"><div className=\"text-[10px] font-semibold uppercase tracking-wider text-slate-500\">Dica</div><p className=\"mt-1 text-xs leading-5 text-slate-400\">{composerPlan.tip}</p></div></div>}<div className=\"mb-3\"><div className=\"text-[10px] font-semibold uppercase tracking-wider text-slate-500\">{t.style}</div><div className=\"mt-2 flex flex-wrap gap-1.5\">{([['amigavel','Amigável'],['profissional','Profissional'],['descontraido','Descontraído'],['objetivo','Objetivo'],['proximo','Próximo'],['pastoral','Pastoral'],['consultivo','Consultivo']] as Array<[ComposerStyle,string]>).map(([value,label]) => <button key={value} onClick={() => { setComposerStyle(value); setTimeout(() => void compose(selected, tone), 0); }} className={\`rounded-lg px-2.5 py-1.5 text-xs \${composerStyle === value ? 'bg-white text-slate-950' : 'bg-white/5 text-slate-400'}\`}>{label}</button>)}</div></div>{composerPlan?.options?.length > 1 && <div className=\"mb-3\"><div className=\"text-[10px] font-semibold uppercase tracking-wider text-slate-500\">{t.chooseOption}</div><div className=\"mt-2 grid gap-2\">{composerPlan.options.map((option:any,index:number) => <button key={option.id || index} onClick={() => setDraft(option.text)} className={\`rounded-xl border p-3 text-left text-xs leading-5 \${draft === option.text ? 'border-indigo-400/40 bg-indigo-400/[0.07] text-slate-100' : 'border-white/8 bg-black/15 text-slate-400'}\`}><span className=\"mr-2 font-semibold text-indigo-300\">{index + 1}.</span>{option.text}</button>)}</div></div>}<div className=\"min-h-24 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-100\">`;
  s=s.replace(marker,insert);
  write(path,s);
}

// Tests: make the Radar suite verify the full composer contract.
{
  const path='src/tests/composerPlaybook.test.ts';
  write(path,`import { buildComposerPlan } from '../personal/radar/composerPlaybook';\nimport { RadarSignal } from '../personal/radar/radarSignals';\n\nlet passed=0; let total=0;\nfunction assert(value:unknown,message:string){ total++; if(!value) throw new Error(message); passed++; }\nconst signal: RadarSignal = { id:'s1', type:'explicit_product_interest', reason:'fit', nextAction:'ask', evidence:[{messageIndex:1,dateKey:'2026-09-10',sender:'Pr. João',snippet:'A escala do louvor e as cifras ficam todas espalhadas no WhatsApp.'}] };\nconst plan=buildComposerPlan({ person:{displayName:'Pr. João'}, signal });\nassert(plan.options.length===3,'generates three message options');\nassert(plan.stage===2,'fit starts with discovery instead of product dump');\nassert(plan.recommendedStyle==='consultivo','fit defaults to consultative style');\nassert(plan.recommendation.includes('Não apresente'),'recommends discovery before presentation');\nassert(plan.factsUsed.length===1,'shows facts used');\nassert(plan.nextSmallYes.length>10,'explains next small yes');\nconst audio=buildComposerPlan({person:{displayName:'João'},signal,channel:'audio',style:'proximo'});\nassert(audio.options.length===3,'audio generates three options');\nassert(audio.estimatedDurationSeconds===30,'audio includes estimated duration');\nassert(audio.tip.includes('pausas'),'audio guidance stays conversational');\nconst pastoral: RadarSignal={...signal,id:'s2',type:'unanswered_conversation'};\nassert(buildComposerPlan({person:{displayName:'Pr. Carlos'},signal:pastoral}).recommendedStyle==='pastoral','pastoral contact defaults to pastoral style');\nconst video=buildComposerPlan({person:{displayName:'João'},signal,objective:'pedir_video'});\nassert(video.stage===4 && video.options.every(o=>/vídeo/i.test(o.text)),'permission stage asks before video');\nconst trial=buildComposerPlan({person:{displayName:'João'},signal,objective:'convidar_trial'});\nassert(trial.stage===8 && trial.options.every(o=>/7 dias/i.test(o.text)),'trial stage uses seven-day real-organization test');\nconsole.log(\`✅ Composer Playbook: \${passed} / \${total}\`);\n`);

  const pkg='package.json';
  let p=read(pkg);
  p=replaceOnce(p,
    '"test:radar-pilot": "tsx src/tests/personalRadarSignals.test.ts && tsx src/tests/personalRadarService.test.ts"',
    '"test:radar-pilot": "tsx src/tests/personalRadarSignals.test.ts && tsx src/tests/personalRadarService.test.ts && tsx src/tests/composerPlaybook.test.ts"',
    'package-radar-test');
  write(pkg,p);
}
