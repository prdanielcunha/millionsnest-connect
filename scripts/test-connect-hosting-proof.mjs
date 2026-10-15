import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeProof, validateProof, verifyPublishedProof as verifyWithExpectedProof } from './connect-hosting-proof.mjs';

const dist = await mkdtemp(join(tmpdir(), 'connect-proof-'));
const sha = 'a'.repeat(40), origin = 'https://connect.millionsnest.com';
try {
  await mkdir(join(dist, 'assets'));
  await writeFile(join(dist, 'index.html'), '<!doctype html><script src="/assets/index-synthetic.js"></script><link href="/assets/index-synthetic.css"><script src="/connect-auth.js"></script>');
  for (const path of ['assets/index-synthetic.js', 'assets/index-synthetic.css', 'connect-auth.js']) await writeFile(join(dist, path), `synthetic ${path}`);
  const proof = await writeProof(dist, sha);
  const verifyPublishedProof = (origin, sha, options = {}) => verifyWithExpectedProof(origin, sha, { expectedProof: proof, ...options });
  assert.equal(proof.assets.length, 3);
  assert.equal(await readFile(join(dist, 'connect-release.json'), 'utf8'), await readFile(join(dist, `connect-release-${sha}.json`), 'utf8'));
  for (const value of [{ ...proof, releaseSha: 'b'.repeat(40) }, { ...proof, indexSha256: 'wrong' }, { ...proof, application: 'other-app' },
    { ...proof, assets: [{ path: 'https://evil.example/code.js', sha256: '0'.repeat(64) }] }, { ...proof, assets: [...proof.assets, proof.assets[0]] }]) {
    assert.throws(() => validateProof(value, sha));
  }
  let calls = 0, mode = 'good';
  const fetchImpl = async (url, init) => {
    calls++; assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert(!init.headers.Authorization);
    const parsed = new URL(url); assert.equal(parsed.origin, origin); assert.equal(parsed.searchParams.get('release'), sha);
    if (mode === 'provider') throw new Error('synthetic PRIVATE provider body');
    const path = parsed.pathname;
    const json = path.endsWith('.json');
    let body = await readFile(join(dist, path === '/' ? 'index.html' : path.slice(1)));
    if (mode === 'spa' && json) body = Buffer.from('<html>fallback</html>');
    if (mode === 'old-index' && path === '/') body = Buffer.from('<html>old index</html>');
    if (mode === 'old-asset' && path.endsWith('.js')) body = Buffer.from('stale or HTML fallback');
    if (mode === 'forged-metadata') {
      const forgedIndex = '<html>different build with self-consistent remote metadata</html>';
      if (path === '/') body = Buffer.from(forgedIndex);
      if (json) body = Buffer.from(JSON.stringify({ ...proof, indexSha256: createHash('sha256').update(forgedIndex).digest('hex') }));
    }
    if (mode === 'retry' && parsed.searchParams.get('attempt') === '0' && path === '/') body = Buffer.from('stale HTML');
    return new Response(body, { headers: { 'content-type': json ? 'application/json' : path === '/' ? 'text/html; charset=utf-8' : 'application/octet-stream' } });
  };
  assert.equal(await verifyPublishedProof(origin, sha, { fetchImpl, attempts: 1 }), true);
  for (mode of ['spa', 'old-index', 'old-asset', 'forged-metadata', 'provider']) await assert.rejects(() => verifyPublishedProof(origin, sha, { fetchImpl, attempts: 1 }), /PUBLISHED_ARTIFACT_MISMATCH/);
  await assert.rejects(() => verifyWithExpectedProof(origin, sha, { fetchImpl, attempts: 1 }), /PROOF_INVALID/);
  mode = 'retry'; let delays = 0;
  assert.equal(await verifyPublishedProof(origin, sha, { fetchImpl, attempts: 2, delay: async () => { delays++; } }), true); assert.equal(delays, 1);
  const previous = calls;
  await assert.rejects(() => verifyPublishedProof('https://evil.example', sha, { fetchImpl })); assert.equal(calls, previous);
  await assert.rejects(() => writeProof(dist, '../invalid'));
  // Exercise the actual CLI entry point and exit codes, not just imported helpers.
  for (const fallback of [false, true]) {
    const program = `import {readFile} from 'node:fs/promises';
      const nativeTimer=globalThis.setTimeout; globalThis.setTimeout=(fn)=>nativeTimer(fn,0);
      globalThis.fetch=async url=>{const path=new URL(url).pathname;
        const json=path.endsWith('.json');
        const body=${fallback}&&json?'<!doctype html><html>SPA</html>':await readFile(${JSON.stringify(dist)}+(path==='/'?'/index.html':path));
        return new Response(body,{headers:{'content-type':json?'application/json':path==='/'?'text/html':'application/octet-stream'}})};
      process.argv=[process.execPath,${JSON.stringify(new URL('./connect-hosting-proof.mjs', import.meta.url).pathname)},'verify',${JSON.stringify(origin)},${JSON.stringify(sha)},${JSON.stringify(dist)}];
      await import(${JSON.stringify(new URL('./connect-hosting-proof.mjs', import.meta.url).href)});`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, fallback ? 1 : 0, result.stderr);
    assert.match(fallback ? result.stderr : result.stdout, fallback ? /CONNECT_HOSTING_PROOF_FAILED/ : /CONNECT_HOSTING_EXACT_ARTIFACT_OK/);
  }
  console.log('Connect Hosting proof: trusted local build anchor, exact release/HTML/JS/CSS/auth hashes, forged remote metadata, SPA/stale/tampered failures, bounded retry and GET-only privacy passed.');
} finally { await rm(dist, { recursive: true, force: true }); }
