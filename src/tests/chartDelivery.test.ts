import { 
  resolveSongChart, 
  generateChartDelivery, 
  normalizeSongSearchText, 
  isSongVisibleToOrganization, 
  searchSongCharts,
  generateScheduleSongbook
} from '../core/services/chartDelivery';
import { mockChartDataset } from '../demo/chartDataset';
import { SongChartProjection } from '../types';
import { ToolGatewayService } from '../core/services/toolGateway';
import { mockEcosystemContext, mockTools } from '../demo/mockData';

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

// SECURITY FIX 01: songbooks preserve rights and tenant visibility boundaries.
const londrinaSongbook = generateScheduleSongbook('schedule_londrina', 'org_londrina_01');
checkOk(londrinaSongbook.songs.some(s => s.songId === 'song_demo_01'), 'global song visible in Londrina songbook');
checkOk(londrinaSongbook.songs.some(s => s.songId === 'song_demo_02'), 'Londrina song visible in Londrina songbook');
checkEqual(londrinaSongbook.songs.some(s => s.songId === 'song_demo_other_org'), false, 'Curitiba song NOT visible in Londrina songbook');

const curitibaSongbook = generateScheduleSongbook('schedule_curitiba', 'org_curitiba_02');
checkOk(curitibaSongbook.songs.some(s => s.songId === 'song_demo_01'), 'global song visible in Curitiba songbook');
checkOk(curitibaSongbook.songs.some(s => s.songId === 'song_demo_other_org'), 'Curitiba song visible in Curitiba songbook');
checkEqual(curitibaSongbook.songs.some(s => s.songId === 'song_demo_02'), false, 'Londrina song NOT visible in Curitiba songbook');

const unknownSong: SongChartProjection = {
  ...mockChartDataset[0],
  songId: 'song_demo_unknown_test',
  rights: { ...mockChartDataset[0].rights, status: 'unknown' }
};
mockChartDataset.push(unknownSong);
try {
  const rightsSongbook = generateScheduleSongbook('schedule_rights', 'org_londrina_01');
  checkEqual(rightsSongbook.songs.some(s => s.rights.status === 'restricted'), false, 'restricted song NOT included in songbook');
  checkEqual(rightsSongbook.songs.some(s => s.rights.status === 'unknown'), false, 'unknown song NOT included in songbook');
} finally {
  mockChartDataset.pop();
}

// SECURITY FIX 05: rights are enforced for every delivery purpose before content creation.
const rightsFixture = (songId: string, rights: Partial<SongChartProjection['rights']>): SongChartProjection => ({
  ...mockChartDataset[0],
  songId,
  lyrics: `LYRIC_UNICA_${songId}`,
  chords: `CHORD_UNICO_${songId}`,
  rights: {
    ...mockChartDataset[0].rights,
    status: 'licensed',
    allowFullDisplay: true,
    allowWhatsAppText: true,
    allowDocument: true,
    ...rights
  }
});

const noFullDisplay = rightsFixture('rights_no_full', {
  allowFullDisplay: false,
  allowWhatsAppText: true,
  allowDocument: true
});
const blockedNoFull = generateChartDelivery(noFullDisplay, undefined, 'full_display');
checkEqual(blockedNoFull.mode, 'blocked', 'allowFullDisplay=false blocks full display');
checkEqual(blockedNoFull.chunks.length, 0, 'blocked delivery has no chunks');
checkEqual(blockedNoFull.chunkCount, 0, 'blocked delivery has zero chunkCount');
checkEqual(blockedNoFull.automaticContinuation, false, 'blocked delivery has no automatic continuation');
checkEqual(blockedNoFull.resolvedSong, undefined, 'blocked delivery omits resolvedSong');
const serializedBlocked = JSON.stringify(blockedNoFull);
checkEqual(serializedBlocked.includes('LYRIC_UNICA_rights_no_full'), false, 'blocked payload omits protected lyrics');
checkEqual(serializedBlocked.includes('CHORD_UNICO_rights_no_full'), false, 'blocked payload omits protected chords');

const noWhatsApp = rightsFixture('rights_no_whatsapp', { allowWhatsAppText: false });
checkOk(generateChartDelivery(noWhatsApp, undefined, 'full_display').mode !== 'blocked', 'full display does not require WhatsApp right');
checkEqual(generateChartDelivery(noWhatsApp, undefined, 'whatsapp_text').mode, 'blocked', 'WhatsApp text requires WhatsApp right');

const noDocument = rightsFixture('rights_no_document', { allowDocument: false });
checkOk(generateChartDelivery(noDocument, undefined, 'full_display').mode !== 'blocked', 'full display does not require document right');
checkEqual(generateChartDelivery(noDocument, undefined, 'document').mode, 'blocked', 'document requires document right');

const expired = rightsFixture('rights_expired', { licenseExpiresAt: '2000-01-01T00:00:00Z' });
checkEqual(generateChartDelivery(expired, undefined, 'full_display').mode, 'blocked', 'expired license blocks full display');
checkEqual(generateChartDelivery(expired, undefined, 'whatsapp_text').mode, 'blocked', 'expired license blocks WhatsApp text');
checkEqual(generateChartDelivery(expired, undefined, 'document').mode, 'blocked', 'expired license blocks document');

const futureLicense = rightsFixture('rights_future', { licenseExpiresAt: '2999-01-01T00:00:00Z' });
checkOk(generateChartDelivery(futureLicense, undefined, 'document').mode !== 'blocked', 'future valid license permits eligible delivery');
const invalidLicense = rightsFixture('rights_invalid', { licenseExpiresAt: 'invalid-date' });
checkEqual(generateChartDelivery(invalidLicense).mode, 'blocked', 'invalid license date fails closed');

const unknownRights = rightsFixture('rights_unknown', { status: 'unknown' });
checkEqual(generateChartDelivery(unknownRights).mode, 'blocked', 'unknown status remains blocked');
checkEqual(generateChartDelivery(restrictedSong).resolvedSong, undefined, 'restricted blocked delivery omits resolvedSong');

const originalDatasetLength = mockChartDataset.length;
const songbookFixtures = [
  rightsFixture('book_no_document', { allowDocument: false }),
  rightsFixture('book_no_whatsapp', { allowWhatsAppText: false }),
  expired,
  { ...rightsFixture('book_other_tenant', {}), organizationId: 'org_curitiba_02' },
  { ...rightsFixture('book_valid_tenant', {}), organizationId: 'org_londrina_01' }
];
mockChartDataset.push(...songbookFixtures);
try {
  const documentBook = generateScheduleSongbook('rights_document', 'org_londrina_01', 'document');
  checkEqual(documentBook.songs.some(s => s.songId === 'book_no_document'), false, 'document songbook excludes allowDocument=false');
  checkEqual(documentBook.songs.some(s => s.songId === 'rights_expired'), false, 'songbook excludes expired license');
  checkEqual(documentBook.songs.some(s => s.songId === 'book_other_tenant'), false, 'songbook still excludes another tenant');
  checkOk(documentBook.songs.some(s => s.songId === 'book_valid_tenant'), 'songbook includes valid tenant song');

  const whatsAppBook = generateScheduleSongbook('rights_whatsapp', 'org_londrina_01', 'whatsapp_text');
  checkEqual(whatsAppBook.songs.some(s => s.songId === 'book_no_whatsapp'), false, 'WhatsApp songbook excludes allowWhatsAppText=false');
  const displayBook = generateScheduleSongbook('rights_display', 'org_londrina_01', 'full_display');
  checkOk(displayBook.songs.some(s => s.songId === 'book_no_whatsapp'), 'full display songbook permits allowWhatsAppText=false');
} finally {
  mockChartDataset.splice(originalDatasetLength);
}

const gatewayFixtures = [noWhatsApp, noDocument];
const gatewayDatasetLength = mockChartDataset.length;
const getSongChartTool = mockTools.find(tool => tool.name === 'getSongChart')!;
const renderDocumentTool = mockTools.find(tool => tool.name === 'renderSongChartDocument')!;
const baseInvocationContext = {
  requestId: 'req_rights_inapp',
  correlationId: 'corr_rights',
  actor: { uid: 'demo-user-001' },
  organization: { id: 'org_londrina_01' },
  appAccess: { appId: 'musicscale', capabilities: [] },
  channel: { type: 'inapp', conversationId: 'conv_rights' },
  locale: 'pt-BR'
};
mockChartDataset.push(...gatewayFixtures);
try {
  ToolGatewayService.resetDemoState();
  const inAppResult = ToolGatewayService.invokeTool(mockEcosystemContext, getSongChartTool, { songId: noWhatsApp.songId }, baseInvocationContext);
  checkEqual(inAppResult.result.status, 'success', 'in-app chart gateway invocation succeeds');
  checkOk((inAppResult.result.data as any).mode !== 'blocked', 'in-app getSongChart uses full display');
  checkOk(JSON.stringify(inAppResult.result.data).includes(noWhatsApp.lyrics), 'in-app eligible content is delivered');

  const whatsAppResult = ToolGatewayService.invokeTool(
    mockEcosystemContext,
    getSongChartTool,
    { songId: noWhatsApp.songId },
    { ...baseInvocationContext, requestId: 'req_rights_whatsapp', channel: { ...baseInvocationContext.channel, type: 'whatsapp' } }
  );
  checkEqual((whatsAppResult.result.data as any).mode, 'blocked', 'WhatsApp getSongChart uses WhatsApp text purpose');
  checkEqual(JSON.stringify(whatsAppResult.result.data).includes(noWhatsApp.lyrics), false, 'WhatsApp blocked gateway payload omits lyrics');
  checkEqual(JSON.stringify(whatsAppResult.result.data).includes(noWhatsApp.chords), false, 'WhatsApp blocked gateway payload omits chords');

  const documentResult = ToolGatewayService.invokeTool(
    mockEcosystemContext,
    renderDocumentTool,
    { songId: noDocument.songId },
    { ...baseInvocationContext, requestId: 'req_rights_document' }
  );
  checkEqual((documentResult.result.data as any).mode, 'blocked', 'renderSongChartDocument uses document purpose');
  checkEqual(JSON.stringify(documentResult.result.data).includes(noDocument.lyrics), false, 'blocked document gateway payload omits lyrics');
  checkEqual(JSON.stringify(documentResult.result.data).includes(noDocument.chords), false, 'blocked document gateway payload omits chords');
} finally {
  mockChartDataset.splice(gatewayDatasetLength);
  ToolGatewayService.resetDemoState();
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
