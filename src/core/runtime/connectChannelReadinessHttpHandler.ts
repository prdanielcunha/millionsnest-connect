import express from 'express';
import type { CanonicalContextProvider } from './connectCore';
import {
  evaluateConnectChannelReadiness,
  type ConnectChannelReadiness,
} from '../channels/channelReadiness';
import {
  probeConnectRuntimeFirestoreReadiness,
  type ConnectRuntimeFirestoreReadiness,
} from './firestoreRuntimeReadiness';

export interface ConnectChannelReadinessHttpHandlerOptions {
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
  return raw.trim().slice(0, 256);
}

function mayAdminChannels(context: {
  globalAccess: boolean;
  organizationRole: string | null;
  capabilities: string[];
  permissions: string[];
}): boolean {
  if (context.globalAccess) return true;
  const role = String(context.organizationRole || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/admin|administrator|administrador|owner|dono/.test(role)) return true;

  const grants = new Set([...(context.capabilities || []), ...(context.permissions || [])]);
  return grants.has('channels.read') || grants.has('channels.manage');
}

export function createConnectChannelReadinessHttpHandler(
  options: ConnectChannelReadinessHttpHandlerOptions,
) {
  const env = options.env ?? process.env;
  const projectId = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || 'millionsnest';
  const probe = options.storageReadinessProbe ?? (() =>
    probeConnectRuntimeFirestoreReadiness({ projectId }));

  return async function connectChannelReadinessHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const authToken = bearer(req);
    const requestedOrganizationId = organizationId(req);

    if (!authToken) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
    }
    if (!requestedOrganizationId || requestedOrganizationId.includes('/') || requestedOrganizationId.includes('\\')) {
      return res.status(400).json({ success: false, code: 'ORGANIZATION_REQUIRED' });
    }

    let resolution;
    try {
      resolution = await options.contextProvider.resolve({
        authToken,
        requestedOrganizationId,
      });
    } catch {
      return res.status(503).json({ success: false, code: 'CANONICAL_CONTEXT_UNAVAILABLE' });
    }

    if (resolution.status !== 'resolved') {
      const status = resolution.status === 'identity_required'
        ? 401
        : resolution.status === 'organization_required'
          ? 409
          : 403;
      return res.status(status).json({
        success: false,
        code: resolution.status === 'identity_required'
          ? 'IDENTITY_REQUIRED'
          : resolution.status === 'organization_required'
            ? 'ORGANIZATION_REQUIRED'
            : 'CANONICAL_ACCESS_DENIED',
      });
    }

    if (resolution.context.organizationId !== requestedOrganizationId) {
      return res.status(409).json({ success: false, code: 'TENANT_MISMATCH' });
    }

    if (!mayAdminChannels(resolution.context)) {
      return res.status(403).json({ success: false, code: 'CHANNELS_ACCESS_DENIED' });
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

    const readiness: ConnectChannelReadiness = evaluateConnectChannelReadiness(env, storage.state);

    return res.status(200).json({
      success: true,
      organizationId: requestedOrganizationId,
      ...readiness,
    });
  };
}
