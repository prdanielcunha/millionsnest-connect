import { CanonicalContextProvider, CanonicalCoreContext } from '../core/runtime/connectCore';
import { PersonalIntelligenceService } from '../personal/intelligence/personalIntelligenceService';
import { PersonalRadarService } from '../personal/radar/personalRadarService';
import { PersonalSourcesService } from '../personal/sources/personalSourcesService';
import { FirestorePersonalVault, VaultDocument, VaultWrite } from '../personal/storage/firestorePersonalVault';

let passed = 0;
let total = 0;
function assert(condition: unknown, message: string) { total++; if (!condition) throw new Error(message); passed++; }
function equal(actual: unknown, expected: unknown, message: string) { assert(actual === expected, `${message} (expected ${String(expected)}, got ${String(actual)})`); }

class MemoryVault extends FirestorePersonalVault {
  readonly records = new Map<string, Record<string, unknown>>();
  constructor() { super({ fetchImpl: (async () => new Response()) as typeof fetch }); }
  private key(path: string[]) { return path.join('/'); }
  override async get(_auth: string, _uid: string, path: string[]): Promise<VaultDocument | null> {
    const data = this.records.get(this.key(path));
    return data ? { id: path[path.length - 1] || '', ...structuredClone(data) } : null;
  }
  override async list(_auth: string, _uid: string, path: string[], max = 1_500): Promise<VaultDocument[]> {
    const prefix = `${this.key(path)}/`; const result: VaultDocument[] = [];
    for (const [key, data] of this.records.entries()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length); if (!rest || rest.includes('/')) continue;
      result.push({ id: rest, ...structuredClone(data) }); if (result.length >= max) break;
    }
    return result;
  }
  override async writeMany(_auth: string, _uid: string, writes: VaultWrite[]) { for (const write of writes) this.records.set(this.key(write.path), structuredClone(write.data)); }
  override async deleteMany(_auth: string, _uid: string, paths: string[][]) { for (const path of paths) this.records.delete(this.key(path)); }
}

function context(): CanonicalCoreContext {
  return { actorUid: 'founder-1', systemRole: 'founder', globalAccess: true, organizationId: 'org-1', organizationRole: 'owner', permissions: [], capabilities: [], appAccess: { musicscale: true } };
}
function provider(value: CanonicalCoreContext): CanonicalContextProvider { return { async resolve() { return { status: 'resolved', context: value }; } }; }

console.log('--- Running Relationship Intelligence Tests ---');

const vault = new MemoryVault();
const cp = provider(context());
const now = () => Date.parse('2026-09-12T18:00:00Z');
const radar = new PersonalRadarService(cp, vault, now);
const sources = new PersonalSourcesService(cp, vault, radar, now);
const intelligence = new PersonalIntelligenceService(cp, vault, sources, {
  CONNECT_GOOGLE_DRIVE_IMPORT_ENABLED: 'false',
  CONNECT_WHATSAPP_BUSINESS_ENABLED: 'false',
  CONNECT_INSTAGRAM_PRO_ENABLED: 'false',
  CONNECT_CHATGPT_TOOLS_ENABLED: 'false',
}, now);
const request = { authToken: 'Bearer founder-token', organizationId: 'org-1' };

const exportText = [
  '[10/09/2026, 09:00:00] +55 43 99999-9999: Oi, aqui é Marcelo Santos. Vi o MusicScale e queria entender como funciona.',
  '[10/09/2026, 09:05:00] Daniel: Claro, posso te explicar sem compromisso.',
  '[12/09/2026, 10:15:00] +55 43 99999-9999: Aqui na igreja ainda organizamos a escala pelo WhatsApp.',
].join('\n');
await sources.importWhatsApp(request, {
  fileName: 'Grupo Lideres.txt',
  contentBase64: Buffer.from(exportText, 'utf8').toString('base64'),
  selfNames: ['Daniel'],
});

const grouped = await sources.getRadar(request);
equal(grouped.people.length, 1, 'import creates one external person');
const personId = String((grouped.people[0] as any).id);
assert(Boolean((grouped.people[0] as any).probableName), 'probable identity is inferred from self-introduction');

const reviewBefore = await intelligence.getIdentityReview(request);
assert(reviewBefore.items.some(item => item.personId === personId && item.probableName), 'identity review surfaces probable name with evidence');

const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:Marcelo Santos\nTEL;TYPE=CELL:+55 43 99999-9999\nEMAIL:marcelo@example.com\nEND:VCARD\n`;
const contacts = await intelligence.importVCard(request, { fileName: 'contatos.vcf', contentBase64: Buffer.from(vcf, 'utf8').toString('base64') });
equal(contacts.contactCount, 1, 'vCard import stores one contact');
assert(contacts.matchedPeople >= 1, 'exact phone creates an identity suggestion');
const reviewAfter = await intelligence.getIdentityReview(request);
assert(reviewAfter.items.some(item => item.personId === personId && item.contactSuggestions.length === 1), 'identity review explains exact-phone contact evidence');

const audience = await intelligence.previewAudience(request, { query: 'MusicScale', sourceId: String(grouped.conversations[0].sourceId), activeWithinDays: 30, minMessages: 1 });
assert(audience.items.some(item => item.personId === personId), 'smart audience can segment by authorized topic and source');
await intelligence.saveAudience(request, { name: 'Interessados MusicScale', definition: { query: 'MusicScale' } });
equal((await intelligence.listAudiences(request)).count, 1, 'smart audience can be saved privately');

await intelligence.updateFollowUp(request, personId, { action: 'schedule', dueAt: '2026-09-13T18:00:00Z', note: 'Retomar sobre a escala do louvor' });
const followups = await intelligence.listFollowUps(request);
equal(followups.count, 1, 'scheduled follow-up appears in pending list');
const timeline = await intelligence.getTimeline(request, personId, 100);
assert(timeline.items.some(item => item.type === 'message'), 'unified timeline contains authored messages');
assert(timeline.items.some(item => item.type === 'follow_up'), 'unified timeline contains scheduled follow-up event');

const confirmed = await intelligence.reviewProbableName(request, personId, 'confirm');
equal((confirmed.person as any).identityResolution, 'user_confirmed_probable_name', 'probable identity becomes confirmed only after explicit user action');

const health = await intelligence.getImportHealth(request);
assert(['healthy', 'attention'].includes(health.status), 'import health reports a real state after imports');
const capabilities = await intelligence.getCapabilities(request);
assert(capabilities.connectors.some(item => item.id === 'chatgpt_tools' && item.status === 'api_ready'), 'authenticated ChatGPT tool gateway is explicitly exposed as API-ready, not falsely connected');
assert(capabilities.safety.personalWhatsAppScraping === false && capabilities.safety.automaticMassSend === false, 'connector capabilities preserve no-scraping and no-mass-send safety boundary');

const toolPeople = await intelligence.toolSearchPeople(request, { query: 'MusicScale' });
assert(toolPeople.people.some(item => item.personId === personId), 'tool gateway can search people with provenance-aware audience logic');
const toolContext = await intelligence.toolGetPersonContext(request, personId);
assert(Array.isArray(toolContext.timeline) && toolContext.automaticSend === false, 'tool gateway returns contextual timeline and keeps sending disabled');

await intelligence.updateFollowUp(request, personId, { action: 'complete' });
equal((await intelligence.listFollowUps(request)).count, 0, 'completed follow-up leaves pending queue');

console.log(`✅ Passed ${passed} / ${total} tests.`);
