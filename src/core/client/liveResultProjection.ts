export type LiveScheduleProjection = {
  id: string;
  date: string | null;
  time: string | null;
  timeZone: string | null;
  functionNames: string[];
};

export type LiveRepertoireSongProjection = {
  id: string;
  order: number;
  title: string;
  artist: string | null;
  scheduledKey: string | null;
  bpm: number | null;
  hasChords: boolean;
  hasLyrics: boolean;
};

export type LivePresenceProjection = {
  status: 'pending' | 'accepted' | 'maybe' | 'declined' | 'mixed';
  responseCount: number;
  respondedAt: string | null;
};

export type LiveChartProjection = {
  status: 'ready' | 'no_chords' | 'requires_source_key_confirmation' | 'transposition_failed';
  songId: string;
  title: string;
  artist: string | null;
  sourceKey: string | null;
  scheduledKey: string | null;
  bpm: number | null;
  chords: string | null;
  transposed: boolean;
  sourceVerified: boolean;
};

export type LiveResultProjection =
  | { kind: 'schedule'; schedule: LiveScheduleProjection }
  | { kind: 'repertoire'; schedule: LiveScheduleProjection | null; songs: LiveRepertoireSongProjection[] }
  | { kind: 'presence'; schedule: LiveScheduleProjection | null; presence: LivePresenceProjection | null }
  | { kind: 'chart'; schedule: LiveScheduleProjection | null; chart: LiveChartProjection | null }
  | null;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function nullableText(value: unknown, maxLength: number): string | null {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function safeNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function schedule(value: unknown): LiveScheduleProjection | null {
  const source = object(value);
  if (!source) return null;
  const id = text(source.id, 256);
  if (!id) return null;

  const names = Array.isArray(source.functionNames)
    ? source.functionNames
        .filter((item): item is string => typeof item === 'string')
        .map((item) => text(item, 120))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return {
    id,
    date: nullableText(source.date, 20),
    time: nullableText(source.time, 20),
    timeZone: nullableText(source.timeZone, 80),
    functionNames: names,
  };
}

function repertoire(value: unknown): LiveRepertoireSongProjection[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .flatMap((entry, index) => {
      const source = object(entry);
      if (!source) return [];
      const id = text(source.id, 256);
      const title = text(source.title, 180);
      if (!id || !title) return [];
      const orderValue = safeNumber(source.order, 1, 1000);
      return [{
        id,
        order: orderValue === null ? index + 1 : Math.round(orderValue),
        title,
        artist: nullableText(source.artist, 160),
        scheduledKey: nullableText(source.scheduledKey, 24),
        bpm: safeNumber(source.bpm, 20, 300),
        hasChords: source.hasChords === true,
        hasLyrics: source.hasLyrics === true,
      }];
    });
}

function presence(value: unknown): LivePresenceProjection | null {
  const source = object(value);
  if (!source) return null;
  const allowed = new Set(['pending', 'accepted', 'maybe', 'declined', 'mixed']);
  const status = typeof source.status === 'string' && allowed.has(source.status)
    ? source.status as LivePresenceProjection['status']
    : 'pending';
  const responseCount = safeNumber(source.responseCount, 0, 100);
  const respondedAtRaw = nullableText(source.respondedAt, 64);
  const respondedAt =
    respondedAtRaw && !Number.isNaN(Date.parse(respondedAtRaw))
      ? new Date(respondedAtRaw).toISOString()
      : null;
  return {
    status,
    responseCount: responseCount === null ? 0 : Math.round(responseCount),
    respondedAt,
  };
}

function chart(value: unknown): LiveChartProjection | null {
  const source = object(value);
  if (!source) return null;
  const allowed = new Set([
    'ready',
    'no_chords',
    'requires_source_key_confirmation',
    'transposition_failed',
  ]);
  const status = typeof source.status === 'string' && allowed.has(source.status)
    ? source.status as LiveChartProjection['status']
    : 'transposition_failed';
  const sourceVerified = source.sourceVerified === true;
  const rawChords = typeof source.chords === 'string' ? source.chords.slice(0, 80_000) : '';
  const chords = status === 'ready' && sourceVerified && rawChords.trim()
    ? rawChords
    : null;

  return {
    status,
    songId: text(source.songId, 256),
    title: text(source.title, 180),
    artist: nullableText(source.artist, 160),
    sourceKey: nullableText(source.sourceKey, 24),
    scheduledKey: nullableText(source.scheduledKey, 24),
    bpm: safeNumber(source.bpm, 20, 300),
    chords,
    transposed: source.transposed === true && Boolean(chords),
    sourceVerified,
  };
}

/**
 * Browser-side display boundary for structured live Core results.
 *
 * It never renders arbitrary unknown tool data. Only the explicit, PII-minimal
 * projections already supported by the real MusicScale verticals are accepted.
 */
export function normalizeLiveResultProjection(value: unknown): LiveResultProjection {
  const root = object(value);
  if (!root) return null;

  if ('chart' in root) {
    return {
      kind: 'chart',
      schedule: schedule(root.schedule),
      chart: chart(root.chart),
    };
  }

  if ('repertoire' in root) {
    return {
      kind: 'repertoire',
      schedule: schedule(root.schedule),
      songs: repertoire(root.repertoire),
    };
  }

  if ('presence' in root) {
    return {
      kind: 'presence',
      schedule: schedule(root.schedule),
      presence: presence(root.presence),
    };
  }

  const directSchedule = schedule(root);
  if (directSchedule) {
    return { kind: 'schedule', schedule: directSchedule };
  }

  return null;
}
