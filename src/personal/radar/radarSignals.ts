import crypto from 'node:crypto';
import { ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';

export type RadarSignalType =
  | 'explicit_product_interest'
  | 'unanswered_conversation'
  | 'recurring_relevant_topic'
  | 'commercial_followup_due';

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

const PRODUCT_PATTERNS = [
  /\bmusicscale\b/i,
  /\bapp(?:licativo)?\b/i,
  /\bsistema\b/i,
  /\bplataforma\b/i,
  /\bpre[cç]o\b/i,
  /\bvalor\b/i,
  /\bquanto\s+custa\b/i,
  /\bteste\b/i,
  /\bexperimentar\b/i,
  /\bfunciona\b/i,
];

const RELEVANT_TOPIC_PATTERNS = [
  /\bescala(?:s)?\b/i,
  /\brepert[oó]rio\b/i,
  /\bcifra(?:s)?\b/i,
  /\bensaio(?:s)?\b/i,
  /\blouvor\b/i,
  /\bm[uú]sic[oa]s?\b/i,
  /\borganiza(?:r|[cç][aã]o|do|da)\b/i,
  /\btecnologia\b/i,
  /\bwhatsapp\b/i,
];

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
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

function hasExplicitProductInterest(text: string): boolean {
  if (/\bmusicscale\b/i.test(text)) return true;
  return hasAny(text, PRODUCT_PATTERNS) && hasAny(text, RELEVANT_TOPIC_PATTERNS);
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
  // A raw WhatsApp export does not encode reply targets reliably. We only infer
  // "you did/did not reply" when there is exactly one non-self participant.
  // In group/multi-party exports, person-specific message evidence can still
  // produce explicit/recurrent signals, but reply/follow-up inference is disabled.
  const isDirectConversation = self.size > 0 && grouped.size === 1;
  const people: RadarPerson[] = [];

  for (const [normalizedName, messages] of grouped.entries()) {
    const ordered = [...messages].sort((a, b) => a.index - b.index);
    const displayName = ordered[ordered.length - 1]?.sender || normalizedName;
    const personId = stableId('person', normalizedName);
    const signals: RadarSignal[] = [];

    const interestMessages = ordered.filter(message => hasExplicitProductInterest(message.text));
    if (interestMessages.length > 0) {
      const selected = interestMessages.slice(-2);
      signals.push({
        id: stableId('signal', `${personId}:explicit_product_interest:${selected.map(item => item.index).join(',')}`),
        type: 'explicit_product_interest',
        reason: 'Há uma menção explícita ao MusicScale ou a aplicativo/sistema em contexto de escala, repertório, organização, música ou tecnologia.',
        nextAction: 'Responder ao ponto concreto e pedir um pequeno “sim” antes de apresentar o MusicScale.',
        evidence: selected.map(evidence),
      });
    }

    const relevantMessages = ordered.filter(message => hasAny(message.text, RELEVANT_TOPIC_PATTERNS));
    if (relevantMessages.length >= 3) {
      const selected = relevantMessages.slice(-3);
      signals.push({
        id: stableId('signal', `${personId}:recurring_relevant_topic:${selected.map(item => item.index).join(',')}`),
        type: 'recurring_relevant_topic',
        reason: 'O tema de escala, repertório, organização, música ou tecnologia apareceu repetidamente na conversa.',
        nextAction: 'Retomar o tema citado pela própria pessoa e fazer uma pergunta curta de descoberta.',
        evidence: selected.map(evidence),
      });
    }

    const lastPersonMessage = ordered[ordered.length - 1];
    if (isDirectConversation && lastPersonMessage) {
      const laterOwnerReply = ownerMessages.some(message => message.index > lastPersonMessage.index);
      if (!laterOwnerReply && daysBetween(lastPersonMessage.dateKey, today) >= 1) {
        signals.push({
          id: stableId('signal', `${personId}:unanswered_conversation:${lastPersonMessage.index}`),
          type: 'unanswered_conversation',
          reason: 'Na conversa direta, a última mensagem desta pessoa ficou sem uma resposta posterior sua neste export.',
          nextAction: 'Reabrir a conversa de forma natural, respondendo ao assunto que ficou pendente.',
          evidence: [evidence(lastPersonMessage)],
        });
      }
    }

    if (isDirectConversation) {
      const ownerSalesMessages = ownerMessages.filter(message =>
        /\bmusicscale\b/i.test(message.text) ||
        (hasAny(message.text, PRODUCT_PATTERNS) && hasAny(message.text, RELEVANT_TOPIC_PATTERNS)),
      );
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
          reason: 'Na conversa direta, você mencionou explicitamente o MusicScale ou produto/app em contexto relevante e não há resposta posterior da pessoa neste export.',
          nextAction: 'Fazer um follow-up curto e útil, sem pressão, retomando exatamente o ponto já conversado.',
          evidence: [evidence(lastOwnerSales)],
        });
      }
    }

    if (!signals.length) continue;
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
