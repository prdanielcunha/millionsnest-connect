import type { LiveConnectSession } from './liveConnectSession';
export type FinanceEntityOption = { id: string; displayName: string };
export type FinanceSummary = { awaitingUpload: number; needsClassification: number; pendingReview: number };
const safeId = (value: unknown): value is string => typeof value === 'string' && !!value && value.length <= 180 && value === value.trim() && !['.', '..'].includes(value) && !/[\\/\u0000-\u001f]/.test(value);

async function read(session: LiveConnectSession, operation: 'entities' | 'pending-documents', entityId: string | undefined, signal: AbortSignal, fetchImpl: typeof fetch) {
  if (!safeId(session.expectedOrganizationId) || (operation === 'pending-documents' && !safeId(entityId))) throw new Error('INVALID_FINANCE_SCOPE');
  const response = await fetchImpl(`/api/core/tools/nestfinance/${operation}`, {
    method: 'POST', cache: 'no-store', signal,
    headers: { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: session.expectedOrganizationId, ...(entityId ? { financeEntityId: entityId } : {}) }),
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'FINANCE_SESSION_REQUIRED' : response.status === 403 ? 'FINANCE_ACCESS_DENIED' : 'FINANCE_READ_UNAVAILABLE');
  const data = await response.json();
  if (data?.schemaVersion !== 1) throw new Error('INVALID_FINANCE_RESPONSE');
  return data;
}
export async function listFinanceEntities(session: LiveConnectSession, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<{ entities: FinanceEntityOption[]; limited: boolean }> {
  const data = await read(session, 'entities', undefined, signal, fetchImpl);
  if (data.organizationId !== session.expectedOrganizationId || !Array.isArray(data.entities) || data.entities.length > 25 || typeof data.limited !== 'boolean' ||
      data.entities.some((item: any) => !item || !safeId(item.id) || typeof item.displayName !== 'string' || !item.displayName.trim() || item.displayName.length > 120 || /[\u0000-\u001f]/.test(item.displayName)) || new Set(data.entities.map((item: any) => item.id)).size !== data.entities.length) throw new Error('INVALID_FINANCE_RESPONSE');
  return { limited: data.limited, entities: data.entities.map((item: any) => ({ id: item.id, displayName: item.displayName })) };
}
export async function readFinancePendingDocuments(session: LiveConnectSession, entityId: string, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<FinanceSummary> {
  const data = await read(session, 'pending-documents', entityId, signal, fetchImpl);
  const keys = ['awaitingUpload', 'needsClassification', 'pendingReview'] as const;
  if (!data.summary || keys.some(key => !Number.isSafeInteger(data.summary[key]) || data.summary[key] < 0)) throw new Error('INVALID_FINANCE_RESPONSE');
  return { awaitingUpload: data.summary.awaitingUpload, needsClassification: data.summary.needsClassification, pendingReview: data.summary.pendingReview };
}
