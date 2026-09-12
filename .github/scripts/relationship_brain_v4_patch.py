from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor {label} in {path}")
    p.write_text(text.replace(old, new, 1))

composer = "src/personal/radar/composerPlaybook.ts"
service = "src/personal/radar/personalRadarService.ts"
client = "src/core/client/personalRadarClient.ts"
radar = "src/features/radar/RadarPage.tsx"
sources = "src/features/sources/PersonalSourcesPage.tsx"
people = "src/features/contacts/LivePeoplePage.tsx"
test = "src/tests/composerPlaybook.test.ts"

# --- Relationship Brain ---------------------------------------------------
replace_once(
    composer,
    "  factsUsed: string[];\n  options: ComposerOption[];",
    "  factsUsed: string[];\n  relationship: RelationshipComposerContext;\n  options: ComposerOption[];",
    "composer plan relationship field",
)

replace_once(
    composer,
    "type PersonLike = {\n  displayName?: unknown;\n  signals?: unknown;\n  lastCommercialAction?: unknown;\n  lastCommercialAt?: unknown;\n  salesStage?: unknown;\n};\n\nfunction hasConversationContinuity(person: PersonLike, signal: RadarSignal): boolean {\n  const stage = String(person.salesStage || '').trim();\n  return Boolean(person.lastCommercialAction)\n    || Boolean(person.lastCommercialAt)\n    || (stage.length > 0 && stage !== 'iniciar_conversa')\n    || signal.type === 'commercial_followup_due';\n}",
    """type PersonLike = {
  displayName?: unknown;
  signals?: unknown;
  lastCommercialAction?: unknown;
  lastCommercialAt?: unknown;
  lastCommercialDraft?: unknown;
  salesStage?: unknown;
  followUpAt?: unknown;
  lastDateKey?: unknown;
  messageCount?: unknown;
  recentConversationMessages?: unknown;
};

export type RelationshipComposerContext = {
  state: 'first_contact' | 'active_reply' | 'waiting_reply' | 'followup_due' | 'dormant' | 'continuation';
  continuation: boolean;
  respondedAfterLastContact: boolean;
  followUpDue: boolean;
  daysSinceLastContact: number | null;
  previousAction: string | null;
  previousStage: string | null;
  latestInboundDateKey: string | null;
  latestInboundSnippet: string | null;
  hasPreviousDraft: boolean;
  suggestedObjective: ComposerObjective;
};

function cleanRecentMessages(value: unknown): Array<{ dateKey: string; snippet: string }> {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    dateKey: String((item as any)?.dateKey || ''),
    snippet: String((item as any)?.snippet || (item as any)?.text || '').replace(/\\s+/g, ' ').trim().slice(0, 280),
  })).filter(item => item.dateKey || item.snippet).slice(0, 8);
}

function buildRelationshipContext(person: PersonLike, signal: RadarSignal): RelationshipComposerContext {
  const now = Date.now();
  const previousAction = String(person.lastCommercialAction || '').trim() || null;
  const previousStage = String(person.salesStage || '').trim() || null;
  const lastCommercialAt = String(person.lastCommercialAt || '').trim();
  const contactMs = Date.parse(lastCommercialAt);
  const daysSinceLastContact = Number.isFinite(contactMs)
    ? Math.max(0, Math.floor((now - contactMs) / 86_400_000))
    : null;
  const followMs = Date.parse(String(person.followUpAt || ''));
  const followUpDue = Number.isFinite(followMs) && followMs <= now;
  const recent = cleanRecentMessages(person.recentConversationMessages);
  const latest = recent[0] || null;
  const latestInboundDateKey = latest?.dateKey || (String(person.lastDateKey || '').trim() || null);
  const latestInboundSnippet = latest?.snippet || null;
  const commercialDay = lastCommercialAt ? lastCommercialAt.slice(0, 10) : '';
  const respondedAfterLastContact = Boolean(commercialDay && latestInboundDateKey && latestInboundDateKey > commercialDay);
  const continuation = Boolean(previousAction)
    || Boolean(lastCommercialAt)
    || Boolean(previousStage && previousStage !== 'iniciar_conversa')
    || signal.type === 'commercial_followup_due';

  let state: RelationshipComposerContext['state'] = 'first_contact';
  if (continuation) {
    if (respondedAfterLastContact) state = 'active_reply';
    else if (followUpDue || signal.type === 'commercial_followup_due') state = 'followup_due';
    else if (previousAction === 'sent_manual') state = 'waiting_reply';
    else if (daysSinceLastContact !== null && daysSinceLastContact >= 21) state = 'dormant';
    else state = 'continuation';
  }

  let suggestedObjective: ComposerObjective;
  if (!continuation) suggestedObjective = hasProductInterest(signal) ? 'descobrir_dor' : 'iniciar_conversa';
  else if (respondedAfterLastContact) suggestedObjective = 'descobrir_dor';
  else if (previousStage === 'convidar_trial' || previousStage === 'acompanhar_trial') suggestedObjective = 'acompanhar_trial';
  else if (followUpDue || state === 'waiting_reply' || state === 'dormant') suggestedObjective = 'retomar_conversa';
  else suggestedObjective = previousStage && previousStage !== 'iniciar_conversa'
    ? previousStage as ComposerObjective
    : 'retomar_conversa';

  return {
    state,
    continuation,
    respondedAfterLastContact,
    followUpDue,
    daysSinceLastContact,
    previousAction,
    previousStage,
    latestInboundDateKey,
    latestInboundSnippet,
    hasPreviousDraft: Boolean(String(person.lastCommercialDraft || '').trim()),
    suggestedObjective,
  };
}

function hasConversationContinuity(person: PersonLike, signal: RadarSignal): boolean {
  return buildRelationshipContext(person, signal).continuation;
}

function normalizedTokens(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9\\s]/g, ' ').split(/\\s+/).filter(token => token.length > 2));
}

function textSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  const a = normalizedTokens(left);
  const b = normalizedTokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / new Set([...a, ...b]).size;
}

function rankNovelOptions(texts: string[], previousDraft: unknown): string[] {
  const previous = String(previousDraft || '').trim();
  if (!previous) return texts;
  return [...texts].sort((a, b) => textSimilarity(a, previous) - textSimilarity(b, previous));
}

function adaptContinuationTiming(text: string, relationship: RelationshipComposerContext): string {
  if (!relationship.continuation) return text;
  const days = relationship.daysSinceLastContact;
  if (days !== null && days >= 21) {
    return text.replace(/Voltando naquele ponto/gi, 'Faz um tempinho desde nossa conversa; voltando naquele ponto')
      .replace(/Passando só para retomar/gi, 'Faz um tempinho desde nossa conversa; retomando');
  }
  if (days !== null && days <= 1) {
    return text.replace(/Voltando naquele ponto/gi, 'Pegando o gancho daquele ponto')
      .replace(/Passando só para retomar/gi, 'Pegando o gancho do que a gente estava falando');
  }
  return text;
}""",
    "relationship context engine",
)

replace_once(
    composer,
    "}): ComposerPlan {\n  const stage = resolveStage(input.signal, input.objective);\n  const objective = input.objective || defaultObjective(stage);\n  const style = input.style || defaultStyle(input.signal);\n  const continuation = hasConversationContinuity(input.person, input.signal);\n  const name = firstName(input.person.displayName);\n  const t = topic(input.signal);\n  const channel: ComposerChannel = input.channel || (objective === 'retomar_conversa' ? 'followup' : 'texto');",
    """}): ComposerPlan {
  const relationship = buildRelationshipContext(input.person, input.signal);
  const requestedObjective = input.objective;
  const objective = relationship.continuation && requestedObjective === 'iniciar_conversa'
    ? relationship.suggestedObjective
    : requestedObjective || relationship.suggestedObjective;
  const stage = resolveStage(input.signal, objective);
  const style = input.style || defaultStyle(input.signal);
  const continuation = relationship.continuation;
  const name = firstName(input.person.displayName);
  const t = topic(input.signal);
  const channel: ComposerChannel = input.channel || (objective === 'retomar_conversa' ? 'followup' : 'texto');""",
    "smart objective selection",
)

replace_once(
    composer,
    "  const factsUsed = input.signal.evidence.slice(0, 3).map(item => `${item.dateKey}: ${item.snippet}`);\n  const recommendation = stage <= 2",
    """  texts = rankNovelOptions(
    texts.map(text => adaptContinuationTiming(text.trim(), relationship)),
    input.person.lastCommercialDraft,
  );

  const factsUsed = input.signal.evidence.slice(0, 4).map(item => `${item.dateKey}: ${item.snippet}`);
  if (relationship.previousAction && input.person.lastCommercialAt) {
    factsUsed.unshift(`Última ação registrada: ${relationship.previousAction} · ${String(input.person.lastCommercialAt).slice(0, 10)}`);
  }
  if (relationship.hasPreviousDraft) factsUsed.unshift('A mensagem anterior está registrada para evitar repetição de abordagem.');
  const continuityRecommendation = relationship.state === 'active_reply'
    ? 'A pessoa falou novamente depois do último contato registrado. Continue a partir do que ela trouxe; não volte para uma abertura fria.'
    : relationship.state === 'followup_due'
      ? 'O follow-up chegou. Retome o ponto anterior com naturalidade, sem repetir saudação ou a mesma pergunta.'
      : relationship.state === 'waiting_reply'
        ? 'Já houve envio registrado. Evite repetir a mensagem anterior e faça um follow-up leve, com uma única pergunta.'
        : relationship.state === 'dormant'
          ? 'Faz tempo desde o último contato. Reative o contexto sem fingir intimidade e sem começar do zero.'
          : 'Continue exatamente do ponto anterior, sem novo cumprimento de primeiro contato e sem repetir a pergunta já usada.';
  const recommendation = stage <= 2""",
    "relationship facts and recommendation",
)

replace_once(
    composer,
    "      ? 'Continue do ponto anterior. Não cumprimente como se fosse uma conversa nova e faça só uma pergunta por vez.'",
    "      ? continuityRecommendation",
    "continuity recommendation usage",
)

replace_once(
    composer,
    "  const why = continuation\n    ? `Já existe contato anterior registrado. A mensagem deve continuar a conversa sobre ${t}, sem reiniciar com outro cumprimento.`",
    """  const why = continuation
    ? relationship.respondedAfterLastContact
      ? `Há uma mensagem mais recente no histórico depois do último contato registrado. O Composer usa esse contexto sobre ${t} e evita reiniciar a conversa.`
      : relationship.followUpDue
        ? `O acompanhamento está no prazo ou vencido. A mensagem retoma ${t} sem repetir uma abertura de primeiro contato.`
        : `Já existe contato anterior registrado. A mensagem continua a conversa sobre ${t}, considera a etapa anterior e evita repetir a abordagem.`""",
    "smart why",
)

replace_once(
    composer,
    "    factsUsed,\n    options: texts.slice(0, 3).map((text, index) => ({",
    "    factsUsed: factsUsed.slice(0, 6),\n    relationship,\n    options: texts.slice(0, 3).map((text, index) => ({",
    "return relationship context",
)

# --- Backend context retrieval + draft memory -----------------------------
replace_once(
    service,
    "      commercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied';\n      followUpDays?: number;",
    "      commercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied';\n      commercialDraft?: string;\n      followUpDays?: number;",
    "service commercial draft input",
)

replace_once(
    service,
    "    if (input.salesStage !== undefined && !SALES_STAGES.has(input.salesStage)) throw new Error('SALES_STAGE_INVALID');\n    if (input.commercialAction !== undefined && !COMMERCIAL_ACTIONS.has(input.commercialAction)) throw new Error('COMMERCIAL_ACTION_INVALID');\n\n    const commercialAt = input.commercialAction ? isoNow(this.now) : (person.lastCommercialAt || null);",
    """    if (input.salesStage !== undefined && !SALES_STAGES.has(input.salesStage)) throw new Error('SALES_STAGE_INVALID');
    if (input.commercialAction !== undefined && !COMMERCIAL_ACTIONS.has(input.commercialAction)) throw new Error('COMMERCIAL_ACTION_INVALID');
    const commercialDraft = input.commercialDraft === undefined ? undefined : String(input.commercialDraft || '').trim();
    if (input.commercialDraft !== undefined && (!commercialDraft || commercialDraft.length > 4_000)) throw new Error('COMMERCIAL_DRAFT_INVALID');

    const commercialAt = input.commercialAction ? isoNow(this.now) : (person.lastCommercialAt || null);""",
    "service commercial draft validation",
)

replace_once(
    service,
    "      lastCommercialAction: input.commercialAction === undefined ? person.lastCommercialAction || null : input.commercialAction,\n      lastCommercialAt: commercialAt,\n      followUpAt,",
    "      lastCommercialAction: input.commercialAction === undefined ? person.lastCommercialAction || null : input.commercialAction,\n      lastCommercialAt: commercialAt,\n      lastCommercialDraft: commercialDraft === undefined ? person.lastCommercialDraft || null : commercialDraft,\n      followUpAt,",
    "persist last commercial draft",
)

replace_once(
    service,
    "  async compose(\n    request: RadarRequestContext,",
    """  private async loadComposerConversationContext(
    request: RadarRequestContext,
    actorUid: string,
    person: Record<string, unknown>,
  ): Promise<Array<{ dateKey: string; timestampLocal: string; sender: string; snippet: string }>> {
    const sourceIds = uniqueStrings(person.sourceIds, person.sourceId).slice(0, 8);
    const aliases = new Set(uniqueStrings(person.displayName, person.probableName, person.identityAliases)
      .map(normalizeIdentityName).filter(Boolean));
    const phone = normalizePhone(person.phone);
    const authored: Array<{ dateKey: string; timestampLocal: string; sender: string; snippet: string }> = [];

    for (const sourceId of sourceIds) {
      const chunks = await this.vault.list(request.authToken, actorUid, ['personalConversations', sourceId, 'messageChunks'], 120);
      for (const chunk of chunks) {
        const messages = Array.isArray(chunk.messages) ? chunk.messages as Array<Record<string, unknown>> : [];
        for (const message of messages) {
          const sender = String(message.sender || '');
          const senderName = normalizeIdentityName(sender);
          const senderPhone = normalizePhone(sender);
          if (!aliases.has(senderName) && !(phone && senderPhone && phone === senderPhone)) continue;
          const snippet = String(message.text || '').replace(/\\s+/g, ' ').trim().slice(0, 320);
          if (!snippet) continue;
          authored.push({
            dateKey: String(message.dateKey || ''),
            timestampLocal: String(message.timestampLocal || ''),
            sender,
            snippet,
          });
        }
      }
    }

    return authored
      .sort((a, b) => String(b.timestampLocal || b.dateKey).localeCompare(String(a.timestampLocal || a.dateKey)))
      .slice(0, 8);
  }

  async compose(
    request: RadarRequestContext,""",
    "composer context loader",
)

replace_once(
    service,
    "    if (!['curto', 'conversa', 'audio', 'video'].includes(tone)) throw new Error('COMPOSER_TONE_INVALID');\n\n    const legacy = legacyComposerPreferences(tone);\n    const plan = buildComposerPlan({\n      person: person as any,\n      signal,",
    """    if (!['curto', 'conversa', 'audio', 'video'].includes(tone)) throw new Error('COMPOSER_TONE_INVALID');

    const recentConversationMessages = await this.loadComposerConversationContext(request, context.actorUid, person);
    const recentEvidence = recentConversationMessages.map((message, index) => ({
      messageIndex: -(index + 1),
      dateKey: message.dateKey,
      sender: message.sender,
      snippet: message.snippet,
    }));
    const contextSignal: RadarSignal = {
      ...signal,
      evidence: [...recentEvidence, ...(signal.evidence || [])]
        .filter((item, index, all) => all.findIndex(other => other.dateKey === item.dateKey && other.sender === item.sender && other.snippet === item.snippet) === index)
        .slice(0, 8),
    };

    const legacy = legacyComposerPreferences(tone);
    const plan = buildComposerPlan({
      person: { ...person, recentConversationMessages } as any,
      signal: contextSignal,""",
    "composer context injection",
)

replace_once(
    service,
    "      factsUsed: plan.factsUsed,\n      tone,",
    "      factsUsed: plan.factsUsed,\n      relationship: plan.relationship,\n      tone,",
    "composer relationship response",
)

replace_once(
    service,
    "      evidence: signal.evidence || [],",
    "      evidence: contextSignal.evidence || [],",
    "composer contextual evidence response",
)

# --- Client type carries relationship memory ------------------------------
replace_once(
    client,
    "  lastCommercialAt?: string | null;\n  followUpAt?: string | null;",
    "  lastCommercialAt?: string | null;\n  lastCommercialDraft?: string | null;\n  followUpAt?: string | null;",
    "client person draft memory",
)
replace_once(
    client,
    "      commercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied';\n      followUpDays?: number;",
    "      commercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied';\n      commercialDraft?: string;\n      followUpDays?: number;",
    "client update draft memory",
)

# --- Universal WhatsApp delivery -----------------------------------------
replace_once(
    radar,
    "import { LanguageCode } from '../../types';",
    "import { LanguageCode } from '../../types';\nimport { openWhatsAppDraft } from '../../core/client/whatsappDelivery';",
    "radar whatsapp helper import",
)
replace_once(radar, "noPhone: 'Adicione o telefone para abrir o WhatsApp.'", "noPhone: 'Sem número salvo: escolha o contato no WhatsApp.'", "radar pt chooser")
replace_once(radar, "noPhone: 'Add a phone number to open WhatsApp.'", "noPhone: 'No saved number: choose the contact in WhatsApp.'", "radar en chooser")
replace_once(radar, "noPhone: 'Agrega el teléfono para abrir WhatsApp.'", "noPhone: 'Sin número guardado: elige el contacto en WhatsApp.'", "radar es chooser")
replace_once(
    radar,
    "await patchPerson(selected.person, { commercialAction: 'copied' });",
    "await patchPerson(selected.person, { commercialAction: 'copied', commercialDraft: draft });",
    "radar copied draft memory",
)
replace_once(
    radar,
    "{phones[selected.person.id] ? <button onClick={() => { window.open(`https://wa.me/${(phones[selected.person.id] || '').replace(/\\D/g, '')}?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer'); void patchPerson(selected.person, { commercialAction: 'whatsapp_opened' }); }} disabled={!draft} className=\"inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-3 text-xs font-semibold text-slate-950 disabled:opacity-40\"><MessageCircle size={15} /> {t.whatsapp}</button> : <span className=\"text-xs text-slate-600\">{t.noPhone}</span>}",
    "<button onClick={() => { openWhatsAppDraft(draft, phones[selected.person.id] || selected.person.phone); void patchPerson(selected.person, { commercialAction: 'whatsapp_opened', commercialDraft: draft }); }} disabled={!draft} className=\"inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-3 text-xs font-semibold text-slate-950 disabled:opacity-40\"><MessageCircle size={15} /> {t.whatsapp}</button>{!normalizePhoneForUse(phones[selected.person.id] || selected.person.phone) && <span className=\"text-xs text-slate-600\">{t.noPhone}</span>}",
    "radar universal whatsapp button",
)

replace_once(
    sources,
    "import { Person360Panel } from '../contacts/Person360Panel';",
    "import { Person360Panel } from '../contacts/Person360Panel';\nimport { openWhatsAppDraft } from '../../core/client/whatsappDelivery';",
    "sources whatsapp helper import",
)
replace_once(
    sources,
    "    try { await client.updatePerson(String(item.personId), { commercialAction: 'copied' }); } catch { /* draft remains usable */ }",
    "    try { await client.updatePerson(String(item.personId), { commercialAction: 'copied', commercialDraft: item.draft }); } catch { /* draft remains usable */ }",
    "sources copied draft memory",
)
replace_once(
    sources,
    "  const openWhatsApp = async (item: any) => {\n    if (!item?.draft) return;\n    try { await client.updatePerson(String(item.personId), { commercialAction: 'whatsapp_opened' }); } catch { /* opening WhatsApp remains manual */ }\n    const phone = normalizePhone(item.phone);\n    const url = phone\n      ? `https://wa.me/${phone}?text=${encodeURIComponent(item.draft)}`\n      : `https://api.whatsapp.com/send?text=${encodeURIComponent(item.draft)}`;\n    window.open(url, '_blank', 'noopener,noreferrer');\n  };",
    """  const openWhatsApp = (item: any) => {
    if (!item?.draft) return;
    openWhatsAppDraft(item.draft, item.phone);
    void client.updatePerson(String(item.personId), { commercialAction: 'whatsapp_opened', commercialDraft: item.draft }).catch(() => undefined);
  };""",
    "sources universal whatsapp",
)

replace_once(
    people,
    "import { LanguageCode } from '../../types';",
    "import { LanguageCode } from '../../types';\nimport { openWhatsAppDraft } from '../../core/client/whatsappDelivery';",
    "people whatsapp helper import",
)
replace_once(
    people,
    "    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'copied' });",
    "    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'copied', commercialDraft: draft });",
    "people copied draft memory",
)
replace_once(
    people,
    "  const openWhatsApp = async () => {\n    if (!selected || !draft) return;\n    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'whatsapp_opened' });\n    const number = normalizePhone(selected.phone);\n    const url = number ? `https://wa.me/${number}?text=${encodeURIComponent(draft)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(draft)}`;\n    window.open(url, '_blank', 'noopener,noreferrer'); await refresh();\n  };",
    """  const openWhatsApp = () => {
    if (!selected || !draft) return;
    openWhatsAppDraft(draft, selected.phone);
    void client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'whatsapp_opened', commercialDraft: draft })
      .then(() => refresh())
      .catch(() => undefined);
  };""",
    "people universal whatsapp",
)
replace_once(
    people,
    "    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'sent_manual', followUpDays });",
    "    await client.updatePerson(selected.id, { salesStage: objective, commercialAction: 'sent_manual', commercialDraft: draft, followUpDays });",
    "people sent draft memory",
)
replace_once(
    people,
    "          {plan && <div className=\"mt-4 space-y-3\"><div className=\"grid gap-2 sm:grid-cols-2\"><div className=\"rounded-xl border border-white/10 bg-white/[0.025] p-3\"><div className=\"text-[10px] uppercase tracking-wider text-slate-500\">Sugestão para agora</div><div className=\"mt-1 text-sm text-white\">{plan.recommendation||plan.stageLabel||label(currentStage,currentLang)}</div></div><div className=\"rounded-xl border border-white/10 bg-white/[0.025] p-3\"><div className=\"text-[10px] uppercase tracking-wider text-slate-500\">Próximo pequeno sim</div><div className=\"mt-1 text-sm text-white\">{plan.nextSmallYes||'Avance somente um passo.'}</div></div></div>",
    """          {plan && <div className=\"mt-4 space-y-3\"><div className=\"grid gap-2 sm:grid-cols-2\"><div className=\"rounded-xl border border-white/10 bg-white/[0.025] p-3\"><div className=\"text-[10px] uppercase tracking-wider text-slate-500\">Sugestão para agora</div><div className=\"mt-1 text-sm text-white\">{plan.recommendation||plan.stageLabel||label(currentStage,currentLang)}</div></div><div className=\"rounded-xl border border-white/10 bg-white/[0.025] p-3\"><div className=\"text-[10px] uppercase tracking-wider text-slate-500\">Próximo pequeno sim</div><div className=\"mt-1 text-sm text-white\">{plan.nextSmallYes||'Avance somente um passo.'}</div></div></div>{plan.relationship&&<div className=\"rounded-xl border border-indigo-400/20 bg-indigo-400/[0.05] p-3\"><div className=\"text-[10px] uppercase tracking-wider text-indigo-300\">Leitura inteligente do relacionamento</div><div className=\"mt-1 text-xs leading-5 text-slate-300\">{plan.relationship.state==='active_reply'?'A pessoa falou novamente depois do último contato registrado.':plan.relationship.state==='followup_due'?'O follow-up está no prazo ou vencido.':plan.relationship.state==='waiting_reply'?'Já houve envio registrado e ainda não há resposta posterior confirmada no histórico importado.':plan.relationship.state==='dormant'?'A conversa está há algum tempo sem contato registrado.':plan.relationship.state==='first_contact'?'Primeiro contato confirmado pelo histórico disponível.':'Há contexto anterior e a conversa deve continuar de onde parou.'}{plan.relationship.daysSinceLastContact!==null?` · ${plan.relationship.daysSinceLastContact} dia(s) desde a última ação registrada.`:''}</div></div>}""",
    "people relationship intelligence card",
)

# --- Regression tests -----------------------------------------------------
p = Path(test)
s = p.read_text()
anchor = "console.log(`✅ Composer Playbook: ${passed} / ${total}`);"
if anchor not in s:
    raise SystemExit("composer test anchor missing")
addition = r"""
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
"""
p.write_text(s.replace(anchor, addition + anchor, 1))
