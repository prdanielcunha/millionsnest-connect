import { SongChartProjection } from '../types';

export const mockChartDataset: SongChartProjection[] = [
  {
    songId: 'song_demo_01',
    title: 'Brilha Brilha Estrelinha',
    artist: 'Domínio Público',
    key: 'C',
    originalKey: 'C',
    bpm: 100,
    lyrics: 'Brilha brilha estrelinha\nQuero ver você brilhar\nFaz de conta que é só minha\nSó pra mim você brilhar',
    chords: 'C      F      C\nF    C     G    C\nC      F      C\nF    C     G    C',
    source: 'public_domain' as any,
    checksum: 'a1b2c3d4',
    rights: {
      status: 'public_domain',
      allowFullDisplay: true,
      allowWhatsAppText: true,
      allowDocument: true,
      allowTransposition: true
    }
  },
  {
    songId: 'song_demo_02',
    title: 'Canção do Deserto',
    artist: 'Música Fictícia',
    version: 'Acústica',
    key: 'Am',
    originalKey: 'Am',
    bpm: 72,
    lyrics: 'No deserto eu te encontro\nOnde a areia encontra o sol\nA minha voz se levanta\nComo um forte rouxinol\n\n(Refrão)\nCanta minh\'alma\nCanta sem parar\nMesmo na seca\nA água vai jorrar',
    chords: 'Am     F      C     G\nAm     F      C     G\nAm     F      C     G\nAm     F      C     G\n\nF      C      G\nF      C      G\nF      C      G\nAm     F      C     G',
    sections: [
      { name: 'Verso', startLine: 0, endLine: 3 },
      { name: 'Refrão', startLine: 5, endLine: 8 }
    ],
    source: 'organization' as any,
    checksum: 'e5f6g7h8',
    rights: {
      status: 'owned',
      allowFullDisplay: true,
      allowWhatsAppText: true,
      allowDocument: true,
      allowTransposition: true
    }
  },
  {
    songId: 'song_demo_03',
    title: 'Música Restrita',
    artist: 'Banda Fictícia',
    key: 'G',
    bpm: 120,
    lyrics: 'Esta letra não pode ser exibida inteira\nDireitos autorais protegem a versão',
    chords: 'G D Em C',
    source: 'licensed_provider' as any,
    checksum: 'z9y8x7w6',
    rights: {
      status: 'restricted',
      allowFullDisplay: false,
      allowWhatsAppText: false,
      allowDocument: false,
      allowTransposition: true,
      attribution: 'Licenciado por Editora Fictícia'
    }
  }
];

// Helper to chunk long text preserving line breaks
export function chunkTextByLines(text: string, maxLinesPerChunk: number = 20): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  for (const line of lines) {
    currentChunk.push(line);
    if (currentChunk.length >= maxLinesPerChunk) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
  
  return chunks;
}
