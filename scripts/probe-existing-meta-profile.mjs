import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const keys = ['CONNECT_WHATSAPP_ACCESS_TOKEN', 'CONNECT_WHATSAPP_GRAPH_API_VERSION', 'CONNECT_WHATSAPP_PHONE_NUMBER_ID', 'CONNECT_WHATSAPP_WABA_ID'];
const release = 'b587bc1652329766feb993a7660e33b205ae9a97';
const image = 'us-central1-docker.pkg.dev/millionsnest/millionsnest-web/connect-api';
const blocked = (code, extra = {}) => ({ state: 'BLOCKED', code, sendAttempted: false, ...extra });

// Inspect only the existing global provider profile. Never enumerate tenant connections.
export async function probeExistingMetaProfile(service, revision, { readSecret, fetchImpl = fetch } = {}) {
  const ready = x => x?.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
  const name = revision?.metadata?.name, traffic = (service?.status?.traffic || []).filter(t => Number(t.percent) > 0);
  const containers = revision?.spec?.containers;
  if (!ready(service) || !ready(revision) || !name?.startsWith('connect-api-') ||
      service.status.latestReadyRevisionName !== name || service.status.latestCreatedRevisionName !== name ||
      traffic.length !== 1 || Number(traffic[0].percent) !== 100 || traffic[0].revisionName !== name ||
      containers?.length !== 1 || ![`${image}:${release}`, revision?.status?.imageDigest].includes(containers[0].image) ||
      revision.spec.serviceAccountName !== 'mn-connect-runtime@millionsnest.iam.gserviceaccount.com' ||
      service?.spec?.template?.spec?.containers?.[0]?.image !== `${image}:${release}` ||
      !revision?.status?.imageDigest?.startsWith(image + '@') ||
      !/^sha256:[a-f0-9]{64}$/.test(revision.status.imageDigest.slice(image.length + 1))) return blocked('RUNTIME_IDENTITY_OR_RELEASE_DRIFT');
  const env = containers[0].env || [];
  const entry = key => env.filter(e => e.name === key);
  for (const flag of ['CONNECT_AUTOMATION_EXECUTION_ENABLED', 'CONNECT_WEB_PUSH_ENABLED']) {
    const values = entry(flag);
    if (values.length !== 1 || values[0].value !== 'false' || values[0].valueFrom) return blocked('RUNTIME_SAFETY_FLAGS_NOT_CONFIRMED');
  }
  const profile = {};
  const missing = keys.slice(0, 3).filter(key => entry(key).length !== 1 || (!entry(key)[0].value?.trim() && !entry(key)[0].valueFrom?.secretKeyRef));
  if (missing.length) return blocked('DEFAULT_PROVIDER_PROFILE_INCOMPLETE', { missingKeys: missing, providerRequests: 0 });
  for (const key of keys.slice(1, 3)) {
    const value = entry(key)[0];
    if (value.valueFrom) return blocked('DEFAULT_PROFILE_IDENTIFIER_REFERENCE_REQUIRES_REVIEW', { key, providerRequests: 0 });
    profile[key] = value.value.trim();
  }
  const version = profile[keys[1]], phoneId = profile[keys[2]], waba = entry(keys[3]);
  const wabaId = waba.length === 1 && !waba[0].valueFrom && /^\d{1,40}$/.test(waba[0].value?.trim() || '') ? waba[0].value.trim() : null;
  if (!/^v\d{1,3}\.\d{1,3}$/.test(version) || !/^\d{1,40}$/.test(phoneId)) return blocked('DEFAULT_PROVIDER_PROFILE_INVALID', { providerRequests: 0 });
  const configuredToken = entry(keys[0])[0];
  let token;
  if (configuredToken.valueFrom) {
    const ref = configuredToken.valueFrom.secretKeyRef;
    const qualified = typeof ref?.name === 'string' && ref.name.match(/^projects\/(?:millionsnest|555464791734)\/secrets\/([a-zA-Z0-9_-]{1,255})$/);
    const secretName = qualified ? qualified[1] : ref?.name;
    if (configuredToken.value || !ref || !/^[a-zA-Z0-9_-]{1,255}$/.test(secretName || '') || !/^(latest|[1-9]\d*)$/.test(ref.key || '') || !readSecret) return blocked('TOKEN_REFERENCE_INVALID', { providerRequests: 0 });
    try { token = (await readSecret(secretName, ref.key)).trim(); }
    catch { return blocked('EXISTING_TOKEN_REFERENCE_UNREADABLE', { providerRequests: 0 }); }
  } else token = configuredToken.value.trim();
  // Refuse JSON bundles, private keys, generic worker secrets and unsupported token kinds.
  if (!/^EAA[A-Za-z0-9_-]{17,8189}$/.test(token)) return blocked('META_TOKEN_FORMAT_NOT_SUPPORTED', { providerRequests: 0 });
  const endpoints = [['phoneAccess', `/${version}/${phoneId}?fields=id`, phoneId]];
  if (wabaId) endpoints.push(['wabaAccess', `/${version}/${wabaId}?fields=id`, wabaId],
    ['templateMetadata', `/${version}/${wabaId}/message_templates?fields=status&limit=25`, null]);
  const checks = {}, statuses = {}, results = [];
  for (const [check, path, expectedId] of endpoints) {
    let response, data;
    try {
      response = await fetchImpl('https://graph.facebook.com' + path, { method: 'GET', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(5000), headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      const reader = response.body?.getReader();
      if (!reader) throw Error();
      const chunks = []; let bytes = 0;
      while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.length;
        if (bytes > 65536) { await reader.cancel(); throw Error(); } chunks.push(Buffer.from(item.value)); }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return blocked('META_READ_REQUEST_FAILED', { checks, providerRequests: results.length + 1 }); }
    results.push(response.status);
    if (!response.ok) return blocked('META_READ_ACCESS_REJECTED', { checks, providerRequests: results.length, httpStatus: response.status,
      ...(Number.isInteger(data?.error?.code) && data.error.code > 0 && data.error.code < 1000000 ? { providerErrorCode: data.error.code } : {}) });
    if (expectedId && data?.id !== expectedId) return blocked('META_RESOURCE_ID_MISMATCH', { checks, providerRequests: results.length });
    if (!expectedId) {
      if (!Array.isArray(data?.data) || data.data.length > 25) return blocked('META_TEMPLATE_RESPONSE_INVALID', { checks, providerRequests: results.length });
      for (const item of data.data) {
        const status = ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL', 'PENDING_DELETION', 'DELETED', 'LIMIT_EXCEEDED'].includes(item?.status) ? item.status : 'OTHER';
        statuses[status] = (statuses[status] || 0) + 1;
      }
      // Never follow paging.next: it may include a token and is not an approved request target.
    }
    checks[check] = true;
  }
  return { state: wabaId ? 'VERIFIED_READ_ONLY' : 'PARTIAL_READ_ONLY',
    ...(!wabaId ? { code: 'DEFAULT_WABA_METADATA_NOT_CONFIGURED', missingOptionalKeys: [keys[3]] } : {}),
    checks, providerRequests: results.length, templateStatusesFirstPage: statuses,
    firstPageOnly: true, sendAttempted: false, webhookDeliveryTested: false, operationalCertification: false };
}

export async function inspectExistingMetaRuntime(run = execFileSync, fetchImpl = fetch) {
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 2 * 1024 * 1024 };
  const service = JSON.parse(run('gcloud', ['run', 'services', 'describe', 'connect-api', '--project', 'millionsnest', '--region', 'us-central1', '--format=json'], options));
  const revisionName = service?.status?.latestReadyRevisionName;
  if (!/^connect-api-[a-z0-9-]+$/.test(revisionName || '')) return blocked('RUNTIME_REVISION_INVALID');
  const revision = JSON.parse(run('gcloud', ['run', 'revisions', 'describe', revisionName, '--project', 'millionsnest', '--region', 'us-central1', '--format=json'], options));
  return probeExistingMetaProfile(service, revision, { fetchImpl,
    readSecret: (name, version) => run('gcloud', ['secrets', 'versions', 'access', version, '--secret', name, '--project', 'millionsnest'], options) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let result;
  try {
    if (process.env.GITHUB_REF !== 'refs/heads/production' || process.env.GITHUB_REPOSITORY !== 'prdanielcunha/millionsnest-connect') throw Error();
    result = await inspectExistingMetaRuntime();
  } catch { result = blocked('PROTECTED_RUNTIME_METADATA_UNAVAILABLE'); }
  // Only safe enums/counts/key names. Never emit runtime env, token, resource IDs, URLs, names, or raw provider errors.
  console.log('CONNECT_META_EXISTING_PROFILE_READONLY_RESULT=' + JSON.stringify(result));
  if (result.state !== 'VERIFIED_READ_ONLY') process.exitCode = 2;
}
