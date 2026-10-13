import express from 'express';
import type { CanonicalContextProvider } from './connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import type { ConnectInboxOperatorDirectory } from '../inbox/hubFirestoreInboxOperatorDirectory';

export function createConnectInboxOperatorDirectoryHttpHandler(options: {
  contextProvider: CanonicalContextProvider;
  directory: ConnectInboxOperatorDirectory;
}) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !/^Bearer\s+\S+$/i.test(auth.trim())) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
    }
    const raw = req.query.organizationId;
    const organizationId = typeof raw === 'string' ? raw.trim() : '';
    if (!organizationId || organizationId.length > 180 ||
        organizationId.includes('/') || organizationId.includes('\\')) {
      return res.status(400).json({ success: false, code: 'INBOX_SCOPE_REQUIRED' });
    }
    let result;
    try {
      result = await options.contextProvider.resolve({
        authToken: auth.trim(), requestedOrganizationId: organizationId,
      });
    } catch {
      return res.status(503).json({ success: false, code: 'CANONICAL_CONTEXT_UNAVAILABLE' });
    }
    if (result.status !== 'resolved') {
      return res.status(result.status === 'identity_required' ? 401 : 403)
        .json({ success: false, code: 'INBOX_ACCESS_DENIED' });
    }
    if (result.context.organizationId !== organizationId) {
      return res.status(409).json({ success: false, code: 'ORGANIZATION_CONTEXT_MISMATCH' });
    }
    if (!evaluateConnectInboxAuthority(result.context, 'manage').allowed) {
      return res.status(403).json({ success: false, code: 'INBOX_MANAGE_REQUIRED' });
    }
    try {
      const operators = await options.directory.list({ organizationId });
      return res.status(200).json({ success: true, organizationId, operators });
    } catch {
      return res.status(503).json({ success: false, code: 'INBOX_DIRECTORY_UNAVAILABLE' });
    }
  };
}
