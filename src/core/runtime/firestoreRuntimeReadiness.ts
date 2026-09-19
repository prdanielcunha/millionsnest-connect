export type ConnectRuntimeFirestoreState =
  | 'read_write_confirmed'
  | 'read_only'
  | 'denied_or_missing'
  | 'unknown';

export interface ConnectRuntimeFirestoreReadiness {
  state: ConnectRuntimeFirestoreState;
  permissions: {
    read: boolean;
    list: boolean;
    create: boolean;
    update: boolean;
  };
  source:
    | 'runtime_metadata'
    | 'metadata_unavailable'
    | 'project_iam_probe_unavailable'
    | 'invalid_response';
}

export interface ProbeConnectRuntimeFirestoreOptions {
  projectId?: string;
  fetchImpl?: typeof fetch;
  metadataTokenUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_PROJECT_ID = 'millionsnest';
const DEFAULT_METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

const PERMISSION_READ = 'datastore.entities.get';
const PERMISSION_LIST = 'datastore.entities.list';
const PERMISSION_CREATE = 'datastore.entities.create';
const PERMISSION_UPDATE = 'datastore.entities.update';

function safeProjectId(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_PROJECT_ID;
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(value)) {
    throw new Error('INVALID_FIRESTORE_PROJECT_ID');
  }
  return value;
}

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(Math.min(Math.floor(timeoutMs), 10_000));
  }
  return undefined;
}

function unknown(
  source: ConnectRuntimeFirestoreReadiness['source'],
): ConnectRuntimeFirestoreReadiness {
  return {
    state: 'unknown',
    permissions: {
      read: false,
      list: false,
      create: false,
      update: false,
    },
    source,
  };
}

/**
 * Read-only runtime capability probe.
 *
 * It obtains the Cloud Run service account token from the Google metadata
 * server and asks Cloud Resource Manager projects.testIamPermissions for the
 * four datastore permissions the durable Connect-owned Inbox store requires.
 * Project IAM is the authority for these Firestore data permissions. The probe
 * never writes a document, mutates IAM, logs the token, or returns the token
 * to callers.
 */
export async function probeConnectRuntimeFirestoreReadiness(
  options: ProbeConnectRuntimeFirestoreOptions = {},
): Promise<ConnectRuntimeFirestoreReadiness> {
  const projectId = safeProjectId(options.projectId);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const metadataTokenUrl =
    options.metadataTokenUrl?.trim() || DEFAULT_METADATA_TOKEN_URL;
  const signal = timeoutSignal(options.timeoutMs ?? 2_500);

  let accessToken = '';
  try {
    const metadataResponse = await fetchImpl(metadataTokenUrl, {
      method: 'GET',
      headers: {
        'Metadata-Flavor': 'Google',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal,
    });
    if (!metadataResponse.ok) return unknown('metadata_unavailable');

    const payload = await metadataResponse.json() as {
      access_token?: unknown;
    };
    if (typeof payload.access_token !== 'string' || !payload.access_token.trim()) {
      return unknown('invalid_response');
    }
    accessToken = payload.access_token.trim();
  } catch {
    return unknown('metadata_unavailable');
  }

  try {
    const permissionUrl =
      `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}:testIamPermissions`;
    const response = await fetchImpl(permissionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        permissions: [
          PERMISSION_READ,
          PERMISSION_LIST,
          PERMISSION_CREATE,
          PERMISSION_UPDATE,
        ],
      }),
      cache: 'no-store',
      signal,
    });

    accessToken = '';
    if (!response.ok) return unknown('project_iam_probe_unavailable');

    const payload = await response.json() as {
      permissions?: unknown;
    };
    if (payload.permissions !== undefined && !Array.isArray(payload.permissions)) {
      return unknown('invalid_response');
    }

    // Google APIs commonly omit empty repeated fields from JSON responses.
    // A successful {} response therefore means none of the requested
    // permissions were granted, not that the response is malformed.
    const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];
    const granted = new Set(
      permissions.filter((value): value is string => typeof value === 'string'),
    );
    const read = granted.has(PERMISSION_READ);
    const list = granted.has(PERMISSION_LIST);
    const create = granted.has(PERMISSION_CREATE);
    const update = granted.has(PERMISSION_UPDATE);

    return {
      state: read && list && create && update
        ? 'read_write_confirmed'
        : read && list
          ? 'read_only'
          : 'denied_or_missing',
      permissions: {
        read,
        list,
        create,
        update,
      },
      source: 'runtime_metadata',
    };
  } catch {
    accessToken = '';
    return unknown('project_iam_probe_unavailable');
  }
}
