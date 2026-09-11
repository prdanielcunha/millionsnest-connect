import { CanonicalContextProvider, CanonicalCoreContext } from '../core/runtime/connectCore';
import { PersonalRadarService } from '../personal/radar/personalRadarService';
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

function exportPayload() {
  const text = [
    '[08/09/2026, 09:00:00] Ana: Como vocês organizam a escala pelo WhatsApp?',
    '[08/09/2026, 09:05:00] Daniel: Aqui a gente usa o MusicScale para organizar escala e repertório.',
    '[09/09/2026, 10:00:00] Ana: O MusicScale tem teste e confirmação da equipe?',
  ].join('\n');
  return {
    fileName: 'Conversa com Ana.txt',
    contentBase64: Buffer.from(text, 'utf8').toString('base64'),
    selfNames: ['Daniel'],
  };
}

console.log('--- Running Personal Radar Service Tests ---');

{
  const vault = new MemoryVault();
  let nowMs = Date.parse('2026-09-11T12:00:00Z');
  const service = new PersonalRadarService(
    provider(canonicalContext()),
    vault,
    () => nowMs,
  );
  const request = { authToken: 'Bearer founder-token', organizationId: 'org-1' };

  const first = await service.importWhatsApp(request, exportPayload());
  equal(first.status, 'imported', 'first WhatsApp source import is persisted');
  assert(first.messageCount === 3, 'message count is returned');

  const duplicate = await service.importWhatsApp(request, exportPayload());
  equal(duplicate.status, 'deduplicated', 'same source is deduplicated by content hash');
  equal(duplicate.sourceId, first.sourceId, 'dedupe preserves canonical source id');

  const radar = await service.getRadar(request);
  equal(radar.people.length, 1, 'private Radar returns the imported person');
  const person = radar.people[0] as any;
  assert(person.signals.some((signal: any) => signal.type === 'explicit_product_interest'), 'Radar retains explicit evidence-backed interest');

  const signal = person.signals.find((item: any) => item.type === 'explicit_product_interest');
  const draft = await service.compose(request, person.id, signal.id, 'curto');
  assert(Array.isArray((draft as any).options) && (draft as any).options.length === 3, 'Composer produces three contextual draft options');
  assert((draft as any).stage === 2, 'Composer starts MusicScale fit with discovery before product presentation');
  assert(typeof (draft as any).recommendation === 'string' && (draft as any).recommendation.length > 10, 'Composer explains the recommended next move');
  equal(draft.automaticSend, false, 'Composer never enables automatic commercial sending');
  assert(Array.isArray(draft.evidence) && draft.evidence.length > 0, 'Composer keeps the evidence attached');

  const snooze = await service.updatePerson(request, person.id, { radarState: 'snoozed', snoozeDays: 7 });
  equal(snooze.radarState, 'snoozed', 'manual snooze persists the snoozed state');
  equal(snooze.snoozedUntil, '2026-09-18T12:00:00.000Z', 'manual snooze stores an explicit deterministic deadline');
  equal((await service.getRadar(request)).people.length, 0, 'actively snoozed person is hidden from Radar');

  let invalidSnoozeRejected = false;
  try {
    await service.updatePerson(request, person.id, { radarState: 'snoozed', snoozeDays: 91 });
  } catch (error) {
    invalidSnoozeRejected = error instanceof Error && error.message === 'SNOOZE_DAYS_INVALID';
  }
  assert(invalidSnoozeRejected, 'snooze duration fails closed outside the 1-90 day bound');

  nowMs += 8 * 86_400_000;
  equal((await service.getRadar(request)).people.length, 1, 'person returns automatically after snooze deadline expires');

  const reactivated = await service.updatePerson(request, person.id, { radarState: 'active' });
  equal(reactivated.snoozedUntil, null, 'reactivating clears stale snooze metadata');

  await service.updatePerson(request, person.id, { salesStage: 'pedir_video' });
  equal((vault.records.get(`personalPeople/${person.id}`) as any).salesStage, 'pedir_video', 'commercial stage persists across sessions');
  await service.updatePerson(request, person.id, { commercialAction: 'whatsapp_opened' });
  equal((vault.records.get(`personalPeople/${person.id}`) as any).lastCommercialAction, 'whatsapp_opened', 'WhatsApp open is tracked distinctly from sent');
  await service.updatePerson(request, person.id, { commercialAction: 'sent_manual', followUpDays: 2 });
  equal((vault.records.get(`personalPeople/${person.id}`) as any).lastCommercialAction, 'sent_manual', 'manual send is explicit');
  assert(typeof (vault.records.get(`personalPeople/${person.id}`) as any).followUpAt === 'string', 'manual send schedules follow-up');
  let invalidStageRejected = false;
  try { await service.updatePerson(request, person.id, { salesStage: 'invalid' as any }); } catch (error) { invalidStageRejected = error instanceof Error && error.message === 'SALES_STAGE_INVALID'; }
  assert(invalidStageRejected, 'invalid commercial stage fails closed');

  const promotion = await service.promoteOpportunity(request, person.id);
  equal(promotion.success, true, 'opportunity promotion is an explicit manual action');
  assert(vault.records.has(`relationshipOpportunities/${person.id}`), 'manual promotion creates an owner-scoped opportunity record');
  equal((vault.records.get(`relationshipOpportunities/${person.id}`) as any).salesStage, 'pedir_video', 'opportunity receives minimal commercial stage metadata');
  assert(typeof (vault.records.get(`relationshipOpportunities/${person.id}`) as any).followUpAt === 'string', 'opportunity receives follow-up metadata without raw history');

  const deletion = await service.deleteSource(request, first.sourceId);
  equal(deletion.deleted, true, 'source deletion succeeds');
  assert(!vault.records.has(`personalSources/${first.sourceId}`), 'source record is deleted');
  assert(![...vault.records.keys()].some(key => key.startsWith(`personalPeople/${first.sourceId}_`)), 'derived people from the source are deleted');
  assert(![...vault.records.values()].some(value => value.sourceId === first.sourceId), 'derived source-linked records are deleted');
}

{
  const service = new PersonalRadarService(
    provider(canonicalContext({ globalAccess: false, systemRole: null })),
    new MemoryVault(),
  );
  let denied = false;
  try {
    await service.getRadar({ authToken: 'Bearer member-token', organizationId: 'org-1' });
  } catch (error) {
    denied = error instanceof Error && error.message === 'RADAR_PILOT_FORBIDDEN';
  }
  assert(denied, 'ordinary organization member cannot enter the private founder Radar pilot');
}

{
  const service = new PersonalRadarService(
    provider(canonicalContext({ organizationId: 'org-other' })),
    new MemoryVault(),
  );
  let denied = false;
  try {
    await service.getRadar({ authToken: 'Bearer founder-token', organizationId: 'org-1' });
  } catch (error) {
    denied = error instanceof Error && error.message === 'RADAR_TENANT_MISMATCH';
  }
  assert(denied, 'tenant mismatch fails closed even for a global identity');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
