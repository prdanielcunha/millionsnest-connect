import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { resolveConnectCoreIntent } from '../runtime/connectCore';
export type ConnectProduct = 'musicscale' | 'nestfinance' | 'nestjourney';
export const CONNECT_PRODUCTS = {
  musicscale: { label: 'MusicScale', tools: ['get_next_schedule', 'get_next_schedule_repertoire', 'get_next_schedule_presence', 'get_next_schedule_chart'] },
  nestfinance: { label: 'NestFinance', tools: [] },
  nestjourney: { label: 'NestJourney', tools: [] },
} as const;
export type ProductRouteDecision = {
  product: ConnectProduct | null; kind: 'route' | 'clarify';
  source: 'explicit_product' | 'signed_origin' | 'conversation_context' | 'music_intent' | 'ambiguous';
};
export function routingId(...parts: string[]) { return createHash('sha256').update(JSON.stringify(parts)).digest('hex'); }
/** Origin proves product provenance only. It never grants identity, tenant access or tools. */
export function verifyProductOrigin(text: string, secret: string | undefined, nowMs: number): ConnectProduct | null {
  const match = text.match(/\[mn-origin:([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\]/);
  if (!match || !secret || secret.length < 32 || match[0].length > 2048) return null;
  try {
    const signature = Buffer.from(match[2], 'base64url');
    const expected = createHmac('sha256', secret).update('connect-product-origin:v1:' + match[1]).digest();
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
    const payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    if (payload.version !== 1 || !Object.hasOwn(CONNECT_PRODUCTS, payload.product) ||
        !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt) ||
        payload.issuedAt > nowMs + 30000 || payload.expiresAt <= nowMs ||
        payload.expiresAt <= payload.issuedAt || payload.expiresAt - payload.issuedAt > 600000) return null;
    return payload.product;
  } catch { return null; }
}
export function routeProduct(text: string, current: ConnectProduct | null, nowMs: number, originSecret?: string): ProductRouteDecision {
  const clean = text.replace(/\[mn-origin:[^\]]*\]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const explicit = (Object.keys(CONNECT_PRODUCTS) as ConnectProduct[]).filter(p => new RegExp(`\\b${p}\\b`, 'i').test(clean));
  const signed = verifyProductOrigin(text, originSecret, nowMs);
  if (explicit.length > 1 || text.includes('[mn-origin:') && !signed || signed && explicit.length && explicit[0] !== signed) {
    return { product: current, kind: 'clarify', source: 'ambiguous' };
  }
  if (explicit.length === 1) return { product: explicit[0], kind: 'route', source: signed ? 'signed_origin' : 'explicit_product' };
  if (signed) return { product: signed, kind: 'route', source: 'signed_origin' };
  if (current) return { product: current, kind: 'route', source: 'conversation_context' };
  if (resolveConnectCoreIntent(clean) !== 'unknown') return { product: 'musicscale', kind: 'route', source: 'music_intent' };
  return { product: null, kind: 'clarify', source: 'ambiguous' };
}
export type ProductRoutingState = {
  organizationId: string; conversationId: string; product: ConnectProduct | null;
  lastOrder: string; decisions: Record<string, ProductRouteDecision>;
  history: Array<{ eventId: string; product: ConnectProduct; occurredAt: string }>;
};
export interface ProductRouteStore {
  decide(input: { organizationId: string; conversationId: string; eventId: string; occurredAt: string; text: string }, nowMs: number, originSecret?: string): Promise<ProductRouteDecision | null>;
}
export function applyProductRoute(state: ProductRoutingState | null, input: Parameters<ProductRouteStore['decide']>[0], nowMs: number, originSecret?: string) {
  if (state && (state.organizationId !== input.organizationId || state.conversationId !== input.conversationId)) throw new Error('PRODUCT_ROUTING_SCOPE_MISMATCH');
  if (state && Object.hasOwn(state.decisions, input.eventId)) return { state, decision: state.decisions[input.eventId], duplicate: true };
  const order = `${new Date(input.occurredAt).toISOString()}:${input.eventId}`;
  if (state && order.slice(0, 24) < state.lastOrder.slice(0, 24)) return { state, decision: null, duplicate: true };
  const decision = routeProduct(input.text, state?.product ?? null, nowMs, originSecret);
  const next: ProductRoutingState = state ? { ...state, decisions: { ...state.decisions }, history: [...state.history] } : {
    organizationId: input.organizationId, conversationId: input.conversationId, product: null, lastOrder: '', decisions: {}, history: [],
  };
  if (decision.kind === 'route' && decision.product !== next.product) {
    next.product = decision.product;
    next.history.push({ eventId: input.eventId, product: decision.product!, occurredAt: new Date(input.occurredAt).toISOString() });
    next.history = next.history.slice(-20);
  }
  next.lastOrder = order;
  Object.defineProperty(next.decisions, input.eventId, { value: decision, enumerable: true, writable: true, configurable: true });
  next.decisions = Object.fromEntries(Object.entries(next.decisions).slice(-100));
  return { state: next, decision, duplicate: false };
}
