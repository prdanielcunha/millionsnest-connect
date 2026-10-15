import type express from 'express';
import type { CanonicalContextProvider } from '../runtime/connectCore';
import type { ConnectInboxOperatorDirectory } from '../inbox/hubFirestoreInboxOperatorDirectory';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import { CONNECT_PRODUCTS, type ConnectProduct } from '../routing/productRouting';
import { productAgentProfile } from './productAgentProfiles';
import { defaultAgentSettings, parseAgentSettings, validAgentProduct, validAgentScope, type ProductAgentSettingsStore } from './productAgentSettings';

type AgentHandlerOptions = {
  contextProvider: CanonicalContextProvider; directory: ConnectInboxOperatorDirectory; owners: Partial<Record<ConnectProduct, string>>;
  settingsStore?: ProductAgentSettingsStore;
  settingsEditable?: boolean;
};
async function manager(req: express.Request, options: AgentHandlerOptions) {
  const token = req.headers.authorization, organizationId = req.query.organizationId;
  if (typeof token !== 'string' || token.length > 8192 || !/^Bearer\s+\S+$/i.test(token)) return { status: 401, code: 'AUTH_REQUIRED' } as const;
  if (!validAgentScope(organizationId)) return { status: 400, code: 'ORGANIZATION_REQUIRED' } as const;
  const result = await options.contextProvider.resolve({ authToken: token, requestedOrganizationId: organizationId });
  if (result.status !== 'resolved' || result.context.organizationId !== organizationId || !evaluateConnectInboxAuthority(result.context, 'manage').allowed) return { status: 403, code: 'AGENT_PROFILES_ACCESS_DENIED' } as const;
  return { status: 200, organizationId, actorUid: result.context.actorUid } as const;
}

export function createProductAgentProfilesHandler(options: AgentHandlerOptions) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const authority = await manager(req, options);
      if (authority.status !== 200) return res.status(authority.status).json({ code: authority.code });
      const { organizationId } = authority;
      const profiles = await Promise.all((Object.keys(CONNECT_PRODUCTS) as ConnectProduct[]).map(async product => {
        const stored = await options.settingsStore?.read({ organizationId, product });
        const settings = stored?.settings ?? defaultAgentSettings(product, options.owners[product]);
        const uid = settings.ownerUid;
        let verified = false;
        if (uid) try { verified = await options.directory.verify({ organizationId, uid }); } catch { /* Never expose or assign an unverified owner. */ }
        const profile = productAgentProfile(product);
        return { ...profile, communicationStyle: settings.communicationStyle,
          knowledge: { ...profile.knowledge, overview: settings.overview, intake: settings.intake },
          enabled: settings.enabled, version: stored?.version ?? 0, settingsEditable: !!options.settingsStore && options.settingsEditable !== false,
          owner: verified ? { state: 'verified', uid } : { state: 'unassigned', uid: null } };
      }));
      return res.json({ success: true, organizationId, configurationSource: options.settingsStore ? 'tenant_settings_and_verified_product_owners' : 'server_defaults_and_verified_product_owners', profiles });
    } catch { return res.status(503).json({ code: 'AGENT_PROFILES_UNAVAILABLE' }); }
  };
}

export function createProductAgentSettingsHandler(options: AgentHandlerOptions) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!options.settingsStore || options.settingsEditable === false) return res.status(404).json({ code: 'AGENT_SETTINGS_DISABLED' });
    try {
      const authority = await manager(req, options);
      if (authority.status !== 200) return res.status(authority.status).json({ code: authority.code });
      const product = req.params.product;
      const body = req.body;
      if (!validAgentProduct(product) || !body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).length !== 4 || !Object.keys(body).every(k => ['expectedVersion', 'requestId', 'settings', 'publicKnowledgeConfirmed'].includes(k)) ||
          body.publicKnowledgeConfirmed !== true || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || body.expectedVersion >= Number.MAX_SAFE_INTEGER ||
          typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId)) return res.status(400).json({ code: 'AGENT_SETTINGS_INVALID' });
      const settings = parseAgentSettings(body.settings);
      if (settings.ownerUid && !await options.directory.verify({ organizationId: authority.organizationId, uid: settings.ownerUid })) return res.status(403).json({ code: 'AGENT_OWNER_ACCESS_DENIED' });
      const saved = await options.settingsStore.save({ organizationId: authority.organizationId, product, actorUid: authority.actorUid,
        expectedVersion: body.expectedVersion, requestId: body.requestId, settings });
      return res.json({ success: true, organizationId: authority.organizationId, product, version: saved.record.version, replayed: saved.replayed });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'AGENT_SETTINGS_INVALID') return res.status(400).json({ code });
      if (code === 'AGENT_SETTINGS_CONFLICT') return res.status(409).json({ code });
      return res.status(503).json({ code: 'AGENT_SETTINGS_UNAVAILABLE' });
    }
  };
}
