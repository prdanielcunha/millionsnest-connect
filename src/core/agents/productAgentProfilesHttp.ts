import type express from 'express';
import type { CanonicalContextProvider } from '../runtime/connectCore';
import type { ConnectInboxOperatorDirectory } from '../inbox/hubFirestoreInboxOperatorDirectory';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import { CONNECT_PRODUCTS, type ConnectProduct } from '../routing/productRouting';
import { productAgentProfile } from './productAgentProfiles';

export function createProductAgentProfilesHandler(options: {
  contextProvider: CanonicalContextProvider; directory: ConnectInboxOperatorDirectory; owners: Partial<Record<ConnectProduct, string>>;
}) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.headers.authorization, organizationId = req.query.organizationId;
    if (typeof token !== 'string' || token.length > 8192 || !/^Bearer\s+\S+$/i.test(token)) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    if (typeof organizationId !== 'string' || !organizationId.trim() || organizationId !== organizationId.trim() || ['.', '..'].includes(organizationId) || organizationId.length > 180 || /[\\/\u0000-\u001f]/.test(organizationId)) return res.status(400).json({ code: 'ORGANIZATION_REQUIRED' });
    try {
      const result = await options.contextProvider.resolve({ authToken: token, requestedOrganizationId: organizationId });
      if (result.status !== 'resolved' || result.context.organizationId !== organizationId || !evaluateConnectInboxAuthority(result.context, 'manage').allowed) return res.status(403).json({ code: 'AGENT_PROFILES_ACCESS_DENIED' });
      const profiles = await Promise.all((Object.keys(CONNECT_PRODUCTS) as ConnectProduct[]).map(async product => {
        const uid = options.owners[product];
        let verified = false;
        if (uid) try { verified = await options.directory.verify({ organizationId, uid }); } catch { /* Never expose or assign an unverified owner. */ }
        return { ...productAgentProfile(product), owner: verified ? { state: 'verified', uid } : { state: 'unassigned', uid: null } };
      }));
      return res.json({ success: true, organizationId, configurationSource: 'server_defaults_and_verified_product_owners', profiles });
    } catch { return res.status(503).json({ code: 'AGENT_PROFILES_UNAVAILABLE' }); }
  };
}
