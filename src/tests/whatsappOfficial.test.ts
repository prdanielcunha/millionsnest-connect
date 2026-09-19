import { createHmac } from 'node:crypto';
import {
  normalizeWhatsAppWebhookEnvelope,
  verifyWhatsAppSignature,
  verifyWhatsAppWebhookChallenge,
} from '../core/channels/whatsappOfficial';
import {
  createWhatsAppWebhookIngressHandler,
  createWhatsAppWebhookVerificationHandler,
} from '../core/runtime/whatsappOfficialWebhookHttpHandler';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
function mockRes() {
  const state: any = { statusCode: 200, body: null, headers: {}, text: '' };
  state.setHeader = (key: string, value: string) => { state.headers[key.toLowerCase()] = value; return state; };
  state.status = (code: number) => { state.statusCode = code; return state; };
  state.json = (body: unknown) => { state.body = body; return state; };
  state.type = () => state;
  state.send = (text: string) => { state.text = text; return state; };
  return state;
}

console.log('--- Running Official WhatsApp Adapter Tests ---');

{
  const result = verifyWhatsAppWebhookChallenge({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'verify-123',
    'hub.challenge': 'challenge-456',
  }, 'verify-123');
  equal(result.ok, true, 'valid webhook challenge is accepted');
  equal(result.ok ? result.challenge : '', 'challenge-456', 'challenge is returned verbatim');
}
{
  const result = verifyWhatsAppWebhookChallenge({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'wrong',
    'hub.challenge': 'challenge-456',
  }, 'verify-123');
  equal(result.ok, false, 'wrong verify token is rejected');
}
{
  const raw = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = 'app-secret';
  const signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  equal(verifyWhatsAppSignature(raw, signature, secret), true, 'valid Meta signature is accepted');
  equal(verifyWhatsAppSignature(raw, 'sha256=' + '0'.repeat(64), secret), false, 'invalid Meta signature is rejected');
}
{
  const events = normalizeWhatsAppWebhookEnvelope({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: 'phone-01' },
          messages: [{
            id: 'wamid.1',
            from: '5543999999999',
            timestamp: '1789820000',
            type: 'text',
            text: { body: 'Qual é minha próxima escala?' },
          }],
          statuses: [{
            id: 'wamid.2',
            recipient_id: '5543888888888',
            timestamp: '1789820001',
            status: 'delivered',
          }],
        },
      }],
    }],
  });
  equal(events.length, 2, 'message and delivery status are normalized');
  equal(events[0].kind, 'message', 'message event stays typed');
  equal(events[1].kind, 'status', 'status event stays typed');
}
{
  const handler = createWhatsAppWebhookVerificationHandler({
    env: {
      CONNECT_WHATSAPP_WEBHOOK_ENABLED: 'true',
      CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-123',
    },
  });
  const res = mockRes();
  handler({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-123', 'hub.challenge': 'ok' } } as any, res);
  equal(res.statusCode, 200, 'configured verification endpoint succeeds');
  equal(res.text, 'ok', 'verification endpoint returns challenge');
}
{
  const raw = Buffer.from(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'phone-01' },
      messages: [{ id: 'wamid.3', from: '5543999999999', timestamp: '1', type: 'text', text: { body: 'Oi' } }],
    } }] }],
  }));
  const secret = 'app-secret';
  const signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');

  const handler = createWhatsAppWebhookIngressHandler({
    env: {
      CONNECT_WHATSAPP_WEBHOOK_ENABLED: 'true',
      CONNECT_WHATSAPP_APP_SECRET: secret,
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  const res = mockRes();
  await handler({ body: raw, headers: { 'x-hub-signature-256': signature } } as any, res);
  equal(res.statusCode, 503, 'real message is not silently acknowledged before ingestion is mounted');
  equal(res.body.code, 'WHATSAPP_INGESTION_NOT_READY', 'ingestion gate is explicit');
}
{
  let accepted = 0;
  const raw = Buffer.from(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'phone-01' },
      statuses: [{ id: 'wamid.4', recipient_id: '5543999999999', timestamp: '1', status: 'read' }],
    } }] }],
  }));
  const secret = 'app-secret';
  const signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const handler = createWhatsAppWebhookIngressHandler({
    env: {
      CONNECT_WHATSAPP_WEBHOOK_ENABLED: 'true',
      CONNECT_WHATSAPP_APP_SECRET: secret,
    },
    ingestor: { async ingest(events) { accepted = events.length; } },
    logger: { info() {}, warn() {}, error() {} },
  });
  const res = mockRes();
  await handler({ body: raw, headers: { 'x-hub-signature-256': signature } } as any, res);
  equal(res.statusCode, 200, 'signed webhook is accepted when ingestor exists');
  equal(accepted, 1, 'normalized provider event reaches ingestor');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
