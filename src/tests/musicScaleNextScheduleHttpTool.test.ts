import {
  MUSIC_SCALE_NEXT_SCHEDULE_PATH,
  MusicScaleNextScheduleHttpTool,
} from '../core/runtime/musicScaleNextScheduleHttpTool';

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

function input(overrides: Record<string, unknown> = {}) {
  return {
    authToken: 'Bearer user-firebase-token',
    actorUid: 'user-1',
    systemRole: null,
    globalAccess: false,
    organizationId: 'org-1',
    organizationRole: 'member',
    permissions: ['anything-from-hub'],
    capabilities: ['anything-from-hub'],
    requiredCapability: 'scales.read' as const,
    requestId: 'req-1',
    correlationId: 'cor-1',
    channel: { type: 'inapp', conversationId: 'conv-1' },
    locale: 'pt-BR',
    ...overrides,
  };
}

console.log('--- Running MusicScale Next Schedule HTTP Tool Tests ---');

{
  let called = 0;
  let seenUrl = '';
  let seenHeaders: Record<string, string> = {};
  const tool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test/some/path',
    fetchImpl: async (url, init) => {
      called++;
      seenUrl = url;
      seenHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            auditId: 'audit-ms-1',
            organizationId: 'org-1',
            schedule: {
              id: 'scale-1',
              organizationId: 'org-1',
              date: '2026-09-11',
              time: '19:00',
              deepLink: '/scales/scale-1',
            },
            humanSummary: 'Sua próxima escala é em 11/09/2026, às 19:00.',
          };
        },
      };
    },
  });

  const result = await tool.getNextSchedule(input());
  checkEqual(called, 1, 'adapter performs exactly one canonical MusicScale request');
  checkEqual(
    seenUrl,
    `https://musicscale.example.test${MUSIC_SCALE_NEXT_SCHEDULE_PATH}`,
    'adapter ignores arbitrary origin paths and targets the canonical endpoint',
  );
  checkEqual(seenHeaders.Authorization, 'Bearer user-firebase-token', 'user bearer is forwarded transiently');
  checkEqual(seenHeaders['X-Organization-Id'], 'org-1', 'canonical organization is forwarded');
  checkEqual(seenHeaders['X-Request-Id'], 'req-1', 'request id is forwarded for tracing');
  checkEqual(seenHeaders['X-Correlation-Id'], 'cor-1', 'correlation id is forwarded for tracing');
  checkEqual('X-Actor-Uid' in seenHeaders, false, 'actor uid is not trusted or forwarded as authority');
  checkEqual('X-System-Role' in seenHeaders, false, 'Connect-side system role is not forwarded as authority');
  checkEqual('X-Capabilities' in seenHeaders, false, 'Connect-side capabilities are not forwarded as authority');
  checkEqual(result.status, 'success', 'valid response maps to success');
  checkEqual(result.auditId, 'audit-ms-1', 'MusicScale audit id is preserved');
  checkEqual(result.status === 'success' ? result.deepLink : undefined, '/scales/scale-1', 'MusicScale deep link is preserved');
}

{
  let called = 0;
  const tool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => {
      called++;
      throw new Error('must not be called');
    },
  });

  const result = await tool.getNextSchedule(input({ authToken: '' }));
  checkEqual(result.status, 'denied', 'missing bearer fails closed before network');
  checkEqual(called, 0, 'missing bearer never calls MusicScale');
}

{
  const tool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() {
        return {
          success: false,
          code: 'PERMISSION_DENIED',
          auditId: 'audit-denied',
          humanSummary: 'Access denied.',
        };
      },
    }),
  });

  const result = await tool.getNextSchedule(input());
  checkEqual(result.status, 'denied', 'MusicScale 403 stays denied');
  checkEqual(result.auditId, 'audit-denied', 'denial audit id is preserved');
}

{
  const tool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          auditId: 'audit-conflict',
          organizationId: 'org-2',
          schedule: {
            id: 'foreign-scale',
            organizationId: 'org-2',
          },
          humanSummary: 'Foreign schedule',
        };
      },
    }),
  });

  const result = await tool.getNextSchedule(input());
  checkEqual(result.status, 'conflict', 'tenant mismatch in tool response fails closed');
  checkEqual(JSON.stringify(result).includes('foreign-scale'), false, 'foreign record is not returned to Core');
}

{
  const tool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          auditId: 'audit-empty',
          organizationId: 'org-1',
          schedule: null,
          humanSummary: 'Não encontrei uma próxima escala atribuída a você.',
        };
      },
    }),
  });

  const result = await tool.getNextSchedule(input());
  checkEqual(result.status, 'success', 'no assigned schedule is a successful read result');
  checkEqual(result.status === 'success' ? result.data : 'wrong', null, 'no-schedule result preserves null data');
}

{
  const tool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async json() {
        return { success: false, code: 'SERVICE_UNAVAILABLE' };
      },
    }),
  });

  const result = await tool.getNextSchedule(input());
  checkEqual(result.status, 'failed', 'MusicScale 5xx maps to failed');
  checkEqual(result.status === 'failed' ? result.retryable : undefined, true, 'MusicScale 5xx is retryable');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
