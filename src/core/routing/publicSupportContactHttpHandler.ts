import type express from 'express';
import type { WhatsAppConnectionBinding } from '../channels/whatsappConnectionRegistry';
import { SUPPORT_COPY, SUPPORT_PRODUCTS, SUPPORT_TOPICS, supportMarker, validSupportContext, type SupportLocale } from './supportIntake';

/** No send, no contact creation and no auth dependency. Destination comes from the existing provider. */
export function createPublicSupportContactHttpHandler(options: {
  bindings: readonly WhatsAppConnectionBinding[];
  provider: { getDisplayPhoneNumber(id: string): Promise<string> };
  now?: () => number;
}) {
  let cached: { number: string; until: number } | undefined;
  let pending: Promise<string> | undefined;
  const number = async () => {
    if (cached && cached.until > (options.now?.() ?? Date.now())) return cached.number;
    if (pending) return pending;
    pending = (async () => {
      const bindings = options.bindings.filter(b => b.enabled);
      if (bindings.length !== 1) throw new Error('AMBIGUOUS_SUPPORT_NUMBER');
      const value = await options.provider.getDisplayPhoneNumber(bindings[0].phoneNumberId);
      if (!/^[1-9][0-9]{7,14}$/.test(value)) throw new Error('INVALID_SUPPORT_NUMBER');
      cached = { number: value, until: (options.now?.() ?? Date.now()) + 60000 };
      return value;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://wa.me https://api.whatsapp.com https://web.whatsapp.com https://www.whatsapp.com whatsapp:; base-uri 'none'; frame-ancestors 'none'");
    const q = req.query;
    const locale: SupportLocale = typeof q.locale === 'string' && Object.hasOwn(SUPPORT_COPY, q.locale) ? q.locale as SupportLocale : 'pt-BR';
    const copy = SUPPORT_COPY[locale];
    const context = { product: q.product ?? 'hub', source: q.source ?? 'website', topic: q.topic ?? 'help' };
    if (Object.keys(q).some(k => !['product', 'source', 'topic', 'locale', 'open'].includes(k)) || !validSupportContext(context) || q.open !== undefined && q.open !== '1') {
      return res.status(400).type('text/plain').send(copy.unavailable);
    }
    if (q.open === '1') {
      try {
        const url = new URL(`https://wa.me/${await number()}`);
        url.searchParams.set('text', `${copy.greeting} ${SUPPORT_PRODUCTS[context.product]}.\n${copy.topics[context.topic]} · ${copy.sources[context.source]}\n${supportMarker(context)}`);
        return res.redirect(302, url.toString());
      } catch { return res.status(503).type('text/plain').send(copy.unavailable); }
    }
    // All interpolated values are from the finite catalog, never raw query/body content.
    return res.type('html').send(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.subtitle}</title><style>body{margin:0;background:#090e18;color:#f4f7fc;font:16px system-ui;min-height:100dvh;display:grid;place-items:center}main{box-sizing:border-box;width:min(100%,480px);padding:32px 24px}small{color:#92bfff}h1{font-size:30px;letter-spacing:-1px}p{color:#aab8cc;line-height:1.6}form{display:grid;gap:12px;margin:28px 0}select,button{font:inherit;min-height:52px;border-radius:12px;padding:12px;border:1px solid #33465e;background:#151f30;color:white}button{background:#2674dd;border:0;font-weight:650;cursor:pointer}select:focus-visible,button:focus-visible{outline:3px solid #92bfff;outline-offset:3px}</style></head><body><main><small>${copy.subtitle}</small><h1>${copy.title}</h1><p>${SUPPORT_PRODUCTS[context.product]} · ${copy.sources[context.source]}</p><form method="get"><input type="hidden" name="product" value="${context.product}"><input type="hidden" name="source" value="${context.source}"><input type="hidden" name="locale" value="${locale}"><input type="hidden" name="open" value="1"><select name="topic" aria-label="${copy.title}">${SUPPORT_TOPICS.map(topic => `<option value="${topic}"${topic === context.topic ? ' selected' : ''}>${copy.topics[topic]}</option>`).join('')}</select><button>${copy.action}</button></form><p>${copy.hint}</p><p><small>${copy.privacy}</small></p></main></body></html>`);
  };
}
