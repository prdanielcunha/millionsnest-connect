import {
  HUB_SESSION_CONTEXT_PATH,
  HubSessionContextHttpProvider,
} from '../core/runtime/hubSessionContextHttpProvider';

let passed = 0;
let total = 0;

function checkEqual(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    console.error(`❌ ${message} - Expected: ${String(expected)}, Actual: ${String(actual)}`);
    throw new Error(message);
  }
  passed++;
}

console.log('--- Running Hub Session Context HTTP Provider Tests ---');

{
  let seenUrl = '';
  let seenAuthorization = '';
  const provider = new HubSessionContextHttpProvider({
    hubOrigin: 'https://millionsnest.example/base/path',
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenAuthorization = init.headers.Authorization;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            protocolVersion: '1.0.0',
            user: {
              uid: 'user_01',
              systemRole: 'user',
              capabilities: [],
            },
            globalAccess: false,
            activeOrganizationId: 'org_01',
            activeOrganization: {
              id: 'org_01',
              organizationRole: 'member',
              permissions: [],
              capabilities: [],
            },
            appAccess: {
              musicscale: {
                appId: 'musicscale',
                organizationId: 'org_01',
                accessible: true,
                decisionState: 'granted',
              },
            },
          };
        },
      };
    },
  });

  const result = await provider.resolve({
    authToken: 'firebase-token',
    requestedOrganizationId: 'org_01',
  });

  checkEqual(
    seenUrl,
    `https://millionsnest.example${HUB_SESSION_CONTEXT_PATH}`,
    'provider targets only the verified canonical Hub endpoint',
  );
  checkEqual(seenAuthorization, 'Bearer firebase-token', 'provider forwards bearer auth server-side');
  checkEqual(result.status, 'resolved', 'valid Hub response resolves canonical context');
}

{
  const provider = new HubSessionContextHttpProvider({
    hubOrigin: 'https://millionsnest.example',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() { return {}; },
    }),
  });

  const result = await provider.resolve({ authToken: 'expired-token' });
  checkEqual(result.status, 'identity_required', 'Hub 401 fails closed to identity flow');
}

{
  const provider = new HubSessionContextHttpProvider({
    hubOrigin: 'https://millionsnest.example',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() { return {}; },
    }),
  });

  const result = await provider.resolve({ authToken: 'forbidden-token' });
  checkEqual(result.status, 'denied', 'Hub 403 remains denied');
}

{
  const provider = new HubSessionContextHttpProvider({
    hubOrigin: 'https://millionsnest.example',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          protocolVersion: '1.0.0',
          user: { uid: 'user_01', systemRole: 'user', capabilities: [] },
          globalAccess: false,
          activeOrganizationId: 'org_02',
          activeOrganization: {
            id: 'org_02',
            organizationRole: 'member',
            permissions: [],
            capabilities: [],
          },
          appAccess: {
            musicscale: {
              appId: 'musicscale',
              organizationId: 'org_02',
              accessible: true,
              decisionState: 'granted',
            },
          },
        };
      },
    }),
  });

  const result = await provider.resolve({
    authToken: 'valid-token',
    requestedOrganizationId: 'org_01',
  });
  checkEqual(result.status, 'organization_required', 'requested tenant mismatch cannot silently switch tenant');
}

{
  let didThrow = false;
  try {
    new HubSessionContextHttpProvider({ hubOrigin: '' });
  } catch {
    didThrow = true;
  }
  checkEqual(didThrow, true, 'missing Hub origin fails closed at construction');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
