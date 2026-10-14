import { readFileSync } from 'node:fs';
import { createECDH } from 'node:crypto';
const PATH = '/var/run/secrets/connect-execution.json';
const KEYS = ['CONNECT_WEB_PUSH_PUBLIC_KEY', 'CONNECT_WEB_PUSH_PRIVATE_KEY', 'CONNECT_WEB_PUSH_SUBJECT', 'CONNECT_AUTOMATION_WORKER_SECRET', 'CONNECT_SUPPORT_ORIGIN_SECRET'] as const;
/** Opt-in Secret Manager mount. No feature flags, tenant authority or Meta credentials are admitted. */
export function resolveExecutionSecretBundle(env: Record<string, string | undefined>, load = (path: string) => readFileSync(path, 'utf8')): Record<string, string | undefined> {
  if (!env.CONNECT_EXECUTION_SECRET_FILE) return env;
  try {
    if (env.CONNECT_EXECUTION_SECRET_FILE !== PATH) throw new Error();
    const raw = load(PATH); if (raw.length > 8000) throw new Error();
    const bundle = JSON.parse(raw);
    if (!bundle || Array.isArray(bundle) || typeof bundle !== 'object' || Object.keys(bundle).length !== KEYS.length || Object.keys(bundle).some(key => !KEYS.includes(key as any))) throw new Error();
    if (KEYS.some(key => typeof bundle[key] !== 'string' || !bundle[key] || bundle[key].length > 512)) throw new Error();
    for (const key of ['CONNECT_AUTOMATION_WORKER_SECRET', 'CONNECT_SUPPORT_ORIGIN_SECRET']) if (bundle[key].length < 32) throw new Error();
    if (!/^[A-Za-z0-9_-]{43}$/.test(bundle.CONNECT_WEB_PUSH_PRIVATE_KEY) || !/^[A-Za-z0-9_-]{87}$/.test(bundle.CONNECT_WEB_PUSH_PUBLIC_KEY) || !/^(https:\/\/|mailto:)\S+$/.test(bundle.CONNECT_WEB_PUSH_SUBJECT)) throw new Error();
    const curve = createECDH('prime256v1'); curve.setPrivateKey(Buffer.from(bundle.CONNECT_WEB_PUSH_PRIVATE_KEY, 'base64url'));
    if (curve.getPublicKey().toString('base64url') !== bundle.CONNECT_WEB_PUSH_PUBLIC_KEY) throw new Error();
    const merged = { ...env };
    for (const key of KEYS) if (merged[key] === undefined) merged[key] = bundle[key];
    return merged;
  } catch { throw new Error('CONNECT_EXECUTION_SECRET_BUNDLE_INVALID'); }
}
