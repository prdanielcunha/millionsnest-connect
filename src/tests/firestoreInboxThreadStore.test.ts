import {
  createConnectThreadEvent,
  projectConnectThread,
} from '../core/inbox/threadDomain';
import {
  FirestoreConnectThreadStore,
  type ConnectRuntimeAccessTokenProvider,
} from '../core/inbox/firestoreThreadStore';

let total = 0;
let passed = 0;

function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
}

async function rejects(
  run: () => Promise<unknown>,
  expectedMessage: string,
  message: string,
) {
  total++;
  try {
    await run();
  } catch (error) {
    const actual = error instanceof Error ? error.message : String(error);
    if (actual !== expectedMessage) {
      throw new Error(
        `${message}: expected ${expectedMessage}, got ${actual}`,
      );
    }
    passed++;
    return;
  }
  throw new Error(`${message}: expected rejection ${expectedMessage}`);
}

type StoredDocument = {
  name: string;
  fields: Record<string, unknown>;
  updateTime: string;
};

type RecordedCall = {
  method: string;
  url: string;
  authorization: string;
  body?: any;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createFakeFirestore() {
  const docs = new Map<string, StoredDocument>();
  const calls: RecordedCall[] = [];
  const commits: any[] = [];
  let revision = 0;
  let beforeNextCommit: (() => void) | null = null;

  const updateTime = () => {
    revision++;
    return `2026-09-19T00:00:${String(revision).padStart(2, '0')}.000000Z`;
  };

  const documentKeyFromUrl = (rawUrl: string) => {
    const url = new URL(rawUrl);
    const marker = '/documents/';
    const index = url.pathname.indexOf(marker);
    if (index < 0) return '';
    return url.pathname
      .slice(index + marker.length)
      .split('/')
      .map(decodeURIComponent)
      .join('/');
  };

  const fetchImpl = async (
    input: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> => {
    const url = String(input);
    const method = (init.method || 'GET').toUpperCase();
    const headers = init.headers as Record<string, string> | undefined;
    const authorization = headers?.Authorization || '';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, authorization, body });

    if (url.endsWith('/documents:commit') && method === 'POST') {
      commits.push(body);
      const hook = beforeNextCommit;
      beforeNextCommit = null;
      hook?.();

      const writes = Array.isArray(body?.writes) ? body.writes : [];
      for (const write of writes) {
        const name = String(write?.update?.name || '');
        const prefix = '/documents/';
        const key = name.includes(prefix)
          ? name.slice(name.indexOf(prefix) + prefix.length)
          : '';
        const existing = docs.get(key);
        const precondition = write?.currentDocument || {};

        if (precondition.exists === false && existing) {
          return jsonResponse(409, {
            error: { status: 'ALREADY_EXISTS' },
          });
        }
        if (
          typeof precondition.updateTime === 'string' &&
          existing?.updateTime !== precondition.updateTime
        ) {
          return jsonResponse(409, {
            error: { status: 'FAILED_PRECONDITION' },
          });
        }
      }

      for (const write of writes) {
        const name = String(write.update.name);
        const prefix = '/documents/';
        const key = name.slice(name.indexOf(prefix) + prefix.length);
        docs.set(key, {
          name,
          fields: write.update.fields,
          updateTime: updateTime(),
        });
      }

      return jsonResponse(200, {
        writeResults: writes.map(() => ({ updateTime: updateTime() })),
        commitTime: updateTime(),
      });
    }

    if (method === 'GET') {
      const key = documentKeyFromUrl(url);

      // A collection-list request ends at the events collection itself.
      if (key.endsWith('/events')) {
        const prefix = `${key}/`;
        const documents = [...docs.entries()]
          .filter(([candidate]) => {
            if (!candidate.startsWith(prefix)) return false;
            return !candidate.slice(prefix.length).includes('/');
          })
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, document]) => document);
        return jsonResponse(200, { documents });
      }

      const document = docs.get(key);
      if (!document) return jsonResponse(404, { error: { status: 'NOT_FOUND' } });
      return jsonResponse(200, document);
    }

    return jsonResponse(405, { error: { status: 'METHOD_NOT_ALLOWED' } });
  };

  return {
    docs,
    calls,
    commits,
    fetchImpl: fetchImpl as typeof fetch,
    mutateBeforeNextCommit(run: () => void) {
      beforeNextCommit = run;
    },
    forceTouch(path: string) {
      const existing = docs.get(path);
      if (!existing) throw new Error('FAKE_DOCUMENT_NOT_FOUND');
      docs.set(path, { ...existing, updateTime: updateTime() });
    },
  };
}

class FixedRuntimeTokenProvider implements ConnectRuntimeAccessTokenProvider {
  calls = 0;

  async getAccessToken(): Promise<string> {
    this.calls++;
    return 'connect-runtime-service-token';
  }
}

console.log('--- Running Durable Firestore Inbox Store Tests ---');

const fake = createFakeFirestore();
const tokenProvider = new FixedRuntimeTokenProvider();
const store = new FirestoreConnectThreadStore({
  projectId: 'millionsnest',
  fetchImpl: fake.fetchImpl,
  tokenProvider,
});

const openEvent = createConnectThreadEvent({
  eventType: 'CONVERSATION_OPENED',
  requestId: 'open-1',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'provider-conversation:1',
  channel: 'whatsapp',
  occurredAt: new Date('2026-09-19T00:00:00.000Z'),
});

const opened = await store.append(openEvent, 0);
equal(opened.kind, 'appended', 'first thread event is appended');
equal(opened.projection.status, 'new', 'open event creates new thread');
equal(opened.projection.sourceEventCount, 1, 'snapshot starts at version one');
equal(fake.commits.length, 1, 'first append uses one atomic commit');
equal(fake.commits[0].writes.length, 2, 'event and snapshot share one commit');
equal(
  fake.commits[0].writes[0].currentDocument.exists,
  false,
  'event creation is guarded by exists=false',
);
equal(
  fake.commits[0].writes[1].currentDocument.exists,
  false,
  'new snapshot is guarded by exists=false',
);

const loadedOpen = await store.load({
  organizationId: 'org-1',
  conversationId: 'thread-1',
});
equal(loadedOpen?.lastEventId, openEvent.eventId, 'snapshot can be loaded directly');

const assignEvent = createConnectThreadEvent({
  eventType: 'THREAD_ASSIGNED',
  requestId: 'assign-1',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'connect-request:assign-1',
  assigneeType: 'team',
  assigneeRef: 'care-team',
  reasonCode: 'manual_triage',
  occurredAt: new Date('2026-09-19T00:00:01.000Z'),
});

const assigned = await store.append(assignEvent, 1);
equal(assigned.kind, 'appended', 'second event is appended');
equal(assigned.projection.status, 'in_progress', 'assignment advances status');
equal(assigned.projection.mode, 'human', 'assignment enters human mode');
equal(
  typeof fake.commits[1].writes[1].currentDocument.updateTime,
  'string',
  'existing snapshot uses updateTime optimistic precondition',
);

const duplicate = await store.append(assignEvent, 2);
equal(duplicate.kind, 'duplicate', 'exact event retry is idempotent');
equal(fake.commits.length, 2, 'duplicate retry performs no new commit');

const collidingEvent = {
  ...assignEvent,
  evidenceRef: 'connect-request:different-evidence',
};
await rejects(
  () => store.append(collidingEvent, 2),
  'EVENT_ID_COLLISION',
  'same event id with different canonical bytes is rejected',
);

await rejects(
  () => store.append(createConnectThreadEvent({
    eventType: 'THREAD_WAITING_PERSON',
    requestId: 'stale-write',
    organizationId: 'org-1',
    conversationId: 'thread-1',
    evidenceRef: 'connect-request:stale-write',
    occurredAt: new Date('2026-09-19T00:00:02.000Z'),
  }), 1),
  'THREAD_VERSION_CONFLICT',
  'stale expected version fails before commit',
);

const events = await store.readEvents({
  organizationId: 'org-1',
  conversationId: 'thread-1',
});
equal(events.length, 2, 'event stream is persisted separately from snapshot');
const rebuilt = projectConnectThread(events);
equal(
  JSON.stringify(rebuilt),
  JSON.stringify(await store.load({
    organizationId: 'org-1',
    conversationId: 'thread-1',
  })),
  'snapshot rebuild matches durable projection',
);

equal(
  await store.load({
    organizationId: 'org-2',
    conversationId: 'thread-1',
  }),
  null,
  'same conversation id in another tenant cannot load org-1 snapshot',
);
equal(
  (await store.readEvents({
    organizationId: 'org-2',
    conversationId: 'thread-1',
  })).length,
  0,
  'event listing is tenant pinned by document path',
);

const restartedStore = new FirestoreConnectThreadStore({
  projectId: 'millionsnest',
  fetchImpl: fake.fetchImpl,
  tokenProvider: new FixedRuntimeTokenProvider(),
});
equal(
  (await restartedStore.load({
    organizationId: 'org-1',
    conversationId: 'thread-1',
  }))?.sourceEventCount,
  2,
  'new runtime instance rebuilds from durable backend state',
);

const concurrencyEvent = createConnectThreadEvent({
  eventType: 'THREAD_WAITING_PERSON',
  requestId: 'concurrency-1',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'connect-request:concurrency-1',
  occurredAt: new Date('2026-09-19T00:00:03.000Z'),
});
fake.mutateBeforeNextCommit(() => {
  fake.forceTouch('connectOrganizations/org-1/inboxThreads/thread-1');
});
await rejects(
  () => store.append(concurrencyEvent, 2),
  'THREAD_VERSION_CONFLICT',
  'snapshot change between read and commit is rejected atomically',
);

equal(
  fake.calls.some((call) => call.url.includes('/users/')),
  false,
  'organizational Inbox never reuses Personal Vault user paths',
);
equal(
  fake.calls.some((call) => call.method === 'DELETE'),
  false,
  'durable Inbox contract never requires delete operations',
);
equal(
  fake.calls.every(
    (call) =>
      call.authorization === 'connect-runtime-service-token' ||
      call.authorization === '',
  ),
  true,
  'Firestore calls use only injected runtime service identity',
);
equal(
  fake.calls.some((call) => call.authorization.includes('firebase')),
  false,
  'user Firebase bearer is never used by durable Inbox storage',
);
equal(
  fake.calls.some(
    (call) =>
      call.url.includes('connectOrganizations/org-1/inboxThreads/thread-1/events'),
  ),
  true,
  'events live under organization and thread scoped collection path',
);
equal(tokenProvider.calls > 0, true, 'runtime token provider is actually exercised');

console.log(`✅ Passed ${passed} / ${total} tests.`);
