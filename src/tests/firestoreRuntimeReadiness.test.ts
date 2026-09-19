import {
  probeConnectRuntimeFirestoreReadiness,
} from '../core/runtime/firestoreRuntimeReadiness';

let total = 0;
let passed = 0;

function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
}

function response(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  } as Response;
}

console.log('--- Running Connect Runtime Firestore Readiness Tests ---');

{
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const secret = 'runtime-secret-token';
  const result = await probeConnectRuntimeFirestoreReadiness({
    projectId: 'millionsnest',
    timeoutMs: 0,
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes('metadata.google.internal')) {
        return response(200, { access_token: secret });
      }
      return response(200, {
        permissions: [
          'datastore.entities.get',
          'datastore.entities.list',
          'datastore.entities.create',
          'datastore.entities.update',
        ],
      });
    },
  });

  equal(result.state, 'read_write_confirmed', 'read/write runtime is confirmed');
  equal(result.permissions.read, true, 'read permission is visible');
  equal(result.permissions.list, true, 'list permission is visible');
  equal(result.permissions.create, true, 'create permission is visible');
  equal(result.permissions.update, true, 'update permission is visible');
  equal(calls.length, 2, 'probe performs exactly metadata + project IAM requests');
  equal(
    (calls[0].init?.headers as Record<string, string>)['Metadata-Flavor'],
    'Google',
    'metadata request requires Google metadata flavor header',
  );
  equal(
    calls[1].url,
    'https://cloudresourcemanager.googleapis.com/v1/projects/millionsnest:testIamPermissions',
    'effective datastore permissions are tested against the project IAM policy',
  );
  equal(
    String((calls[1].init?.headers as Record<string, string>).Authorization),
    `Bearer ${secret}`,
    'runtime token is used only for the project IAM permission probe',
  );
  equal(
    JSON.stringify(result).includes(secret),
    false,
    'runtime token never appears in returned readiness payload',
  );
}

{
  const result = await probeConnectRuntimeFirestoreReadiness({
    timeoutMs: 0,
    fetchImpl: async (input) => String(input).includes('metadata.google.internal')
      ? response(200, { access_token: 'token' })
      : response(200, {
          permissions: ['datastore.entities.get', 'datastore.entities.list'],
        }),
  });

  equal(result.state, 'read_only', 'read/list-only runtime is not treated as writable');
  equal(result.permissions.list, true, 'list permission is required for event rebuild');
  equal(result.permissions.create, false, 'missing create is explicit');
  equal(result.permissions.update, false, 'missing update is explicit');
}

{
  const result = await probeConnectRuntimeFirestoreReadiness({
    timeoutMs: 0,
    fetchImpl: async (input) => String(input).includes('metadata.google.internal')
      ? response(200, { access_token: 'token' })
      : response(200, { permissions: [] }),
  });

  equal(result.state, 'denied_or_missing', 'missing read permission fails closed');
}

{
  const result = await probeConnectRuntimeFirestoreReadiness({
    timeoutMs: 0,
    fetchImpl: async (input) => String(input).includes('metadata.google.internal')
      ? response(200, { access_token: 'token' })
      : response(200, {
          permissions: [
            'datastore.entities.get',
            'datastore.entities.create',
            'datastore.entities.update',
          ],
        }),
  });

  equal(
    result.state,
    'denied_or_missing',
    'missing list permission blocks durable Inbox readiness',
  );
  equal(result.permissions.list, false, 'missing list permission is explicit');
}

{
  const result = await probeConnectRuntimeFirestoreReadiness({
    timeoutMs: 0,
    fetchImpl: async (input) => String(input).includes('metadata.google.internal')
      ? response(200, { access_token: 'token' })
      : response(200, {}),
  });

  equal(
    result.state,
    'denied_or_missing',
    'omitted empty permissions field is treated as no granted permissions',
  );
  equal(
    result.source,
    'runtime_metadata',
    'successful empty IAM response remains a valid runtime probe',
  );
}

{
  const result = await probeConnectRuntimeFirestoreReadiness({
    timeoutMs: 0,
    fetchImpl: async () => response(404, {}),
  });

  equal(result.state, 'unknown', 'missing metadata stays unknown');
  equal(result.source, 'metadata_unavailable', 'metadata failure has a safe source code');
}

{
  const result = await probeConnectRuntimeFirestoreReadiness({
    timeoutMs: 0,
    fetchImpl: async (input) => String(input).includes('metadata.google.internal')
      ? response(200, { access_token: 'token' })
      : response(403, {}),
  });

  equal(result.state, 'unknown', 'project IAM probe failure stays unknown');
  equal(
    result.source,
    'project_iam_probe_unavailable',
    'project IAM probe failure has a safe source code',
  );
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
