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
  assert(types.has('explicit_product_interest'), 'MusicScale fit is highest-priority signal');
  assert(types.has('commercial_followup_due'), 'existing direct relationship is also surfaced');
  assert(!direct[0].signals.some(signal => signal.evidence.length === 0), 'direct signals keep evidence');
}

{
  const relationshipOnly = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Carlos', 'Como funciona a câmera desse celular?'),
      message(1, 'Daniel', 'Depois eu te mostro.'),
    ],
  });
  equal(relationshipOnly.length, 1, 'a real direct relationship can surface even without MusicScale keywords');
  assert(
    relationshipOnly[0].signals.some(signal => signal.type === 'commercial_followup_due'),
    'direct relationship uses the second priority bucket',
  );
  assert(
    !relationshipOnly[0].signals.some(signal => signal.type === 'explicit_product_interest'),
    'unrelated relationship is not falsely classified as MusicScale fit',
  );
}

{
  const group = deriveRadarPeople({
    selfNames: ['Daniel Barbosa', 'Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Ana', 'A escala do louvor está confusa.'),
      message(1, 'Bruno', 'Daniel, depois consegue me chamar no privado?'),
      message(2, 'Daniel', 'Consigo sim.'),
      message(3, 'Ana', 'O repertório também está espalhado no WhatsApp.'),
    ],
  });
  const ana = group.find(person => person.displayName === 'Ana');
  const bruno = group.find(person => person.displayName === 'Bruno');
  assert(Boolean(ana), 'group participant with MusicScale pain is surfaced');
  assert(ana?.signals.some(signal => signal.type === 'explicit_product_interest'), 'group MusicScale fit stays evidence-based');
  assert(Boolean(bruno), 'explicit owner mention in group is surfaced as relationship');
  assert(bruno?.signals.some(signal => signal.type === 'commercial_followup_due'), 'owner mention uses relationship priority');
}

{
  const pastoral = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Pastor Presidente João', 'Boa noite irmãos.'),
      message(1, 'Pr. Marcos', 'Deus abençoe a todos.'),
      message(2, 'Pessoa Comum', 'Boa noite.'),
    ],
  });
  const leader = pastoral.find(person => person.displayName === 'Pastor Presidente João');
  const pastor = pastoral.find(person => person.displayName === 'Pr. Marcos');
  assert(Boolean(leader), 'pastor/leader decision-maker is surfaced without MusicScale keyword');
  assert(leader?.signals.some(signal => signal.type === 'unanswered_conversation'), 'leader role uses third priority bucket');
  assert(Boolean(pastor), 'remaining pastoral contact is surfaced');
  assert(pastor?.signals.some(signal => signal.type === 'recurring_relevant_topic'), 'pastoral contact uses fourth priority bucket');
  assert(!pastoral.some(person => person.displayName === 'Pessoa Comum'), 'unrelated cold contact is not added just because it appears in a group');
}

{
  const ordered = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Pastor Presidente João', 'Boa noite irmãos.'),
      message(1, 'Pr. Marcos', 'Paz a todos.'),
      message(2, 'Bruno', 'Daniel, fala comigo depois por favor.'),
      message(3, 'Ana', 'Nossa escala e as cifras ficam perdidas no WhatsApp.'),
    ],
  });
  equal(ordered[0]?.displayName, 'Ana', 'MusicScale fit ranks first');
  equal(ordered[1]?.displayName, 'Bruno', 'existing relationship/mention ranks second');
  equal(ordered[2]?.displayName, 'Pastor Presidente João', 'pastor/leader decision-maker ranks third');
  equal(ordered[3]?.displayName, 'Pr. Marcos', 'remaining pastoral contact ranks fourth');
}

{
  const sensitiveOnly = deriveRadarPeople({
    selfNames: ['Daniel'],
    todayDateKey: '2026-09-11',
    messages: [
      message(0, 'Maria', 'Minha religião é algo pessoal.'),
    ],
  });
  equal(sensitiveOnly.length, 0, 'sensitive personal statements alone never create Radar signals');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
