import { SongChartProjection, SongChartDelivery, ScheduleSongbookProjection, ScheduleDocumentStatus, SongSearchResult, SongChartAmbiguityOption } from '../../types';
import { chunkTextByLines, mockChartDataset } from '../../demo/chartDataset';
import { transposeChartContent } from './transposition';

export function normalizeSongSearchText(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isSongVisibleToOrganization(
  song: SongChartProjection,
  organizationId?: string
): boolean {
  if (song.organizationId) {
    return song.organizationId === organizationId;
  }
  return true;
}

export function searchSongCharts(
  query: string,
  organizationId?: string
): SongSearchResult[] {
  const normalizedQuery = normalizeSongSearchText(query);
  if (!normalizedQuery) return [];

  const visibleSongs = mockChartDataset.filter(song => isSongVisibleToOrganization(song, organizationId));

  const matches = visibleSongs.filter(s => {
    const titleMatch = normalizeSongSearchText(s.title).includes(normalizedQuery);
    const artistMatch = s.artist ? normalizeSongSearchText(s.artist).includes(normalizedQuery) : false;
    const versionMatch = s.version ? normalizeSongSearchText(s.version).includes(normalizedQuery) : false;
    return titleMatch || artistMatch || versionMatch;
  });

  return matches.map(s => ({
    songId: s.songId,
    title: s.title,
    artist: s.artist,
    version: s.version,
    key: s.key,
    originalKey: s.originalKey,
    selectedKey: s.selectedKey,
    bpm: s.bpm,
    source: s.source,
    rightsStatus: s.rights.status,
    organizationScoped: !!s.organizationId
  }));
}

export function resolveSongChart(
  songId: string,
  titleQuery?: string,
  versionQuery?: string,
  organizationId?: string
): SongChartProjection | { ambiguity: SongChartAmbiguityOption[] } | null {
  if (songId) {
    const found = mockChartDataset.find(s => s.songId === songId);
    if (found && isSongVisibleToOrganization(found, organizationId)) {
      return { ...found };
    }
    return null;
  }

  if (titleQuery) {
    const normalizedTitle = normalizeSongSearchText(titleQuery);
    const visibleSongs = mockChartDataset.filter(s => isSongVisibleToOrganization(s, organizationId));
    
    const matches = visibleSongs.filter(s => {
      const titleMatch = normalizeSongSearchText(s.title).includes(normalizedTitle);
      const artistMatch = s.artist ? normalizeSongSearchText(s.artist).includes(normalizedTitle) : false;
      return titleMatch || artistMatch;
    });

    if (matches.length === 0) return null;

    if (matches.length === 1) {
      return { ...matches[0] };
    }

    if (versionQuery) {
      const normalizedVersion = normalizeSongSearchText(versionQuery);
      const versionMatches = matches.filter(s => s.version && normalizeSongSearchText(s.version) === normalizedVersion);
      if (versionMatches.length === 1) {
        return { ...versionMatches[0] };
      }
    }

    return {
      ambiguity: matches.map(m => ({
        songId: m.songId,
        title: m.title,
        artist: m.artist,
        version: m.version,
        key: m.key,
        bpm: m.bpm
      }))
    };
  }

  return null;
}

export function generateChartDelivery(
  projection: SongChartProjection,
  requestedKey?: string
): SongChartDelivery {
  if (projection.rights.status === 'restricted' || projection.rights.status === 'unknown') {
    return {
      mode: 'blocked',
      resolvedSong: projection,
      chunks: [],
      chunkCount: 0,
      automaticContinuation: false,
      blockedReason: projection.rights.attribution 
        ? `Conteúdo protegido por direitos autorais: ${projection.rights.attribution}`
        : 'Conteúdo restrito ou com direitos desconhecidos.',
      supplementaryActions: []
    };
  }

  // Handle Transposition
  const originalKey = projection.originalKey || projection.key;
  const targetKey = requestedKey || projection.selectedKey || originalKey;
  let finalChords = projection.chords;
  let finalKey = projection.key;
  
  if (targetKey && originalKey && targetKey !== originalKey && projection.rights.allowTransposition) {
    finalChords = transposeChartContent(projection.chords, originalKey, targetKey);
    finalKey = targetKey;
  }

  // Merge lyrics and chords for simple display
  const linesLyrics = projection.lyrics.split('\n');
  const linesChords = finalChords.split('\n');
  const maxLines = Math.max(linesLyrics.length, linesChords.length);
  
  let mergedContent = '';
  for (let i = 0; i < maxLines; i++) {
    const chordLine = linesChords[i] || '';
    const lyricLine = linesLyrics[i] || '';
    mergedContent += (chordLine ? chordLine + '\n' : '') + (lyricLine ? lyricLine + '\n' : '\n');
  }

  const rawChunks = chunkTextByLines(mergedContent, 30);
  
  const mode = rawChunks.length > 1 ? 'auto_chunked' : 'full_text';
  const chunks = rawChunks.map((content, idx) => ({
    index: idx + 1,
    total: rawChunks.length,
    content
  }));

  return {
    mode,
    resolvedSong: { ...projection, chords: finalChords, key: finalKey },
    resolvedKey: finalKey,
    chunks,
    chunkCount: chunks.length,
    automaticContinuation: chunks.length > 1,
    supplementaryActions: ['generate_pdf', 'transpose', 'musician_mode']
  };
}

export function generateScheduleSongbook(
  scheduleId: string,
  organizationId: string
): ScheduleSongbookProjection {
  // Demo just returns all available charts
  return {
    scheduleId,
    organizationId,
    title: 'Escala de Domingo',
    date: '2026-08-09',
    time: '18:00',
    songs: mockChartDataset.filter(s => s.rights.status !== 'restricted' && s.rights.status !== 'unknown'),
    documentStatus: 'available_stub'
  };
}
