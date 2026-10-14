import assert from 'node:assert/strict';
import { homologationReadOnly } from '../server/homologationReadOnly';
for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'TRACE', 'CONNECT']) {
  let allowed = false, status = 0, body: unknown, cache: string;
  const res = { setHeader(_key: string, value: string) { cache = value; }, status(code: number) { status = code; return this; }, json(value: unknown) { body = value; return this; } };
  homologationReadOnly({ method } as any, res as any, () => { allowed = true; });
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) assert.equal(allowed, true);
  else { assert.equal(allowed, false); assert.equal(status, 409); assert.equal(cache, 'no-store'); assert.deepEqual(body, { code: 'HOMOLOGATION_READ_ONLY' }); }
}
console.log('Homologation readonly: mutation methods denied before existing routes; reads allowed');
