import { createHash, createHmac } from 'node:crypto';
import {
  GoogleMetadataAccessTokenProvider,
  type ConnectRuntimeAccessTokenProvider,
} from '../inbox/firestoreThreadStore';

const DEFAULT_PROJECT_ID = 'millionsnest';
const STORAGE_SCHEMA_VERSION = 1;

type FirestoreDocument = {
  fields?: Record<string, any>;
  updateTime?: string;
};

export type WhatsAppChannelIdentityBinding = {
  schemaVersion: 1;
  organizationId: string;
  channel: 'whatsapp';
  channelIdentityHash: string;
  actorUid: string;
  linkedAt: string;
};

export type WhatsAppLinkChallenge = {
  schemaVersion: 1;
  challengeHash: string;
  organizationId: string;
  channelIdentityHash: string;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string;
};

export interface WhatsAppChannelIdentityStore {
  resolve(input: {
    organizationId: string;
    phoneNumberId: string;
    senderRef: string;
  }): Promise<WhatsAppChannelIdentityBinding | null>;
  putChallenge(input: WhatsAppLinkChallenge): Promise<'created' | 'existing'>;
  getChallenge(token: string): Promise<(WhatsAppLinkChallenge & { updateTime: string }) | null>;
  consumeChallenge(input: {
    token: string;
    actorUid: string;
    now: string;
  }): Promise<WhatsAppChannelIdentityBinding>;
}

export interface FirestoreWhatsAppChannelIdentityStoreOptions {
  projectId?: string;
  fetchImpl?: typeof fetch;
  tokenProvider?: ConnectRuntimeAccessTokenProvider;
}

function safeProjectId(value: string | undefined): string {
  const projectId = value?.trim() || DEFAULT_PROJECT_ID;
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) {
    throw new Error('INVALID_FIRESTORE_PROJECT_ID');
  }
  return projectId;
}

function safeSegment(value: string, maxLength = 300): string {
  const clean = value.trim();
  if (!clean || clean.length > maxLength || clean.includes('/') || clean.includes('\\')) {
    throw new Error('INVALID_DOCUMENT_SEGMENT');
  }
  return clean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createWhatsAppChannelIdentityHash(input: {
  organizationId: string;
  phoneNumberId: string;
  senderRef: string;
}): string {
  const organizationId = safeSegment(input.organizationId, 180);
  const phoneNumberId = safeSegment(input.phoneNumberId, 180);
  const senderRef = input.senderRef.replace(/\D/g, '');
  if (senderRef.length < 8 || senderRef.length > 20) {
    throw new Error('WHATSAPP_SENDER_INVALID');
  }
  return sha256(`whatsapp:v1:${organizationId}:${phoneNumberId}:${senderRef}`);
}

export function deriveWhatsAppLinkToken(input: {
  appSecret: string;
  organizationId: string;
  channelIdentityHash: string;
  providerMessageId: string;
}): string {
  const secret = input.appSecret.trim();
  if (secret.length < 16) throw new Error('WHATSAPP_APP_SECRET_INVALID');
  const organizationId = safeSegment(input.organizationId, 180);
  const identityHash = input.channelIdentityHash.trim();
  const providerMessageId = safeSegment(input.providerMessageId, 300);
  if (!/^[a-f0-9]{64}$/.test(identityHash)) throw new Error('CHANNEL_IDENTITY_HASH_INVALID');

  return createHmac('sha256', secret)
    .update(`connect-link:v1:${organizationId}:${identityHash}:${providerMessageId}`)
    .digest('base64url');
}

export function hashWhatsAppLinkToken(token: string): string {
  const clean = token.trim();
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(clean)) throw new Error('WHATSAPP_LINK_TOKEN_INVALID');
  return sha256(clean);
}

function stringValue(value: string) {
  return { stringValue: value };
}

function integerValue(value: number) {
  return { integerValue: String(value) };
}

function readString(document: FirestoreDocument, field: string): string | null {
  const value = document.fields?.[field]?.stringValue;
  return typeof value === 'string' ? value : null;
}

function readInteger(document: FirestoreDocument, field: string): number | null {
  const value = document.fields?.[field]?.integerValue;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function bindingPath(organizationId: string, identityHash: string): string[] {
  return [
    'connectSensitiveOrganizations',
    safeSegment(organizationId, 180),
    'whatsappChannelIdentities',
    safeSegment(identityHash, 64),
  ];
}

function challengePath(challengeHash: string): string[] {
  return ['connectWhatsAppLinkChallenges', safeSegment(challengeHash, 64)];
}

function encodedPath(parts: string[]): string {
  return parts.map((part) => encodeURIComponent(safeSegment(part, 900))).join('/');
}

function parseBinding(document: FirestoreDocument): WhatsAppChannelIdentityBinding {
  if (readInteger(document, 'storageSchemaVersion') !== STORAGE_SCHEMA_VERSION) {
    throw new Error('WHATSAPP_IDENTITY_BINDING_INVALID');
  }
  const organizationId = readString(document, 'organizationId');
  const channelIdentityHash = readString(document, 'channelIdentityHash');
  const actorUid = readString(document, 'actorUid');
  const linkedAt = readString(document, 'linkedAt');
  const channel = readString(document, 'channel');

  if (
    !organizationId ||
    !channelIdentityHash ||
    !/^[a-f0-9]{64}$/.test(channelIdentityHash) ||
    !actorUid ||
    !linkedAt ||
    channel !== 'whatsapp'
  ) {
    throw new Error('WHATSAPP_IDENTITY_BINDING_INVALID');
  }

  return {
    schemaVersion: 1,
    organizationId,
    channel: 'whatsapp',
    channelIdentityHash,
    actorUid,
    linkedAt,
  };
}

function parseChallenge(document: FirestoreDocument): WhatsAppLinkChallenge {
  if (readInteger(document, 'storageSchemaVersion') !== STORAGE_SCHEMA_VERSION) {
    throw new Error('WHATSAPP_LINK_CHALLENGE_INVALID');
  }
  const challengeHash = readString(document, 'challengeHash');
  const organizationId = readString(document, 'organizationId');
  const channelIdentityHash = readString(document, 'channelIdentityHash');
  const expiresAt = readString(document, 'expiresAt');
  const createdAt = readString(document, 'createdAt');
  const consumedAt = readString(document, 'consumedAt') || undefined;

  if (
    !challengeHash ||
    !/^[a-f0-9]{64}$/.test(challengeHash) ||
    !organizationId ||
    !channelIdentityHash ||
    !/^[a-f0-9]{64}$/.test(channelIdentityHash) ||
    !expiresAt ||
    !createdAt
  ) {
    throw new Error('WHATSAPP_LINK_CHALLENGE_INVALID');
  }

  return {
    schemaVersion: 1,
    challengeHash,
    organizationId,
    channelIdentityHash,
    expiresAt,
    createdAt,
    consumedAt,
  };
}

export class FirestoreWhatsAppChannelIdentityStore implements WhatsAppChannelIdentityStore {
  private readonly projectId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;
  private readonly documentsBase: string;
  private readonly commitUrl: string;

  constructor(options: FirestoreWhatsAppChannelIdentityStoreOptions = {}) {
    this.projectId = safeProjectId(options.projectId);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
    const database = `projects/${this.projectId}/databases/(default)`;
    this.documentsBase = `https://firestore.googleapis.com/v1/${database}/documents`;
    this.commitUrl = `https://firestore.googleapis.com/v1/${database}/documents:commit`;
  }

  async resolve(input: {
    organizationId: string;
    phoneNumberId: string;
    senderRef: string;
  }): Promise<WhatsAppChannelIdentityBinding | null> {
    const identityHash = createWhatsAppChannelIdentityHash(input);
    const document = await this.getDocument(bindingPath(input.organizationId, identityHash));
    if (!document) return null;
    const binding = parseBinding(document);
    if (binding.organizationId !== input.organizationId || binding.channelIdentityHash !== identityHash) {
      throw new Error('WHATSAPP_IDENTITY_SCOPE_MISMATCH');
    }
    return binding;
  }

  async putChallenge(input: WhatsAppLinkChallenge): Promise<'created' | 'existing'> {
    const path = challengePath(input.challengeHash);
    const existing = await this.getDocument(path);
    if (existing) {
      const challenge = parseChallenge(existing);
      if (
        challenge.organizationId !== input.organizationId ||
        challenge.channelIdentityHash !== input.channelIdentityHash
      ) {
        throw new Error('WHATSAPP_LINK_CHALLENGE_COLLISION');
      }
      return 'existing';
    }

    const token = await this.tokenProvider.getAccessToken();
    const url = new URL(`${this.documentsBase}/${encodedPath(path)}`);
    url.searchParams.set('currentDocument.exists', 'false');

    const response = await this.fetchImpl(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        fields: {
          storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
          challengeHash: stringValue(input.challengeHash),
          organizationId: stringValue(input.organizationId),
          channelIdentityHash: stringValue(input.channelIdentityHash),
          expiresAt: stringValue(input.expiresAt),
          createdAt: stringValue(input.createdAt),
          ...(input.consumedAt ? { consumedAt: stringValue(input.consumedAt) } : {}),
        },
      }),
      cache: 'no-store',
    });

    if (response.ok) return 'created';
    if (response.status === 409 || response.status === 412) {
      const converged = await this.getDocument(path);
      if (!converged) throw new Error('WHATSAPP_LINK_CHALLENGE_WRITE_CONFLICT');
      const challenge = parseChallenge(converged);
      if (
        challenge.organizationId !== input.organizationId ||
        challenge.channelIdentityHash !== input.channelIdentityHash
      ) {
        throw new Error('WHATSAPP_LINK_CHALLENGE_COLLISION');
      }
      return 'existing';
    }
    throw new Error(`WHATSAPP_LINK_CHALLENGE_WRITE_${response.status}`);
  }

  async getChallenge(tokenValue: string): Promise<(WhatsAppLinkChallenge & { updateTime: string }) | null> {
    const challengeHash = hashWhatsAppLinkToken(tokenValue);
    const document = await this.getDocument(challengePath(challengeHash));
    if (!document) return null;
    const updateTime = typeof document.updateTime === 'string' ? document.updateTime : '';
    if (!updateTime) throw new Error('WHATSAPP_LINK_CHALLENGE_UPDATE_TIME_MISSING');
    return { ...parseChallenge(document), updateTime };
  }

  async consumeChallenge(input: {
    token: string;
    actorUid: string;
    now: string;
  }): Promise<WhatsAppChannelIdentityBinding> {
    const actorUid = safeSegment(input.actorUid, 256);
    const challenge = await this.getChallenge(input.token);
    if (!challenge) throw new Error('WHATSAPP_LINK_CHALLENGE_NOT_FOUND');
    if (challenge.consumedAt) throw new Error('WHATSAPP_LINK_CHALLENGE_USED');

    const nowMs = Date.parse(input.now);
    const expiresMs = Date.parse(challenge.expiresAt);
    if (!Number.isFinite(nowMs) || !Number.isFinite(expiresMs) || expiresMs < nowMs) {
      throw new Error('WHATSAPP_LINK_CHALLENGE_EXPIRED');
    }

    const binding: WhatsAppChannelIdentityBinding = {
      schemaVersion: 1,
      organizationId: challenge.organizationId,
      channel: 'whatsapp',
      channelIdentityHash: challenge.channelIdentityHash,
      actorUid,
      linkedAt: input.now,
    };

    const challengeDocumentName = this.fullDocumentName(challengePath(challenge.challengeHash));
    const bindingDocumentName = this.fullDocumentName(
      bindingPath(binding.organizationId, binding.channelIdentityHash),
    );

    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(this.commitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: challengeDocumentName,
              fields: {
                storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
                challengeHash: stringValue(challenge.challengeHash),
                organizationId: stringValue(challenge.organizationId),
                channelIdentityHash: stringValue(challenge.channelIdentityHash),
                expiresAt: stringValue(challenge.expiresAt),
                createdAt: stringValue(challenge.createdAt),
                consumedAt: stringValue(input.now),
              },
            },
            currentDocument: { updateTime: challenge.updateTime },
          },
          {
            update: {
              name: bindingDocumentName,
              fields: {
                storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
                organizationId: stringValue(binding.organizationId),
                channel: stringValue('whatsapp'),
                channelIdentityHash: stringValue(binding.channelIdentityHash),
                actorUid: stringValue(binding.actorUid),
                linkedAt: stringValue(binding.linkedAt),
              },
            },
          },
        ],
      }),
      cache: 'no-store',
    });

    if (response.ok) return binding;
    if (response.status === 409 || response.status === 412) {
      throw new Error('WHATSAPP_LINK_CHALLENGE_USED');
    }
    throw new Error(`WHATSAPP_LINK_CHALLENGE_CONSUME_${response.status}`);
  }

  private fullDocumentName(path: string[]): string {
    return `projects/${this.projectId}/databases/(default)/documents/${path.join('/')}`;
  }

  private async getDocument(path: string[]): Promise<FirestoreDocument | null> {
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(
      `${this.documentsBase}/${encodedPath(path)}`,
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
    if (!response.ok) throw new Error(`WHATSAPP_IDENTITY_GET_${response.status}`);
    return await response.json() as FirestoreDocument;
  }
}
