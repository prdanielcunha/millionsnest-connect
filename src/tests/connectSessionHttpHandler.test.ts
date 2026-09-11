import { createConnectSessionHttpHandler } from '../core/runtime/connectSessionHttpHandler';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}

class FakeResponse {
  statusCode = 200;
  body: any = null;
  headers: Record<string, string> = {};
  setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; }
  status(code: number) { this.statusCode = code; return this; }
  json(body: unknown) { this.body = body; return this; }
}

console.log('--- Running Connect Session HTTP Handler Tests ---');

{
  const handler = createConnectSessionHttpHandler({
    hubOrigin: 'https://www.millionsnest.com',
    fetchImpl: (async () => { throw new Error('should not fetch'); }) as any,
  });
  const res = new FakeResponse();
  await handler({ headers: {}, query: { organizationId: 'org-1' } } as any, res as any);
  equal(res.statusCode, 401, 'session proxy requires bearer');
  equal(res.body.code, 'AUTH_REQUIRED', 'missing bearer returns safe code');
  equal(res.headers['cache-control'], 'no-store', 'session is never cacheable');
}

{
  let forwardedAuthorization = '';
  const handler = createConnectSessionHttpHandler({
    hubOrigin: 'https://www.millionsnest.com',
    fetchImpl: (async (_input: any, init?: any) => {
      forwardedAuthorization = init?.headers?.Authorization || '';
      return new Response(JSON.stringify({
        success: true,
        protocolVersion: '1.0.0',
        user: { uid: 'user-1', systemRole: 'user', capabilities: [] },
        activeOrganizationId: 'org-1',
        activeOrganization: {
          id: 'org-1', name: 'Organization One', slug: 'organization-one',
          organizationRole: 'member', permissions: [], capabilities: [],
        },
        organizations: [],
        appAccess: { musicscale: { accessible: true } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any,
  });
  const res = new FakeResponse();
  await handler({
    headers: { authorization: 'Bearer firebase-id-token' },
    query: { organizationId: 'org-1' },
  } as any, res as any);
  equal(res.statusCode, 200, 'canonical session is returned');
  equal(res.body.activeOrganizationId, 'org-1', 'canonical tenant is preserved');
  equal(forwardedAuthorization, 'Bearer firebase-id-token', 'Firebase bearer is forwarded only to Hub');
}

{
  const handler = createConnectSessionHttpHandler({
    hubOrigin: 'https://www.millionsnest.com',
    fetchImpl: (async () => new Response(JSON.stringify({
      success: true,
      user: { uid: 'user-1' },
      activeOrganizationId: 'org-other',
      activeOrganization: { id: 'org-other' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as any,
  });
  const res = new FakeResponse();
  await handler({
    headers: { authorization: 'Bearer firebase-id-token' },
    query: { organizationId: 'org-1' },
  } as any, res as any);
  equal(res.statusCode, 409, 'tenant mismatch fails closed');
  equal(res.body.code, 'ORGANIZATION_CONTEXT_MISMATCH', 'tenant mismatch is explicit');
}

{
  const handler = createConnectSessionHttpHandler({
    hubOrigin: 'https://www.millionsnest.com',
    fetchImpl: (async () => new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } })) as any,
  });
  const res = new FakeResponse();
  await handler({
    headers: { authorization: 'Bearer expired' },
    query: { organizationId: 'org-1' },
  } as any, res as any);
  equal(res.statusCode, 401, 'Hub auth rejection remains auth rejection');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
