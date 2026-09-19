import express from 'express';
import type { CanonicalContextProvider } from './connectCore';

export interface NestJourneyFollowupContextHttpHandlerOptions {
  contextProvider: CanonicalContextProvider;
  hubOrigin: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const SAFE_ID = /^[A-Za-z0-9._:-]{1,220}$/;

function bearerFromRequest(req: express.Request): string {
  const value = req.headers.authorization;
  return typeof value === 'string' && /^Bearer\s+\S+$/i.test(value.trim())
    ? value.trim()
    : '';
}

function safeId(value: unknown): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return SAFE_ID.test(candidate) ? candidate : '';
}

function normalizeOrigin(raw: string): string {
  const url = new URL(raw.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('MILLIONSNEST_HUB_ORIGIN is invalid.');
  }
  return url.origin;
}

function validReturnTo(value: unknown, followupId: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'nestjourney.millionsnest.com' &&
      url.pathname === '/followup-runtime' &&
      url.searchParams.get('followup') === followupId;
  } catch {
    return false;
  }
}

function validPayload(value: any, organizationId: string, followupId: string) {
  return Boolean(
    value?.success === true &&
    value?.organization?.id === organizationId &&
    typeof value?.organization?.name === 'string' &&
    value?.followup?.id === followupId &&
    typeof value?.followup?.careRequestId === 'string' &&
    typeof value?.followup?.congregationId === 'string' &&
    typeof value?.person?.name === 'string' &&
    value.person.name.trim() &&
    typeof value?.person?.phone === 'string' &&
    value.person.phone.trim() &&
    validReturnTo(value?.returnTo, followupId)
  );
}

/**
 * Authenticated Connect-side projection for one actionable NestJourney first
 * contact. Hub remains the authority and independently validates NestJourney
 * entitlement, Care capability, congregation scope, owner, consent and source.
 *
 * The same Firebase bearer is forwarded transiently. The response is never
 * cached and no person name/phone is logged by this boundary.
 */
export function createNestJourneyFollowupContextHttpHandler(
  options: NestJourneyFollowupContextHttpHandlerOptions,
) {
  const hubOrigin = normalizeOrigin(options.hubOrigin);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 8_000);

  return async function nestJourneyFollowupContextHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    const authorization = bearerFromRequest(req);
    if (!authorization) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
    }

    const organizationId = safeId(req.query.organizationId);
    const followupId = safeId(req.query.followupId);
    if (!organizationId || !followupId) {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST' });
    }

    let canonical;
    try {
      canonical = await options.contextProvider.resolve({
        authToken: authorization,
        requestedOrganizationId: organizationId,
      });
    } catch {
      return res.status(503).json({ success: false, code: 'CANONICAL_CONTEXT_UNAVAILABLE' });
    }

    if (canonical.status !== 'resolved') {
      const status = canonical.status === 'identity_required'
        ? 401
        : canonical.status === 'organization_required'
          ? 409
          : 403;
      return res.status(status).json({
        success: false,
        code: canonical.status === 'identity_required'
          ? 'IDENTITY_REQUIRED'
          : canonical.status === 'organization_required'
            ? 'ORGANIZATION_REQUIRED'
            : 'CANONICAL_ACCESS_DENIED',
      });
    }

    if (canonical.context.organizationId !== organizationId) {
      return res.status(409).json({ success: false, code: 'TENANT_MISMATCH' });
    }

    const upstream = new URL('/api/ecosystem/connect/nestjourney/followup-context', hubOrigin);
    upstream.searchParams.set('organizationId', organizationId);
    upstream.searchParams.set('followupId', followupId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(upstream.toString(), {
        method: 'GET',
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as any;

      if (!response.ok) {
        const status = [400, 401, 403, 404, 409].includes(response.status)
          ? response.status
          : 503;
        const code = typeof payload?.code === 'string'
          ? payload.code
          : status === 404
            ? 'FOLLOWUP_NOT_FOUND'
            : 'NESTJOURNEY_CONTEXT_UNAVAILABLE';
        return res.status(status).json({ success: false, code });
      }

      if (!validPayload(payload, organizationId, followupId)) {
        return res.status(502).json({ success: false, code: 'INVALID_UPSTREAM_CONTEXT' });
      }

      return res.status(200).json(payload);
    } catch (error) {
      return res.status(503).json({
        success: false,
        code: error instanceof Error && error.name === 'AbortError'
          ? 'NESTJOURNEY_CONTEXT_TIMEOUT'
          : 'NESTJOURNEY_CONTEXT_UNAVAILABLE',
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}
