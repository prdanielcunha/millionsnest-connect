import { bootstrapLiveConnectSession } from '../core/client/liveConnectSession';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
function ok(value: unknown, message: string) {
  total++;
  if (!value) throw new Error(message);
  passed++;
}

const now = 1_700_000_000_000;
const handoff = {
  appId: 'connect',
  protocolVersion: '1.0.0',
  orgId: 'org-1',
  userId: 'user-1',
  customToken: 'custom-token',
  expiresAt: now + 300_000,
  supportMode: false,
};
const encoded = Buffer.from(JSON.stringify(handoff), 'utf8').toString('base64');

console.log('--- Running Live Connect Session Tests ---');

{
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let replacedUrl = '';
  const fetchFn = (async (input: any, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      const request = JSON.parse(String(init?.body || '{}'));
      equal(request.token, 'custom-token', 'custom token is exchanged, not used as Core bearer');
      return new Response(JSON.stringify({ idToken: 'firebase-id-token', localId: 'user-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.startsWith('/api/core/session')) {
      equal((init?.headers as any)?.Authorization, 'Bearer firebase-id-token', 'canonical session uses exchanged ID token');
      return new Response(JSON.stringify({
        success: true,
        protocolVersion: '1.0.0',
        user: { uid: 'user-1', displayName: 'Daniel', systemRole: 'user', capabilities: [] },
        activeOrganizationId: 'org-1',
        activeOrganization: {
          id: 'org-1',
          name: 'OBPC',
          slug: 'obpc',
          organizationRole: 'owner',
          permissions: ['scales.read'],
          capabilities: [],
        },
        appAccess: { musicscale: { accessible: true } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url === '/api/core/message') {
      equal((init?.headers as any)?.Authorization, 'Bearer firebase-id-token', 'Core message uses Firebase ID token');
      const body = JSON.parse(String(init?.body || '{}'));
      equal(body.requestedOrganizationId, 'org-1', 'Core message is pinned to canonical handoff organization');
      return new Response(JSON.stringify({
        status: 'success',
        humanSummary: 'Sua próxima escala é amanhã.',
        auditId: 'audit-1',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const session = await bootstrapLiveConnectSession({
    locationHref: `https://connect.example/start?ecosystem_ctx=${encodeURIComponent(encoded)}`,
    replaceUrl: (url) => { replacedUrl = url; },
    fetchFn,
    now: () => now,
    configuredApiKey: 'public-api-key',
  });

  ok(!replacedUrl.includes('ecosystem_ctx'), 'credential-bearing handoff is removed from browser history immediately');
  equal(session.expectedOrganizationId, 'org-1', 'live session is tenant bound');
  equal(session.context.activeOrganization.id, 'org-1', 'UI context comes from canonical session');
  equal(session.context.user.uid, 'user-1', 'canonical identity matches handoff identity');

  const result = await session.sendMessage('Qual é minha próxima escala?', 'conversation-1', 'pt-BR');
  equal(result.status, 'success', 'live Core response succeeds');
  equal(result.auditId, 'audit-1', 'downstream audit id reaches UI safely');
  ok(calls.every((call) => !String(call.init?.body || '').includes('firebase-id-token')), 'ID token is never copied into JSON bodies');
}

{
  let threw = false;
  try {
    await bootstrapLiveConnectSession({
      locationHref: 'https://connect.example/start',
      replaceUrl: () => {},
      fetchFn: (async () => { throw new Error('must not fetch'); }) as any,
      now: () => now,
      configuredApiKey: 'public-api-key',
    });
  } catch (error) {
    threw = error instanceof Error && error.message === 'HANDOFF_REQUIRED';
  }
  ok(threw, 'live mode refuses to silently fall back without a Hub handoff');
}

{
  const wrongTenantFetch = (async (input: any) => {
    const url = String(input);
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      return new Response(JSON.stringify({ idToken: 'firebase-id-token', localId: 'user-1' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      success: true,
      user: { uid: 'user-1' },
      activeOrganizationId: 'org-2',
      activeOrganization: { id: 'org-2' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  let threw = false;
  try {
    await bootstrapLiveConnectSession({
      locationHref: `https://connect.example/start?ecosystem_ctx=${encodeURIComponent(encoded)}`,
      replaceUrl: () => {},
      fetchFn: wrongTenantFetch,
      now: () => now,
      configuredApiKey: 'public-api-key',
    });
  } catch (error) {
    threw = error instanceof Error && error.message === 'CANONICAL_CONTEXT_MISMATCH';
  }
  ok(threw, 'live bootstrap fails closed when canonical Hub tenant differs');
}

{
  const deniedSessionFetch = (async (input: any) => {
    const url = String(input);
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      return new Response(JSON.stringify({ idToken: 'firebase-id-token', localId: 'user-1' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      success: false,
      code: 'ORGANIZATION_ACCESS_DENIED',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  let code = '';
  try {
    await bootstrapLiveConnectSession({
      locationHref: `https://connect.example/start?ecosystem_ctx=${encodeURIComponent(encoded)}`,
      replaceUrl: () => {},
      fetchFn: deniedSessionFetch,
      now: () => now,
      configuredApiKey: 'public-api-key',
    });
  } catch (error) {
    code = error instanceof Error ? error.message : '';
  }
  equal(code, 'ORGANIZATION_ACCESS_DENIED', 'safe canonical denial code survives to the bootstrap UI');
}

{
  const malformedHostingConfigFetch = (async (input: any) => {
    const url = String(input);
    if (url === '/__/firebase/init.json') {
      return new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  let code = '';
  try {
    await bootstrapLiveConnectSession({
      locationHref: `https://connect.example/start?ecosystem_ctx=${encodeURIComponent(encoded)}`,
      replaceUrl: () => {},
      fetchFn: malformedHostingConfigFetch,
      now: () => now,
      configuredApiKey: '',
    });
  } catch (error) {
    code = error instanceof Error ? error.message : '';
  }
  equal(code, 'FIREBASE_CONFIG_UNAVAILABLE', 'malformed Hosting config fails with a stable safe diagnostic');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
