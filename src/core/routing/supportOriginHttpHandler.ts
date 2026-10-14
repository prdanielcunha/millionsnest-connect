import { createHmac } from 'node:crypto';
import type express from 'express';
import type { CanonicalContextProvider } from '../runtime/connectCore';
import { CONNECT_PRODUCTS, type ConnectProduct } from './productRouting';
/** Authenticated source hint, never an identity/tenant credential. Caller must retain its existing official support number. */
export function createSupportOriginHttpHandler(contextProvider: CanonicalContextProvider, secret: string, now = () => Date.now()) {
  if (secret.length < 32) throw new Error('SUPPORT_ORIGIN_SECRET_REQUIRED');
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const authToken = req.headers.authorization;
    if (typeof authToken !== 'string' || !/^Bearer\s+\S+$/i.test(authToken)) { res.status(401).json({ code: 'AUTH_REQUIRED' }); return; }
    const body = req.body;
    if (!body || Object.keys(body).some(k => !['product', 'organizationId'].includes(k)) || !Object.hasOwn(CONNECT_PRODUCTS, body.product) ||
        typeof body.organizationId !== 'string' || !body.organizationId || body.organizationId.length > 180 || /[\\/]/.test(body.organizationId)) {
      res.status(400).json({ code: 'INVALID_SUPPORT_ORIGIN' }); return;
    }
    const product = body.product as ConnectProduct;
    try {
      const context = await contextProvider.resolve({ authToken, requestedOrganizationId: body.organizationId });
      if (context.status !== 'resolved' || context.context.organizationId !== body.organizationId || context.context.appAccess[product] !== true) {
        res.status(403).json({ code: 'SUPPORT_APP_ACCESS_REQUIRED' }); return;
      }
      const issuedAt = now(), expiresAt = issuedAt + 600000;
      const payload = Buffer.from(JSON.stringify({ version: 1, product, issuedAt, expiresAt })).toString('base64url');
      const signature = createHmac('sha256', secret).update('connect-product-origin:v1:' + payload).digest('base64url');
      res.json({ product, expiresAt, originHint: `[mn-origin:${payload}.${signature}]` });
    } catch { res.status(503).json({ code: 'SUPPORT_AUTHORITY_UNAVAILABLE' }); }
  };
}
