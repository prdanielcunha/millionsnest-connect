import { resolveSongChart, generateChartDelivery } from '../core/services/chartDelivery';
import { mockChartDataset } from '../demo/chartDataset';

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
console.log('--- Running Chart Delivery Tests ---');

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
const resolution2 = resolveSongChart('', 'Fictícia') as any;
checkOk(!!resolution2.ambiguity, 'ambiguity object returned');
checkEqual(resolution2.ambiguity.length, 2, '2 matches');

// 16. conteúdo restricted ou unknown é bloqueado para entrega integral.
const restrictedSong = mockChartDataset[2];
const del3 = generateChartDelivery(restrictedSong);
checkEqual(del3.mode, 'blocked', 'mode blocked');
checkEqual(del3.chunkCount, 0, 'chunkCount 0');
checkOk(!!del3.blockedReason, 'has blockedReason');

// --- Novas regras de transposição local sem integração ---

// 1. uma projeção autorizada em C com requestedKey: D é transposta
// Let's create a mock projection
const songC = { ...mockChartDataset[0], chords: 'C  F  G', key: 'C' }; // song_demo_01 is originally E, let's use a dynamic one.
const del4 = generateChartDelivery(songC, 'D'); // requestedKey 'D'
checkEqual(del4.resolvedKey, 'D', 'resolvedKey changed to D');

// 2. Transposed content is D G A
// In full_text mode, chunk 0 contains lyrics and chords merged. We can inspect the text.
const combinedContent = del4.chunks[0].content;
if (!combinedContent) {
  console.log('DEL4:', JSON.stringify(del4, null, 2));
}
checkOk(combinedContent.includes('D  G  A'), 'chords transposed to D');
checkEqual(combinedContent.includes('C  F  G'), false, 'original chords are gone');

// 3. o conteúdo original da projeção permanece intacto;
checkEqual(songC.chords, 'C  F  G', 'original chords untampered');
checkEqual(songC.key, 'C', 'original key untampered');

// 4. generateChartDelivery() não precisa de flag de integração; (tested implicitly by del4 generating without throwing)

console.log(`✅ Passed ${passed} / ${total} tests.`);
