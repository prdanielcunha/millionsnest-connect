import crypto from 'node:crypto';
import { RadarPerson, RadarSignal } from './radarSignals';

export type PotentialLevel = 'very_high' | 'high' | 'medium' | 'low' | 'unknown';
export type ManualPriority = 'normal' | 'important' | 'priority';
export type IdentityMatchKind = 'strong' | 'ambiguous' | 'conflict' | 'none';

export type IdentityMatch = {
  kind: IdentityMatchKind;
  confidence: number;
  reasons: string[];
};

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function normalizeIdentityName(value: unknown): string {
  return typeof value === 'string'
    ? value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
    : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim())
    : [];
}

export function compareIdentity(
  incoming: Pick<RadarPerson, 'displayName' | 'normalizedName' | 'phone'>,
  existing: Record<string, unknown>,
): IdentityMatch {
  const incomingPhone = normalizePhone(incoming.phone);
  const existingPhone = normalizePhone(existing.phone);
  const incomingName = normalizeIdentityName(incoming.normalizedName || incoming.displayName);
  const existingName = normalizeIdentityName(existing.normalizedName || existing.displayName);
  const confirmedAliases = new Set(stringArray(existing.identityConfirmedAliases).map(normalizeIdentityName));
  const blockedAliases = new Set(stringArray(existing.identityBlockedAliases).map(normalizeIdentityName));

  if (incomingPhone && existingPhone && incomingPhone !== existingPhone) {
    return {
      kind: incomingName && incomingName === existingName ? 'conflict' : 'none',
      confidence: incomingName && incomingName === existingName ? 18 : 0,
      reasons: incomingName && incomingName === existingName ? ['same_name_different_phone'] : [],
    };
  }

  if (incomingPhone && existingPhone && incomingPhone === existingPhone) {
    return { kind: 'strong', confidence: 100, reasons: ['same_normalized_phone'] };
  }

  if (incomingName && confirmedAliases.has(incomingName) && !blockedAliases.has(incomingName)) {
    return { kind: 'strong', confidence: 96, reasons: ['user_confirmed_alias'] };
  }

  if (incomingName && blockedAliases.has(incomingName)) {
    return { kind: 'conflict', confidence: 0, reasons: ['user_confirmed_separate'] };
  }

  if (incomingName && existingName && incomingName === existingName) {
    return { kind: 'ambiguous', confidence: 58, reasons: ['same_normalized_name'] };
  }

  const existingAliases = new Set(stringArray(existing.identityAliases).map(normalizeIdentityName));
  if (incomingName && existingAliases.has(incomingName)) {
    return { kind: 'ambiguous', confidence: 52, reasons: ['same_known_alias'] };
  }

  return { kind: 'none', confidence: 0, reasons: [] };
}

export function automaticPotentialFromPriority(priority: number): PotentialLevel {
  if (priority === 0) return 'very_high';
  if (priority === 1) return 'high';
  if (priority === 2) return 'medium';
  if (priority === 3) return 'low';
  return 'unknown';
}

export function potentialRank(level: unknown): number {
  const rank: Record<PotentialLevel, number> = {
    very_high: 0,
    high: 1,
    medium: 2,
    low: 3,
    unknown: 4,
  };
  return typeof level === 'string' && level in rank ? rank[level as PotentialLevel] : 4;
}

export function manualPriorityRank(value: unknown): number {
  if (value === 'priority') return 0;
  if (value === 'important') return 1;
  return 2;
}

export function mergeSignals(existingValue: unknown, incoming: RadarSignal[]): RadarSignal[] {
  const map = new Map<string, RadarSignal>();
  if (Array.isArray(existingValue)) {
    for (const signal of existingValue as RadarSignal[]) {
      if (signal?.id) map.set(signal.id, signal);
    }
  }
  for (const signal of incoming) {
    if (signal?.id) map.set(signal.id, signal);
  }
  return Array.from(map.values());
}

export function uniqueStrings(...values: unknown[]): string[] {
  const result = new Set<string>();
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) result.add(item.trim());
      }
    } else if (typeof value === 'string' && value.trim()) {
      result.add(value.trim());
    }
  }
  return Array.from(result);
}

export function newPersonDocumentId(sourceId: string, person: RadarPerson): string {
  const phone = normalizePhone(person.phone);
  const seed = phone ? `phone:${phone}` : `source:${sourceId}:person:${person.id}`;
  return `person_${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
}

export function safeEffectivePotential(person: Record<string, unknown>): PotentialLevel {
  const manual = person.manualPotential;
  if (manual === 'very_high' || manual === 'high' || manual === 'medium' || manual === 'low' || manual === 'unknown') {
    return manual;
  }
  const automatic = person.automaticPotential;
  if (automatic === 'very_high' || automatic === 'high' || automatic === 'medium' || automatic === 'low' || automatic === 'unknown') {
    return automatic;
  }
  return automaticPotentialFromPriority(Number(person.priority ?? 99));
}
