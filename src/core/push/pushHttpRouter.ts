import { createPushDiagnostic } from './pushDiagnostic';
import type { PushSender } from './inboxPushService';
import express from 'express';
import type { CanonicalContextProvider } from '../runtime/connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import type { ConnectThreadStore } from '../inbox/threadStore';
import type { PushStore } from './firestorePushStore';
import { pushId, validateSubscription } from './pushPolicy';

export function createPushRouter(contextProvider: CanonicalContextProvider, store: PushStore, publicKey: string, threads?: ConnectThreadStore, diagnostics?: { sender: PushSender; deliveryMode: 'test' | 'live' }) {
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
  async function lastInbound(organizationId: string, conversationId: string) {
    if (!threads) throw new Error('PUSH_THREADS_UNAVAILABLE');
    const scope = { organizationId, conversationId };
    if (!await threads.load(scope)) return null;
    const events = await threads.readEvents(scope);
    return events.filter(e => e.eventType === 'MESSAGE_REPLIED')
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.eventId.localeCompare(a.eventId))[0]?? null;
  }
  router.post('/unread', async (req, res) => {
    const ids = req.body?.conversationIds;
    if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !id || id.length > 180 || /[\\/]/.test(id))) {
      res.status(400).json({ code: 'INVALID_CONVERSATIONS' }); return;
    }
    try {
      const { organizationId, actorUid } = res.locals.pushContext;
      const markers = await store.readMarkers(organizationId, actorUid);
      const unread: Record<string, { eventId: string; evidenceRef: string }> = Object.create(null);
      // Batched reads cap concurrent Firestore work; browser IDs never select another tenant.
      for (let offset = 0; offset < ids.length; offset += 5) {
        const results = await Promise.all(ids.slice(offset, offset + 5).map(async conversationId => {
          const latest = await lastInbound(organizationId, conversationId);
          return latest && markers[conversationId]?.eventId !== latest.eventId ? { conversationId, eventId: latest.eventId, evidenceRef: latest.evidenceRef } : null;
        }));
        for (const item of results) if (item) unread[item.conversationId] = { eventId: item.eventId, evidenceRef: item.evidenceRef };
      }
      res.json({ unread });
    } catch { res.status(503).json({ code: 'PUSH_READ_STATE_UNAVAILABLE' }); }
  });
  router.post('/read', async (req, res) => {
    const id = req.body?.conversationId;
    if (typeof id !== 'string' || !id || id.length > 180 || /[\\/]/.test(id)) { res.status(400).json({ code: 'INVALID_CONVERSATION' }); return; }
    try {
      const { organizationId, actorUid } = res.locals.pushContext;
      const latest = await lastInbound(organizationId, id);
      if (!latest) { res.status(404).json({ code: 'THREAD_MESSAGE_NOT_FOUND' }); return; }
      if (typeof req.body.expectedEventId !== 'string' || req.body.expectedEventId !== latest.eventId) { res.status(409).json({ code: 'PUSH_READ_MESSAGE_CHANGED' }); return; }
      await store.markRead(organizationId, actorUid, id, latest.eventId);
      res.status(204).end();
    } catch { res.status(503).json({ code: 'PUSH_READ_STATE_UNAVAILABLE' }); }
  });
  if (diagnostics) router.post('/test', createPushDiagnostic(store, diagnostics.sender));
  router.get('/', async (_req, res) => {
    try {
      const { organizationId, actorUid } = res.locals.pushContext;
      const devices = (await store.list(organizationId)).filter(d => d.actorUid === actorUid && Date.parse(d.expiresAt) > Date.now());
      res.json({ publicKey, deliveryMode: diagnostics?.deliveryMode ?? 'live', devices: devices.map(({ id, enabled, expiresAt, quietStart, quietEnd, timeZone }) =>
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
