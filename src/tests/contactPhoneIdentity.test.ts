import { CanonicalContextProvider, CanonicalCoreContext } from '../core/runtime/connectCore';
import { PersonalRadarService } from '../personal/radar/personalRadarService';
import { FirestorePersonalVault, VaultDocument, VaultWrite } from '../personal/storage/firestorePersonalVault';

let passed = 0;
let total = 0;
function assert(condition: unknown, message: string) { total += 1; if (!condition) throw new Error(message); passed += 1; }
function equal(actual: unknown, expected: unknown, message: string) { assert(actual === expected, `${message}: ${String(actual)}`); }

class MemoryVault extends FirestorePersonalVault {
  readonly records = new Map<string, Record<string, unknown>>();
  constructor() { super({ fetchImpl: (async () => new Response()) as typeof fetch }); }
  private key(path: string[]) { return path.join('/'); }
  override async get(_token: string, _uid: string, path: string[]): Promise<VaultDocument | null> {
    const data = this.records.get(this.key(path));
    return data ? { id: path.at(-1) || '', ...structuredClone(data) } : null;
  }
  override async list(_token: string, _uid: string, path: string[], max = 1_500): Promise<VaultDocument[]> {
    const prefix = `${this.key(path)}/`;
    const rows: VaultDocument[] = [];
    for (const [key, data] of this.records.entries()) {
      if (!key.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      if (!id || id.includes('/')) continue;
      rows.push({ id, ...structuredClone(data) });
      if (rows.length >= max) break;
    }
    return rows;
  }
  override async writeMany(_token: string, _uid: string, writes: VaultWrite[]) {
    for (const write of writes) this.records.set(this.key(write.path), structuredClone(write.data));
  }
  override async deleteMany(_token: string, _uid: string, paths: string[][]) {
    for (const path of paths) this.records.delete(this.key(path));
  }
}

const canonical: CanonicalCoreContext = {
  actorUid: 'founder-test', systemRole: 'founder', globalAccess: true,
  organizationId: 'org-test', organizationRole: 'owner', permissions: [], capabilities: [], appAccess: { musicscale: true },
};
const contextProvider: CanonicalContextProvider = { async resolve() { return { status: 'resolved', context: canonical }; } };
const vault = new MemoryVault();
const radar = new PersonalRadarService(contextProvider, vault, () => Date.parse('2026-09-12T18:00:00Z'));
const request = { authToken: 'test-session', organizationId: 'org-test' };
const syntheticPhoneLabel = '+00 00 00000-0000';
const exportText = `[12/09/2026, 12:00:00] ${syntheticPhoneLabel}: Olá, aqui é sobre a escala do louvor.`;

console.log('--- Running Contact Phone Identity Tests ---');
await radar.importWhatsApp(request, {
  fileName: 'Grupo Louvor.txt', contentBase64: Buffer.from(exportText, 'utf8').toString('base64'), selfNames: ['Daniel'],
});
equal((await radar.getPeople(request)).count, 1, 'phone-labelled sender creates one person');
await radar.importContacts(request, { contacts: [{ name: 'João Exemplo', phone: syntheticPhoneLabel }] });
const after = await radar.getPeople(request);
equal(after.count, 1, 'exact address-book phone enriches instead of duplicating');
equal(String(after.people[0].displayName), 'João Exemplo', 'contact name becomes canonical display name');
equal(String(after.people[0].identityResolution), 'contact_phone_confirmed', 'resolution reason is preserved');
equal(Number(after.people[0].identityConfidence), 100, 'exact user-provided phone evidence is confirmed');
assert(Array.isArray(after.people[0].identityAliases), 'original source identity is preserved as an alias');
console.log(`✅ Passed ${passed} / ${total} tests.`);
