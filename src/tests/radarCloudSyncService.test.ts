import { CanonicalContextProvider, CanonicalCoreContext } from '../core/runtime/connectCore';
import { RadarCloudSyncService, RADAR_CLOUD_LOGIC_VERSION } from '../personal/radar/radarCloudSyncService';
import { FirestorePersonalVault, VaultDocument, VaultWrite } from '../personal/storage/firestorePersonalVault';

class MemoryVault extends FirestorePersonalVault {
  readonly records = new Map<string, Record<string, unknown>>();
  writeCalls = 0;

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
    this.writeCalls++;
    for (const write of writes) this.records.set(this.key(write.path), structuredClone(write.data));
  }
}

function canonicalContext(): CanonicalCoreContext {
  return {
    actorUid: 'founder-1',
    systemRole: 'founder',
    globalAccess: true,
    organizationId: 'org-1',
    organizationRole: 'owner',
    permissions: [],
    capabilities: [],
    appAccess: { musicscale: true },
  };
}

function provider(): CanonicalContextProvider {
  return {
    async resolve() {
      return { status: 'resolved', context: canonicalContext() };
    },
  };
}

const vault = new MemoryVault();
const sourceId = 'wa_cloudsync_test';
const messages = [
  { index: 0, dateKey: '2026-09-10', timestampLocal: '2026-09-10T09:00:00', sender: 'Marcos Ferreira', text: 'Me permita uma breve reflexão em tom contemplativo sobre ouvir e compreender.' },
  { index: 1, dateKey: '2026-09-10', timestampLocal: '2026-09-10T09:01:00', sender: 'Pr. Celso Carvalho', text: 'Nosso maior desafio é vencer nossos desejos e paixões carnais e avançar.' },
  { index: 2, dateKey: '2026-09-10', timestampLocal: '2026-09-10T09:02:00', sender: 'Ana', text: 'Estamos com dificuldade para organizar a escala do louvor e confirmar os músicos.' },
];

vault.records.set(`personalConversations/${sourceId}`, {
  id: sourceId,
  sourceId,
  selfNames: ['Daniel'],
  label: 'Pastores do Espigão',
  messageCount: messages.length,
});
vault.records.set(`personalConversations/${sourceId}/messageChunks/0000`, {
  sourceId,
  chunkIndex: 0,
  messages,
});
vault.records.set(`personalSources/${sourceId}`, {
  id: sourceId,
  sourceId,
  radarCount: 99,
  messageCount: messages.length,
});
vault.records.set(`importRuns/${sourceId}`, {
  id: sourceId,
  sourceId,
  radarCount: 99,
});

for (const [id, displayName, manualPotential] of [
  ['marcos', 'Marcos Ferreira', 'medium'],
  ['celso', 'Pr. Celso Carvalho', null],
  ['ana', 'Ana', null],
] as const) {
  vault.records.set(`personalPeople/${id}`, {
    id,
    displayName,
    normalizedName: displayName.toLocaleLowerCase('pt-BR'),
    sourceId,
    sourceIds: [sourceId],
    messageCount: 100,
    automaticPotential: 'very_high',
    manualPotential,
    manualPriority: 'normal',
    favorite: id === 'marcos',
    radarState: 'active',
    signals: [{
      id: `legacy_${id}`,
      type: 'explicit_product_interest',
      reason: 'legacy false positive',
      nextAction: 'legacy',
      evidence: [{ messageIndex: 0, dateKey: '2026-09-10', sender: displayName, snippet: 'legacy' }],
    }],
  });
}

const service = new RadarCloudSyncService(provider(), vault, () => Date.parse('2026-09-13T03:45:00Z'));
const request = { authToken: 'Bearer token', organizationId: 'org-1' };
const first = await service.ensureCurrent(request);
if (first.status !== 'reprocessed') throw new Error('expected first sync to reprocess');

const marcos = vault.records.get('personalPeople/marcos')!;
const celso = vault.records.get('personalPeople/celso')!;
const ana = vault.records.get('personalPeople/ana')!;

if (marcos.automaticPotential !== 'unknown') throw new Error('devotional text must not create MusicScale potential');
if (celso.automaticPotential !== 'unknown') throw new Error('pastoral/devotional text must not create MusicScale potential');
if (ana.automaticPotential !== 'very_high') throw new Error('real worship scheduling pain must remain high-confidence');
if (marcos.manualPotential !== 'medium') throw new Error('manual potential must survive cloud reprocessing');
if (marcos.favorite !== true) throw new Error('manual favorite must survive cloud reprocessing');
if (marcos.radarLogicVersion !== RADAR_CLOUD_LOGIC_VERSION) throw new Error('person must be stamped with cloud logic version');
if (vault.records.get(`personalSources/${sourceId}`)?.radarLogicVersion !== RADAR_CLOUD_LOGIC_VERSION) throw new Error('source metrics must be cloud-updated');
if (vault.records.get('radarMeta/classification')?.status !== 'current') throw new Error('cloud metadata must mark migration current');

const writesAfterFirst = vault.writeCalls;
const second = await service.ensureCurrent(request);
if (second.status !== 'current') throw new Error('second sync must use the cloud version marker');
if (vault.writeCalls !== writesAfterFirst) throw new Error('current cloud data must not be rewritten on every device read');

console.log('radarCloudSyncService.test.ts: ok');
