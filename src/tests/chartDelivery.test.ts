import { 
  resolveSongChart, 
  generateChartDelivery, 
  normalizeSongSearchText, 
  isSongVisibleToOrganization, 
  searchSongCharts 
} from '../core/services/chartDelivery';
import { mockChartDataset } from '../demo/chartDataset';
import { SongChartProjection } from '../types';

let passed = 0;
let total = 0;
function checkEqual(actual: any, expected: any, message: string) {
  total++;
  if (actual === expected) {
    passed++;
  } else {
    console.error(`❌ ${message} - Expected: ${expected}, Actual: ${actual}`);
    throw new Error(message);
  }
}
function checkOk(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
  } else {
    console.error(`❌ ${message}`);
    throw new Error(message);
  }
}
function checkNull(actual: any, message: string) {
  total++;
  if (actual === null) {
    passed++;
  } else {
    console.error(`❌ ${message} - Expected: null, Actual: ${actual}`);
    throw new Error(message);
  }
}

console.log('--- Running Chart Delivery Tests ---');

// Old tests
// 8. pedido explícito de cifra com uma versão retorna full_text.
const resolution1 = resolveSongChart('', 'Brilha') as any;
checkOk(!!resolution1 && resolution1.songId === 'song_demo_01', 'resolution success');
const del1 = generateChartDelivery(resolution1);
checkEqual(del1.mode, 'full_text', 'mode full_text');
checkEqual(del1.chunks.length, 1, '1 chunk');
checkEqual(del1.automaticContinuation, false, 'auto_cont false');

// 10. cifra longa retorna todos os chunks no mesmo resultado e automaticContinuation true.
const longSong = { ...mockChartDataset[1], lyrics: Array(100).fill('linha').join('\n'), chords: Array(100).fill('C').join('\n') };
const del2 = generateChartDelivery(longSong);
checkEqual(del2.mode, 'auto_chunked', 'mode auto_chunked');
checkOk(del2.chunks.length > 1, 'multiple chunks');
checkEqual(del2.automaticContinuation, true, 'auto_cont true');

// 12. múltiplas versões retornam ambiguityOptions sem escolher silenciosamente.
const resolution2 = resolveSongChart('', 'Fictícia', undefined, 'org_londrina_01') as any;
checkOk(!!resolution2.ambiguity, 'ambiguity object returned');
checkOk(resolution2.ambiguity.length >= 2, 'multiple matches');

// 16. conteúdo restricted ou unknown é bloqueado para entrega integral.
const restrictedSong = mockChartDataset.find(s => s.songId === 'song_demo_03')!;
const del3 = generateChartDelivery(restrictedSong);
checkEqual(del3.mode, 'blocked', 'mode blocked');
checkEqual(del3.chunkCount, 0, 'chunkCount 0');
checkOk(!!del3.blockedReason, 'has blockedReason');

// --- Novas regras de transposição local sem integração ---

// 1. uma projeção autorizada em C com requestedKey: D é transposta
const songC = { ...mockChartDataset.find(s => s.songId === 'song_demo_01')!, chords: 'C  F  G', key: 'C' };
const del4 = generateChartDelivery(songC, 'D');
checkEqual(del4.resolvedKey, 'D', 'resolvedKey changed to D');

const combinedContent = del4.chunks[0].content;
checkOk(combinedContent.includes('D  G  A'), 'chords transposed to D');
checkEqual(combinedContent.includes('C  F  G'), false, 'original chords are gone');

checkEqual(songC.chords, 'C  F  G', 'original chords untampered');
checkEqual(songC.key, 'C', 'original key untampered');

// NEW TESTS FOR CONNECT-CHART-FOUNDATION-01A2-A

// 1. dataset compila sem as any nos campos source alterados; (Implicitly tested by compilation)
const song1 = mockChartDataset.find(s => s.songId === 'song_demo_01')!;
const song2 = mockChartDataset.find(s => s.songId === 'song_demo_02')!;

// 2. domínio público usa rights.status = public_domain;
checkEqual(song1.rights.status, 'public_domain', 'rights.status is public_domain');

// 3. domínio público usa source válido;
checkEqual(song1.source, 'living_library', 'source is living_library');

// 4. busca por título exato;
const search1 = searchSongCharts('Brilha Brilha Estrelinha');
checkOk(search1.length >= 1, 'search by exact title');
checkEqual(search1[0].songId, 'song_demo_01', 'exact title match');

// 5. busca case-insensitive;
const search2 = searchSongCharts('brilha brilha estrelinha');
checkEqual(search2[0].songId, 'song_demo_01', 'case-insensitive match');

// 6. busca sem acento encontra título com acento;
const search3 = searchSongCharts('cancao do deserto', 'org_londrina_01');
checkOk(search3.length >= 2, 'accent-insensitive match');

// 7. espaços adicionais são normalizados;
const search4 = searchSongCharts('  cancao   do   deserto  ', 'org_londrina_01');
checkOk(search4.length >= 2, 'spaces normalized match');

// 8. query vazia retorna array vazio;
const search5 = searchSongCharts('   ');
checkEqual(search5.length, 0, 'empty query returns empty array');

// 9. resultado de busca não possui lyrics;
checkEqual((search1[0] as any).lyrics, undefined, 'no lyrics in search result');

// 10. resultado de busca não possui chords;
checkEqual((search1[0] as any).chords, undefined, 'no chords in search result');

// 11. resultado de busca não possui tabs;
checkEqual((search1[0] as any).tabs, undefined, 'no tabs in search result');

// 12. busca pode encontrar versão;
const search6 = searchSongCharts('Acústica', 'org_londrina_01');
checkOk(search6.some(s => s.songId === 'song_demo_02'), 'search by version');

// 13. busca pode encontrar artista fictício;
const search7 = searchSongCharts('Artista Fictício Curitiba', 'org_curitiba_02');
checkOk(search7.some(s => s.songId === 'song_demo_other_org'), 'search by artist');

// 14. música global aparece para org_londrina_01;
const search8 = searchSongCharts('Brilha', 'org_londrina_01');
checkOk(search8.some(s => s.songId === 'song_demo_01'), 'global song visible to londrina');

// 15. música global aparece para org_curitiba_02;
const search9 = searchSongCharts('Brilha', 'org_curitiba_02');
checkOk(search9.some(s => s.songId === 'song_demo_01'), 'global song visible to curitiba');

// 16. música local Londrina aparece para Londrina;
const search10 = searchSongCharts('Canção do Deserto', 'org_londrina_01');
checkOk(search10.some(s => s.songId === 'song_demo_02'), 'londrina song visible to londrina');

// 17. música local Londrina NÃO aparece para Curitiba;
const search11 = searchSongCharts('Canção do Deserto', 'org_curitiba_02');
checkEqual(search11.some(s => s.songId === 'song_demo_02'), false, 'londrina song NOT visible to curitiba');

// 18. música local Curitiba aparece para Curitiba;
const search12 = searchSongCharts('Hino da Montanha', 'org_curitiba_02');
checkOk(search12.some(s => s.songId === 'song_demo_other_org'), 'curitiba song visible to curitiba');

// 19. música local Curitiba NÃO aparece para Londrina;
const search13 = searchSongCharts('Hino da Montanha', 'org_londrina_01');
checkEqual(search13.length, 0, 'curitiba song NOT visible to londrina');

// 20. resolver por songId respeita organização;
const res1 = resolveSongChart('song_demo_02', undefined, undefined, 'org_londrina_01') as SongChartProjection;
checkOk(!!res1 && res1.songId === 'song_demo_02', 'resolve by songId respects org');

// 21. resolver por songId cross-tenant retorna null;
const res2 = resolveSongChart('song_demo_02', undefined, undefined, 'org_curitiba_02');
checkNull(res2, 'resolve by songId cross-tenant returns null');

// 22. resolver por título respeita organização;
const res3 = resolveSongChart('', 'Hino da Montanha', undefined, 'org_curitiba_02') as SongChartProjection;
checkOk(!!res3 && res3.songId === 'song_demo_other_org', 'resolve by title respects org');

const res4 = resolveSongChart('', 'Hino da Montanha', undefined, 'org_londrina_01');
checkNull(res4, 'resolve by title cross-tenant returns null');

// 23. duas versões do mesmo título retornam ambiguidade;
const res5 = resolveSongChart('', 'Canção do Deserto', undefined, 'org_londrina_01') as any;
checkOk(!!res5.ambiguity, 'ambiguity returned for multiple versions');
checkEqual(res5.ambiguity.length, 2, '2 versions found');

// 24. ambiguidade não contém lyrics;
checkEqual(res5.ambiguity[0].lyrics, undefined, 'no lyrics in ambiguity');

// 25. ambiguidade não contém chords;
checkEqual(res5.ambiguity[0].chords, undefined, 'no chords in ambiguity');

// 26. versionQuery resolve a versão correta;
const res6 = resolveSongChart('', 'Canção do Deserto', 'Ao Vivo Demo', 'org_londrina_01') as SongChartProjection;
checkOk(!!res6 && res6.songId === 'song_demo_02_alt', 'versionQuery resolves correct version');

// 27. nenhuma versão adequada retorna resultado incorreto silenciosamente;
const res7 = resolveSongChart('', 'Canção do Deserto', 'Inexistente', 'org_londrina_01') as any;
checkOk(!!res7.ambiguity, 'ambiguity returned when version not found');

// 28. dataset original não é mutado;
const songToResolve = mockChartDataset.find(s => s.songId === 'song_demo_01')!;
const initialChords = songToResolve.chords;
const res8 = resolveSongChart('song_demo_01') as SongChartProjection;
res8.chords = 'mutated';
checkEqual(mockChartDataset.find(s => s.songId === 'song_demo_01')!.chords, initialChords, 'original dataset is not mutated');

console.log(`✅ Passed ${passed} / ${total} tests.`);
