import express from 'express';
import type { CanonicalContextProvider } from '../runtime/connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import type { PushStore } from './firestorePushStore';
import { pushId, validateSubscription } from './pushPolicy';

export function createPushRouter(contextProvider: CanonicalContextProvider, store: PushStore, publicKey: string) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' || !/^Bearer\s+\S+$/i.test(authorization)) {
      res.status(401).json({ code: 'AUTH_REQUIRED' }); return;
    }
    const org = req.method === 'GET' ? req.query.organizationId : req.body?.organizationId;
    if (typeof org !== 'string' || !org || org.length > 180 || /[\\/]/.test(org)) {
      res.status(400).json({ code: 'ORGANIZATION_REQUIRED' }); return;
    }
    try {
      const result = await contextProvider.resolve({ authToken: authorization, requestedOrganizationId: org });
      if (result.status !== 'resolved') { res.status(result.status === 'identity_required' ? 401 : 403).json({ code: 'PUSH_ACCESS_DENIED' }); return; }
      if (result.context.organizationId !== org || !evaluateConnectInboxAuthority(result.context, 'manage').allowed) {
        res.status(403).json({ code: 'PUSH_ACCESS_DENIED' }); return;
      }
      res.locals.pushContext = result.context;
      next();
    } catch { res.status(503).json({ code: 'PUSH_AUTHORITY_UNAVAILABLE' }); }
  });
  router.get('/', async (_req, res) => {
    try {
      const { organizationId, actorUid } = res.locals.pushContext;
      const devices = (await store.list(organizationId)).filter(d => d.actorUid === actorUid && Date.parse(d.expiresAt) > Date.now());
      res.json({ publicKey, devices: devices.map(({ id, enabled, expiresAt, quietStart, quietEnd, timeZone }) =>
        ({ id, enabled, expiresAt, quietStart, quietEnd, timeZone })) });
    } catch { res.status(503).json({ code: 'PUSH_STORAGE_UNAVAILABLE' }); }
  });
  router.post('/', async (req, res) => {
    let device;
    try {
      const b = req.body;
      if (!b || Object.keys(b).some(k => !['organizationId', 'subscription', 'enabled', 'quietStart', 'quietEnd', 'timeZone'].includes(k))) throw new Error();
      const subscription = validateSubscription(b.subscription);
      const quietStart = b.quietStart ?? 22, quietEnd = b.quietEnd ?? 8, timeZone = b.timeZone ?? 'America/Sao_Paulo';
      if (![quietStart, quietEnd].every(h => Number.isInteger(h) && h >= 0 && h <= 23) ||
          typeof timeZone !== 'string' || timeZone.length > 80 || typeof b.enabled !== 'boolean') throw new Error();
      new Intl.DateTimeFormat('en-US', { timeZone }).format();
      device = { id: pushId(subscription.endpoint), organizationId: res.locals.pushContext.organizationId,
        actorUid: res.locals.pushContext.actorUid, subscription, enabled: b.enabled,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), quietStart, quietEnd, timeZone };
    } catch { res.status(400).json({ code: 'INVALID_PUSH_SUBSCRIPTION' }); return; }
    try {
      const devices = await store.list(device.organizationId);
      if (devices.length >= 100 || devices.filter(d => d.actorUid === device.actorUid && d.id !== device.id).length >= 10) {
        res.status(409).json({ code: 'PUSH_DEVICE_LIMIT' }); return;
      }
      await store.save(device);
      res.status(201).json({ id: device.id, expiresAt: device.expiresAt });
    } catch { res.status(503).json({ code: 'PUSH_STORAGE_UNAVAILABLE' }); }
  });
  router.delete('/:deviceId', async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(String(req.params.deviceId))) { res.status(400).json({ code: 'INVALID_DEVICE_ID' }); return; }
    try {
      const { organizationId, actorUid } = res.locals.pushContext;
      await store.remove(organizationId, actorUid, String(req.params.deviceId));
      res.status(204).end();
    } catch { res.status(403).json({ code: 'PUSH_REVOCATION_FAILED' }); }
  });
  return router;
}
