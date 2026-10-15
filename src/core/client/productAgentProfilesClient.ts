import type { LiveConnectSession } from './liveConnectSession';
import type { LanguageCode } from '../../types';
import type { ProductAgentSettings } from '../agents/productAgentSettings';

type Product = 'musicscale' | 'nestfinance' | 'nestjourney';
export type ProductAgentView = {
  product: Product; label: string; communicationStyle: 'practical' | 'careful' | 'welcoming';
  overview: Record<LanguageCode, string>; intake: Record<LanguageCode, string>; url: string;
  allowedToolRefs: string[]; ownerVerified: boolean;
  enabled: boolean; version: number; settingsEditable: boolean; ownerUid: string | null;
};
const urls = { musicscale: 'https://musicscale.millionsnest.com', nestfinance: 'https://nestfinance.millionsnest.com', nestjourney: 'https://nestjourney.millionsnest.com' };
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f]/.test(value);
function localized(value: unknown): Record<LanguageCode, string> {
  const source = value as Record<string, unknown> | null;
  if (!source || !['pt-BR', 'en-US', 'es-ES'].every(key => text(source[key]))) throw new Error('INVALID_AGENT_PROFILES');
  return { 'pt-BR': source['pt-BR'] as string, 'en-US': source['en-US'] as string, 'es-ES': source['es-ES'] as string };
}
/** Only a bounded display projection; server-side Hub checks remain authoritative. */
export async function listProductAgentProfiles(session: LiveConnectSession, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<ProductAgentView[]> {
  const response = await fetchImpl(`/api/core/agents/product-profiles?organizationId=${encodeURIComponent(session.expectedOrganizationId)}`, {
    method: 'GET', headers: { Authorization: `Bearer ${session.idToken}` }, cache: 'no-store', signal,
  });
  if (response.status === 401) throw new Error('AGENT_SESSION_REQUIRED');
  if (response.status === 403) throw new Error('AGENT_ACCESS_DENIED');
  if (!response.ok) throw new Error('AGENT_PROFILES_UNAVAILABLE');
  const result = await response.json();
  if (result?.success !== true || result.organizationId !== session.expectedOrganizationId || !Array.isArray(result.profiles) || result.profiles.length !== 3) throw new Error('INVALID_AGENT_PROFILES');
  const seen = new Set<string>();
  return result.profiles.map((value: any) => {
    if (!value || !Object.hasOwn(urls, value.product) || seen.has(value.product) || !text(value.label) || value.label.length > 80 ||
        !['practical', 'careful', 'welcoming'].includes(value.communicationStyle) || value.executionMode !== 'deterministic_public_knowledge' || value.modelCost !== 0 || value.humanFallback !== true ||
        value.knowledge?.url !== urls[value.product as Product] || !Array.isArray(value.allowedToolRefs) || value.allowedToolRefs.length > 10 ||
        !value.allowedToolRefs.every((item: unknown) => typeof item === 'string' && /^[a-z][a-z0-9_.-]{0,100}$/.test(item)) ||
        !['verified', 'unassigned'].includes(value.owner?.state)) throw new Error('INVALID_AGENT_PROFILES');
    if ((value.enabled !== undefined && typeof value.enabled !== 'boolean') ||
        (value.version !== undefined && (!Number.isSafeInteger(value.version) || value.version < 0)) ||
        (value.settingsEditable !== undefined && typeof value.settingsEditable !== 'boolean') ||
        (value.owner.state === 'verified' && (!text(value.owner.uid) || value.owner.uid.length > 180 || /[\\/]/.test(value.owner.uid)))) throw new Error('INVALID_AGENT_PROFILES');
    seen.add(value.product);
    return { product: value.product, label: value.label, communicationStyle: value.communicationStyle,
      overview: localized(value.knowledge.overview), intake: localized(value.knowledge.intake), url: value.knowledge.url,
      allowedToolRefs: [...value.allowedToolRefs], ownerVerified: value.owner.state === 'verified', ownerUid: value.owner.state === 'verified' ? value.owner.uid : null,
      enabled: value.enabled ?? true, version: value.version ?? 0, settingsEditable: value.settingsEditable ?? false };
  });
}

/** Explicit save only. Bearer and drafts are never written to browser storage. */
export async function saveProductAgentSettings(session: LiveConnectSession, input: {
  product: Product; expectedVersion: number; requestId: string; settings: ProductAgentSettings; publicKnowledgeConfirmed: boolean;
}, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<{ version: number; replayed: boolean }> {
  if (!Object.hasOwn(urls, input.product) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 ||
      !/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId) || input.publicKnowledgeConfirmed !== true) throw new Error('AGENT_SETTINGS_INVALID');
  const response = await fetchImpl(`/api/core/agents/product-profiles/${input.product}?organizationId=${encodeURIComponent(session.expectedOrganizationId)}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' }, cache: 'no-store', signal,
    body: JSON.stringify({ expectedVersion: input.expectedVersion, requestId: input.requestId, settings: input.settings, publicKnowledgeConfirmed: true }),
  });
  if (response.status === 401) throw new Error('AGENT_SESSION_REQUIRED');
  if (response.status === 403) throw new Error('AGENT_ACCESS_DENIED');
  if (response.status === 409) throw new Error('AGENT_SETTINGS_CONFLICT');
  if (response.status === 400) throw new Error('AGENT_SETTINGS_INVALID');
  if (!response.ok) throw new Error('AGENT_SETTINGS_UNAVAILABLE');
  const result = await response.json();
  if (result?.success !== true || result.organizationId !== session.expectedOrganizationId || result.product !== input.product ||
      !Number.isSafeInteger(result.version) || result.version <= input.expectedVersion || typeof result.replayed !== 'boolean') throw new Error('INVALID_AGENT_SETTINGS_RESULT');
  return { version: result.version, replayed: result.replayed };
}

export type ProductAgentOwnerChoice = { uid: string; displayName: string };
export async function listProductAgentOwners(session: LiveConnectSession, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<ProductAgentOwnerChoice[]> {
  const response = await fetchImpl(`/api/core/inbox/operators?organizationId=${encodeURIComponent(session.expectedOrganizationId)}`, {
    headers: { Authorization: `Bearer ${session.idToken}`, 'X-Organization-Id': session.expectedOrganizationId }, cache: 'no-store', signal,
  });
  if (!response.ok) throw new Error('AGENT_OWNERS_UNAVAILABLE');
  const result = await response.json();
  if (result?.success !== true || result.organizationId !== session.expectedOrganizationId || !Array.isArray(result.operators) || result.operators.length > 100) throw new Error('INVALID_AGENT_OWNERS');
  const seen = new Set<string>();
  return result.operators.map((value: unknown) => {
    const owner = value as Record<string, unknown> | null;
    if (!owner || !text(owner.uid) || owner.uid.length > 180 || /[\\/]/.test(owner.uid) || seen.has(owner.uid) || !text(owner.displayName) || owner.displayName.length > 80) throw new Error('INVALID_AGENT_OWNERS');
    seen.add(owner.uid);
    return { uid: owner.uid, displayName: owner.displayName };
  });
}
