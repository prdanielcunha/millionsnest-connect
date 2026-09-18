import { Buffer } from 'node:buffer';
import { classifyMusicScaleEvidence, deriveRadarPeople } from '../personal/radar/radarSignals';
import { extractWhatsAppText, parseWhatsAppExport, ParsedWhatsAppMessage } from '../personal/whatsapp/whatsappExport';

let passed = 0;
let total = 0;

function assert(condition: unknown, message: string) {
  total++;
  if (!condition) throw new Error(message);
  passed++;
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(actual === expected, `${message} (expected ${String(expected)}, got ${String(actual)})`);
}

function storedZip(name: string, text: string): Buffer {
  const fileName = Buffer.from(name, 'utf8');
  const data = Buffer.from(text, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(fileName.length, 26);
  const localRecord = Buffer.concat([local, fileName, data]);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(fileName.length, 28);
  const centralRecord = Buffer.concat([central, fileName]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(centralRecord.length, 12); eocd.writeUInt32LE(localRecord.length, 16);
  return Buffer.concat([localRecord, centralRecord, eocd]);
}

function message(index: number, sender: string, text: string, dateKey = '2026-09-08'): ParsedWhatsAppMessage {
  return { index, sender, text, dateKey, timestampLocal: `${dateKey}T10:00:00` };
}

console.log('--- Running Personal Radar Signal Tests ---');

{
  const text = [
    '[08/09/2026, 10:15:01] Daniel: Bom dia',
    '[08/09/2026, 10:16:02] Ana: Como vocês organizam a escala do louvor pelo WhatsApp?',
    'Eu sempre me perco nas mensagens.',
    '09/09/2026, 11:22 - Daniel: Entendi.',
  ].join('\n');
  const parsed = parseWhatsAppExport(text);
  equal(parsed.messages.length, 3, 'TXT parses participant messages');
  assert(parsed.messages[1].text.includes('Eu sempre me perco'), 'multiline message is preserved');
  equal(extractWhatsAppText('Conversa do WhatsApp.zip', storedZip('_chat.txt', text)), text, 'stored ZIP extracts TXT');
}

{
  equal(classifyMusicScaleEvidence('Me permita uma breve reflexão em tom contemplativo.'), 'none', 'contemplative tone is not a musical key signal');
  equal(classifyMusicScaleEvidence('Nosso maior desafio é vencer nossas paixões carnais.'), 'none', 'devotional challenge is unrelated to MusicScale');
  equal(classifyMusicScaleEvidence('Qual tom da música de domingo?'), 'topic', 'musical key with song context is relevant');
  equal(classifyMusicScaleEvidence('A escala do louvor está confusa e ninguém confirma.'), 'pain', 'worship schedule pain is strong evidence');
  equal(classifyMusicScaleEvidence('Quanto custa o MusicScale?'), 'explicit', 'explicit product interest is strongest evidence');
}

{
  const falsePositive = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Pr. Marcos', 'Me permita uma breve reflexão em tom contemplativo: ouvir eu te compreendo.'),
      message(1, 'Pastor Presidente João', 'Nosso maior desafio é vencer nossos desejos e paixões carnais.'),
    ],
  });
  equal(falsePositive.length, 0, 'pastoral/devotional content alone never enters MusicScale Radar');
}

{
  const relationshipOnly = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [message(0, 'Carlos', 'Como funciona a câmera desse celular?'), message(1, 'Daniel', 'Depois eu te mostro.')],
  });
  equal(relationshipOnly.length, 0, 'relationship alone does not create MusicScale fit');
}

{
  const direct = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Ana', 'A escala do louvor está confusa e o repertório fica espalhado no WhatsApp.'),
      message(1, 'Daniel', 'Entendi.'),
      message(2, 'Ana', 'Tem algum sistema que ajude a equipe?'),
    ],
  });
  equal(direct.length, 1, 'real MusicScale pain produces Radar person');
  assert(direct[0].signals.some(signal => signal.type === 'explicit_product_interest'), 'real pain gets strong product signal');
  assert(direct[0].signals.every(signal => signal.evidence.length > 0), 'every surfaced signal has evidence');
}

{
  const topicOnly = deriveRadarPeople({
    selfNames: ['Daniel'],
    messages: [message(0, 'Marcos', 'Hoje o louvor foi muito bonito.')],
  });
  equal(topicOnly.length, 1, 'real worship topic can be surfaced');
  assert(topicOnly[0].signals.some(signal => signal.type === 'recurring_relevant_topic'), 'topic without pain is not promoted to very high');
  assert(!topicOnly[0].signals.some(signal => signal.type === 'explicit_product_interest'), 'topic alone is not explicit product interest');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
