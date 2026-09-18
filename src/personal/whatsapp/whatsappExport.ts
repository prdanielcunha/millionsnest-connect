import { inflateRawSync } from 'node:zlib';

export type ParsedWhatsAppMessage = {
  index: number;
  sender: string;
  text: string;
  dateKey: string;
  timestampLocal: string;
};

export type ParsedWhatsAppExport = {
  messages: ParsedWhatsAppMessage[];
  participants: string[];
  firstDateKey: string | null;
  lastDateKey: string | null;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_MESSAGES = 25_000;
const MAX_ZIP_ENTRIES = 500;

function cleanText(value: string): string {
  return value.replace(/\u200e|\u200f|\u202a|\u202c/g, '').replace(/\r\n?/g, '\n');
}

function readUInt16(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > buffer.length) throw new Error('ZIP_INVALID');
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) throw new Error('ZIP_INVALID');
  return buffer.readUInt32LE(offset);
}

/**
 * Minimal ZIP reader intentionally limited to the WhatsApp export use case.
 * It accepts only non-encrypted stored/deflated entries and extracts one .txt
 * file. Size/ratio/entry caps prevent ZIP bombs without adding a third-party
 * archive dependency to the zero-cost Core runtime.
 */
export function extractWhatsAppText(fileName: string, bytes: Buffer): string {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error('IMPORT_FILE_SIZE_INVALID');
  const lowerName = fileName.trim().toLowerCase();
  if (!lowerName.endsWith('.zip')) {
    if (!lowerName.endsWith('.txt')) throw new Error('IMPORT_FILE_TYPE_INVALID');
    const text = cleanText(bytes.toString('utf8'));
    if (!text.trim()) throw new Error('IMPORT_EMPTY');
    return text;
  }

  const minEocd = 22;
  if (bytes.length < minEocd) throw new Error('ZIP_INVALID');
  let eocd = -1;
  const scanStart = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - minEocd; offset >= scanStart; offset--) {
    if (readUInt32(bytes, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP_INVALID');

  const entryCount = readUInt16(bytes, eocd + 10);
  const centralSize = readUInt32(bytes, eocd + 12);
  const centralOffset = readUInt32(bytes, eocd + 16);
  if (entryCount <= 0 || entryCount > MAX_ZIP_ENTRIES) throw new Error('ZIP_INVALID');
  if (centralOffset + centralSize > bytes.length) throw new Error('ZIP_INVALID');

  let offset = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (readUInt32(bytes, offset) !== 0x02014b50) throw new Error('ZIP_INVALID');
    const flags = readUInt16(bytes, offset + 8);
    const method = readUInt16(bytes, offset + 10);
    const compressedSize = readUInt32(bytes, offset + 20);
    const uncompressedSize = readUInt32(bytes, offset + 24);
    const nameLength = readUInt16(bytes, offset + 28);
    const extraLength = readUInt16(bytes, offset + 30);
    const commentLength = readUInt16(bytes, offset + 32);
    const localOffset = readUInt32(bytes, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) throw new Error('ZIP_INVALID');
    const entryName = bytes.subarray(nameStart, nameEnd).toString('utf8');

    if (entryName.toLowerCase().endsWith('.txt') && !entryName.endsWith('/')) {
      if ((flags & 0x1) !== 0) throw new Error('ZIP_ENCRYPTED_UNSUPPORTED');
      if (method !== 0 && method !== 8) throw new Error('ZIP_COMPRESSION_UNSUPPORTED');
      if (!uncompressedSize || uncompressedSize > MAX_TEXT_BYTES) throw new Error('IMPORT_FILE_SIZE_INVALID');
      if (compressedSize > MAX_UPLOAD_BYTES) throw new Error('IMPORT_FILE_SIZE_INVALID');
      if (compressedSize > 0 && uncompressedSize / compressedSize > 120) throw new Error('ZIP_RATIO_INVALID');
      if (readUInt32(bytes, localOffset) !== 0x04034b50) throw new Error('ZIP_INVALID');
      const localNameLength = readUInt16(bytes, localOffset + 26);
      const localExtraLength = readUInt16(bytes, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataStart < 0 || dataEnd > bytes.length) throw new Error('ZIP_INVALID');
      const compressed = bytes.subarray(dataStart, dataEnd);
      const extracted = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
      if (extracted.length !== uncompressedSize || extracted.length > MAX_TEXT_BYTES) throw new Error('ZIP_INVALID');
      const text = cleanText(extracted.toString('utf8'));
      if (!text.trim()) throw new Error('IMPORT_EMPTY');
      return text;
    }

    offset = nameEnd + extraLength + commentLength;
    if (offset > centralOffset + centralSize) throw new Error('ZIP_INVALID');
  }

  throw new Error('WHATSAPP_TXT_NOT_FOUND');
}

function normalizeYear(raw: string): number {
  const value = Number(raw);
  return raw.length === 2 ? (value >= 70 ? 1900 + value : 2000 + value) : value;
}

function toDateParts(
  dayRaw: string,
  monthRaw: string,
  yearRaw: string,
  hourRaw: string,
  minuteRaw: string,
  secondRaw?: string,
  meridiemRaw?: string,
): { dateKey: string; timestampLocal: string } | null {
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = normalizeYear(yearRaw);
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw || '0');
  const meridiem = (meridiemRaw || '').toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }
  if (
    year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
  ) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateKey = `${year}-${pad(month)}-${pad(day)}`;
  return {
    dateKey,
    timestampLocal: `${dateKey}T${pad(hour)}:${pad(minute)}:${pad(second)}`,
  };
}

const BRACKETED = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(?:-\s*)?([^:]{1,180}):\s?(.*)$/;
const DASHED_24H = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*([^:]{1,180}):\s?(.*)$/;
const DASHED_12H = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*([^:]{1,180}):\s?(.*)$/i;

function parseHeader(line: string): { sender: string; text: string; dateKey: string; timestampLocal: string } | null {
  let match = BRACKETED.exec(line);
  if (match) {
    const parts = toDateParts(match[1], match[2], match[3], match[4], match[5], match[6]);
    if (!parts) return null;
    return { ...parts, sender: match[7].trim(), text: match[8] || '' };
  }

  match = DASHED_24H.exec(line);
  if (match) {
    const parts = toDateParts(match[1], match[2], match[3], match[4], match[5], match[6]);
    if (!parts) return null;
    return { ...parts, sender: match[7].trim(), text: match[8] || '' };
  }

  match = DASHED_12H.exec(line);
  if (match) {
    const parts = toDateParts(match[1], match[2], match[3], match[4], match[5], undefined, match[6]);
    if (!parts) return null;
    return { ...parts, sender: match[7].trim(), text: match[8] || '' };
  }

  return null;
}

export function parseWhatsAppExport(text: string): ParsedWhatsAppExport {
  const normalized = cleanText(text);
  const lines = normalized.split('\n');
  const messages: ParsedWhatsAppMessage[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u00a0/g, ' ');
    const header = parseHeader(line);
    if (header?.sender) {
      if (messages.length >= MAX_MESSAGES) throw new Error('IMPORT_MESSAGE_LIMIT_EXCEEDED');
      messages.push({
        index: messages.length,
        sender: header.sender.slice(0, 180),
        text: header.text.slice(0, 20_000),
        dateKey: header.dateKey,
        timestampLocal: header.timestampLocal,
      });
      continue;
    }

    // WhatsApp multiline messages continue on the following physical lines.
    // System lines before the first participant message are intentionally ignored.
    const previous = messages[messages.length - 1];
    if (previous && line) {
      previous.text = `${previous.text}\n${line}`.slice(0, 20_000);
    }
  }

  if (!messages.length) throw new Error('WHATSAPP_FORMAT_UNRECOGNIZED');
  const participants = Array.from(new Set(messages.map(message => message.sender))).sort((a, b) => a.localeCompare(b));
  return {
    messages,
    participants,
    firstDateKey: messages[0]?.dateKey || null,
    lastDateKey: messages[messages.length - 1]?.dateKey || null,
  };
}
