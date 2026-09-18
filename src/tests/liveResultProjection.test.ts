import { normalizeLiveResultProjection } from '../core/client/liveResultProjection';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}

console.log('--- Running Live Result Projection Tests ---');

{
  const result = normalizeLiveResultProjection({
    schedule: { id: 'scale-1', date: '2026-09-20', time: '19:00', functionNames: ['Voz'] },
    repertoire: [
      { id: 'song-1', order: 1, title: 'Promessas', artist: 'Artista', scheduledKey: 'A', bpm: 72, hasChords: true },
    ],
  });
  equal(result?.kind, 'repertoire', 'repertoire shape is recognized');
  equal(result?.kind === 'repertoire' ? result.songs[0].scheduledKey : '', 'A', 'scheduled key is preserved');
}

{
  const result = normalizeLiveResultProjection({
    schedule: { id: 'scale-1' },
    presence: { status: 'accepted', responseCount: 1, respondedAt: '2026-09-18T10:00:00Z' },
  });
  equal(result?.kind, 'presence', 'presence shape is recognized');
  equal(result?.kind === 'presence' ? result.presence?.status : '', 'accepted', 'presence status is preserved');
}

{
  const result = normalizeLiveResultProjection({
    schedule: { id: 'scale-1' },
    chart: {
      status: 'ready',
      songId: 'song-1',
      title: 'Promessas',
      sourceKey: 'G',
      scheduledKey: 'A',
      chords: 'A E/G# F#m D',
      sourceVerified: true,
    },
    secret: 'must-not-render',
  });
  equal(result?.kind, 'chart', 'chart shape is recognized');
  equal(result?.kind === 'chart' ? result.chart?.chords : '', 'A E/G# F#m D', 'verified chart content is preserved');
  equal(JSON.stringify(result).includes('must-not-render'), false, 'unknown fields are not projected');
}

{
  const result = normalizeLiveResultProjection({
    chart: {
      status: 'ready',
      songId: 'song-1',
      title: 'Promessas',
      chords: 'UNVERIFIED_SECRET_CHORDS',
      sourceVerified: false,
    },
  });
  equal(result?.kind, 'chart', 'unverified chart status is recognized');
  equal(result?.kind === 'chart' ? result.chart?.chords : 'bad', null, 'unverified chart content is stripped');
  equal(JSON.stringify(result).includes('UNVERIFIED_SECRET_CHORDS'), false, 'unverified chart bytes never reach display projection');
}

{
  equal(normalizeLiveResultProjection({ arbitrary: 'payload' }), null, 'arbitrary tool payload is not rendered');
  equal(normalizeLiveResultProjection('raw text'), null, 'non-object payload is not rendered');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
