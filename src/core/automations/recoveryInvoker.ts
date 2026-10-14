import { createHmac } from 'node:crypto';
/** One bounded authenticated invocation; queue leases own retries, not this transport. */
export async function invokeAutomationRecovery(options: {
  origin: string; secret: string; limit?: number; now?: () => number; fetchImpl?: typeof fetch;
}): Promise<{ processed: number }> {
  const url = new URL(options.origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/' ||
      !(url.hostname === 'connect.millionsnest.com' || ['connect-api-u3w4hccnga-uc.a.run.app', 'connect-api-staging-u3w4hccnga-uc.a.run.app'].includes(url.hostname) ||
        /^connect-api(?:-staging)?-555464791734\.us-central1\.run\.app$/.test(url.hostname))) {
    throw new Error('INVALID_RECOVERY_ORIGIN');
  }
  if (typeof options.secret !== 'string' || options.secret.length < 32 || options.secret.length > 4096) throw new Error('RECOVERY_SECRET_REQUIRED');
  const limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('INVALID_RECOVERY_BATCH');
  const timestamp = String((options.now ?? Date.now)());
  if (!/^\d{13}$/.test(timestamp)) throw new Error('INVALID_RECOVERY_TIME');
  const body = JSON.stringify({ limit });
  const signature = createHmac('sha256', options.secret).update('worker\n' + timestamp + '\n' + body).digest('hex');
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(new URL('/api/core/automations/worker', url), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'x-connect-timestamp': timestamp, 'x-connect-signature': signature }, body,
    });
  } catch { throw new Error('RECOVERY_TRANSPORT_UNCERTAIN'); }
  if (!response.ok) throw new Error(response.status === 404 ? 'RECOVERY_EXECUTION_DISABLED' : 'RECOVERY_REQUEST_REJECTED');
  let result: { processed?: unknown };
  try { result = await response.json(); } catch { throw new Error('INVALID_RECOVERY_RESPONSE'); }
  if (!Number.isInteger(result?.processed) || Number(result.processed) < 0 || Number(result.processed) > limit) throw new Error('INVALID_RECOVERY_RESPONSE');
  return { processed: Number(result.processed) };
}
