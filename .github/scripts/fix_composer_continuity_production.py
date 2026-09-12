from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor {label} in {path}")
    p.write_text(text.replace(old, new, 1))

composer = "src/personal/radar/composerPlaybook.ts"
radar = "src/features/radar/RadarPage.tsx"
test = "src/tests/composerPlaybook.test.ts"

# Relationship state becomes part of the Composer input so it can distinguish
# a true first outreach from a second/third/fourth contact.
replace_once(
    composer,
    "type PersonLike = {\n  displayName?: unknown;\n  signals?: unknown;\n};",
    "type PersonLike = {\n  displayName?: unknown;\n  signals?: unknown;\n  lastCommercialAction?: unknown;\n  lastCommercialAt?: unknown;\n  salesStage?: unknown;\n};\n\nfunction hasConversationContinuity(person: PersonLike, signal: RadarSignal): boolean {\n  const stage = String(person.salesStage || '').trim();\n  return Boolean(person.lastCommercialAction)\n    || Boolean(person.lastCommercialAt)\n    || (stage.length > 0 && stage !== 'iniciar_conversa')\n    || signal.type === 'commercial_followup_due';\n}",
    "person continuity fields",
)

replace_once(
    composer,
    "function greeting(name: string, style: ComposerStyle): string {\n  if (style === 'amigavel') return name ? `E aí, ${name}! Tudo bem?` : 'E aí! Tudo bem?';\n  if (style === 'profissional') return name ? `Olá, ${name}. Tudo bem?` : 'Olá. Tudo bem?';\n  if (style === 'descontraido') return name ? `Fala, ${name}! Beleza?` : 'Fala! Beleza?';\n  if (style === 'objetivo') return name ? `${name},` : 'Direto ao ponto:';\n  if (style === 'proximo') return name ? `Oi, ${name}! Tudo bem por aí?` : 'Oi! Tudo bem por aí?';\n  if (style === 'pastoral') return name ? `Paz, ${name}! Tudo bem?` : 'Paz! Tudo bem?';\n  if (style === 'consultivo') return name ? `${name}, tudo bem?` : 'Tudo bem?';\n  return name ? `Oi, ${name}! Tudo bem?` : 'Oi! Tudo bem?';\n}",
    "function greeting(name: string, style: ComposerStyle, continuation = false): string {\n  if (continuation) return name ? `${name},` : '';\n  if (style === 'amigavel') return name ? `E aí, ${name}! Tudo bem?` : 'E aí! Tudo bem?';\n  if (style === 'profissional') return name ? `Olá, ${name}. Tudo bem?` : 'Olá. Tudo bem?';\n  if (style === 'descontraido') return name ? `Fala, ${name}! Beleza?` : 'Fala! Beleza?';\n  if (style === 'objetivo') return name ? `${name},` : 'Direto ao ponto:';\n  if (style === 'proximo') return name ? `Oi, ${name}! Tudo bem por aí?` : 'Oi! Tudo bem por aí?';\n  if (style === 'pastoral') return name ? `Paz, ${name}! Tudo bem?` : 'Paz! Tudo bem?';\n  if (style === 'consultivo') return name ? `${name}, tudo bem?` : 'Tudo bem?';\n  return name ? `Oi, ${name}! Tudo bem?` : 'Oi! Tudo bem?';\n}",
    "continuation-aware greeting",
)

for fn in ["openingVariants", "permissionVariants", "videoSendVariants", "diagnosticVariants", "focusedVariants", "followupVariants", "audioVariants"]:
    replace_once(
        composer,
        f"function {fn}(name: string, signal: RadarSignal, style: ComposerStyle): string[] {{\n  const g = greeting(name, style);",
        f"function {fn}(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {{\n  const g = greeting(name, style, continuation);",
        fn,
    )
for fn in ["trialVariants", "closingVariants"]:
    replace_once(
        composer,
        f"function {fn}(name: string, style: ComposerStyle): string[] {{\n  const g = greeting(name, style);",
        f"function {fn}(name: string, style: ComposerStyle, continuation = false): string[] {{\n  const g = greeting(name, style, continuation);",
        fn,
    )

replace_once(
    composer,
    "function openingVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {\n  const g = greeting(name, style, continuation);\n  const t = topic(signal);",
    "function openingVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {\n  const g = greeting(name, style, continuation);\n  const t = topic(signal);\n  if (continuation) {\n    return [\n      `${g} Voltando naquele ponto sobre ${t}: como isso está por aí agora?`,\n      `${g} Fiquei pensando no que a gente falou sobre ${t}. O que está pesando mais nessa parte hoje?`,\n      `${g} Sobre nossa conversa de ${t}: isso ainda continua sendo uma dificuldade para vocês?`,\n    ].map(text => soften(style, text.trim()));\n  }",
    "continuation opening copy",
)

# Video scripts have a hard-coded greeting rather than greeting(), so give them
# the same continuity semantics without losing the richer production scripts.
replace_once(
    composer,
    "function videoScriptVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {\n  const t = topic(signal);\n  const who = name ? `, ${name}` : '';\n  return [\n    `Oi${who}! Gravei rapidinho porque é mais fácil te mostrar. O MusicScale nasceu da nossa própria rotina de igreja. Aqui a equipe recebe a escala, vê repertório, cifras e tons e confirma presença sem depender de mensagem perdida. Pensando no que você comentou sobre ${t}, olha como essa parte fica organizada.`,\n    `Oi${who}! Em menos de meio minuto eu quero te mostrar só uma coisa. A gente tinha muita informação espalhada no WhatsApp e criou o MusicScale para centralizar a rotina do louvor. Repara especialmente nessa parte de ${t}, porque foi exatamente o ponto que lembrei da nossa conversa.`,\n    `Oi${who}! Vou te mostrar sem apresentação comercial, só na prática. Aqui está uma escala real: equipe, músicas, cifras, tons e confirmação num lugar só. Pelo que você falou sobre ${t}, acho que essa é a parte que mais vale você olhar primeiro.`,\n  ].map(text => soften(style, text));\n}",
    "function videoScriptVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {\n  const t = topic(signal);\n  const who = name ? `, ${name}` : '';\n  const prefix = continuation ? (name ? `${name}, ` : '') : `Oi${who}! `;\n  return [\n    `${prefix}Pegando o gancho do que a gente falou: gravei rapidinho porque é mais fácil te mostrar. O MusicScale nasceu da nossa própria rotina de igreja. Aqui a equipe recebe a escala, vê repertório, cifras e tons e confirma presença sem depender de mensagem perdida. Pensando no que você comentou sobre ${t}, olha como essa parte fica organizada.`,\n    `${prefix}Como a gente já estava falando sobre ${t}, quero te mostrar só essa parte. A gente tinha muita informação espalhada no WhatsApp e criou o MusicScale para centralizar a rotina do louvor.`,\n    `${prefix}Continuando nossa conversa, vou te mostrar sem apresentação comercial, só na prática. Aqui está uma escala real: equipe, músicas, cifras, tons e confirmação num lugar só. Pelo que você falou sobre ${t}, essa é a parte que mais vale olhar primeiro.`,\n  ].map(text => soften(style, text.trim()));\n}",
    "continuation video script",
)

replace_once(
    composer,
    "  const style = input.style || defaultStyle(input.signal);\n  const name = firstName(input.person.displayName);",
    "  const style = input.style || defaultStyle(input.signal);\n  const continuation = hasConversationContinuity(input.person, input.signal);\n  const name = firstName(input.person.displayName);",
    "continuation calculation",
)

# Adapt every production stage, including video and diagnosis, to continuity.
repls = [
    ("texts = audioVariants(name, input.signal, style);", "texts = audioVariants(name, input.signal, style, continuation);"),
    ("texts = videoScriptVariants(name, input.signal, style);", "texts = videoScriptVariants(name, input.signal, style, continuation);"),
    ("texts = videoSendVariants(name, input.signal, style);", "texts = videoSendVariants(name, input.signal, style, continuation);"),
    ("texts = diagnosticVariants(name, input.signal, style);", "texts = diagnosticVariants(name, input.signal, style, continuation);"),
    ("texts = permissionVariants(name, input.signal, style);", "texts = permissionVariants(name, input.signal, style, continuation);"),
    ("texts = focusedVariants(name, input.signal, style);", "texts = focusedVariants(name, input.signal, style, continuation);"),
    ("texts = trialVariants(name, style);", "texts = trialVariants(name, style, continuation);"),
    ("texts = followupVariants(name, input.signal, style);", "texts = followupVariants(name, input.signal, style, true);"),
    ("texts = closingVariants(name, style);", "texts = closingVariants(name, style, true);"),
    ("texts = openingVariants(name, input.signal, style);", "texts = openingVariants(name, input.signal, style, continuation);"),
]
for old, new in repls:
    # audioVariants occurs twice in production. Replace all occurrences safely.
    p = Path(composer)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing composer call {old}")
    p.write_text(text.replace(old, new))

replace_once(
    composer,
    "  const recommendation = stage <= 2\n    ? 'Comece com uma pergunta curta. Não apresente o MusicScale inteiro ainda.'",
    "  const recommendation = stage <= 2\n    ? continuation\n      ? 'Continue do ponto anterior. Não cumprimente como se fosse uma conversa nova e faça só uma pergunta por vez.'\n      : 'Comece com uma pergunta curta. Não apresente o MusicScale inteiro ainda.'",
    "continuation recommendation",
)
replace_once(
    composer,
    "  const why = hasProductInterest(input.signal)",
    "  const why = continuation\n    ? `Já existe contato anterior registrado. A mensagem deve continuar a conversa sobre ${t}, sem reiniciar com outro cumprimento.`\n    : hasProductInterest(input.signal)",
    "continuation why",
)

# Production already supports commercialAction in both client and backend.
# Record user intent when copy/WhatsApp are used, so the next generated message
# knows that this is no longer a cold first contact.
replace_once(
    radar,
    "<button onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); }} disabled={!draft}",
    "<button onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); await patchPerson(selected.person, { commercialAction: 'copied' }); }} disabled={!draft}",
    "copy action tracking",
)
replace_once(
    radar,
    "<button onClick={() => window.open(`https://wa.me/${(phones[selected.person.id] || '').replace(/\\D/g, '')}?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer')} disabled={!draft}",
    "<button onClick={() => { window.open(`https://wa.me/${(phones[selected.person.id] || '').replace(/\\D/g, '')}?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer'); void patchPerson(selected.person, { commercialAction: 'whatsapp_opened' }); }} disabled={!draft}",
    "whatsapp action tracking",
)

replace_once(
    radar,
    "    setSelected(selection); setDraft(''); setComposerPlan(null); setTone('curto');\n    const initialStyle: ComposerStyle = signal.type === 'unanswered_conversation' || signal.type === 'recurring_relevant_topic'\n      ? 'pastoral' : signal.type === 'commercial_followup_due' ? 'proximo' : 'consultivo';\n    setComposerStyle(initialStyle);\n    setTimeout(() => void compose(selection, 'curto', initialStyle), 0);",
    "    setSelected(selection); setDraft(''); setComposerPlan(null); setTone('curto');\n    const initialStyle: ComposerStyle = signal.type === 'unanswered_conversation' || signal.type === 'recurring_relevant_topic'\n      ? 'pastoral' : signal.type === 'commercial_followup_due' ? 'proximo' : 'consultivo';\n    const hasPriorContact = Boolean(person.lastCommercialAction || person.lastCommercialAt)\n      || (Boolean(person.salesStage) && person.salesStage !== 'iniciar_conversa')\n      || signal.type === 'commercial_followup_due';\n    const initialObjective: ComposerObjective = hasPriorContact ? 'retomar_conversa' : 'iniciar_conversa';\n    setComposerStyle(initialStyle);\n    setComposerObjective(initialObjective);\n    setTimeout(() => void compose(selection, 'curto', initialStyle, initialObjective), 0);",
    "contextual composer objective",
)

# Regression tests: first contact retains its chosen voice; later contacts must
# continue existing context instead of greeting again as if they were new.
p = Path(test)
s = p.read_text()
addition = """
const continued=buildComposerPlan({person:{displayName:'João',lastCommercialAction:'whatsapp_opened',lastCommercialAt:'2026-09-12T12:00:00Z'},signal,style:'amigavel'});
assert(continued.options.every(option=>!/^E aí|^Oi[,!]|^Olá[,!]|^Fala[,!]|^Paz[,!]/i.test(option.text)),'later contacts do not restart with a first-contact greeting');
assert(continued.options.some(option=>/Voltando|Fiquei pensando|nossa conversa/i.test(option.text)),'later contacts explicitly continue prior context');
assert(continued.recommendation.includes('Continue do ponto anterior'),'continuation guidance tells Composer not to restart the conversation');
const continuedVideo=buildComposerPlan({person:{displayName:'João',lastCommercialAction:'whatsapp_opened'},signal,objective:'enviar_video',channel:'video',style:'amigavel'});
assert(continuedVideo.options.every(option=>!/^Oi[,!]/i.test(option.text)),'later video contact does not restart with Oi');
"""
anchor = "console.log(`✅ Composer Playbook: ${passed} / ${total}`);"
if anchor not in s:
    raise SystemExit("composer test anchor missing")
p.write_text(s.replace(anchor, addition + anchor, 1))
