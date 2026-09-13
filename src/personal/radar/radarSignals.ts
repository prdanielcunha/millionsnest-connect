import crypto from 'node:crypto';
import { ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';

/**
 * Persisted signal codes remain stable for backward compatibility, but product
 * potential is now evidence-first: relationship/pastoral context may order an
 * already-relevant person, never create MusicScale relevance by itself.
 */
export type RadarSignalType =
  | 'explicit_product_interest'
  | 'commercial_followup_due'
  | 'unanswered_conversation'
  | 'recurring_relevant_topic';

export type RadarEvidence = {
  messageIndex: number;
  dateKey: string;
  sender: string;
  snippet: string;
};

export type RadarSignal = {
  id: string;
  type: RadarSignalType;
  reason: string;
  nextAction: string;
  evidence: RadarEvidence[];
};

export type RadarPerson = {
  id: string;
  displayName: string;
  normalizedName: string;
  phone: string | null;
  messageCount: number;
  firstDateKey: string | null;
  lastDateKey: string | null;
  signals: RadarSignal[];
};

export type MusicScaleEvidenceTier = 'explicit' | 'pain' | 'topic' | 'none';

const PRODUCT_PATTERNS = [
  /\bapp(?:licativo)?\b/i,
  /\bsistema\b/i,
  /\bplataforma\b/i,
  /\bsoftware\b/i,
  /\bferramenta\b/i,
  /\bpre[cç]o\b/i,
  /\bvalor\b/i,
  /\bquanto\s+custa\b/i,
  /\bteste\b/i,
  /\bexperimentar\b/i,
  /\bfunciona\b/i,
];

const PAIN_OR_INTENT_PATTERNS = [
  /\bdif[ií]cil\b/i,
  /\bdificuldade\b/i,
  /\bproblema\b/i,
  /\bconfus(?:a|o|ão)\b/i,
  /\bperdid[oa]s?\b/i,
  /\bespalhad[oa]s?\b/i,
  /\borganiza(?:r|[cç][aã]o|do|da)\b/i,
  /\bcontrola(?:r|mos|ndo)\b/i,
  /\bplanilha\b/i,
  /\bwhatsapp\b/i,
  /\bprecis(?:a|amos|ando)\b/i,
  /\bnecessidade\b/i,
  /\bajuda(?:r)?\b/i,
  /\bningu[eé]m\s+confirma\b/i,
  /\bconfirm(?:ar|a[cç][aã]o)\b/i,
  /\bn[aã]o\s+sei\b/i,
  /\bcomo\s+(?:voc[eê]s?|a\s+gente)\b/i,
  /\btem\s+algum\s+(?:app|aplicativo|sistema|jeito)\b/i,
];

// Concrete MusicScale domain evidence. Ambiguous words only count when tied to
// music/worship context; e.g. "tom contemplativo" must never match musical key.
const MUSIC_SCALE_TOPIC_PATTERNS = [
  /\blouvor\b/i,
  /\bworship\b/i,
  /\bminist[eé]rio\s+de\s+(?:louvor|m[uú]sica)\b/i,
  /\bl[ií]der\s+de\s+louvor\b/i,
  /\bministro(?:a)?\s+de\s+louvor\b/i,
  /\bcifra(?:s)?\b/i,
  /\bchord(?:s)?\b/i,
  /\brepert[oó]rio(?:s)?\b/i,
  /\bset\s*list\b/i,
  /\bvocal(?:ista|istas)?\b/i,
  /\bback\s*vocal\b/i,
  /\binstrumentista(?:s)?\b/i,
  /\btecladista(?:s)?\b/i,
  /\bguitarrista(?:s)?\b/i,
  /\bbaixista(?:s)?\b/i,
  /\bbaterista(?:s)?\b/i,
  /\bm[uú]sic[oa]s?\b/i,
  /\bbanda\b/i,
  /\bescala(?:s)?\b.{0,60}\b(?:louvor|m[uú]sic|banda|equipe|vocal|instrumentista|tecladista|guitarrista|baixista|baterista)\b/i,
  /\b(?:louvor|m[uú]sic|banda|equipe|vocal|instrumentista|tecladista|guitarrista|baixista|baterista)\b.{0,60}\bescala(?:s)?\b/i,
  /\bensaio(?:s)?\b.{0,60}\b(?:louvor|m[uú]sic|banda|equipe|vocal|instrumentista)\b/i,
  /\b(?:louvor|m[uú]sic|banda|equipe|vocal|instrumentista)\b.{0,60}\bensaio(?:s)?\b/i,
  /\b(?:tom|tonalidade)\b.{0,45}\b(?:m[uú]sica|can[cç][aã]o|cifra|louvor|repert[oó]rio)\b/i,
  /\b(?:m[uú]sica|can[cç][aã]o|cifra|louvor|repert[oó]rio)\b.{0,45}\b(?:tom|tonalidade)\b/i,
  /\b(?:trocar|mudar|subir|baixar)\s+(?:o\s+)?tom\b/i,
  /\btranspo(?:r|si[cç][aã]o)\b.{0,45}\b(?:m[uú]sica|cifra|tom|tonalidade)\b/i,
  /\bm[uú]sicas?\s+(?:do|para\s+o)\s+culto\b/i,
  /\b(?:confirma(?:r|[cç][aã]o)|presen[cç]a|disponibilidade)\b.{0,60}\b(?:escala|louvor|m[uú]sic|banda|equipe|ensaio)\b/i,
  /\b(?:escala|louvor|m[uú]sic|banda|equipe|ensaio)\b.{0,60}\b(?:confirma(?:r|[cç][aã]o)|presen[cç]a|disponibilidade)\b/i,
];

const LEADERSHIP_ROLE_PATTERNS = [
  /\bpastor(?:a)?\s+(?:titular|presidente|s[eê]nior|senior|respons[aá]vel)\b/i,
  /\bpr\.?\s*(?:titular|presidente)\b/i,
  /\bpresidente\s+(?:da|de)\s+igreja\b/i,
  /\bl[ií]der\s+(?:do\s+)?(?:louvor|worship|minist[eé]rio\s+de\s+m[uú]sica)\b/i,
  /\bministro(?:a)?\s+de\s+louvor\b/i,
  /\bcoordenador(?:a)?\s+(?:de\s+)?(?:louvor|m[uú]sica)\b/i,
  /\bdirigente\s+(?:de\s+)?(?:louvor|m[uú]sica)\b/i,
  /\brespons[aá]vel\s+(?:pelo|por|do|da)\s+(?:louvor|m[uú]sica)\b/i,
];

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${crypto.createHash('sha256').update(value).digest('hex').slice(0, 20)}`;
}

function snippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function evidence(message: ParsedWhatsAppMessage): RadarEvidence {
  return {
    messageIndex: message.index,
    dateKey: message.dateKey,
    sender: message.sender,
    snippet: snippet(message.text),
  };
}

function extractPhone(sender: string): string | null {
  const digits = sender.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = Date.parse(`${dateA}T00:00:00Z`);
  const b = Date.parse(`${dateB}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

export function classifyMusicScaleEvidence(text: string): MusicScaleEvidenceTier {
  if (/\bmusicscale\b/i.test(text)) return 'explicit';
  const topic = hasAny(text, MUSIC_SCALE_TOPIC_PATTERNS);
  if (!topic) return 'none';
  if (hasAny(text, PRODUCT_PATTERNS)) return 'explicit';
  if (hasAny(text, PAIN_OR_INTENT_PATTERNS)) return 'pain';
  return 'topic';
}

function selfMentioned(text: string, selfNames: string[]): boolean {
  const normalized = ` ${normalizeText(text).replace(/[^a-z0-9@+]+/g, ' ')} `;
  return selfNames.some(rawName => {
    const full = normalizeName(rawName);
    if (!full) return false;
    const candidates = new Set<string>([full, full.split(' ')[0]].filter(value => value.length >= 3));
    for (const candidate of candidates) {
      if (normalized.includes(` ${candidate} `) || normalized.includes(` @${candidate} `)) return true;
    }
    return false;
  });
}

function roleEvidenceText(displayName: string, messages: ParsedWhatsAppMessage[]): string {
  return `${displayName} ${messages.map(message => message.text).join(' ')}`;
}

function isLeadershipRole(displayName: string, messages: ParsedWhatsAppMessage[]): boolean {
  return hasAny(roleEvidenceText(displayName, messages), LEADERSHIP_ROLE_PATTERNS);
}

export function deriveRadarPeople(input: {
  messages: ParsedWhatsAppMessage[];
  selfNames: string[];
  todayDateKey?: string;
}): RadarPerson[] {
  const self = new Set(input.selfNames.map(normalizeName).filter(Boolean));
  const today = input.todayDateKey || new Date().toISOString().slice(0, 10);
  const grouped = new Map<string, ParsedWhatsAppMessage[]>();

  for (const message of input.messages) {
    const key = normalizeName(message.sender);
    if (!key || self.has(key)) continue;
    const list = grouped.get(key) || [];
    list.push(message);
    grouped.set(key, list);
  }

  const ownerMessages = input.messages.filter(message => self.has(normalizeName(message.sender)));
  const isDirectConversation = self.size > 0 && grouped.size === 1;
  const people: RadarPerson[] = [];

  for (const [normalizedName, messages] of grouped.entries()) {
    const ordered = [...messages].sort((a, b) => a.index - b.index);
    const displayName = ordered[ordered.length - 1]?.sender || normalizedName;
    const personId = stableId('person', normalizedName);
    const signals: RadarSignal[] = [];

    const classified = ordered.map(message => ({ message, tier: classifyMusicScaleEvidence(message.text) }));
    const relevantMessages = classified.filter(item => item.tier !== 'none');

    // Product Radar is evidence-gated. Being a pastor, being active in a group,
    // message volume, or having a relationship with the owner never creates fit.
    if (!relevantMessages.length) continue;

    const strongMessages = relevantMessages.filter(item => item.tier === 'explicit' || item.tier === 'pain');
    if (strongMessages.length) {
      const selected = strongMessages.slice(-3);
      const explicitlyNamed = selected.some(item => item.tier === 'explicit');
      signals.push({
        id: stableId('signal', `${personId}:music_scale_fit:${selected.map(item => item.message.index).join(',')}`),
        type: 'explicit_product_interest',
        reason: explicitlyNamed
          ? 'Esta pessoa citou o MusicScale ou demonstrou interesse explícito em uma ferramenta ligada à rotina de louvor.'
          : 'Esta pessoa descreveu uma dor operacional ligada ao MusicScale, com evidência concreta de louvor, escala, repertório, cifras, ensaio ou equipe.',
        nextAction: 'Retomar exatamente a evidência citada e fazer uma pergunta curta antes de apresentar o MusicScale.',
        evidence: selected.map(item => evidence(item.message)),
      });
    } else {
      const selected = relevantMessages.slice(-3);
      signals.push({
        id: stableId('signal', `${personId}:music_scale_topic:${selected.map(item => item.message.index).join(',')}`),
        type: 'recurring_relevant_topic',
        reason: 'Esta pessoa mencionou um assunto realmente ligado ao MusicScale, mas ainda não há dor, intenção de compra ou necessidade operacional clara.',
        nextAction: 'Se fizer sentido pelo relacionamento, fazer uma pergunta consultiva para descobrir se existe uma dificuldade real antes de apresentar o produto.',
        evidence: selected.map(item => evidence(item.message)),
      });
    }

    // Relationship only refines an already evidence-qualified MusicScale contact.
    const directInteraction = isDirectConversation && ownerMessages.length > 0 && ordered.length > 0;
    const mentionMessages = ordered.filter(message => selfMentioned(message.text, input.selfNames));
    const explicitlyMentioned = mentionMessages.length > 0;
    if (directInteraction || explicitlyMentioned) {
      const selected = explicitlyMentioned
        ? mentionMessages.slice(-2)
        : relevantMessages.slice(-1).map(item => item.message);
      signals.push({
        id: stableId('signal', `${personId}:relationship:${selected.map(item => item.index).join(',') || 'direct'}`),
        type: 'commercial_followup_due',
        reason: explicitlyMentioned
          ? 'Além do sinal de produto, esta pessoa chamou você pelo nome ou marcou você na conversa.'
          : 'Além do sinal de produto, vocês já tiveram uma conversa direta neste histórico.',
        nextAction: 'Usar o relacionamento existente para fazer uma pergunta curta sobre a dor identificada, sem abordagem genérica.',
        evidence: selected.map(evidence),
      });
    }

    if (isDirectConversation) {
      const ownerSalesMessages = ownerMessages.filter(message => classifyMusicScaleEvidence(message.text) === 'explicit');
      const lastOwnerSales = ownerSalesMessages
        .filter(ownerMessage => {
          const previousPerson = ordered.some(personMessage => personMessage.index < ownerMessage.index);
          const laterPerson = ordered.some(personMessage => personMessage.index > ownerMessage.index);
          return previousPerson && !laterPerson;
        })
        .slice(-1)[0];
      if (lastOwnerSales && daysBetween(lastOwnerSales.dateKey, today) >= 2) {
        signals.push({
          id: stableId('signal', `${personId}:commercial_followup_due:${lastOwnerSales.index}`),
          type: 'commercial_followup_due',
          reason: 'Você já apresentou o MusicScale ou uma solução diretamente relacionada e não há resposta posterior da pessoa neste export.',
          nextAction: 'Fazer um follow-up curto, útil e sem pressão, retomando o ponto que vocês já conversaram.',
          evidence: [evidence(lastOwnerSales)],
        });
      }
    }

    if (isLeadershipRole(displayName, ordered)) {
      const selected = relevantMessages.slice(-1).map(item => item.message);
      signals.push({
        id: stableId('signal', `${personId}:leadership_role`),
        type: 'unanswered_conversation',
        reason: 'O contato tem evidência de liderança e também possui contexto real ligado ao MusicScale.',
        nextAction: 'Fazer uma abordagem respeitosa e consultiva baseada no trecho real que gerou o sinal.',
        evidence: selected.map(evidence),
      });
    }

    people.push({
      id: personId,
      displayName,
      normalizedName,
      phone: extractPhone(displayName),
      messageCount: ordered.length,
      firstDateKey: ordered[0]?.dateKey || null,
      lastDateKey: ordered[ordered.length - 1]?.dateKey || null,
      signals,
    });
  }

  const priority: Record<RadarSignalType, number> = {
    explicit_product_interest: 0,
    commercial_followup_due: 1,
    unanswered_conversation: 2,
    recurring_relevant_topic: 3,
  };

  return people.sort((a, b) => {
    const aRank = Math.min(...a.signals.map(signal => priority[signal.type]));
    const bRank = Math.min(...b.signals.map(signal => priority[signal.type]));
    if (aRank !== bRank) return aRank - bRank;
    return (b.lastDateKey || '').localeCompare(a.lastDateKey || '');
  });
}
