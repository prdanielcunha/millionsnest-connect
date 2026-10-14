import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { resolveExecutionSecretBundle } from '../server/executionSecretBundle';
const ec=createECDH('prime256v1');ec.generateKeys();
const bundle={CONNECT_WEB_PUSH_PUBLIC_KEY:ec.getPublicKey().toString('base64url'),CONNECT_WEB_PUSH_PRIVATE_KEY:ec.getPrivateKey().toString('base64url'),CONNECT_WEB_PUSH_SUBJECT:'https://connect.millionsnest.com',CONNECT_AUTOMATION_WORKER_SECRET:'synthetic-worker-key-that-is-long-enough',CONNECT_SUPPORT_ORIGIN_SECRET:'synthetic-origin-key-that-is-long-enough'};
const env={CONNECT_EXECUTION_SECRET_FILE:'/var/run/secrets/connect-execution.json',CONNECT_WEB_PUSH_ENABLED:'false',CONNECT_WHATSAPP_APP_SECRET:'synthetic-meta-preserved'};
assert.strictEqual(resolveExecutionSecretBundle(env,()=>JSON.stringify(bundle)).CONNECT_WEB_PUSH_ENABLED,'false');
assert.strictEqual(resolveExecutionSecretBundle(env,()=>JSON.stringify(bundle)).CONNECT_WHATSAPP_APP_SECRET,env.CONNECT_WHATSAPP_APP_SECRET);
assert.strictEqual(resolveExecutionSecretBundle({...env,CONNECT_AUTOMATION_WORKER_SECRET:'existing-key'},()=>JSON.stringify(bundle)).CONNECT_AUTOMATION_WORKER_SECRET,'existing-key');
assert(!Object.hasOwn(env,'CONNECT_WEB_PUSH_PRIVATE_KEY'));
const disabled={};assert.strictEqual(resolveExecutionSecretBundle(disabled,()=>{throw new Error('must not load');}),disabled);
for(const changed of [{...bundle,CONNECT_WEB_PUSH_ENABLED:'true'},{...bundle,CONNECT_WHATSAPP_APP_SECRET:'injected'},{...bundle,CONNECT_SUPPORT_ORIGIN_SECRET:'short'},{...bundle,CONNECT_WEB_PUSH_PRIVATE_KEY:'x'.repeat(43)},{...bundle,CONNECT_WEB_PUSH_PUBLIC_KEY:'x'.repeat(87)},{...bundle,CONNECT_WEB_PUSH_SUBJECT:'http://unsafe.test'},null,[]]) {
 assert.throws(()=>resolveExecutionSecretBundle(env,()=>JSON.stringify(changed)),e=>e instanceof Error&&e.message==='CONNECT_EXECUTION_SECRET_BUNDLE_INVALID');
}
for(const bad of ['invalid-json','x'.repeat(8001)])assert.throws(()=>resolveExecutionSecretBundle(env,()=>bad),/CONNECT_EXECUTION_SECRET_BUNDLE_INVALID/);
let loaded=false;assert.throws(()=>resolveExecutionSecretBundle({...env,CONNECT_EXECUTION_SECRET_FILE:'/etc/passwd'},()=>{loaded=true;return ''; }));assert(!loaded);
assert.throws(()=>resolveExecutionSecretBundle(env,()=>{throw new Error('PRIVATE private-key');}),e=>e instanceof Error&&!e.message.includes('PRIVATE'));
console.log('Execution secret bundle: paired P256, fixed mount, no activation/Meta injection, existing values preserved and sanitized failures passed');
