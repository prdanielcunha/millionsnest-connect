import {
  MetaWhatsAppProvider,
} from '../core/channels/metaWhatsAppProvider';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
function throws(fn: () => unknown, code: string, message: string) {
  total++;
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message === code) {
      passed++;
      return;
    }
    throw error;
  }
  throw new Error(`${message}: expected ${code}`);
}

console.log('--- Running Meta WhatsApp Provider Tests ---');

{
  let capturedUrl = '';
  let capturedAuthorization = '';
  let capturedBody: any = null;
  const provider = new MetaWhatsAppProvider({
    accessToken: 'server-secret-access-token',
    graphApiVersion: 'v99.0',
    fetchImpl: (async (input: any, init?: any) => {
      capturedUrl = String(input);
      capturedAuthorization = String(init?.headers?.Authorization || '');
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.provider.1' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });

  const result = await provider.sendText({
    phoneNumberId: '123456789',
    recipientPhone: '+55 (43) 99999-9999',
    text: 'Resposta humana',
  });

  equal(result.providerMessageId, 'wamid.provider.1', 'provider returns Meta message id');
  equal(capturedUrl, 'https://graph.facebook.com/v99.0/123456789/messages', 'provider uses official Graph endpoint');
  equal(capturedAuthorization, 'Bearer server-secret-access-token', 'access token stays in server authorization header');
  equal(capturedBody.messaging_product, 'whatsapp', 'official WhatsApp product is explicit');
  equal(capturedBody.to, '5543999999999', 'recipient is normalized before provider dispatch');
  equal(capturedBody.text.body, 'Resposta humana', 'text body is sent only in provider request');
}

{
  throws(
    () => new MetaWhatsAppProvider({
      accessToken: 'secret',
      graphApiVersion: 'latest',
    }),
    'WHATSAPP_GRAPH_VERSION_INVALID',
    'volatile Graph version must be explicit at activation time',
  );
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
