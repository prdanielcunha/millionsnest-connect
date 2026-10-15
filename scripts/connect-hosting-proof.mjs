import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ORIGINS = new Set(['https://connect.millionsnest.com', 'https://mn-connect-555464791734.web.app']);
const safePath = value => typeof value === 'string' && /^(\/assets\/[A-Za-z0-9_-]+\.(js|css)|\/connect-auth\.js)$/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = () => { throw new Error('CONNECT_HOSTING_PROOF_INVALID'); };

export function validateProof(value, sha) {
  if (!SHA.test(sha) || !value || value.schemaVersion !== 1 || value.application !== 'millionsnest-connect' || value.releaseSha !== sha ||
      !DIGEST.test(value.indexSha256) || !Array.isArray(value.assets) || value.assets.length < 2 || value.assets.length > 8 ||
      value.assets.some(item => !item || !safePath(item.path) || !DIGEST.test(item.sha256)) ||
      new Set(value.assets.map(item => item.path)).size !== value.assets.length ||
      !value.assets.some(item => item.path.startsWith('/assets/') && item.path.endsWith('.js')) ||
      !value.assets.some(item => item.path.endsWith('.css')) || !value.assets.some(item => item.path === '/connect-auth.js')) fail();
  return value;
}

export async function writeProof(dist, sha) {
  if (!SHA.test(sha)) fail();
  const index = await readFile(resolve(dist, 'index.html'));
  const html = index.toString('utf8');
  const paths = [...new Set([...html.matchAll(/(?:src|href)="(\/(?:assets\/[^"<>]+\.(?:js|css)|connect-auth\.js))"/g)].map(match => match[1]))];
  if (paths.some(path => !safePath(path))) fail();
  const assets = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(resolve(dist, '.' + path))) })));
  const proof = validateProof({ schemaVersion: 1, application: 'millionsnest-connect', releaseSha: sha, indexSha256: hash(index), assets }, sha);
  const json = JSON.stringify(proof) + '\n';
  await writeFile(resolve(dist, 'connect-release.json'), json);
  await writeFile(resolve(dist, `connect-release-${sha}.json`), json);
  return proof;
}

/** GET-only verification of the actual served HTML/JS/CSS/auth entry, with no credentials. */
export async function verifyPublishedProof(origin, sha, { expectedProof, fetchImpl = fetch, attempts = 30, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!ORIGINS.has(origin) || !SHA.test(sha) || !Number.isInteger(attempts) || attempts < 1 || attempts > 30) fail();
  // The serving domain cannot define its own expected artifact hashes.
  const expected = JSON.stringify(validateProof(expectedProof, sha));
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const signal = AbortSignal.timeout(10000);
      const get = async path => {
        const response = await fetchImpl(`${origin}${path}?release=${sha}&attempt=${attempt}`, {
          method: 'GET', redirect: 'error', cache: 'no-store', signal, headers: { 'Cache-Control': 'no-cache, no-store' },
        });
        if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 2000000) fail();
        const body = Buffer.from(await response.arrayBuffer());
        if (!body.length || body.length > 2000000) fail();
        return { body, type: response.headers.get('content-type') ?? '' };
      };
      const [regular, immutable, index] = await Promise.all([get('/connect-release.json'), get(`/connect-release-${sha}.json`), get('/')]);
      if (![regular, immutable].every(value => /^application\/json\b/i.test(value.type)) || !/^text\/html\b/i.test(index.type)) fail();
      const proof = validateProof(JSON.parse(regular.body.toString('utf8')), sha);
      const second = validateProof(JSON.parse(immutable.body.toString('utf8')), sha);
      if (JSON.stringify(proof) !== expected || JSON.stringify(second) !== expected || hash(index.body) !== proof.indexSha256) fail();
      await Promise.all(proof.assets.map(async asset => { if (hash((await get(asset.path)).body) !== asset.sha256) fail(); }));
      return true;
    } catch { /* Stale CDN, HTML SPA fallback and transport failures cannot certify a release. */ }
    if (attempt + 1 < attempts) await delay(3000);
  }
  throw new Error('CONNECT_HOSTING_PUBLISHED_ARTIFACT_MISMATCH');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, target, sha, dist = 'dist'] = process.argv.slice(2);
  try {
    if (command === 'write') { await writeProof(target, sha); console.log(`CONNECT_HOSTING_ARTIFACT_READY=${sha}`); }
    else if (command === 'verify') {
      if (!SHA.test(sha)) fail();
      const expectedProof = JSON.parse(await readFile(resolve(dist, `connect-release-${sha}.json`), 'utf8'));
      await verifyPublishedProof(target, sha, { expectedProof });
      console.log(`CONNECT_HOSTING_EXACT_ARTIFACT_OK=${sha}`);
    }
    else fail();
  } catch { console.error('CONNECT_HOSTING_PROOF_FAILED'); process.exitCode = 1; }
}
