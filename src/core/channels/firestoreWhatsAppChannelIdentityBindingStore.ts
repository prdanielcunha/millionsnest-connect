import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import {
  GoogleMetadataAccessTokenProvider,
  type ConnectRuntimeAccessTokenProvider,
} from '../inbox/firestoreThreadStore';

const DEFAULT_PROJECT_ID = 'millionsnest';
const STORAGE_SCHEMA_VERSION = 1;

type FirestoreDocument = {
  fields?: Record<string, any>;
};

export type WhatsAppChannelIdentityBinding = {
  schemaVersion: 1;
  channelOrganizationId: string;
  channelIdentityRef: string;
  grantRef: string;
  grantSecret: string;
  targetOrganizationId: string;
  linkedAtMs: number;
  expiresAtMs: number;
};

export interface WhatsAppChannelIdentityBindingStore {
  get(input: {
    channelOrganizationId: string;
    channelIdentityRef: string;
  }): Promise<WhatsAppChannelIdentityBinding | null>;
  put(binding: WhatsAppChannelIdentityBinding): Promise<void>;
}

export interface FirestoreWhatsAppChannelIdentityBindingStoreOptions {
  projectId?: string;
  encryptionRootSecret: string;
  fetchImpl?: typeof fetch;
  tokenProvider?: ConnectRuntimeAccessTokenProvider;
}

function safeProjectId(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_PROJECT_ID;
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(value)) {
    throw new Error('INVALID_FIRESTORE_PROJECT_ID');
  }
  return value;
}

function safeSegment(raw: string, maxLength = 300): string {
  const value = raw.trim();
  if (
    !value ||
    value === '.' ||
    value === '..' ||
    value.length > maxLength ||
    value.includes('/') ||
    value.includes('\\')
  ) {
    throw new Error('INVALID_DOCUMENT_SEGMENT');
  }
  return value;
}

function encodedPath(parts: string[]): string {
  return parts.map((part) => encodeURIComponent(safeSegment(part, 900))).join('/');
}

function stringValue(value: string) {
  return { stringValue: value };
}

function integerValue(value: number) {
  return { integerValue: String(Math.trunc(value)) };
}

function readString(document: FirestoreDocument, field: string): string {
  const value = document.fields?.[field]?.stringValue;
  return typeof value === 'string' ? value : '';
}

function readInteger(document: FirestoreDocument, field: string): number {
  const raw = document.fields?.[field]?.integerValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveEncryptionKey(rootSecret: string): Buffer {
  const root = rootSecret.trim();
  if (root.length < 16) throw new Error('CHANNEL_BINDING_ENCRYPTION_SECRET_INVALID');
  return createHmac('sha256', root)
    .update('millionsnest-connect-channel-binding-encryption-v1', 'utf8')
    .digest();
}

function aad(binding: Pick<WhatsAppChannelIdentityBinding, 'channelOrganizationId' | 'channelIdentityRef'>): Buffer {
  return Buffer.from(
    `${safeSegment(binding.channelOrganizationId, 180)}|${safeSegment(binding.channelIdentityRef, 128)}`,
    'utf8',
  );
}

function encryptSecret(
  secret: string,
  binding: Pick<WhatsAppChannelIdentityBinding, 'channelOrganizationId' | 'channelIdentityRef'>,
  key: Buffer,
) {
  const clean = secret.trim();
  if (!clean || clean.length > 512) throw new Error('CHANNEL_BINDING_GRANT_SECRET_INVALID');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(binding));
  const ciphertext = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

function decryptSecret(
  encrypted: { iv: string; ciphertext: string; tag: string },
  binding: Pick<WhatsAppChannelIdentityBinding, 'channelOrganizationId' | 'channelIdentityRef'>,
  key: Buffer,
): string {
  try {
    const iv = Buffer.from(encrypted.iv, 'base64url');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64url');
    const tag = Buffer.from(encrypted.tag, 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error('invalid encrypted binding');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('CHANNEL_BINDING_DECRYPT_FAILED');
  }
}

function documentPath(channelOrganizationId: string, channelIdentityRef: string): string[] {
  return [
    'connectSensitiveOrganizations',
    safeSegment(channelOrganizationId, 180),
    'channelIdentityBindings',
    safeSegment(channelIdentityRef, 128),
  ];
}

/**
 * Connect-owned credential binding for an already verified channel possession.
 *
 * The provider user id/phone is never stored here. Hub grant secrets are
 * encrypted at rest with an AES-GCM key derived server-side from the existing
 * WhatsApp verification secret and are never returned to the browser.
 */
export class FirestoreWhatsAppChannelIdentityBindingStore implements WhatsAppChannelIdentityBindingStore {
  private readonly projectId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;
  private readonly documentsBase: string;
  private readonly encryptionKey: Buffer;

  constructor(options: FirestoreWhatsAppChannelIdentityBindingStoreOptions) {
    this.projectId = safeProjectId(options.projectId);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
    this.encryptionKey = deriveEncryptionKey(options.encryptionRootSecret);
    this.documentsBase =
      `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
  }

  async get(input: {
    channelOrganizationId: string;
    channelIdentityRef: string;
  }): Promise<WhatsAppChannelIdentityBinding | null> {
    const channelOrganizationId = safeSegment(input.channelOrganizationId, 180);
    const channelIdentityRef = safeSegment(input.channelIdentityRef, 128);
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(
      `${this.documentsBase}/${encodedPath(documentPath(channelOrganizationId, channelIdentityRef))}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CHANNEL_BINDING_GET_${response.status}`);

    const document = await response.json() as FirestoreDocument;
    if (readInteger(document, 'storageSchemaVersion') !== STORAGE_SCHEMA_VERSION) {
      throw new Error('CHANNEL_BINDING_INVALID');
    }

    const targetOrganizationId = readString(document, 'targetOrganizationId');
    const grantRef = readString(document, 'grantRef');
    const storedIdentityRef = readString(document, 'channelIdentityRef');
    const storedChannelOrganizationId = readString(document, 'channelOrganizationId');
    const linkedAtMs = readInteger(document, 'linkedAtMs');
    const expiresAtMs = readInteger(document, 'expiresAtMs');
    const iv = readString(document, 'grantSecretIv');
    const ciphertext = readString(document, 'grantSecretCiphertext');
    const tag = readString(document, 'grantSecretTag');

    if (
      storedIdentityRef !== channelIdentityRef ||
      storedChannelOrganizationId !== channelOrganizationId ||
      !targetOrganizationId ||
      !grantRef ||
      !linkedAtMs ||
      !expiresAtMs ||
      !iv ||
      !ciphertext ||
      !tag
    ) {
      throw new Error('CHANNEL_BINDING_INVALID');
    }

    const grantSecret = decryptSecret(
      { iv, ciphertext, tag },
      { channelOrganizationId, channelIdentityRef },
      this.encryptionKey,
    );

    return {
      schemaVersion: 1,
      channelOrganizationId,
      channelIdentityRef,
      grantRef,
      grantSecret,
      targetOrganizationId,
      linkedAtMs,
      expiresAtMs,
    };
  }

  async put(binding: WhatsAppChannelIdentityBinding): Promise<void> {
    if (binding.schemaVersion !== 1) throw new Error('CHANNEL_BINDING_INVALID');
    const channelOrganizationId = safeSegment(binding.channelOrganizationId, 180);
    const channelIdentityRef = safeSegment(binding.channelIdentityRef, 128);
    const targetOrganizationId = safeSegment(binding.targetOrganizationId, 180);
    const grantRef = safeSegment(binding.grantRef, 180);
    if (!/^[a-f0-9]{64}$/.test(channelIdentityRef)) throw new Error('CHANNEL_BINDING_INVALID');
    if (!Number.isFinite(binding.linkedAtMs) || !Number.isFinite(binding.expiresAtMs)) {
      throw new Error('CHANNEL_BINDING_INVALID');
    }

    const encrypted = encryptSecret(
      binding.grantSecret,
      { channelOrganizationId, channelIdentityRef },
      this.encryptionKey,
    );
    const token = await this.tokenProvider.getAccessToken();
    const url =
      `${this.documentsBase}/${encodedPath(documentPath(channelOrganizationId, channelIdentityRef))}`;
    const response = await this.fetchImpl(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        fields: {
          storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
          channelOrganizationId: stringValue(channelOrganizationId),
          channelIdentityRef: stringValue(channelIdentityRef),
          targetOrganizationId: stringValue(targetOrganizationId),
          grantRef: stringValue(grantRef),
          grantSecretIv: stringValue(encrypted.iv),
          grantSecretCiphertext: stringValue(encrypted.ciphertext),
          grantSecretTag: stringValue(encrypted.tag),
          linkedAtMs: integerValue(binding.linkedAtMs),
          expiresAtMs: integerValue(binding.expiresAtMs),
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`CHANNEL_BINDING_PUT_${response.status}`);
  }
}
