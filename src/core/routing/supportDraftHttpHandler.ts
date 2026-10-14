import type express from 'express';
import type { CanonicalContextProvider } from '../runtime/connectCore';
import type { WhatsAppConnectionBinding } from '../channels/whatsappConnectionRegistry';
import { CONNECT_PRODUCTS, type ConnectProduct } from './productRouting';
import { createSupportOriginHttpHandler } from './supportOriginHttpHandler';

/** A manually opened public support draft, never an outbound provider send or a domain grant. */
export function createSupportDraftHttpHandler(options: {
  contextProvider: CanonicalContextProvider; secret: string;
  bindings: readonly WhatsAppConnectionBinding[];
  provider: { getDisplayPhoneNumber(id: string): Promise<string> };
  now?: () => number;
}) {
  const issue = createSupportOriginHttpHandler(options.contextProvider, options.secret, options.now);
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['product', 'organizationId', 'locale'].includes(key)) ||
        body.locale !== undefined && !['pt-BR', 'en-US', 'es-ES'].includes(body.locale)) {
      return res.status(400).json({ code: 'INVALID_SUPPORT_DRAFT' });
    }
    let status = 200, result: any;
    const capture = { setHeader() {}, status(code: number) { status = code; return capture; }, json(value: unknown) { result = value; return capture; } };
    // The existing issuer revalidates the caller's requested tenant and app entitlement.
    // The public central support number grants no access to that support organization's data.
    await issue({ headers: req.headers, body: { product: body.product, organizationId: body.organizationId } } as express.Request, capture as unknown as express.Response);
    if (status !== 200) return res.status(status).json(result);
    const active = options.bindings.filter(binding => binding.enabled);
    if (active.length !== 1) return res.status(409).json({ code: 'OFFICIAL_SUPPORT_NUMBER_AMBIGUOUS' });
    try {
      const number = await options.provider.getDisplayPhoneNumber(active[0].phoneNumberId);
      if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error();
      const label = CONNECT_PRODUCTS[body.product as ConnectProduct].label;
      const message = body.locale === 'en-US' ? `I need support with ${label}.` : body.locale === 'es-ES' ? `Necesito ayuda con ${label}.` : `Preciso de suporte sobre o ${label}.`;
      const url = new URL(`https://wa.me/${number}`);
      url.searchParams.set('text', message + '\n' + result.originHint);
      return res.json({ product: result.product, expiresAt: result.expiresAt, draftUrl: url.toString(), automaticSend: false });
    } catch { return res.status(503).json({ code: 'OFFICIAL_SUPPORT_NUMBER_UNAVAILABLE' }); }
  };
}
