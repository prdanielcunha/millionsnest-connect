import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content);
}

function replaceOnce(content, before, after, label) {
  const index = content.indexOf(before);
  if (index < 0) throw new Error(`PATCH_ANCHOR_MISSING:${label}`);
  if (content.indexOf(before, index + before.length) >= 0) throw new Error(`PATCH_ANCHOR_NOT_UNIQUE:${label}`);
  return content.slice(0, index) + after + content.slice(index + before.length);
}

const identityInference = `import { ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';
import { normalizeIdentityName, normalizePhone } from './identityResolution';

export type IdentityEvidenceKind = 'self_introduction' | 'direct_address_reply' | 'phone_name_pair';
export type IdentityConfidence = 'high' | 'medium' | 'low' | 'none';

export type IdentityInferenceEvidence = {
  kind: IdentityEvidenceKind;
  score: number;
  sourceId: string;
  messageIndex: number;
  dateKey: string;
  sender: string;
  snippet: string;
};

export type ProbableIdentity = {
  probableName: string | null;
  normalizedProbableName: string;
  confidence: IdentityConfidence;
  score: number;
  evidence: IdentityInferenceEvidence[];
};

const ROLE_ONLY = new Set([
  'pastor', 'pastora', 'pr', 'pra', 'bispo', 'bispa', 'lider', 'líder', 'ministro', 'ministra',
  'presbitero', 'presbítero', 'apostolo', 'apóstolo', 'reverendo', 'reverenda', 'irmao', 'irmão', 'irma', 'irmã',
  'coordenador', 'coordenadora', 'responsavel', 'responsável', 'secretario', 'secretária', 'secretaria',
]);

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'na', 'no', 'nas', 'nos', 'e', 'aqui', 'from', 'at', 'of', 'the', 'del', 'de', 'la', 'el',
]);

function compactSnippet(text: string): string {
  return text.replace(/\\s+/g, ' ').trim().slice(0, 260);
}

function looksLikeUnknownLabel(value: string): boolean {
  if (normalizePhone(value)) return true;
  const clean = value.trim().toLowerCase();
  return !clean || clean === 'unknown' || clean === 'desconhecido' || clean === 'contato' || clean === 'contact';
}

function cleanCandidate(raw: string): string | null {
  let value = raw
    .replace(/[“”"'`]/g, '')
    .replace(/^\\s*(?:o|a|el|la)\\s+/i, '')
    .replace(/\\s+/g, ' ')
    .trim();
  if (!value) return null;

  const words = value.split(' ');
  const selected: string[] = [];
  for (const word of words) {
    const normalized = normalizeIdentityName(word);
    if (!normalized) continue;
    if (selected.length > 0 && STOP_WORDS.has(normalized)) break;
    selected.push(word.replace(/^[^\\p{L}]+|[^\\p{L}'’-]+$/gu, ''));
    if (selected.length >= 4) break;
  }

  while (selected.length && ROLE_ONLY.has(normalizeIdentityName(selected[0]))) selected.shift();
  value = selected.filter(Boolean).join(' ').trim();
  const normalized = normalizeIdentityName(value);
  if (!normalized || normalized.length < 2 || normalized.length > 70) return null;
  if (/\\d/.test(value)) return null;
  if (ROLE_ONLY.has(normalized)) return null;
  if (['eu', 'me', 'voce', 'você', 'ele', 'ela', 'we', 'i', 'me', 'yo'].includes(normalized)) return null;
  return value;
}

function introductionCandidate(text: string): string | null {
  const patterns = [
    /\\b(?:meu nome (?:é|e)|me chamo|aqui quem fala (?:é|e)|quem fala (?:é|e)|aqui (?:é|e)(?: o| a)?|sou(?: o| a)?)\\s+([^.!?;,\\n]{2,80})/iu,
    /\\b(?:my name is|this is|i['’]?m)\\s+([^.!?;,\\n]{2,80})/iu,
    /\\b(?:me llamo|soy)\\s+([^.!?;,\\n]{2,80})/iu,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = match ? cleanCandidate(match[1]) : null;
    if (candidate) return candidate;
  }
  return null;
}

function addressedCandidate(text: string): string | null {
  const match = /^(?:(?:oi|olá|ola|hey|hola|bom dia|boa tarde|boa noite)\\s+)?@?([\\p{L}][\\p{L}'’-]{2,}(?:\\s+[\\p{L}][\\p{L}'’-]{2,})?)\\s*[,!:]/iu.exec(text.trim());
  return match ? cleanCandidate(match[1]) : null;
}

function phonePairCandidate(text: string, phone: string | null): string | null {
  if (!phone) return null;
  const textDigits = text.replace(/\\D/g, '');
  const suffix = phone.slice(-8);
  if (suffix.length < 8 || !textDigits.includes(suffix)) return null;
  const patterns = [
    /(?:contato|telefone|n[uú]mero|whatsapp)\\s+(?:do|da|de)?\\s*([\\p{L}][\\p{L}'’-]{2,}(?:\\s+[\\p{L}][\\p{L}'’-]{2,}){0,2})/iu,
    /([\\p{L}][\\p{L}'’-]{2,}(?:\\s+[\\p{L}][\\p{L}'’-]{2,}){0,2})\\s*[-–:]?\\s*\\+?\\d[\\d\\s().-]{7,}/u,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = match ? cleanCandidate(match[1]) : null;
    if (candidate) return candidate;
  }
  return null;
}

function confidenceFromScore(score: number): IdentityConfidence {
  if (score >= 85) return 'high';
  if (score >= 65) return 'medium';
  if (score >= 50) return 'low';
  return 'none';
}

export function inferProbableIdentity(input: {
  displayName: string;
  phone?: string | null;
  messages: ParsedWhatsAppMessage[];
  sourceId: string;
}): ProbableIdentity {
  if (!looksLikeUnknownLabel(input.displayName)) {
    return { probableName: null, normalizedProbableName: '', confidence: 'none', score: 0, evidence: [] };
  }

  const phone = normalizePhone(input.phone || input.displayName);
  const targetName = normalizeIdentityName(input.displayName);
  const candidates = new Map<string, { displayName: string; max: number; evidence: IdentityInferenceEvidence[] }>();
  const add = (name: string | null, score: number, kind: IdentityEvidenceKind, message: ParsedWhatsAppMessage) => {
    if (!name) return;
    const normalized = normalizeIdentityName(name);
    if (!normalized) return;
    const current = candidates.get(normalized) || { displayName: name, max: 0, evidence: [] };
    current.max = Math.max(current.max, score);
    current.evidence.push({
      kind,
      score,
      sourceId: input.sourceId,
      messageIndex: message.index,
      dateKey: message.dateKey,
      sender: message.sender,
      snippet: compactSnippet(message.text),
    });
    candidates.set(normalized, current);
  };

  for (let index = 0; index < input.messages.length; index++) {
    const message = input.messages[index];
    const senderMatches = normalizeIdentityName(message.sender) === targetName || (phone && normalizePhone(message.sender) === phone);
    if (senderMatches) {
      add(introductionCandidate(message.text), 94, 'self_introduction', message);
      const previous = input.messages[index - 1];
      if (previous && normalizeIdentityName(previous.sender) !== targetName) {
        add(addressedCandidate(previous.text), 64, 'direct_address_reply', previous);
      }
      continue;
    }
    add(phonePairCandidate(message.text, phone), 88, 'phone_name_pair', message);
  }

  const ranked = Array.from(candidates.entries()).map(([normalized, candidate]) => {
    const corroboration = Math.max(0, candidate.evidence.length - 1) * 4;
    return {
      normalized,
      displayName: candidate.displayName,
      score: Math.min(98, candidate.max + corroboration),
      evidence: candidate.evidence.sort((a, b) => b.score - a.score || b.messageIndex - a.messageIndex).slice(0, 5),
    };
  }).sort((a, b) => b.score - a.score || b.evidence.length - a.evidence.length);

  const best = ranked[0];
  if (!best || best.score < 50) {
    return { probableName: null, normalizedProbableName: '', confidence: 'none', score: 0, evidence: [] };
  }
  const second = ranked[1];
  const adjustedScore = second && second.score >= best.score - 4 ? Math.min(best.score, 64) : best.score;
  return {
    probableName: best.displayName,
    normalizedProbableName: best.normalized,
    confidence: confidenceFromScore(adjustedScore),
    score: adjustedScore,
    evidence: best.evidence,
  };
}
`;
write('src/personal/radar/identityInference.ts', identityInference);

const conversationIdentity = `import { normalizeIdentityName } from '../radar/identityResolution';

function baseFileName(fileName: string): string {
  return fileName.trim().replace(/\\.(?:txt|zip)$/i, '').trim();
}

export function deriveConversationLabel(fileName: string, participants: string[], selfNames: string[]): string {
  let label = baseFileName(fileName)
    .replace(/^whatsapp\\s+chat\\s+(?:with|com)\\s+/i, '')
    .replace(/^conversa\\s+(?:do\\s+)?whatsapp\\s+(?:com|with)\\s+/i, '')
    .replace(/^chat\\s+(?:do\\s+)?whatsapp\\s+(?:com|with)\\s+/i, '')
    .replace(/^whatsapp\\s*[-–—:]\\s*/i, '')
    .replace(/^_?chat$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

  const self = new Set(selfNames.map(normalizeIdentityName).filter(Boolean));
  const external = participants.filter(name => !self.has(normalizeIdentityName(name)));
  if (!label || /^(?:chat|conversa|whatsapp)$/i.test(label)) {
    if (external.length === 1) label = external[0];
    else if (external.length > 1) label = `WhatsApp · ${external.length} participantes`;
    else label = 'WhatsApp importado';
  }
  return label.slice(0, 160);
}

export function deriveConversationKind(participants: string[], selfNames: string[]): 'group' | 'direct' | 'unknown' {
  const self = new Set(selfNames.map(normalizeIdentityName).filter(Boolean));
  const external = participants.filter(name => !self.has(normalizeIdentityName(name)));
  if (external.length > 1) return 'group';
  if (external.length === 1) return 'direct';
  return 'unknown';
}
`;
write('src/personal/whatsapp/conversationIdentity.ts', conversationIdentity);

let service = read('src/personal/radar/personalRadarService.ts');
service = replaceOnce(
  service,
  "import { extractWhatsAppText, parseWhatsAppExport, ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';\n",
  "import { extractWhatsAppText, parseWhatsAppExport, ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';\nimport { deriveConversationKind, deriveConversationLabel } from '../whatsapp/conversationIdentity';\nimport { inferProbableIdentity, IdentityInferenceEvidence } from './identityInference';\n",
  'service imports',
);
service = replaceOnce(
  service,
  "function validManualPriority(value: unknown): ManualPriority | undefined {\n  return ['normal', 'important', 'priority'].includes(String(value))\n    ? value as ManualPriority\n    : undefined;\n}\n",
  "function validManualPriority(value: unknown): ManualPriority | undefined {\n  return ['normal', 'important', 'priority'].includes(String(value))\n    ? value as ManualPriority\n    : undefined;\n}\n\nfunction mergeIdentityEvidence(existingValue: unknown, incomingValue: unknown): IdentityInferenceEvidence[] {\n  const map = new Map<string, IdentityInferenceEvidence>();\n  const collect = (value: unknown) => {\n    if (!Array.isArray(value)) return;\n    for (const item of value as IdentityInferenceEvidence[]) {\n      if (!item || typeof item !== 'object') continue;\n      const key = `${String(item.sourceId || '')}:${Number(item.messageIndex ?? -1)}:${String(item.kind || '')}`;\n      if (!map.has(key)) map.set(key, item);\n    }\n  };\n  collect(existingValue);\n  collect(incomingValue);\n  return Array.from(map.values()).sort((a, b) => b.score - a.score || String(b.dateKey).localeCompare(String(a.dateKey))).slice(0, 12);\n}\n\nfunction conversationSummary(conversation: Record<string, unknown>) {\n  return {\n    id: String(conversation.id || conversation.sourceId || ''),\n    sourceId: String(conversation.sourceId || conversation.id || ''),\n    label: String(conversation.label || conversation.fileName || conversation.sourceId || 'WhatsApp'),\n    kind: String(conversation.kind || 'unknown'),\n    fileName: String(conversation.fileName || ''),\n    createdAt: String(conversation.createdAt || ''),\n    firstDateKey: typeof conversation.firstDateKey === 'string' ? conversation.firstDateKey : null,\n    lastDateKey: typeof conversation.lastDateKey === 'string' ? conversation.lastDateKey : null,\n    participantCount: Number(conversation.participantCount || (Array.isArray(conversation.participantNames) ? conversation.participantNames.length : 0)),\n    messageCount: Number(conversation.messageCount || 0),\n  };\n}\n",
  'service helpers',
);
service = replaceOnce(
  service,
  "    const parsed = parseWhatsAppExport(text);\n    const selfNames = normalizeSelfNames(input.selfNames);\n    const people = deriveRadarPeople({ messages: parsed.messages, selfNames }).slice(0, 250);\n    const createdAt = isoNow(this.now);\n",
  "    const parsed = parseWhatsAppExport(text);\n    const selfNames = normalizeSelfNames(input.selfNames);\n    const conversationLabel = deriveConversationLabel(fileName, parsed.participants, selfNames);\n    const conversationKind = deriveConversationKind(parsed.participants, selfNames);\n    const people = deriveRadarPeople({ messages: parsed.messages, selfNames }).slice(0, 250).map(person => {\n      const inference = inferProbableIdentity({\n        displayName: person.displayName,\n        phone: person.phone,\n        messages: parsed.messages,\n        sourceId,\n      });\n      return {\n        ...person,\n        probableName: inference.probableName,\n        normalizedProbableName: inference.normalizedProbableName,\n        probableNameConfidence: inference.confidence,\n        probableNameScore: inference.score,\n        identityEvidence: inference.evidence,\n        signals: person.signals.map(signal => ({\n          ...signal,\n          sourceId,\n          sourceLabel: conversationLabel,\n          evidence: signal.evidence.map(item => ({ ...item, sourceId, sourceLabel: conversationLabel })),\n        })),\n      };\n    });\n    const createdAt = isoNow(this.now);\n",
  'service import enrichment',
);
service = replaceOnce(
  service,
  "          identityAliases: uniqueStrings(existing.identityAliases, existing.displayName, person.displayName),\n          identityConfirmedAliases: uniqueStrings(existing.identityConfirmedAliases, person.normalizedName),\n          identityConfidence: strong.match.confidence,\n",
  "          probableName: existing.probableName || person.probableName || null,\n          normalizedProbableName: existing.normalizedProbableName || person.normalizedProbableName || '',\n          probableNameConfidence: existing.probableNameConfidence || person.probableNameConfidence || 'none',\n          probableNameScore: Math.max(Number(existing.probableNameScore || 0), Number(person.probableNameScore || 0)),\n          identityEvidence: mergeIdentityEvidence(existing.identityEvidence, person.identityEvidence),\n          identityAliases: uniqueStrings(existing.identityAliases, existing.displayName, person.displayName, person.probableName),\n          identityConfirmedAliases: uniqueStrings(existing.identityConfirmedAliases, person.normalizedName),\n          identityConfidence: strong.match.confidence,\n",
  'service merge inference',
);
service = replaceOnce(
  service,
  "        identityAliases: [person.displayName],\n        identityConfirmedAliases: [],\n        identityBlockedAliases: [],\n        identityConfidence: ambiguous.length ? ambiguous[0].confidence : 0,\n        identityResolution: ambiguous.length ? 'needs_review' : 'new_person',\n",
  "        identityAliases: uniqueStrings(person.displayName, person.probableName),\n        identityConfirmedAliases: [],\n        identityBlockedAliases: [],\n        identityConfidence: Math.max(ambiguous.length ? ambiguous[0].confidence : 0, Number(person.probableNameScore || 0)),\n        identityResolution: ambiguous.length ? 'needs_review' : person.probableName ? 'probable_name' : 'new_person',\n",
  'service new person inference',
);
service = replaceOnce(
  service,
  "          fileName,\n          ownerUid: context.actorUid,\n          createdAt,\n          firstDateKey: parsed.firstDateKey,\n",
  "          fileName,\n          label: conversationLabel,\n          kind: conversationKind,\n          ownerUid: context.actorUid,\n          createdAt,\n          firstDateKey: parsed.firstDateKey,\n",
  'service source metadata',
);
service = replaceOnce(
  service,
  "          fileName,\n          createdAt,\n          firstDateKey: parsed.firstDateKey,\n          lastDateKey: parsed.lastDateKey,\n          participantNames: parsed.participants.slice(0, 300),\n          messageCount: parsed.messages.length,\n",
  "          fileName,\n          label: conversationLabel,\n          kind: conversationKind,\n          createdAt,\n          firstDateKey: parsed.firstDateKey,\n          lastDateKey: parsed.lastDateKey,\n          participantNames: parsed.participants.slice(0, 300),\n          participantCount: parsed.participants.length,\n          messageCount: parsed.messages.length,\n",
  'service conversation metadata',
);
service = replaceOnce(
  service,
  "      identityReviewCount,\n    };\n  }\n\n  async getRadar(request: RadarRequestContext) {\n",
  "      identityReviewCount,\n      conversationLabel,\n      conversationKind,\n    };\n  }\n\n  async getRadar(request: RadarRequestContext) {\n",
  'service import response metadata',
);
service = replaceOnce(
  service,
  "    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500);\n    const nowMs = this.now();\n    const visible: Array<Record<string, unknown> & { id: string; effectivePotential: PotentialLevel }> = people\n",
  "    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500);\n    const conversationsRaw = await this.vault.list(request.authToken, context.actorUid, ['personalConversations'], 300);\n    const conversations = conversationsRaw.map(conversationSummary).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));\n    const sourceMap = new Map(conversations.map(item => [item.sourceId, item]));\n    const nowMs = this.now();\n    const visible: Array<Record<string, unknown> & { id: string; effectivePotential: PotentialLevel }> = people\n",
  'service radar source load',
);
service = replaceOnce(
  service,
  "      .filter(person => person.radarState !== 'ignored' && !isActivelySnoozed(person, nowMs) && !person.notRelevant)\n      .map(person => ({ ...(person as Record<string, unknown> & { id: string }), effectivePotential: safeEffectivePotential(person) }));\n",
  "      .filter(person => person.radarState !== 'ignored' && !isActivelySnoozed(person, nowMs) && !person.notRelevant)\n      .map(person => {\n        const ids = uniqueStrings(person.sourceIds, person.sourceId);\n        return {\n          ...(person as Record<string, unknown> & { id: string }),\n          sourceIds: ids,\n          sources: ids.map(sourceId => sourceMap.get(sourceId) || {\n            id: sourceId,\n            sourceId,\n            label: sourceId,\n            kind: 'unknown',\n            fileName: '',\n            createdAt: '',\n            firstDateKey: null,\n            lastDateKey: null,\n            participantCount: 0,\n            messageCount: 0,\n          }),\n          effectivePotential: safeEffectivePotential(person),\n        };\n      });\n",
  'service radar join sources',
);
service = replaceOnce(
  service,
  "    return { people: visible, count: visible.length };\n  }\n",
  "    return { people: visible, count: visible.length, conversations };\n  }\n",
  'service radar response sources',
);
service = replaceOnce(
  service,
  "            sourceId,\n            sender: String(message?.sender || ''),\n",
  "            sourceId,\n            sourceLabel: String(conversation.label || conversation.fileName || sourceId),\n            sourceKind: String(conversation.kind || 'unknown'),\n            sender: String(message?.sender || ''),\n",
  'service search provenance',
);
write('src/personal/radar/personalRadarService.ts', service);

let client = read('src/core/client/personalRadarClient.ts');
client = replaceOnce(
  client,
  "export type RadarManualPriority = 'normal' | 'important' | 'priority';\n",
  "export type RadarManualPriority = 'normal' | 'important' | 'priority';\n\nexport type RadarConversationSummary = {\n  id: string;\n  sourceId: string;\n  label: string;\n  kind: 'group' | 'direct' | 'unknown' | string;\n  fileName: string;\n  createdAt: string;\n  firstDateKey?: string | null;\n  lastDateKey?: string | null;\n  participantCount: number;\n  messageCount: number;\n};\n\nexport type RadarIdentityEvidence = {\n  kind: string;\n  score: number;\n  sourceId: string;\n  messageIndex: number;\n  dateKey: string;\n  sender: string;\n  snippet: string;\n};\n",
  'client source types',
);
client = replaceOnce(
  client,
  "  displayName: string;\n  normalizedName?: string;\n",
  "  displayName: string;\n  normalizedName?: string;\n  probableName?: string | null;\n  normalizedProbableName?: string;\n  probableNameConfidence?: 'high' | 'medium' | 'low' | 'none';\n  probableNameScore?: number;\n  identityEvidence?: RadarIdentityEvidence[];\n  sources?: RadarConversationSummary[];\n",
  'client person inference types',
);
client = replaceOnce(
  client,
  "  async getRadar(): Promise<{ people: RadarClientPerson[]; count: number }> {\n",
  "  async getRadar(): Promise<{ people: RadarClientPerson[]; count: number; conversations: RadarConversationSummary[] }> {\n",
  'client radar return type',
);
client = replaceOnce(
  client,
  "    return { people: Array.isArray(body.people) ? body.people : [], count: Number(body.count || 0) };\n",
  "    return {\n      people: Array.isArray(body.people) ? body.people : [],\n      count: Number(body.count || 0),\n      conversations: Array.isArray(body.conversations) ? body.conversations : [],\n    };\n",
  'client radar sources response',
);
write('src/core/client/personalRadarClient.ts', client);

let ui = read('src/features/radar/RadarPage.tsx');
ui = replaceOnce(
  ui,
  "  PersonalRadarClient,\n  RadarClientPerson,\n  RadarManualPriority,\n",
  "  PersonalRadarClient,\n  RadarClientPerson,\n  RadarConversationSummary,\n  RadarManualPriority,\n",
  'ui client import',
);
ui = replaceOnce(
  ui,
  "const potentialOrder: RadarPotentialLevel[] = ['very_high', 'high', 'medium', 'low', 'unknown'];\n",
  "const sourceCopy = {\n  'pt-BR': { all: 'Todas as conversas', title: 'Conversas importadas', from: 'Veio de', group: 'Grupo', direct: 'Conversa', probable: 'Provável nome', originalId: 'Identificação no arquivo', evidence: 'Como o Connect chegou nisso', high: 'confiança alta', medium: 'confiança média', low: 'confiança baixa', none: 'sem confiança suficiente' },\n  'en-US': { all: 'All conversations', title: 'Imported conversations', from: 'From', group: 'Group', direct: 'Conversation', probable: 'Probable name', originalId: 'Identifier in file', evidence: 'How Connect inferred this', high: 'high confidence', medium: 'medium confidence', low: 'low confidence', none: 'not enough confidence' },\n  'es-ES': { all: 'Todas las conversaciones', title: 'Conversaciones importadas', from: 'Vino de', group: 'Grupo', direct: 'Conversación', probable: 'Nombre probable', originalId: 'Identificación en el archivo', evidence: 'Cómo Connect llegó a esto', high: 'confianza alta', medium: 'confianza media', low: 'confianza baja', none: 'sin confianza suficiente' },\n} satisfies Record<LanguageCode, Record<string, string>>;\n\nconst potentialOrder: RadarPotentialLevel[] = ['very_high', 'high', 'medium', 'low', 'unknown'];\n",
  'ui source copy',
);
ui = replaceOnce(
  ui,
  "  const t = copy[currentLang];\n",
  "  const t = copy[currentLang];\n  const s = sourceCopy[currentLang];\n",
  'ui source copy binding',
);
ui = replaceOnce(
  ui,
  "  const [people, setPeople] = useState<RadarClientPerson[]>([]);\n",
  "  const [people, setPeople] = useState<RadarClientPerson[]>([]);\n  const [conversations, setConversations] = useState<RadarConversationSummary[]>([]);\n  const [sourceFilter, setSourceFilter] = useState('all');\n",
  'ui source state',
);
ui = replaceOnce(
  ui,
  "      setPeople(result.people);\n      setPhones(Object.fromEntries(result.people.map(person => [person.id, person.phone || ''])));\n",
  "      setPeople(result.people);\n      setConversations(result.conversations || []);\n      setPhones(Object.fromEntries(result.people.map(person => [person.id, person.phone || ''])));\n",
  'ui refresh sources',
);
ui = replaceOnce(
  ui,
  "  const visiblePeople = useMemo(() => people.filter(person => {\n    if (filter === 'favorites') return Boolean(person.favorite);\n",
  "  const visiblePeople = useMemo(() => people.filter(person => {\n    const sourceIds = person.sourceIds?.length ? person.sourceIds : [person.sourceId];\n    if (sourceFilter !== 'all' && !sourceIds.includes(sourceFilter)) return false;\n    if (filter === 'favorites') return Boolean(person.favorite);\n",
  'ui source filter predicate',
);
ui = replaceOnce(
  ui,
  "  }), [people, filter]);\n",
  "  }), [people, filter, sourceFilter]);\n",
  'ui source filter deps',
);
ui = replaceOnce(
  ui,
  "      <section className=\"grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center\">\n",
  "      {conversations.length > 0 && <section className=\"rounded-[24px] border border-white/10 bg-white/[0.022] p-3 sm:p-4\"><div className=\"flex items-center gap-2 text-xs font-semibold text-slate-300\"><FileArchive size={15} className=\"text-indigo-300\" /> {s.title}</div><div className=\"mt-3 flex gap-2 overflow-x-auto pb-1\"><button onClick={() => setSourceFilter('all')} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs transition ${sourceFilter === 'all' ? 'border-indigo-400/30 bg-indigo-400/15 text-indigo-100' : 'border-white/8 bg-black/10 text-slate-500 hover:text-white'}`}>{s.all}</button>{conversations.map(conversation => <button key={conversation.sourceId} onClick={() => setSourceFilter(conversation.sourceId)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-left text-xs transition ${sourceFilter === conversation.sourceId ? 'border-indigo-400/30 bg-indigo-400/15 text-indigo-100' : 'border-white/8 bg-black/10 text-slate-500 hover:text-white'}`}><span className=\"font-medium\">{conversation.label}</span><span className=\"ml-2 text-[10px] opacity-60\">{conversation.kind === 'group' ? s.group : conversation.kind === 'direct' ? s.direct : 'WhatsApp'} · {conversation.messageCount}</span></button>)}</div></section>}\n\n      <section className=\"grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center\">\n",
  'ui source selector',
);
ui = ui.replace('{person.displayName}</h2>', '{person.probableName || person.displayName}</h2>');
if (!ui.includes('{person.probableName || person.displayName}</h2>')) throw new Error('PATCH_ANCHOR_MISSING:ui probable heading');
ui = replaceOnce(
  ui,
  "<span>{person.messageCount || 0} {t.messages}</span>",
  "<span>{person.messageCount || 0} {t.messages}</span>{person.probableName && <span>{s.originalId}: {person.displayName}</span>}",
  'ui original identity metadata',
);
ui = replaceOnce(
  ui,
  "            {candidate && <div className=\"mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-3\">",
  "            {person.sources?.length ? <div className=\"mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500\"><span className=\"mr-1\">{s.from}:</span>{person.sources.map(source => <button key={source.sourceId} onClick={() => setSourceFilter(source.sourceId)} className=\"rounded-lg border border-white/8 bg-black/15 px-2 py-1 text-slate-400 hover:border-indigo-400/25 hover:text-indigo-200\">{source.label}</button>)}</div> : null}\n\n            {person.probableName && person.identityEvidence?.length ? <div className=\"mt-4 rounded-2xl border border-sky-300/15 bg-sky-300/[0.045] p-3\"><div className=\"text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200/80\">{s.probable} · {s[person.probableNameConfidence || 'none']}</div><div className=\"mt-1 text-sm font-medium text-sky-50\">{person.probableName}</div><div className=\"mt-2 text-[10px] font-medium text-slate-500\">{s.evidence}</div>{person.identityEvidence.slice(0, 2).map((item, index) => <div key={`${item.sourceId}-${item.messageIndex}-${index}`} className=\"mt-1.5 text-xs leading-5 text-slate-400\">“{item.snippet}” <span className=\"text-slate-600\">· {item.dateKey}</span></div>)}</div> : null}\n\n            {candidate && <div className=\"mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-3\">",
  'ui source and probable evidence',
);
ui = replaceOnce(
  ui,
  "<div className=\"text-xs font-medium text-slate-200\">{result.sender} · {result.dateKey}</div>",
  "<div className=\"text-xs font-medium text-slate-200\">{result.sender} · {result.dateKey}{result.sourceLabel ? ` · ${result.sourceLabel}` : ''}</div>",
  'ui search source label',
);
write('src/features/radar/RadarPage.tsx', ui);

let tests = read('src/tests/personalRadarService.test.ts');
const extraTests = `

{
  const vault = new MemoryVault();
  const service = new PersonalRadarService(provider(canonicalContext()), vault, () => Date.parse('2026-09-12T18:30:00Z'));
  const request = { authToken: 'Bearer founder-token', organizationId: 'org-1' };
  const text = [
    '[12/09/2026, 15:00:00] +55 43 99999-1234: Oi, aqui é o Marcelo Santos. Como vocês organizam a escala do louvor?',
    '[12/09/2026, 15:02:00] Daniel: Hoje usamos o MusicScale para repertório e confirmação.',
    '[12/09/2026, 15:03:00] +55 43 99999-1234: Entendi, queria conhecer melhor.',
  ].join('\\n');
  const imported = await service.importWhatsApp(request, {
    fileName: 'Grupo Lideres de Louvor.txt',
    contentBase64: Buffer.from(text, 'utf8').toString('base64'),
    selfNames: ['Daniel'],
  });
  equal((imported as any).conversationLabel, 'Grupo Lideres de Louvor', 'import keeps a human-readable conversation source label');
  equal((imported as any).conversationKind, 'direct', 'conversation kind is derived from external participants');

  const radar = await service.getRadar(request);
  equal((radar as any).conversations.length, 1, 'Radar exposes imported conversations separately');
  equal((radar as any).conversations[0].label, 'Grupo Lideres de Louvor', 'conversation provenance keeps the imported source name');
  const person = radar.people[0] as any;
  equal(person.probableName, 'Marcelo Santos', 'unknown phone sender gets an explainable probable name from self-introduction');
  equal(person.probableNameConfidence, 'high', 'self-introduction produces high-confidence identity evidence');
  assert(Array.isArray(person.identityEvidence) && person.identityEvidence.some((item: any) => item.snippet.includes('Marcelo Santos')), 'probable name keeps the exact supporting message');
  assert(Array.isArray(person.sources) && person.sources.some((source: any) => source.label === 'Grupo Lideres de Louvor'), 'person keeps visible source provenance');

  const search = await service.search(request, 'conhecer');
  equal((search.matches[0] as any).sourceLabel, 'Grupo Lideres de Louvor', 'history search returns the conversation source label');
}
`;
tests = replaceOnce(
  tests,
  "\nconsole.log(`✅ Passed ${passed} / ${total} tests.`);",
  `${extraTests}\nconsole.log(\`✅ Passed \${passed} / \${total} tests.\`);`,
  'service source identity tests',
);
write('src/tests/personalRadarService.test.ts', tests);

console.log('SOURCE_AWARE_IDENTITY_PATCH_APPLIED');
