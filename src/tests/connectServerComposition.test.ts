import { AddressInfo } from 'node:net';
import { CanonicalContextProvider, ConnectCoreService, CoreAuditPort, MusicScaleReadToolPort } from '../core/runtime/connectCore';
import { createConnectServer } from '../server/createConnectServer';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';

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
  const app = createConnectServer({
    core: createCore(),
    env: { CONNECT_RELEASE_SHA: 'test-release-sha' },
  });
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
  checkEqual(healthPayload.releaseSha, 'test-release-sha', 'health exposes immutable release sha when configured');
  checkEqual(health.headers.get('cache-control'), 'no-store', 'health is not cacheable');

  const disabledStorageProbe = await fetch(`${origin}/api/health/storage-readiness`);
  const disabledStorageProbePayload = await disabledStorageProbe.json() as any;
  checkEqual(disabledStorageProbe.status, 404, 'storage readiness probe is disabled by default');
  checkEqual(
    disabledStorageProbePayload.code,
    'STORAGE_READINESS_PROBE_DISABLED',
    'disabled storage readiness probe is explicit',
  );

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

    const outbound = await fetch(`http://127.0.0.1:${address.port}/api/core/outbound/validate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: 'req-1',
        organizationId: 'org-1',
        sourceApp: 'nestlocal',
      }),
    });
    const outboundPayload = await outbound.json() as any;
    checkEqual(outbound.status, 503, 'outbound validation boundary fails closed without Hub configuration');
    checkEqual(outboundPayload.code, 'CORE_CONFIGURATION_MISSING', 'outbound configuration failure is explicit');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

{
  const app = createConnectServer({
    env: {
      CONNECT_STORAGE_READINESS_PROBE_ENABLED: 'true',
      FIREBASE_PROJECT_ID: 'millionsnest',
    },
    fetchImpl: async (input) => String(input).includes('metadata.google.internal')
      ? {
          ok: true,
          status: 200,
          async json() {
            return { access_token: 'runtime-test-token' };
          },
        } as Response
      : {
          ok: true,
          status: 200,
          async json() {
            return {
              permissions: [
                'datastore.entities.get',
                'datastore.entities.list',
                'datastore.entities.create',
                'datastore.entities.update',
              ],
            };
          },
        } as Response,
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/health/storage-readiness`,
    );
    const payload = await response.json() as any;
    checkEqual(response.status, 200, 'enabled storage readiness probe is reachable');
    checkEqual(
      payload.storageReadiness,
      'read_write_confirmed',
      'storage readiness endpoint reports runtime effective state',
    );
    checkEqual(
      JSON.stringify(payload).includes('runtime-test-token'),
      false,
      'storage readiness endpoint never exposes runtime access token',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

{
  const app = createConnectServer({
    env: {
      CONNECT_INBOX_DURABLE_ENABLED: 'false',
    },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/core/inbox/threads/thread-1?organizationId=org-1`,
      {
        headers: { Authorization: 'Bearer user-token' },
      },
    );
    const payload = await response.json() as any;
    checkEqual(response.status, 404, 'durable Inbox route is dark by default');
    checkEqual(
      payload.code,
      'INBOX_DURABLE_DISABLED',
      'disabled durable Inbox has explicit code',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

{
  const store = new InMemoryConnectThreadStore();
  const commands = new ConnectThreadCommandService(
    store,
    () => new Date('2026-09-19T00:00:00.000Z'),
  );
  await commands.open({
    requestId: 'server-seed',
    organizationId: 'org-1',
    conversationId: 'thread-1',
    evidenceRef: 'provider-conversation:server-seed',
    channel: 'whatsapp',
  });

  const inboxContextProvider: CanonicalContextProvider = {
    async resolve() {
      return {
        status: 'resolved',
        context: {
          actorUid: 'owner-1',
          systemRole: null,
          globalAccess: false,
          organizationId: 'org-1',
          organizationRole: 'owner',
          permissions: [],
          capabilities: [],
          appAccess: { musicscale: false },
        },
      };
    },
  };

  const app = createConnectServer({
    env: {
      CONNECT_INBOX_DURABLE_ENABLED: 'true',
    },
    inboxContextProvider,
    inboxStore: store,
    inboxStorageReadinessProbe: async () => ({
      state: 'denied_or_missing',
      permissions: {
        read: false,
        list: false,
        create: false,
        update: false,
      },
      source: 'runtime_metadata',
    }),
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/core/inbox/threads/thread-1?organizationId=org-1`,
      {
        headers: { Authorization: 'Bearer user-token' },
      },
    );
    const payload = await response.json() as any;
    checkEqual(
      response.status,
      503,
      'durable Inbox fails closed while runtime IAM is missing',
    );
    checkEqual(
      payload.code,
      'INBOX_STORAGE_NOT_READY',
      'missing runtime IAM has explicit storage gate code',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

{
  const store = new InMemoryConnectThreadStore();
  const commands = new ConnectThreadCommandService(
    store,
    () => new Date('2026-09-19T00:00:00.000Z'),
  );
  await commands.open({
    requestId: 'server-ready-seed',
    organizationId: 'org-1',
    conversationId: 'thread-ready',
    evidenceRef: 'provider-conversation:server-ready-seed',
    channel: 'whatsapp',
  });

  let readinessCalls = 0;
  const inboxContextProvider: CanonicalContextProvider = {
    async resolve({ requestedOrganizationId }) {
      return {
        status: 'resolved',
        context: {
          actorUid: 'owner-1',
          systemRole: null,
          globalAccess: false,
          organizationId: requestedOrganizationId || 'org-1',
          organizationRole: 'owner',
          permissions: [],
          capabilities: [],
          appAccess: { musicscale: false },
        },
      };
    },
  };

  const app = createConnectServer({
    env: {
      CONNECT_INBOX_DURABLE_ENABLED: 'true',
    },
    inboxContextProvider,
    inboxStore: store,
    inboxStorageReadinessProbe: async () => {
      readinessCalls++;
      return {
        state: 'read_write_confirmed',
        permissions: {
          read: true,
          list: true,
          create: true,
          update: true,
        },
        source: 'runtime_metadata',
      };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;

    const read = await fetch(
      `${origin}/api/core/inbox/threads/thread-ready?organizationId=org-1`,
      {
        headers: { Authorization: 'Bearer user-token' },
      },
    );
    const readPayload = await read.json() as any;
    checkEqual(read.status, 200, 'ready durable Inbox read route is mounted');
    checkEqual(
      readPayload.thread.conversationId,
      'thread-ready',
      'mounted Inbox read stays tenant/thread scoped',
    );

    const resolve = await fetch(
      `${origin}/api/core/inbox/threads/thread-ready/actions`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: 'org-1',
          action: 'resolve',
          requestId: 'server-resolve-1',
          evidenceRef: 'connect-request:server-resolve-1',
        }),
      },
    );
    const resolvePayload = await resolve.json() as any;
    checkEqual(resolve.status, 200, 'ready durable Inbox command route is mounted');
    checkEqual(
      resolvePayload.thread.status,
      'resolved',
      'mounted command persists canonical thread transition',
    );
    checkEqual(
      readinessCalls,
      1,
      'readiness proof is cached across adjacent Inbox requests',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
