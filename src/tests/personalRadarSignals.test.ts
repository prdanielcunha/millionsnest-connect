import { Buffer } from 'node:buffer';
import { deriveRadarPeople } from '../personal/radar/radarSignals';
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
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  local.writeUInt16LE(0, 28);
  const localRecord = Buffer.concat([local, fileName, data]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  const centralRecord = Buffer.concat([central, fileName]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralRecord.length, 12);
  eocd.writeUInt32LE(localRecord.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localRecord, centralRecord, eocd]);
}

function message(index: number, sender: string, text: string, dateKey = '2026-09-08'): ParsedWhatsAppMessage {
  return {
    index,
    sender,
    text,
    dateKey,
    timestampLocal: `${dateKey}T10:00:00`,
  };
}

console.log('--- Running Personal Radar Signal Tests ---');

{
  const text = [
    '[08/09/2026, 10:15:01] Daniel: Bom dia',
    '[08/09/2026, 10:16:02] Ana: Como vocês organizam a escala pelo WhatsApp?',
    'Eu sempre me perco nas mensagens.',
    '09/09/2026, 11:22 - Daniel: Entendi.',
  ].join('\n');
  const parsed = parseWhatsAppExport(text);
  equal(parsed.messages.length, 3, 'TXT parses participant messages');
  equal(parsed.messages[1].sender, 'Ana', 'sender is preserved');
  assert(parsed.messages[1].text.includes('Eu sempre me perco'), 'multiline message is preserved');
  equal(parsed.firstDateKey, '2026-09-08', 'first date is normalized');
  equal(parsed.lastDateKey, '2026-09-09', 'last date is normalized');

  const extracted = extractWhatsAppText('Conversa do WhatsApp.zip', storedZip('_chat.txt', text));
  equal(extracted, text, 'stored ZIP extracts the WhatsApp TXT exactly');
}

{
  let rejected = false;
  try {
    parseWhatsAppExport('arquivo sem mensagens reconhecíveis');
  } catch (error) {
    rejected = error instanceof Error && error.message === 'WHATSAPP_FORMAT_UNRECOGNIZED';
  }
  assert(rejected, 'unrecognized WhatsApp format fails closed');
}

{
  const direct = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Ana', 'Como vocês organizam a escala pelo WhatsApp?'),
      message(1, 'Daniel', 'Aqui usamos o MusicScale para organizar escala e repertório.'),
      message(2, 'Ana', 'Esse aplicativo ajuda no repertório e nas cifras?'),
      message(3, 'Ana', 'Também temos muita confusão com ensaio e escala.'),
      message(4, 'Ana', 'Quanto custa o MusicScale?'),
    ],
  });
  equal(direct.length, 1, 'direct relevant conversation produces one Radar person');
  const types = new Set(direct[0].signals.map(signal => signal.type));
  assert(types.has('explicit_product_interest'), 'explicit MusicScale interest is surfaced');
  assert(types.has('recurring_relevant_topic'), 'recurring relevant topic is surfaced');
  assert(types.has('unanswered_conversation'), 'direct unanswered conversation is surfaced');
  assert(!direct[0].signals.some(signal => signal.evidence.length === 0), 'every signal has evidence');
}

{
  const unrelated = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Carlos', 'Como funciona a câmera desse celular?'),
      message(1, 'Carlos', 'Qual o preço dela?'),
      message(2, 'Daniel', 'Não sei ainda.'),
    ],
  });
  equal(unrelated.length, 0, 'generic app/product words outside relevant context do not create a sales lead');
}

{
  const group = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Ana', 'A escala do louvor está confusa.'),
      message(1, 'Bruno', 'O repertório também está espalhado no WhatsApp.'),
      message(2, 'Daniel', 'Eu criei o MusicScale para escala e repertório.'),
      message(3, 'Ana', 'O MusicScale tem confirmação de presença?'),
    ],
  });
  const ana = group.find(person => person.displayName === 'Ana');
  assert(Boolean(ana), 'group participant can surface explicit evidence from their own message');
  assert(ana?.signals.some(signal => signal.type === 'explicit_product_interest'), 'group explicit product interest remains evidence-based');
  assert(!group.some(person => person.signals.some(signal => signal.type === 'unanswered_conversation')), 'group exports never infer unanswered status');
  assert(!group.some(person => person.signals.some(signal => signal.type === 'commercial_followup_due')), 'group exports never infer commercial follow-up attribution');
}

{
  const sensitiveOnly = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Maria', 'Minha religião é algo pessoal.'),
      message(1, 'Daniel', 'Tudo bem.'),
    ],
  });
  equal(sensitiveOnly.length, 0, 'sensitive personal statements alone never create Radar signals');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
