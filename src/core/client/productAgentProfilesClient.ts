import type { LiveConnectSession } from './liveConnectSession';
import type { LanguageCode } from '../../types';

type Product = 'musicscale' | 'nestfinance' | 'nestjourney';
export type ProductAgentView = {
  product: Product; label: string; communicationStyle: 'practical' | 'careful' | 'welcoming';
  overview: Record<LanguageCode, string>; intake: Record<LanguageCode, string>; url: string;
  allowedToolRefs: string[]; ownerVerified: boolean;
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
    seen.add(value.product);
    return { product: value.product, label: value.label, communicationStyle: value.communicationStyle,
      overview: localized(value.knowledge.overview), intake: localized(value.knowledge.intake), url: value.knowledge.url,
      allowedToolRefs: [...value.allowedToolRefs], ownerVerified: value.owner.state === 'verified' };
  });
}
