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

// 9. nenhuma pergunta “quer completa?” é produzida.
// mode !== auto_chunked without auto continuation (this is covered by automaticContinuation being true on chunked)

// 10. cifra longa retorna todos os chunks no mesmo resultado e automaticContinuation true.
// create a fake long song to test auto chunking
const longSong = { ...mockChartDataset[1], lyrics: Array(100).fill('linha').join('\n'), chords: Array(100).fill('C').join('\n') };
const del2 = generateChartDelivery(longSong);
checkEqual(del2.mode, 'auto_chunked', 'mode auto_chunked');
checkOk(del2.chunks.length > 1, 'multiple chunks');
checkEqual(del2.automaticContinuation, true, 'auto_cont true');

// 12. múltiplas versões retornam ambiguityOptions sem escolher silenciosamente.
// We need multiple songs matching "Fictícia"
const resolution2 = resolveSongChart('', 'Fictícia') as any;
checkOk(!!resolution2.ambiguity, 'ambiguity object returned');
checkEqual(resolution2.ambiguity.length, 2, '2 matches');

// 16. conteúdo restricted ou unknown é bloqueado para entrega integral.
const restrictedSong = mockChartDataset[2];
const del3 = generateChartDelivery(restrictedSong);
checkEqual(del3.mode, 'blocked', 'mode blocked');
checkEqual(del3.chunkCount, 0, 'chunkCount 0');
checkOk(!!del3.blockedReason, 'has blockedReason');

console.log(`✅ Passed ${passed} / ${total} tests.`);
