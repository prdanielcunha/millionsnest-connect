import crypto from 'node:crypto';
import { ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';

/**
 * IMPORTANT: these four persisted signal codes are also the priority buckets used
 * by PersonalRadarService. Their user-facing labels are intentionally different
 * from the original pilot wording:
 * 0 explicit_product_interest -> MusicScale fit / product pain
 * 1 commercial_followup_due   -> existing relationship / direct interaction
 * 2 unanswered_conversation   -> pastor or ministry decision-maker
 * 3 recurring_relevant_topic  -> other pastoral contact
 *
 * Keeping the persisted codes stable lets existing pilot data continue to load
 * while the Radar evolves into the sales-first priority ladder defined for Connect.
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

// Things MusicScale can actually help with. A single concrete pain/need here is
// enough to put a person in the highest Radar bucket; they do not need to know
// the MusicScale name yet.
const MUSIC_SCALE_FIT_PATTERNS = [
  /\bescala(?:s|do|da|r)?\b/i,
  /\brepert[oó]rio(?:s)?\b/i,
  /\bcifra(?:s)?\b/i,
  /\bchord(?:s)?\b/i,
  /\btom\b/i,
  /\btonalidade\b/i,
  /\btranspo(?:r|si[cç][aã]o)\b/i,
  /\blouvor\b/i,
  /\bworship\b/i,
  /\bminist[eé]rio\s+de\s+(?:louvor|m[uú]sica)\b/i,
  /\bl[ií]der\s+de\s+louvor\b/i,
  /\bministro(?:a)?\s+de\s+louvor\b/i,
  /\bvocal(?:ista|istas)?\b/i,
  /\bback\s*vocal\b/i,
  /\bm[uú]sic[oa]s?\b/i,
  /\binstrumentista(?:s)?\b/i,
  /\bbanda\b/i,
  /\bensaio(?:s)?\b/i,
  /\bset\s*list\b/i,
  /\bplaylist\b/i,
  /\bconfirma(?:r|[cç][aã]o)\b/i,
  /\bpresen[cç]a\b/i,
  /\bdisponibilidade\b/i,
  /\bfaltar\s+(?:no|ao)\s+(?:ensaio|culto)\b/i,
  /\btrocar\s+(?:o\s+)?tom\b/i,
  /\bm[uú]sicas?\s+(?:do|para\s+o)\s+culto\b/i,
  /\borganiza(?:r|[cç][aã]o|do|da)\b.{0,45}\b(?:louvor|m[uú]sic|equipe|banda|escala|repert[oó]rio)\b/i,
  /\b(?:louvor|m[uú]sic|equipe|banda|escala|repert[oó]rio)\b.{0,45}\borganiza(?:r|[cç][aã]o|do|da)\b/i,
  /\bwhatsapp\b.{0,55}\b(?:escala|repert[oó]rio|cifra|louvor|ensaio|m[uú]sic|equipe|banda)\b/i,
  /\b(?:escala|repert[oó]rio|cifra|louvor|ensaio|m[uú]sic|equipe|banda)\b.{0,55}\bwhatsapp\b/i,
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

const PASTOR_ROLE_PATTERNS = [
  /(^|\s)pr\.?($|\s)/i,
  /(^|\s)pra\.?($|\s)/i,
  /\bpastor(?:a)?\b/i,
  /\bbispo(?:a)?\b/i,
  /\bpresb[ií]tero(?:a)?\b/i,
  /\bap[oó]stolo(?:a)?\b/i,
  /\breverendo(?:a)?\b/i,
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

function hasExplicitProductInterest(text: string): boolean {
  if (/\bmusicscale\b/i.test(text)) return true;
  return hasAny(text, PRODUCT_PATTERNS) && hasAny(text, MUSIC_SCALE_FIT_PATTERNS);
}

function hasMusicScaleFit(text: string): boolean {
  return hasExplicitProductInterest(text) || hasAny(text, MUSIC_SCALE_FIT_PATTERNS);
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

function isPastoralRole(displayName: string, messages: ParsedWhatsAppMessage[]): boolean {
  return isLeadershipRole(displayName, messages) || hasAny(roleEvidenceText(displayName, messages), PASTOR_ROLE_PATTERNS);
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
  // Raw WhatsApp exports do not reliably encode quote/reply targets. Direct
  // conversation interaction is safe to infer; in groups we only treat an
  // explicit textual mention of one of the owner's names as person-specific.
  const isDirectConversation = self.size > 0 && grouped.size === 1;
  const people: RadarPerson[] = [];

  for (const [normalizedName, messages] of grouped.entries()) {
    const ordered = [...messages].sort((a, b) => a.index - b.index);
    const displayName = ordered[ordered.length - 1]?.sender || normalizedName;
    const personId = stableId('person', normalizedName);
    const signals: RadarSignal[] = [];
    const lastPersonMessage = ordered[ordered.length - 1];

    // Priority 1: concrete MusicScale fit. One real pain/need is enough.
    const fitMessages = ordered.filter(message => hasMusicScaleFit(message.text));
    if (fitMessages.length > 0) {
      const selected = fitMessages.slice(-3);
      signals.push({
        id: stableId('signal', `${personId}:music_scale_fit:${selected.map(item => item.index).join(',')}`),
        type: 'explicit_product_interest',
        reason: /\bmusicscale\b/i.test(selected.map(item => item.text).join(' '))
          ? 'Esta pessoa já citou o MusicScale ou demonstrou interesse direto em algo que o produto resolve.'
          : 'Esta pessoa falou sobre uma necessidade diretamente ligada ao MusicScale, como louvor, escala, repertório, cifras, ensaio, equipe, confirmação ou organização.',
        nextAction: 'Retomar exatamente o assunto citado e fazer uma pergunta curta antes de apresentar o MusicScale.',
        evidence: selected.map(evidence),
      });
    }

    // Priority 2: existing relationship. In a direct export, messages from both
    // sides prove an actual conversation. In groups, only explicit name/@mention
    // is considered person-specific; adjacency is deliberately not treated as a reply.
    const directInteraction = isDirectConversation && ownerMessages.length > 0 && ordered.length > 0;
    const mentionMessages = ordered.filter(message => selfMentioned(message.text, input.selfNames));
    const explicitlyMentioned = mentionMessages.length > 0;
    if (directInteraction || explicitlyMentioned) {
      const selected = explicitlyMentioned
        ? mentionMessages.slice(-2)
        : [lastPersonMessage].filter(Boolean) as ParsedWhatsAppMessage[];
      signals.push({
        id: stableId('signal', `${personId}:relationship:${selected.map(item => item.index).join(',') || 'direct'}`),
        type: 'commercial_followup_due',
        reason: explicitlyMentioned
          ? 'Esta pessoa chamou você pelo nome ou marcou você na conversa, então já existe um ponto natural para retomar o contato.'
          : 'Vocês já tiveram uma conversa direta neste histórico, o que torna uma abordagem pessoal mais natural do que um contato frio.',
        nextAction: 'Retomar a relação de forma pessoal e descobrir como essa pessoa organiza hoje o louvor e a equipe.',
        evidence: selected.map(evidence),
      });
    }

    // Keep overdue commercial follow-up evidence inside the same relationship
    // bucket so it naturally ranks ahead of cold pastoral contacts.
    if (isDirectConversation) {
      const ownerSalesMessages = ownerMessages.filter(message =>
        /\bmusicscale\b/i.test(message.text) ||
        (hasAny(message.text, PRODUCT_PATTERNS) && hasAny(message.text, MUSIC_SCALE_FIT_PATTERNS)),
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
          reason: 'Você já apresentou o MusicScale ou uma solução relacionada e não há resposta posterior da pessoa neste export.',
          nextAction: 'Fazer um follow-up curto, útil e sem pressão, retomando o ponto que vocês já conversaram.',
          evidence: [evidence(lastOwnerSales)],
        });
      }
    }

    const leadershipRole = isLeadershipRole(displayName, ordered);
    const pastoralRole = isPastoralRole(displayName, ordered);

    // Priority 3: pastors/ministry leaders who look like decision makers for the
    // worship operation. If they also fit priorities 1 or 2, min-rank wins.
    if (leadershipRole) {
      signals.push({
        id: stableId('signal', `${personId}:leadership_role`),
        type: 'unanswered_conversation',
        reason: 'O histórico indica um papel de liderança com influência direta na igreja ou no ministério de louvor.',
        nextAction: 'Fazer uma abordagem respeitosa e consultiva, começando por como a equipe de louvor é organizada hoje.',
        evidence: lastPersonMessage ? [evidence(lastPersonMessage)] : [],
      });
    } else if (pastoralRole) {
      // Priority 4: remaining pastoral contacts. This intentionally surfaces them
      // even without a MusicScale keyword, but always below fit and relationship.
      signals.push({
        id: stableId('signal', `${personId}:pastoral_contact`),
        type: 'recurring_relevant_topic',
        reason: 'Este contato aparenta ser pastor ou liderança pastoral e pode ser relevante para uma apresentação futura do MusicScale.',
        nextAction: 'Só abordar depois dos contatos com dor ou relacionamento mais forte; use uma mensagem pessoal, curta e sem pressão.',
        evidence: lastPersonMessage ? [evidence(lastPersonMessage)] : [],
      });
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
