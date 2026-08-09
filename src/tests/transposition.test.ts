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
checkEqual(transposeChartContent('C  F  G', 'C', 'D'), 'D  G  A', 'content C -> D');

// 18. transposição Bb para C funciona.
checkEqual(transposeChord('Bb', 2), 'C', 'Bb -> C');
checkEqual(transposeChartContent('Bb  Eb  F', 'Bb', 'C'), 'C  F  G', 'content Bb -> C');

// 19. transposição Am e E/G# preserva qualidade e baixo.
checkEqual(transposeChord('Am', 2), 'Bm', 'Am -> Bm');
checkEqual(transposeChord('E/G#', 2), 'F#/A#', 'E/G# -> F#/A#');
checkEqual(transposeChartContent('Am  E/G#', 'C', 'D'), 'Bm  F#/A#', 'content Am E/G#');

// 20. transposição não muta a cifra original.
const original = 'C  F  G';
const transposed = transposeChartContent(original, 'C', 'D');
checkEqual(original, 'C  F  G', 'original preserved');
checkEqual(transposed, 'D  G  A', 'transposed correctly');

// 21. múltiplos espaços permanecem preservados
checkEqual(transposeChartContent('C   F', 'C', 'D'), 'D   G', 'preserves multiple spaces');

// 22. quebras de linha permanecem preservadas
checkEqual(transposeChartContent('C\nF', 'C', 'D'), 'D\nG', 'preserves newlines');

// 23. tom original igual ao tom destino devolve conteúdo equivalente
checkEqual(transposeChartContent('C  F', 'C', 'C'), 'C  F', 'same key preserves content');

// 24. tom original inválido não lança erro
checkEqual(transposeChartContent('C  F', 'X', 'D'), 'C  F', 'invalid original key preserves content');

// 25. tom destino inválido não lança erro
checkEqual(transposeChartContent('C  F', 'C', 'X'), 'C  F', 'invalid new key preserves content');

// 26. token não reconhecido é preservado
checkEqual(transposeChartContent('C  XXX  F', 'C', 'D'), 'D  XXX  G', 'unknown token preserved');

console.log(`✅ Passed ${passed} / ${total} tests.`);
