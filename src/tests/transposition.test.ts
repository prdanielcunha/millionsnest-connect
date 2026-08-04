import { transposeChord, transposeChartContent } from '../core/services/transposition';

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

console.log('--- Running Transposition Tests ---');

// 17. transposição C para D funciona.
checkEqual(transposeChord('C', 2), 'D', 'C -> D');
checkEqual(transposeChartContent('C  F  G', 'C', 'D', true), 'D  G  A', 'content C -> D');

// 18. transposição Bb para C funciona.
checkEqual(transposeChord('Bb', 2), 'C', 'Bb -> C');
checkEqual(transposeChartContent('Bb  Eb  F', 'Bb', 'C', true), 'C  F  G', 'content Bb -> C');

// 19. transposição Am e E/G# preserva qualidade e baixo.
checkEqual(transposeChord('Am', 2), 'Bm', 'Am -> Bm');
checkEqual(transposeChord('E/G#', 2), 'F#/A#', 'E/G# -> F#/A#');
checkEqual(transposeChartContent('Am  E/G#', 'C', 'D', true), 'Bm  F#/A#', 'content Am E/G#');

// 20. transposição não muta a cifra original.
const original = 'C  F  G';
const transposed = transposeChartContent(original, 'C', 'D', true);
checkEqual(original, 'C  F  G', 'original preserved');
checkEqual(transposed, 'D  G  A', 'transposed correctly');

console.log(`✅ Passed ${passed} / ${total} tests.`);
