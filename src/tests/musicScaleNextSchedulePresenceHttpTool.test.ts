import {
  MUSIC_SCALE_NEXT_PRESENCE_PATH,
  MusicScaleNextSchedulePresenceHttpTool,
} from '../core/runtime/musicScaleNextSchedulePresenceHttpTool';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    authToken: 'Bearer user-token',
    actorUid: 'user-1',
    systemRole: null,
    globalAccess: false,
    organizationId: 'org-1',
    organizationRole: 'member',
    permissions: [],
    capabilities: [],
    requiredCapability: 'scales.read' as const,
    requestId: 'req-presence',
    correlationId: 'cor-presence',
    channel: { type: 'inapp', conversationId: 'conv-1' },
    locale: 'pt-BR',
    ...overrides,
  };
}

console.log('--- Running MusicScale Presence HTTP Tool Tests ---');

{
  let url = '';
  let headers: Record<string, string> = {};
  const tool = new MusicScaleNextSchedulePresenceHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test/path',
    fetchImpl: async (inputUrl, init) => {
      url = inputUrl;
      headers = init.headers;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            auditId: 'audit-presence',
            organizationId: 'org-1',
            schedule: { id: 'scale-1', organizationId: 'org-1', deepLink: '/scales/scale-1' },
            presence: {
              status: 'accepted',
              statuses: ['accepted'],
              responseCount: 1,
              respondedAt: '2026-09-18T01:00:00Z',
            },
            humanSummary: 'Sua presença está confirmada.',
          };
        },
      };
    },
  });

  const result = await tool.getNextSchedulePresence(input());
  equal(url, `https://musicscale.example.test${MUSIC_SCALE_NEXT_PRESENCE_PATH}`, 'canonical presence endpoint is used');
  equal(headers.Authorization, 'Bearer user-token', 'bearer is forwarded only as transient auth evidence');
  equal(headers['X-Organization-Id'], 'org-1', 'tenant is forwarded');
  equal(result.status, 'success', 'valid own-presence response succeeds');
  equal(result.status === 'success' ? (result.data as any).presence.status : '', 'accepted', 'presence status is preserved');
  equal(result.status === 'success' ? result.deepLink : '', '/scales/scale-1', 'scale deep link is preserved');
}

{
  const tool = new MusicScaleNextSchedulePresenceHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => { throw new Error('must not call'); },
  });
  equal((await tool.getNextSchedulePresence(input({ authToken: '' }))).status, 'denied', 'missing bearer fails closed');
}

{
  const tool = new MusicScaleNextSchedulePresenceHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          auditId: 'audit-foreign',
          organizationId: 'org-2',
          schedule: { id: 'foreign', organizationId: 'org-2' },
          presence: { status: 'accepted' },
        };
      },
    }),
  });
  const result = await tool.getNextSchedulePresence(input());
  equal(result.status, 'conflict', 'tenant mismatch fails closed');
  equal('data' in result, false, 'tenant mismatch never exposes foreign schedule/presence data');
}

{
  const tool = new MusicScaleNextSchedulePresenceHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          auditId: 'audit-malformed',
          organizationId: 'org-1',
          schedule: { id: 'scale-1', organizationId: 'org-1' },
          presence: { status: 'hacked', statuses: ['accepted', 'other'], responseCount: 1000 },
          humanSummary: 'Status.',
        };
      },
    }),
  });
  const result = await tool.getNextSchedulePresence(input());
  equal(result.status === 'success' ? (result.data as any).presence.status : '', 'pending', 'unknown status is sanitized');
  equal(result.status === 'success' ? (result.data as any).presence.responseCount : -1, 1, 'invalid response count falls back safely');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
