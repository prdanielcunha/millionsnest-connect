import express from 'express';
import type { CanonicalContextProvider } from './connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import { evaluateConnectInboxReadiness } from '../inbox/inboxReadiness';
import {
  probeConnectRuntimeFirestoreReadiness,
  type ConnectRuntimeFirestoreReadiness,
} from './firestoreRuntimeReadiness';

export interface ConnectInboxReadinessHttpHandlerOptions {
  contextProvider: CanonicalContextProvider;
  env?: NodeJS.ProcessEnv;
  storageReadinessProbe?: () => Promise<ConnectRuntimeFirestoreReadiness>;
}

function bearer(req: express.Request): string {
  const raw = req.headers.authorization;
  return typeof raw === 'string' && /^Bearer\s+\S+$/i.test(raw.trim())
    ? raw.trim()
    : '';
}

function organizationId(req: express.Request): string {
  const header = req.headers['x-organization-id'];
  const query = req.query.organizationId;
  const raw = typeof header === 'string'
    ? header
    : typeof query === 'string'
      ? query
      : '';
  const value = raw.trim();
  if (!value || value.length > 256 || value.includes('/') || value.includes('\\')) return '';
  return value;
}

export function createConnectInboxReadinessHttpHandler(
  options: ConnectInboxReadinessHttpHandlerOptions,
) {
  const env = options.env ?? process.env;
  const projectId = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || 'millionsnest';
  const probe = options.storageReadinessProbe ?? (() =>
    probeConnectRuntimeFirestoreReadiness({ projectId }));

  return async function connectInboxReadinessHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    const authToken = bearer(req);
    const requestedOrganizationId = organizationId(req);

    if (!authToken) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
    }
    if (!requestedOrganizationId) {
      return res.status(400).json({ success: false, code: 'ORGANIZATION_REQUIRED' });
    }

    let resolution;
    try {
      resolution = await options.contextProvider.resolve({
        authToken,
        requestedOrganizationId,
      });
    } catch {
      return res.status(503).json({
        success: false,
        code: 'CANONICAL_CONTEXT_UNAVAILABLE',
      });
    }

    if (resolution.status !== 'resolved') {
      return res.status(
        resolution.status === 'identity_required'
          ? 401
          : resolution.status === 'organization_required'
            ? 409
            : 403,
      ).json({
        success: false,
        code:
          resolution.status === 'identity_required'
            ? 'IDENTITY_REQUIRED'
            : resolution.status === 'organization_required'
              ? 'ORGANIZATION_REQUIRED'
              : 'CANONICAL_ACCESS_DENIED',
      });
    }

    if (resolution.context.organizationId !== requestedOrganizationId) {
      return res.status(409).json({
        success: false,
        code: 'TENANT_MISMATCH',
      });
    }

    const authority = evaluateConnectInboxAuthority(resolution.context, 'read');
    if ('reason' in authority) {
      return res.status(403).json({
        success: false,
        code: authority.reason,
      });
    }

    let storage: ConnectRuntimeFirestoreReadiness;
    try {
      storage = await probe();
    } catch {
      storage = {
        state: 'unknown',
        permissions: { read: false, list: false, create: false, update: false },
        source: 'project_iam_probe_unavailable',
      };
    }

    return res.status(200).json({
      success: true,
      organizationId: requestedOrganizationId,
      authoritySource: authority.source,
      ...evaluateConnectInboxReadiness(env, storage.state),
    });
  };
}
