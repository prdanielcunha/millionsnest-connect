import { ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';
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

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'na', 'no', 'aqui', 'from', 'at', 'of', 'the', 'del', 'la', 'el', 'e']);

function snippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 260);
}

function unknownLabel(value: string): boolean {
  if (normalizePhone(value)) return true;
  const clean = value.trim().toLowerCase();
  return !clean || ['unknown', 'desconhecido', 'contato', 'contact'].includes(clean);
}

function cleanCandidate(raw: string): string | null {
  const parts = raw.replace(/[“”"']/g, '').replace(/^\s*(?:o|a|el|la)\s+/i, '').trim().split(/\s+/);
  const selected: string[] = [];
  for (const part of parts) {
    const cleaned = part.replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');
    const normalized = normalizeIdentityName(cleaned);
    if (!normalized) continue;
    if (selected.length > 0 && STOP.has(normalized)) break;
    selected.push(cleaned);
    if (selected.length >= 4) break;
  }
  while (selected.length && ROLE_ONLY.has(normalizeIdentityName(selected[0]))) selected.shift();
  const value = selected.filter(Boolean).join(' ').trim();
  const normalized = normalizeIdentityName(value);
  if (!normalized || normalized.length < 2 || normalized.length > 70 || /\d/.test(value)) return null;
  if (ROLE_ONLY.has(normalized)) return null;
  return value;
}

function introductionCandidate(text: string): string | null {
  const patterns = [
    /\b(?:meu nome (?:é|e)|me chamo|aqui quem fala (?:é|e)|quem fala (?:é|e)|aqui (?:é|e)(?: o| a)?|sou(?: o| a))\s+([^.!?;,\n]{2,80})/iu,
    /\b(?:my name is|this is|i['’]?m)\s+([^.!?;,\n]{2,80})/iu,
    /\b(?:me llamo|soy)\s+([^.!?;,\n]{2,80})/iu,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = match ? cleanCandidate(match[1]) : null;
    if (candidate) return candidate;
  }
  return null;
}

function addressedCandidate(text: string): string | null {
  const match = /^(?:(?:oi|olá|ola|hey|hola|bom dia|boa tarde|boa noite)\s+)?@?([\p{L}][\p{L}'’-]{2,}(?:\s+[\p{L}][\p{L}'’-]{2,})?)\s*[,!:]/iu.exec(text.trim());
  return match ? cleanCandidate(match[1]) : null;
}

function phonePairCandidate(text: string, phone: string | null): string | null {
  if (!phone) return null;
  const digits = text.replace(/\D/g, '');
  const suffix = phone.slice(-8);
  if (suffix.length < 8 || !digits.includes(suffix)) return null;
  const patterns = [
    /(?:contato|telefone|n[uú]mero|whatsapp)\s+(?:do|da|de)?\s*([\p{L}][\p{L}'’-]{2,}(?:\s+[\p{L}][\p{L}'’-]{2,}){0,2})/iu,
    /([\p{L}][\p{L}'’-]{2,}(?:\s+[\p{L}][\p{L}'’-]{2,}){0,2})\s*[-–:]?\s*\+?\d[\d\s().-]{7,}/u,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = match ? cleanCandidate(match[1]) : null;
    if (candidate) return candidate;
  }
  return null;
}

function confidence(score: number): IdentityConfidence {
  if (score >= 85) return 'high';
  if (score >= 65) return 'medium';
  if (score >= 50) return 'low';
  return 'none';
}

export function inferProbableIdentity(input: { displayName: string; phone?: string | null; messages: ParsedWhatsAppMessage[]; sourceId: string }): ProbableIdentity {
  if (!unknownLabel(input.displayName)) return { probableName: null, normalizedProbableName: '', confidence: 'none', score: 0, evidence: [] };
  const phone = normalizePhone(input.phone || input.displayName);
  const target = normalizeIdentityName(input.displayName);
  const candidates = new Map<string, { name: string; max: number; evidence: IdentityInferenceEvidence[] }>();
  const add = (name: string | null, score: number, kind: IdentityEvidenceKind, message: ParsedWhatsAppMessage) => {
    if (!name) return;
    const normalized = normalizeIdentityName(name);
    if (!normalized) return;
    const current = candidates.get(normalized) || { name, max: 0, evidence: [] };
    current.max = Math.max(current.max, score);
    current.evidence.push({ kind, score, sourceId: input.sourceId, messageIndex: message.index, dateKey: message.dateKey, sender: message.sender, snippet: snippet(message.text) });
    candidates.set(normalized, current);
  };
  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index];
    const senderMatches = normalizeIdentityName(message.sender) === target || Boolean(phone && normalizePhone(message.sender) === phone);
    if (senderMatches) {
      add(introductionCandidate(message.text), 94, 'self_introduction', message);
      const previous = input.messages[index - 1];
      if (previous && normalizeIdentityName(previous.sender) !== target) add(addressedCandidate(previous.text), 64, 'direct_address_reply', previous);
    } else {
      add(phonePairCandidate(message.text, phone), 88, 'phone_name_pair', message);
    }
  }
  const ranked = Array.from(candidates.entries()).map(([normalized, value]) => ({
    normalized,
    name: value.name,
    score: Math.min(98, value.max + Math.max(0, value.evidence.length - 1) * 4),
    evidence: value.evidence.sort((a, b) => b.score - a.score || b.messageIndex - a.messageIndex).slice(0, 5),
  })).sort((a, b) => b.score - a.score || b.evidence.length - a.evidence.length);
  const best = ranked[0];
  if (!best || best.score < 50) return { probableName: null, normalizedProbableName: '', confidence: 'none', score: 0, evidence: [] };
  const second = ranked[1];
  const score = second && second.score >= best.score - 4 ? Math.min(best.score, 64) : best.score;
  return { probableName: best.name, normalizedProbableName: best.normalized, confidence: confidence(score), score, evidence: best.evidence };
}
