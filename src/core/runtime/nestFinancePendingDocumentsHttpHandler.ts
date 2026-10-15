import { randomUUID } from 'node:crypto';
import type express from 'express';
import type { CanonicalContextProvider } from './connectCore';
const BASE = 'https://nestfinance.millionsnest.com/api/finance-gateway?operation=';
const safeId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 180 && value === value.trim() && !['.', '..'].includes(value) && !/[\\/\u0000-\u001f]/.test(value);
/** Real Core read-tool boundary. Hub grants app access; Finance alone authorizes entity scope and finance.view. */
type Options = {
  contextProvider: CanonicalContextProvider; fetchImpl?: typeof fetch;
  audit?: (event: { event: string; requestId: string; tool: string; result: string }) => void;
};
export function createNestFinancePendingDocumentsHttpHandler(options: Options) { return createFinanceReadHandler(options, false); }
export function createNestFinanceEntitiesHttpHandler(options: Options) { return createFinanceReadHandler(options, true); }
function createFinanceReadHandler(options: Options, selector: boolean) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const requestId = randomUUID();
    const audit = (result: string) => { try { options.audit?.({ event: 'connect_tool_evaluated', requestId, tool: selector ? 'nestfinance.entities' : 'nestfinance.pending_documents', result }); } catch { /* audit sink cannot expose upstream response */ } };
    const fail = (status: number, code: string) => { audit(code); return res.status(status).json({ code, requestId }); };
    const authToken = req.headers.authorization;
    if (typeof authToken !== 'string' || authToken.length > 8192 || !/^Bearer\s+\S+$/i.test(authToken)) return fail(401, 'AUTH_REQUIRED');
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !(selector ? ['organizationId'] : ['organizationId', 'financeEntityId']).includes(key)) ||
      !safeId(body.organizationId) || (!selector && !safeId(body.financeEntityId))) return fail(400, 'INVALID_FINANCE_TOOL_SCOPE');
    try {
      const authority = await options.contextProvider.resolve({ authToken, requestedOrganizationId: body.organizationId });
      if (authority.status !== 'resolved' || authority.context.organizationId !== body.organizationId || authority.context.appAccess.nestfinance !== true) return fail(403, 'FINANCE_APP_ACCESS_REQUIRED');
      // Entity is only a requested selector: Finance revalidates its actual membership scope.
      const response = await (options.fetchImpl ?? fetch)(BASE + (selector ? 'connect-entities' : 'connect-pending-documents'), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Authorization: authToken, 'X-Connect-User-Authorization': authToken, 'x-organization-id': authority.context.organizationId, 'Content-Type': 'application/json' },
        body: JSON.stringify(selector ? {} : { financeEntityId: body.financeEntityId }),
      });
      if (!response.ok) {
        if ([401, 403, 404, 409].includes(response.status)) return fail(response.status, 'FINANCE_CONTEXT_UNAVAILABLE');
        return fail(503, 'FINANCE_TOOL_UNAVAILABLE');
      }
      const result = await response.json();
      if (selector) {
        if (result?.schemaVersion !== 1 || result.organizationId !== authority.context.organizationId || typeof result.limited !== 'boolean' || !Array.isArray(result.entities) || result.entities.length > 25 ||
            result.entities.some((item: any) => !item || !safeId(item.id) || typeof item.displayName !== 'string' || !item.displayName.trim() || item.displayName.length > 120 || /[\u0000-\u001f]/.test(item.displayName)) || new Set(result.entities.map((item: any) => item.id)).size !== result.entities.length) return fail(503, 'FINANCE_TOOL_INVALID_RESPONSE');
        audit('read_success');
        return res.json({ schemaVersion: 1, requestId, organizationId: result.organizationId, limited: result.limited, entities: result.entities.map((item: any) => ({ id: item.id, displayName: item.displayName })) });
      }
      const keys = ['awaitingUpload', 'needsClassification', 'pendingReview'] as const;
      if (result?.schemaVersion !== 1 || !result.summary || keys.some(key => !Number.isSafeInteger(result.summary[key]) || result.summary[key] < 0)) return fail(503, 'FINANCE_TOOL_INVALID_RESPONSE');
      audit('read_success');
      return res.json({ schemaVersion: 1, requestId, summary: Object.fromEntries(keys.map(key => [key, result.summary[key]])) });
    } catch { return fail(503, 'FINANCE_TOOL_UNAVAILABLE'); }
  };
}
