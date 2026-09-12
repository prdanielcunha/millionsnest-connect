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

replace_once(composer,
"type PersonLike = {\n  displayName?: unknown;\n  signals?: unknown;\n};",
"type PersonLike = {\n  displayName?: unknown;\n  signals?: unknown;\n  lastCommercialAction?: unknown;\n  lastCommercialAt?: unknown;\n  salesStage?: unknown;\n};\n\nfunction hasConversationContinuity(person: PersonLike, signal: RadarSignal): boolean {\n  const stage = String(person.salesStage || '').trim();\n  return Boolean(person.lastCommercialAction)\n    || Boolean(person.lastCommercialAt)\n    || (stage.length > 0 && stage !== 'iniciar_conversa')\n    || signal.type === 'commercial_followup_due';\n}", "person continuity fields")

replace_once(composer,
"function greeting(name: string, style: ComposerStyle): string {\n  if (style === 'pastoral') return name ? `Olá, ${name}! Tudo bem?` : 'Olá! Tudo bem?';\n  if (style === 'descontraido') return name ? `Ô, ${name}!` : 'Oi!';\n  return name ? `Oi, ${name}! Tudo bem?` : 'Oi! Tudo bem?';\n}",
"function greeting(name: string, style: ComposerStyle, continuation = false): string {\n  if (continuation) return name ? `${name},` : '';\n  if (style === 'pastoral') return name ? `Olá, ${name}! Tudo bem?` : 'Olá! Tudo bem?';\n  if (style === 'descontraido') return name ? `Ô, ${name}!` : 'Oi!';\n  return name ? `Oi, ${name}! Tudo bem?` : 'Oi! Tudo bem?';\n}", "continuation greeting")

for fn in ["openingVariants", "permissionVariants", "focusedVariants", "followupVariants", "audioVariants"]:
    replace_once(composer,
        f"function {fn}(name: string, signal: RadarSignal, style: ComposerStyle): string[] {{\n  const g = greeting(name, style);",
        f"function {fn}(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {{\n  const g = greeting(name, style, continuation);",
        fn)
for fn in ["trialVariants", "closingVariants"]:
    replace_once(composer,
        f"function {fn}(name: string, style: ComposerStyle): string[] {{\n  const g = greeting(name, style);",
        f"function {fn}(name: string, style: ComposerStyle, continuation = false): string[] {{\n  const g = greeting(name, style, continuation);",
        fn)

replace_once(composer,
"function openingVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {\n  const g = greeting(name, style, continuation);\n  const t = topic(signal);",
"function openingVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {\n  const g = greeting(name, style, continuation);\n  const t = topic(signal);\n  if (continuation) {\n    return [\n      `${g} Voltando naquele ponto sobre ${t}: como isso está por aí agora?`,\n      `${g} Fiquei pensando no que a gente falou sobre ${t}. O que está pesando mais nessa parte hoje?`,\n      `${g} Sobre nossa conversa de ${t}: isso ainda continua sendo uma dificuldade para vocês?`,\n    ].map(text => soften(style, text.trim()));\n  }",
"continuation opening copy")

replace_once(composer,
"  const style = input.style || defaultStyle(input.signal);\n  const name = firstName(input.person.displayName);",
"  const style = input.style || defaultStyle(input.signal);\n  const continuation = hasConversationContinuity(input.person, input.signal);\n  const name = firstName(input.person.displayName);",
"continuation calculation")

replacements = {
"texts = audioVariants(name, input.signal, style);":"texts = audioVariants(name, input.signal, style, continuation);",
"texts = permissionVariants(name, input.signal, style);":"texts = permissionVariants(name, input.signal, style, continuation);",
"texts = focusedVariants(name, input.signal, style);":"texts = focusedVariants(name, input.signal, style, continuation);",
"texts = trialVariants(name, style);":"texts = trialVariants(name, style, continuation);",
"texts = followupVariants(name, input.signal, style);":"texts = followupVariants(name, input.signal, style, true);",
"texts = closingVariants(name, style);":"texts = closingVariants(name, style, true);",
"texts = openingVariants(name, input.signal, style);":"texts = openingVariants(name, input.signal, style, continuation);",
}
for old, new in replacements.items():
    replace_once(composer, old, new, old)

replace_once(composer,
"  const recommendation = stage <= 2\n    ? 'Comece com uma pergunta curta. Não apresente o MusicScale inteiro ainda.'",
"  const recommendation = stage <= 2\n    ? continuation\n      ? 'Continue do ponto anterior. Não cumprimente como se fosse uma conversa nova e faça só uma pergunta por vez.'\n      : 'Comece com uma pergunta curta. Não apresente o MusicScale inteiro ainda.'",
"continuation recommendation")

replace_once(composer,
"  const why = hasProductInterest(input.signal)",
"  const why = continuation\n    ? `Já existe contato anterior registrado. A mensagem deve continuar a conversa sobre ${t}, sem reiniciar com outro cumprimento.`\n    : hasProductInterest(input.signal)",
"continuation why")

# Track Composer actions so later generations know this is no longer a first contact.
replace_once(radar,
"<button onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); }} disabled={!draft}",
"<button onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); await patchPerson(selected.person, { commercialAction: 'copied' }); }} disabled={!draft}",
"copy tracking")
replace_once(radar,
"<button onClick={() => window.open(`https://wa.me/${(phones[selected.person.id] || '').replace(/\\D/g, '')}?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer')} disabled={!draft}",
"<button onClick={() => { window.open(`https://wa.me/${(phones[selected.person.id] || '').replace(/\\D/g, '')}?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer'); void patchPerson(selected.person, { commercialAction: 'whatsapp_opened' }); }} disabled={!draft}",
"whatsapp tracking")

p = Path(test)
s = p.read_text()
addition = """
const continued=buildComposerPlan({person:{displayName:'João',lastCommercialAction:'whatsapp_opened',lastCommercialAt:'2026-09-12T12:00:00Z'},signal,style:'amigavel'});
assert(continued.options.every(option=>!/^Oi[,!]|^Olá[,!]|^Ô,/.test(option.text)),'later contacts do not restart with a first-contact greeting');
assert(continued.options.some(option=>/Voltando|Fiquei pensando|nossa conversa/i.test(option.text)),'later contacts explicitly continue prior context');
assert(continued.recommendation.includes('Continue do ponto anterior'),'continuation guidance tells Composer not to restart the conversation');
"""
anchor = "console.log(`✅ Composer Playbook: ${passed} / ${total}`);"
if anchor not in s:
    raise SystemExit("test anchor missing")
p.write_text(s.replace(anchor, addition + anchor, 1))
