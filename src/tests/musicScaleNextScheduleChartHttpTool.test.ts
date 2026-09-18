import {
  MUSIC_SCALE_NEXT_CHART_PATH,
  MusicScaleNextScheduleChartHttpTool,
} from '../core/runtime/musicScaleNextScheduleChartHttpTool';

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
    requiredCapability: 'songs.read' as const,
    requestId: 'req-chart',
    correlationId: 'cor-chart',
    channel: { type: 'inapp', conversationId: 'conv-1' },
    locale: 'pt-BR',
    songTitleQuery: 'Promessas',
    ...overrides,
  };
}

console.log('--- Running MusicScale Chart HTTP Tool Tests ---');

{
  let seenUrl = '';
  let seenHeaders: Record<string, string> = {};
  const tool = new MusicScaleNextScheduleChartHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test/path',
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            auditId: 'audit-chart',
            organizationId: 'org-1',
            schedule: { id: 'scale-1', organizationId: 'org-1', deepLink: '/scales/scale-1' },
            chart: {
              status: 'ready',
              songId: 'song-1',
              title: 'Promessas',
              artist: 'Artista',
              sourceKey: 'G',
              scheduledKey: 'A',
              bpm: 72,
              chords: 'A E/G# F#m D',
              transposed: true,
              changedChordCount: 4,
              sourceVerified: true,
            },
            humanSummary: 'Aqui está a cifra de Promessas no tom programado da escala (A).',
          };
        },
      };
    },
  });

  const result = await tool.getNextScheduleChart(input());
  const url = new URL(seenUrl);
  equal(url.pathname, MUSIC_SCALE_NEXT_CHART_PATH, 'canonical chart endpoint is used');
  equal(url.searchParams.get('title'), 'Promessas', 'title is encoded as query context');
  equal(seenHeaders.Authorization, 'Bearer user-token', 'bearer is forwarded transiently');
  equal(seenHeaders['X-Organization-Id'], 'org-1', 'tenant is forwarded');
  equal(seenHeaders['X-Connect-Channel'], 'inapp', 'channel policy is explicit');
  equal(result.status, 'success', 'ready chart succeeds');
  equal(result.status === 'success' ? (result.data as any).chart.scheduledKey : '', 'A', 'scheduled key is preserved');
  equal(result.status === 'success' ? (result.data as any).chart.chords : '', 'A E/G# F#m D', 'validated chords are preserved');
}

{
  const tool = new MusicScaleNextScheduleChartHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => { throw new Error('must not call'); },
  });
  equal((await tool.getNextScheduleChart(input({ channel: { type: 'whatsapp', conversationId: 'conv' } }))).status, 'denied', 'non-inapp chart delivery is blocked before upstream');
}

{
  const tool = new MusicScaleNextScheduleChartHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          auditId: 'audit-unverified',
          organizationId: 'org-1',
          schedule: { id: 'scale-1', organizationId: 'org-1' },
          chart: {
            status: 'requires_source_key_confirmation',
            songId: 'song-1',
            title: 'Promessas',
            scheduledKey: 'A',
          },
          humanSummary: 'O tom de origem precisa ser confirmado.',
        };
      },
    }),
  });
  const result = await tool.getNextScheduleChart(input());
  equal(result.status, 'success', 'source-unverified is a successful factual read');
  equal(result.status === 'success' ? (result.data as any).chart.status : '', 'requires_source_key_confirmation', 'source-unverified status is preserved');
  equal(result.status === 'success' ? 'chords' in (result.data as any).chart : true, false, 'source-unverified payload has no chords');
}

{
  const tool = new MusicScaleNextScheduleChartHttpTool({
    musicScaleOrigin: 'https://musicscale.example.test',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          auditId: 'audit-foreign',
          organizationId: 'org-2',
          schedule: { id: 'foreign-scale', organizationId: 'org-2' },
          chart: { status: 'ready', chords: 'SECRET', sourceVerified: true },
        };
      },
    }),
  });
  const result = await tool.getNextScheduleChart(input());
  equal(result.status, 'conflict', 'tenant mismatch fails closed');
  equal('data' in result, false, 'tenant mismatch exposes no foreign chart data');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
