import { normalizeIdentityName } from '../radar/identityResolution';

function baseFileName(fileName: string): string {
  return fileName.trim().replace(/\.(?:txt|zip)$/i, '').trim();
}

export function deriveConversationMetadata(fileName: string, participants: string[], selfNames: string[]) {
  let label = baseFileName(fileName)
    .replace(/^whatsapp\s+chat\s*[-–—:]?\s*(?:with|com)?\s*/i, '')
    .replace(/^conversa\s+(?:do\s+)?whatsapp\s+(?:com|with)\s+/i, '')
    .replace(/^chat\s+(?:do\s+)?whatsapp\s+(?:com|with)\s+/i, '')
    .replace(/^whatsapp\s*[-–—:]\s*/i, '')
    .replace(/^_?chat$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const self = new Set(selfNames.map(normalizeIdentityName).filter(Boolean));
  const external = participants.filter(name => !self.has(normalizeIdentityName(name)));
  if (!label || /^(?:chat|conversa|whatsapp)$/i.test(label)) {
    if (external.length === 1) label = external[0];
    else if (external.length > 1) label = `WhatsApp · ${external.length} participantes`;
    else label = 'WhatsApp importado';
  }
  const filenameSuggestsGroup = /\b(?:grupo|group)\b/i.test(label);
  const kind: 'group' | 'direct' | 'unknown' = filenameSuggestsGroup || external.length > 1 ? 'group' : external.length === 1 ? 'direct' : 'unknown';
  return { label: label.slice(0, 160), kind, conversationKey: normalizeIdentityName(label).slice(0, 160) || 'whatsapp-importado' };
}