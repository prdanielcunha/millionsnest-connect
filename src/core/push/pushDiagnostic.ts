import type express from 'express';
import type { PushStore } from './firestorePushStore';
import type { PushSender } from './inboxPushService';
import { isQuiet, pushId } from './pushPolicy';
/** Explicit authenticated self-test only; never targets another actor or fabricates a conversation. */
export function createPushDiagnostic(store: PushStore, sender: PushSender, now = () => new Date()) {
  return async (req: express.Request, res: express.Response) => {
    const body = req.body;
    if (!body || Object.keys(body).some(k => !['organizationId', 'deviceId', 'locale'].includes(k)) ||
        !/^[a-f0-9]{64}$/.test(body.deviceId ?? '') || body.locale && !['pt-BR', 'en-US', 'es-ES'].includes(body.locale)) {
      res.status(400).json({ code: 'INVALID_PUSH_TEST' }); return;
    }
    try {
      const { organizationId, actorUid } = res.locals.pushContext;
      const device = await store.get(body.deviceId), date = now();
      if (!device || device.organizationId !== organizationId || device.actorUid !== actorUid) { res.status(403).json({ code: 'PUSH_TEST_DEVICE_DENIED' }); return; }
      if (!device.enabled || Date.parse(device.expiresAt) <= +date) { res.status(409).json({ code: 'PUSH_TEST_DEVICE_INACTIVE' }); return; }
      if (isQuiet(device, date)) { res.status(409).json({ code: 'PUSH_TEST_QUIET_HOURS' }); return; }
      const id = pushId('diagnostic', organizationId, actorUid, device.id, String(Math.floor(+date / 60000)));
      if (!await store.claim(id, new Date(+date + 86400000).toISOString())) { res.status(429).json({ code: 'PUSH_TEST_RATE_LIMIT' }); return; }
      try {
        await sender(device, JSON.stringify({ kind: 'push_test', locale: body.locale ?? 'pt-BR', tag: id, url: '/inbox' }));
        await store.result(id, 'accepted');
        res.json({ accepted: true, deliveryConfirmed: false });
      } catch {
        await store.result(id, 'failed');
        res.status(503).json({ code: 'PUSH_TEST_DELIVERY_UNCERTAIN' });
      }
    } catch { res.status(503).json({ code: 'PUSH_TEST_UNAVAILABLE' }); }
  };
}
