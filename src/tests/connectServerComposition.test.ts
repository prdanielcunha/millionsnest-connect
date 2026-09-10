import { AddressInfo } from 'node:net';
import { CanonicalContextProvider, ConnectCoreService, CoreAuditPort, MusicScaleReadToolPort } from '../core/runtime/connectCore';
import { createConnectServer } from '../server/createConnectServer';

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

function createCore(): ConnectCoreService {
  const context: CanonicalContextProvider = {
    async resolve({ requestedOrganizationId }) {
      return {
        status: 'resolved',
        context: {
          actorUid: 'user-1',
          systemRole: null,
          globalAccess: false,
          organizationId: requestedOrganizationId || 'org-1',
          organizationRole: 'member',
          permissions: [],
          capabilities: [],
          appAccess: { musicscale: true },
        },
      };
    },
  };
  const tool: MusicScaleReadToolPort = {
    async getNextSchedule(input) {
      return {
        status: 'success',
        auditId: 'audit-ms-server',
        humanSummary: 'Sua próxima escala é amanhã.',
        data: { id: 'scale-1', organizationId: input.organizationId },
        deepLink: '/scales/scale-1',
      };
    },
  };
  const audit: CoreAuditPort = { async record() {} };
  return new ConnectCoreService(context, tool, audit);
}

async function withServer(run: (origin: string) => Promise<void>) {
  const app = createConnectServer({ core: createCore() });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

console.log('--- Running Connect Server Composition Tests ---');

await withServer(async (origin) => {
  const health = await fetch(`${origin}/api/health`);
  const healthPayload = await health.json() as any;
  checkEqual(health.status, 200, 'health endpoint is reachable');
  checkEqual(healthPayload.service, 'millionsnest-connect-core', 'health identifies Core service');
  checkEqual(health.headers.get('cache-control'), 'no-store', 'health is not cacheable');

  const unauthorized = await fetch(`${origin}/api/core/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Qual é minha próxima escala?' }),
  });
  const unauthorizedPayload = await unauthorized.json() as any;
  checkEqual(unauthorized.status, 401, 'Core endpoint requires bearer authentication');
  checkEqual(unauthorizedPayload.code, 'AUTH_REQUIRED', 'Core endpoint exposes safe auth requirement');

  const response = await fetch(`${origin}/api/core/message`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer user-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'Qual é minha próxima escala?',
      requestedOrganizationId: 'org-1',
      locale: 'pt-BR',
      conversationId: 'inapp-1',
    }),
  });
  const payload = await response.json() as any;
  checkEqual(response.status, 200, 'authorized Core endpoint request succeeds');
  checkEqual(payload.status, 'success', 'server returns Core result');
  checkEqual(payload.auditId, 'audit-ms-server', 'server preserves downstream audit id');
  checkEqual(payload.data.organizationId, 'org-1', 'server preserves canonical tenant');
});

{
  const app = createConnectServer({ env: {} });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/core/message`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Qual é minha próxima escala?' }),
    });
    const payload = await response.json() as any;
    checkEqual(response.status, 503, 'missing server origins fail closed');
    checkEqual(payload.code, 'CORE_CONFIGURATION_MISSING', 'configuration failure is explicit and safe');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
