import { SongChartProjection, SongChartDelivery, ScheduleSongbookProjection, ScheduleDocumentStatus } from '../../types';
import { chunkTextByLines, mockChartDataset } from '../../demo/chartDataset';
import { transposeChartContent } from './transposition';

export function resolveSongChart(
  songId: string, 
  titleQuery?: string,
  versionQuery?: string
): SongChartProjection | { ambiguity: { songId: string; title: string; version?: string }[] } | null {
  
  if (songId) {
    const found = mockChartDataset.find(s => s.songId === songId);
    return found || null;
  }
  
  if (titleQuery) {
    const matches = mockChartDataset.filter(s => s.title.toLowerCase().includes(titleQuery.toLowerCase()) || (s.artist && s.artist.toLowerCase().includes(titleQuery.toLowerCase())));
    
    if (matches.length === 0) return null;
    
    if (matches.length === 1) {
      return matches[0];
    }
    
    if (versionQuery) {
      const versionMatch = matches.find(s => s.version?.toLowerCase() === versionQuery.toLowerCase());
      if (versionMatch) return versionMatch;
    }
    
    return {
      ambiguity: matches.map(m => ({ songId: m.songId, title: m.title, version: m.version }))
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
    finalChords = transposeChartContent(projection.chords, originalKey, targetKey, true);
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
