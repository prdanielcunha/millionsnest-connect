import { CanonicalContextProvider, CanonicalCoreContext } from '../core/runtime/connectCore';
import { PersonalRadarService } from '../personal/radar/personalRadarService';
import { PersonalSourcesService } from '../personal/sources/personalSourcesService';
import { FirestorePersonalVault, VaultDocument, VaultWrite } from '../personal/storage/firestorePersonalVault';

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

class MemoryVault extends FirestorePersonalVault {
  readonly records = new Map<string, Record<string, unknown>>();

  constructor() {
    super({ fetchImpl: (async () => new Response()) as typeof fetch });
  }

  private key(path: string[]): string {
    return path.join('/');
  }

  override async get(_authToken: string, _uid: string, relativePath: string[]): Promise<VaultDocument | null> {
    const data = this.records.get(this.key(relativePath));
    if (!data) return null;
    return { id: relativePath[relativePath.length - 1] || '', ...structuredClone(data) };
  }

  override async list(
    _authToken: string,
    _uid: string,
    relativeCollectionPath: string[],
    maxDocuments = 1_500,
  ): Promise<VaultDocument[]> {
    const prefix = `${this.key(relativeCollectionPath)}/`;
    const result: VaultDocument[] = [];
    for (const [key, data] of this.records.entries()) {
      if (!key.startsWith(prefix)) continue;
      const remainder = key.slice(prefix.length);
      if (!remainder || remainder.includes('/')) continue;
      result.push({ id: remainder, ...structuredClone(data) });
      if (result.length >= maxDocuments) break;
    }
    return result;
  }

  override async writeMany(_authToken: string, _uid: string, writes: VaultWrite[]): Promise<void> {
    for (const write of writes) this.records.set(this.key(write.path), structuredClone(write.data));
  }

  override async deleteMany(_authToken: string, _uid: string, paths: string[][]): Promise<void> {
    for (const path of paths) this.records.delete(this.key(path));
  }
}

function canonicalContext(overrides: Partial<CanonicalCoreContext> = {}): CanonicalCoreContext {
  return {
    actorUid: 'founder-1',
    systemRole: 'founder',
    globalAccess: true,
    organizationId: 'org-1',
    organizationRole: 'owner',
    permissions: [],
    capabilities: [],
    appAccess: { musicscale: true },
    ...overrides,
  };
}

function provider(context: CanonicalCoreContext): CanonicalContextProvider {
  return {
    async resolve() {
      return { status: 'resolved', context };
    },
  };
}

function payload(lines: string[]) {
  return {
    fileName: 'Grupo Pastores Norte.txt',
    contentBase64: Buffer.from(lines.join('\n'), 'utf8').toString('base64'),
    selfNames: ['Daniel'],
  };
}

const firstExport = [
  '[10/09/2026, 09:00:00] Ana Souza: Como vocês organizam as escalas do louvor hoje?',
  '[10/09/2026, 09:02:00] Daniel: Aqui usamos o MusicScale para escala, repertório e confirmação.',
];
const expandedExport = [
  ...firstExport,
  '[12/09/2026, 11:30:00] Ana Souza: Gostei. Tem como testar o MusicScale na igreja?',
];

console.log('--- Running Personal Sources V2 Service Tests ---');

{
  const vault = new MemoryVault();
  const contextProvider = provider(canonicalContext());
  const now = () => Date.parse('2026-09-12T18:00:00Z');
  const radar = new PersonalRadarService(contextProvider, vault, now);
  const sources = new PersonalSourcesService(contextProvider, vault, radar, now);
  const request = { authToken: 'Bearer founder-token', organizationId: 'org-1' };

  const first = await sources.importWhatsApp(request, payload(firstExport));
  equal(first.status, 'imported', 'first export creates a canonical Personal Source');
  equal(first.addedMessageCount, 2, 'first export adds all messages');
  equal(first.totalMessageCount, 2, 'canonical source starts with the full message count');
  assert(String(first.conversationId).startsWith('conv_'), 'canonical conversation id is independent from raw export hash');

  const second = await sources.importWhatsApp(request, payload(expandedExport));
  equal(second.status, 'incremental', 'expanded export is recognized as the same conversation');
  equal(second.addedMessageCount, 1, 'incremental import adds only the unseen message');
  equal(second.totalMessageCount, 3, 'canonical message total includes old plus new messages exactly once');
  equal(second.conversationId, first.conversationId, 'same WhatsApp group keeps a stable canonical conversation id');

  const duplicate = await sources.importWhatsApp(request, payload(expandedExport));
  equal(duplicate.status, 'deduplicated', 'reimporting the exact expanded export is idempotent');
  equal(duplicate.addedMessageCount, 0, 'exact reimport adds zero messages');
  equal(duplicate.conversationId, first.conversationId, 'exact reimport resolves to the same canonical conversation');

  const listed = await sources.listSources(request);
  equal(listed.count, 1, 'Personal Sources list contains one canonical group instead of one item per export');
  equal(listed.sources[0].messageCount, 3, 'source list reports deduplicated canonical message count');
  equal(listed.sources[0].importCount, 2, 'only unique export revisions increment import history');
  equal(listed.totals.messages, 3, 'dashboard totals do not double-count reimports');

  const groupedRadar = await sources.getRadar(request);
  equal(groupedRadar.conversations.length, 1, 'Radar sees one canonical source');
  equal(groupedRadar.people.length, 1, 'the same sender across incremental slices remains one canonical person');
  equal((groupedRadar.people[0] as any).sources[0].sourceId, first.conversationId, 'person provenance points to the canonical group');

  const detail = await sources.getSource(request, first.conversationId);
  equal(detail.source.messageCount, 3, 'source detail preserves canonical message total');
  equal(detail.recentMessages.length, 3, 'source detail reconstructs deduplicated history from delta slices');
  assert(detail.imports.some(item => item.addedMessageCount === 1), 'source detail explains which import added new messages');
  assert(detail.people.some(person => person.displayName.includes('Ana')), 'source detail exposes people who came from the selected group');

  const personId = String((groupedRadar.people[0] as any).id);
  const person360 = await sources.getPersonContext(request, personId);
  equal(person360.stats.sourceCount, 1, 'Person 360 reports the canonical source count');
  equal(person360.stats.messageCount, 2, 'Person 360 reconstructs only messages authored by the selected person');
  assert(Array.isArray(person360.sources) && person360.sources[0].label === 'Grupo Pastores Norte', 'Person 360 keeps source provenance');
  assert(typeof person360.whyNow === 'string' && person360.whyNow.length > 5, 'Person 360 explains why the relationship deserves attention');

  await radar.updatePerson(request, personId, { favorite: true });
  const brief = await sources.getBrief(request);
  assert(brief.items.some(item => item.personId === personId), 'relationship brief surfaces explicitly prioritized/favorite relationships');
  assert(brief.items.every(item => typeof item.reason === 'string' && item.reason.length > 3), 'brief is explainable rather than score-only');

  const outreach = await sources.prepareSourceOutreach(request, first.conversationId, { limit: 5, tone: 'curto', style: 'consultivo' });
  assert(outreach.count >= 1, 'source-aware outreach can prepare a conversation for people from group X');
  equal(outreach.automaticSend, false, 'group outreach never auto-sends messages');
  assert(outreach.items.every(item => item.automaticSend === false && typeof item.draft === 'string'), 'every prepared outreach item stays manual and editable');

  const deletion = await sources.deleteSource(request, first.conversationId);
  equal(deletion.deleted, true, 'canonical source deletion succeeds');
  equal((await sources.listSources(request)).count, 0, 'source deletion removes the canonical conversation from the vault');
  assert(![...vault.records.keys()].some(key => key.startsWith(`personalConversationGroups/${first.conversationId}`)), 'canonical source metadata and fingerprint index are deleted');
}

{
  const vault = new MemoryVault();
  const contextProvider = provider(canonicalContext({ globalAccess: false, systemRole: null }));
  const radar = new PersonalRadarService(contextProvider, vault);
  const sources = new PersonalSourcesService(contextProvider, vault, radar);
  let denied = false;
  try {
    await sources.listSources({ authToken: 'Bearer member-token', organizationId: 'org-1' });
  } catch (error) {
    denied = error instanceof Error && error.message === 'RADAR_PILOT_FORBIDDEN';
  }
  assert(denied, 'Personal Sources V2 preserves the private governance boundary');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
