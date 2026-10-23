/** Public, self-reported routing metadata. Never identity, tenant or permission evidence. */
export const SUPPORT_PRODUCTS = { hub: 'MillionsNest', musicscale: 'MusicScale', nestfinance: 'NestFinance', nestjourney: 'NestJourney', nestlocal: 'NestLocal', nestaffiliate: 'NestAffiliate' } as const;
export const SUPPORT_SOURCES = ['website', 'app', 'hub'] as const;
export const SUPPORT_TOPICS = ['help', 'error', 'access', 'billing', 'sales', 'other'] as const;
export type SupportContext = {
  product: keyof typeof SUPPORT_PRODUCTS;
  source: typeof SUPPORT_SOURCES[number];
  topic: typeof SUPPORT_TOPICS[number];
};
export const SUPPORT_COPY = {
  'pt-BR': { title: 'Como podemos ajudar?', subtitle: 'Atendimento oficial MillionsNest', action: 'Continuar no WhatsApp', hint: 'A mensagem será preparada. Toque em Enviar no WhatsApp para iniciar o atendimento.', privacy: 'Não envie senhas, códigos de acesso ou dados de cartão.', unavailable: 'Não foi possível abrir o WhatsApp agora. Tente novamente em instantes.', topics: { help: 'Ajuda para usar', error: 'Algo não funcionou', access: 'Entrar na minha conta', billing: 'Assinatura e cobrança', sales: 'Conhecer os planos', other: 'Outro assunto' }, sources: { website: 'Site', app: 'Aplicativo', hub: 'Painel MillionsNest' }, greeting: 'Olá! Preciso de atendimento sobre' },
  'en-US': { title: 'How can we help?', subtitle: 'Official MillionsNest support', action: 'Continue on WhatsApp', hint: 'Your message will be prepared. Tap Send in WhatsApp to start the conversation.', privacy: 'Do not send passwords, sign-in codes or card details.', unavailable: 'Could not open WhatsApp right now. Please try again shortly.', topics: { help: 'Help using the app', error: 'Something went wrong', access: 'Sign in to my account', billing: 'Subscription and billing', sales: 'Explore plans', other: 'Something else' }, sources: { website: 'Website', app: 'Application', hub: 'MillionsNest dashboard' }, greeting: 'Hello! I need support with' },
  'es-ES': { title: '¿Cómo podemos ayudarte?', subtitle: 'Atención oficial MillionsNest', action: 'Continuar en WhatsApp', hint: 'El mensaje estará preparado. Pulsa Enviar en WhatsApp para iniciar la conversación.', privacy: 'No envíes contraseñas, códigos de acceso ni datos de tarjeta.', unavailable: 'No se pudo abrir WhatsApp ahora. Inténtalo de nuevo en unos instantes.', topics: { help: 'Ayuda para usar', error: 'Algo no funcionó', access: 'Entrar en mi cuenta', billing: 'Suscripción y cobros', sales: 'Conocer los planes', other: 'Otro asunto' }, sources: { website: 'Sitio web', app: 'Aplicación', hub: 'Panel MillionsNest' }, greeting: '¡Hola! Necesito ayuda con' },
} as const;
export type SupportLocale = keyof typeof SUPPORT_COPY;
export function validSupportContext(value: unknown): value is SupportContext {
  if (!value || typeof value !== 'object') return false;
  const v = value as SupportContext;
  return typeof v.product === 'string' && typeof v.source === 'string' && typeof v.topic === 'string' && Object.hasOwn(SUPPORT_PRODUCTS, v.product) && SUPPORT_SOURCES.includes(v.source) && SUPPORT_TOPICS.includes(v.topic);
}
export function supportMarker(context: SupportContext): string {
  return `[mn-support:v1:${context.product}:${context.source}:${context.topic}]`;
}
export function parseSupportContext(text: string): SupportContext | null {
  const markers = text.match(/\[mn-support:[^\]\r\n]*\]/g) ?? [];
  if (markers.length !== 1) return null;
  const match = markers[0].match(/^\[mn-support:v1:([a-z]+):([a-z]+):([a-z]+)\]$/);
  if (!match) return null;
  const context = { product: match[1], source: match[2], topic: match[3] };
  return validSupportContext(context) ? context : null;
}
export function supportDescription(context: SupportContext, locale: SupportLocale): string {
  return `${SUPPORT_PRODUCTS[context.product]} · ${SUPPORT_COPY[locale].sources[context.source]} · ${SUPPORT_COPY[locale].topics[context.topic]}`;
}
