import {
  MUSIC_SCALE_NEXT_REPERTOIRE_PATH,
  MusicScaleNextScheduleRepertoireHttpTool,
} from '../core/runtime/musicScaleNextScheduleRepertoireHttpTool';

let passed = 0;
let total = 0;

function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
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
    permissions: [],
    capabilities: [],
    requiredCapability: 'songs.read' as const,
    requestId: 'req-repertoire-1',
    correlationId: 'cor-repertoire-1',
    channel: { type: 'inapp', conversationId: 'conv-1' },
    locale: 'pt-BR',
    ...overrides,
  };
}

console.log('--- Running MusicScale Repertoire HTTP Tool Tests ---');

{
  let seenUrl = '';
  let seenHeaders: Record<string, string> = {};
  const tool = new MusicScaleNextScheduleRepertoireHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test/some/path',
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            auditId: 'audit-repertoire-1',
            organizationId: 'org-1',
            schedule: {
              id: 'scale-1',
              organizationId: 'org-1',
              deepLink: '/scales/scale-1',
            },
            repertoire: [
              { id: 'song-1', order: 1, title: 'Promessas', scheduledKey: 'G#m' },
            ],
            humanSummary: 'Sua próxima escala tem 1 música: Promessas.',
          };
        },
      };
    },
  });

  const result = await tool.getNextScheduleRepertoire(input());
  equal(seenUrl, `https://musicscale.example.test${MUSIC_SCALE_NEXT_REPERTOIRE_PATH}`, 'canonical repertoire endpoint is used');
  equal(seenHeaders.Authorization, 'Bearer user-firebase-token', 'bearer is forwarded transiently');
  equal(seenHeaders['X-Connect-User-Authorization'], 'Bearer user-firebase-token', 'fallback auth carries the same bearer');
  equal(seenHeaders['X-Organization-Id'], 'org-1', 'canonical tenant is forwarded');
  equal(result.status, 'success', 'valid repertoire response succeeds');
  equal(result.status === 'success' ? result.auditId : '', 'audit-repertoire-1', 'downstream audit id is preserved');
  equal(result.status === 'success' ? result.deepLink : '', '/scales/scale-1', 'scale deep link is preserved');
  equal(
    result.status === 'success' ? (result.data as any).repertoire.length : 0,
    1,
    'repertoire items are returned',
  );
}

{
  const tool = new MusicScaleNextScheduleRepertoireHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => { throw new Error('must not be called'); },
  });
  const result = await tool.getNextScheduleRepertoire(input({ authToken: '' }));
  equal(result.status, 'denied', 'missing bearer fails closed');
}

{
  const tool = new MusicScaleNextScheduleRepertoireHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          auditId: 'audit-foreign',
          organizationId: 'org-2',
          schedule: { id: 'scale-2', organizationId: 'org-2' },
          repertoire: [{ id: 'foreign-song' }],
        };
      },
    }),
  });

  const result = await tool.getNextScheduleRepertoire(input());
  equal(result.status, 'conflict', 'tenant mismatch fails closed');
  equal(JSON.stringify(result).includes('foreign-song'), false, 'foreign repertoire is not returned');
}

{
  const tool = new MusicScaleNextScheduleRepertoireHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() {
        return { success: false, auditId: 'audit-denied', humanSummary: 'Access denied.' };
      },
    }),
  });
  const result = await tool.getNextScheduleRepertoire(input());
  equal(result.status, 'denied', 'MusicScale denial stays denied');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
