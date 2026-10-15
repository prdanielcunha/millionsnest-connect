import { createHash } from 'node:crypto';
import { CONNECT_PRODUCTS, type ConnectProduct } from '../routing/productRouting';
import { PRODUCT_AGENT_PROFILES, type AgentLocale } from './productAgentProfiles';

export type AgentCommunicationStyle = 'practical' | 'careful' | 'welcoming';
export type ProductAgentSettings = {
  enabled: boolean;
  communicationStyle: AgentCommunicationStyle;
  ownerUid: string | null;
  overview: Record<AgentLocale, string>;
  intake: Record<AgentLocale, string>;
};
export type ProductAgentRevision = {
  requestId: string; actorRef: string; digest: string; version: number; at: string;
};
export type ProductAgentSettingsRecord = {
  organizationId: string; product: ConnectProduct; version: number;
  settings: ProductAgentSettings; revisions: ProductAgentRevision[];
};
export type ProductAgentSettingsWrite = {
  organizationId: string; product: ConnectProduct; actorUid: string;
  expectedVersion: number; requestId: string; settings: ProductAgentSettings;
};
export interface ProductAgentSettingsStore {
  read(scope: { organizationId: string; product: ConnectProduct }): Promise<ProductAgentSettingsRecord | null>;
  save(input: ProductAgentSettingsWrite): Promise<{ record: ProductAgentSettingsRecord; replayed: boolean }>;
}
export function validAgentScope(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 180 && value.trim() === value &&
    !['.', '..'].includes(value) && !/[\\/\u0000-\u001f\u007f]/.test(value);
}
export function validAgentProduct(value: unknown): value is ConnectProduct {
  return typeof value === 'string' && Object.hasOwn(CONNECT_PRODUCTS, value);
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).length !== allowed.length || !Object.keys(value).every(k => allowed.includes(k))) throw new Error('AGENT_SETTINGS_INVALID');
}
function localized(value: unknown): Record<AgentLocale, string> {
  if (!object(value)) throw new Error('AGENT_SETTINGS_INVALID');
  const locales: AgentLocale[] = ['pt-BR', 'en-US', 'es-ES'];
  keys(value, locales);
  for (const locale of locales) {
    const text = value[locale];
    // Curated public plain text. URLs remain the immutable official app link.
    if (typeof text !== 'string' || !text.trim() || text.length > 1200 || /[\u0000-\u001f\u007f]|https?:\/\/|www\.|wa\.me|\[mn-origin:/i.test(text)) throw new Error('AGENT_SETTINGS_INVALID');
  }
  return { 'pt-BR': value['pt-BR'] as string, 'en-US': value['en-US'] as string, 'es-ES': value['es-ES'] as string };
}
export function parseAgentSettings(value: unknown): ProductAgentSettings {
  if (!object(value)) throw new Error('AGENT_SETTINGS_INVALID');
  keys(value, ['enabled', 'communicationStyle', 'ownerUid', 'overview', 'intake']);
  if (typeof value.enabled !== 'boolean' || !['practical', 'careful', 'welcoming'].includes(value.communicationStyle as string) ||
      (value.ownerUid !== null && !validAgentScope(value.ownerUid))) throw new Error('AGENT_SETTINGS_INVALID');
  return { enabled: value.enabled, communicationStyle: value.communicationStyle as AgentCommunicationStyle,
    ownerUid: value.ownerUid as string | null, overview: localized(value.overview), intake: localized(value.intake) };
}
export function defaultAgentSettings(product: ConnectProduct, ownerUid?: string): ProductAgentSettings {
  const profile = PRODUCT_AGENT_PROFILES[product];
  return { enabled: true, communicationStyle: profile.style, ownerUid: ownerUid ?? null,
    overview: { ...profile.overview }, intake: { ...profile.intake } };
}
export function parseAgentSettingsRecord(value: unknown, scope: { organizationId: string; product: ConnectProduct }): ProductAgentSettingsRecord {
  if (!object(value) || value.organizationId !== scope.organizationId || value.product !== scope.product ||
      !Number.isSafeInteger(value.version) || (value.version as number) < 1 || !Array.isArray(value.revisions) ||
      value.revisions.length < 1 || value.revisions.length > 20) throw new Error('AGENT_SETTINGS_STORAGE_INVALID');
  const revisionCount = value.revisions.length;
  const revisions = value.revisions.map((r: unknown, index: number) => {
    if (!object(r) || typeof r.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(r.requestId) ||
        typeof r.actorRef !== 'string' || !/^[a-f0-9]{64}$/.test(r.actorRef) || typeof r.digest !== 'string' || !/^[a-f0-9]{64}$/.test(r.digest) ||
        r.version !== (value.version as number) - revisionCount + index + 1 ||
        typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at))) throw new Error('AGENT_SETTINGS_STORAGE_INVALID');
    return { requestId: r.requestId, actorRef: r.actorRef, digest: r.digest, version: r.version as number, at: r.at };
  });
  if (new Set(revisions.map(r => r.requestId)).size !== revisions.length) throw new Error('AGENT_SETTINGS_STORAGE_INVALID');
  return { organizationId: scope.organizationId, product: scope.product, version: value.version as number, settings: parseAgentSettings(value.settings), revisions };
}
/** Pure revision transition; a durable adapter must enforce an atomic compare-and-set. */
export function reviseAgentSettings(current: ProductAgentSettingsRecord | null, input: ProductAgentSettingsWrite, now: Date) {
  if (!validAgentScope(input.organizationId) || !validAgentProduct(input.product) || !validAgentScope(input.actorUid) ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || input.expectedVersion >= Number.MAX_SAFE_INTEGER ||
      typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId)) throw new Error('AGENT_SETTINGS_INVALID');
  const settings = parseAgentSettings(input.settings);
  if (current) current = parseAgentSettingsRecord(current, input);
  const actorRef = createHash('sha256').update(`connect-agent-actor:v1:${input.organizationId}:${input.actorUid}`).digest('hex');
  const digest = createHash('sha256').update(JSON.stringify({ expectedVersion: input.expectedVersion, settings })).digest('hex');
  const previous = current?.revisions.find(r => r.requestId === input.requestId);
  if (previous) {
    if (previous.actorRef !== actorRef || previous.digest !== digest || previous.version !== current!.version) throw new Error('AGENT_SETTINGS_CONFLICT');
    return { record: current!, replayed: true };
  }
  if ((current?.version ?? 0) !== input.expectedVersion) throw new Error('AGENT_SETTINGS_CONFLICT');
  const version = input.expectedVersion + 1;
  const record: ProductAgentSettingsRecord = { organizationId: input.organizationId, product: input.product, version, settings,
    revisions: [...(current?.revisions ?? []), { requestId: input.requestId, actorRef, digest, version, at: now.toISOString() }].slice(-20) };
  return { record, replayed: false };
}
