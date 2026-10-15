import { createHash } from 'node:crypto';
import { GoogleMetadataAccessTokenProvider, type ConnectRuntimeAccessTokenProvider } from '../inbox/firestoreThreadStore';
import { createConversationIdFromChannelIdentity, createProviderMessageIndexId, type ConnectMessageContentStore } from '../inbox/messageContentStore';
import type { WhatsAppConnectionRegistry } from '../channels/whatsappConnectionRegistry';
import { validateAutomationEvent, type AutomationJobStore } from './eventJobs';

type IndexDocument = { name: string; updateTime: string; fields: Record<string, { stringValue?: string; integerValue?: string }> };
type OutboxState = 'pending' | 'queued' | 'needs_review';
const CURSOR_ID = '_connect_inbound_outbox_legacy_cursor_v1';

/**
 * Inbox's provider index is written in the SAME Firestore commit as the private
 * message. Its pending bit is the durable outbox, not an unreliable after-hook.
 * No device, domain or Meta delivery is performed here.
 */
export class FirestoreInboundAlertCatchup {
  private readonly base: string;
  private readonly token: ConnectRuntimeAccessTokenProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  constructor(options: {
    projectId: string;
    messages: Pick<ConnectMessageContentStore, 'get'>;
    registry: Pick<WhatsAppConnectionRegistry, 'resolve'>;
    jobs: Pick<AutomationJobStore, 'enqueue'>;
    fetchImpl?: typeof fetch;
    tokenProvider?: ConnectRuntimeAccessTokenProvider;
    now?: () => Date;
  }) {
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(options.projectId)) throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    this.base = `https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/(default)/documents`;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.token = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({ fetchImpl: this.fetchImpl });
    this.messages = options.messages;
    this.registry = options.registry;
    this.jobs = options.jobs;
    this.now = options.now ?? (() => new Date());
  }
  private readonly messages: Pick<ConnectMessageContentStore, 'get'>;
  private readonly registry: Pick<WhatsAppConnectionRegistry, 'resolve'>;
  private readonly jobs: Pick<AutomationJobStore, 'enqueue'>;

  private async request(path: string, init: RequestInit = {}) {
    return this.fetchImpl(this.base + path, {
      ...init, signal: AbortSignal.timeout(8000), cache: 'no-store',
      headers: { Authorization: `Bearer ${await this.token.getAccessToken()}`, 'Content-Type': 'application/json' },
    });
  }
  private string(doc: IndexDocument, key: string) { return doc.fields?.[key]?.stringValue || ''; }
  private attempts(doc: IndexDocument) { return Math.max(0, Math.min(3, Number(doc.fields?.alertOutboxAttempts?.integerValue || 0) || 0)); }
  private async patch(doc: IndexDocument, status: OutboxState, attempts: number, code: string, occurredAt?: string) {
    const id = doc.name.split('/').at(-1) || '';
    if (!/^[A-Za-z0-9:_-]{8,180}$/.test(id) || !doc.updateTime) throw new Error('OUTBOX_INDEX_INVALID');
    const fields = {
      ...doc.fields,
      alertOutboxStatus: { stringValue: status },
      alertOutboxAttempts: { integerValue: String(attempts) },
      alertOutboxCode: { stringValue: code },
      ...(occurredAt ? { alertOutboxOccurredAt: { stringValue: occurredAt } } : {}),
    };
    const r = await this.request(`/connectProviderMessageIndex/${encodeURIComponent(id)}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`,
      { method: 'PATCH', body: JSON.stringify({ fields }) });
    if ([409, 412].includes(r.status)) return false; // another worker won the CAS
    if (!r.ok) throw new Error('OUTBOX_STATUS_UNAVAILABLE');
    return true;
  }
  private async process(doc: IndexDocument) {
    if (!doc.name.includes('/connectProviderMessageIndex/')) throw new Error('OUTBOX_INDEX_INVALID');
    if (this.string(doc, 'channel') !== 'whatsapp') return 'skipped' as const;
    const organizationId = this.string(doc, 'organizationId'), conversationId = this.string(doc, 'conversationId');
    const messageId = this.string(doc, 'messageId');
    if (!organizationId || !conversationId || !messageId || doc.name.split('/').at(-1) !== messageId) {
      await this.patch(doc, 'needs_review', 3, 'invalid_index_scope'); return 'review' as const;
    }
    const message = await this.messages.get({ organizationId, conversationId, messageId });
    const binding = message?.recipientRef ? this.registry.resolve(message.recipientRef) : null;
    if (!message || message.organizationId !== organizationId || message.conversationId !== conversationId ||
      message.messageId !== messageId || message.channel !== 'whatsapp' || message.direction !== 'inbound' ||
      !message.recipientRef || !message.senderRef || !binding || binding.organizationId !== organizationId ||
      createProviderMessageIndexId('whatsapp', message.providerMessageId) !== messageId ||
      createConversationIdFromChannelIdentity({ organizationId, channel: 'whatsapp', connectionRef: binding.connectionRef, channelUserId: message.senderRef }) !== conversationId) {
      await this.patch(doc, 'needs_review', 3, 'canonical_scope_mismatch'); return 'review' as const;
    }
    const clock = this.now();
    let event;
    try {
      event = validateAutomationEvent({ schemaVersion: 1, sourceApp: 'whatsapp', trigger: 'inbox.message_received',
        eventId: messageId, organizationId, conversationId, messageId, occurredAt: message.occurredAt }, 'whatsapp', +clock);
    } catch {
      await this.patch(doc, 'needs_review', 3, 'expired_or_invalid_event', message.occurredAt);
      return 'review' as const;
    }
    try {
      // Atomic budget+job CAS in the existing job store; duplicate does not
      // consume quota or repeat an external attempt.
      await this.jobs.enqueue(event, clock);
      await this.patch(doc, 'queued', this.attempts(doc), 'job_present', message.occurredAt);
      return 'recovered' as const;
    } catch {
      const attempts = this.attempts(doc) + 1;
      await this.patch(doc, attempts >= 3 ? 'needs_review' : 'pending', attempts,
        attempts >= 3 ? 'enqueue_retry_exhausted' : 'enqueue_retry_pending', message.occurredAt);
      return attempts >= 3 ? 'review' as const : 'retry' as const;
    }
  }

  private async pending(limit: number): Promise<IndexDocument[]> {
    const r = await this.request(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'connectProviderMessageIndex' }],
      where: { fieldFilter: { field: { fieldPath: 'alertOutboxStatus' }, op: 'EQUAL', value: { stringValue: 'pending' } } },
      limit,
    } }) });
    if (!r.ok) throw new Error('OUTBOX_QUERY_UNAVAILABLE');
    return ((await r.json()) as Array<{ document?: IndexDocument }>).flatMap(row => row.document ? [row.document] : []);
  }

  /** One durable cursor for a bounded legacy sweep of messages saved BEFORE the atomic outbox. */
  private async sweepLegacy(limit: number): Promise<{ checked: number; recovered: number; review: number }> {
    const cursorResponse = await this.request('/connectProviderMessageIndex/' + CURSOR_ID);
    if (!cursorResponse.ok && cursorResponse.status !== 404) throw new Error('OUTBOX_CURSOR_UNAVAILABLE');
    const cursor = cursorResponse.ok ? await cursorResponse.json() as IndexDocument : null;
    const pageToken = cursor ? this.string(cursor, 'pageToken') : '';
    const url = '/connectProviderMessageIndex?pageSize=' + limit + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const r = await this.request(url);
    if (!r.ok) throw new Error('OUTBOX_LEGACY_SCAN_UNAVAILABLE');
    const body = await r.json() as { documents?: IndexDocument[]; nextPageToken?: string };
    let checked = 0, recovered = 0, review = 0;
    for (const doc of body.documents || []) {
      if (doc.name.endsWith('/' + CURSOR_ID) || this.string(doc, 'channel') !== 'whatsapp' || this.string(doc, 'alertOutboxStatus')) continue;
      checked++;
      const outcome = await this.process(doc);
      if (outcome === 'recovered') recovered++;
      if (outcome === 'review') review++;
    }
    // Never move the cursor before all preceding records are durably queued or
    // explicitly classified. A crash/concurrent replay only rechecks idempotent IDs.
    const nextFields = { pageToken: { stringValue: body.nextPageToken || '' },
      schemaVersion: { integerValue: '1' } };
    const root = this.base.replace('https://firestore.googleapis.com/v1/', '');
    const write = { update: { name: root + '/connectProviderMessageIndex/' + CURSOR_ID, fields: nextFields },
      currentDocument: cursor ? { updateTime: cursor.updateTime } : { exists: false } };
    const commit = await this.request(':commit', { method: 'POST', body: JSON.stringify({ writes: [write] }) });
    if (!commit.ok && ![409, 412].includes(commit.status)) throw new Error('OUTBOX_CURSOR_WRITE_FAILED');
    return { checked, recovered, review };
  }

  /** Same Hub-authorized operator view as normal jobs; no phone/body/uid included. */
  async listReviewsForOrganization(organizationId: string) {
    if (!organizationId || organizationId.length > 180 || /[\\/]/.test(organizationId)) throw new Error('INVALID_OUTBOX_SCOPE');
    const r = await this.request(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'connectProviderMessageIndex' }],
      where: { fieldFilter: { field: { fieldPath: 'organizationId' }, op: 'EQUAL', value: { stringValue: organizationId } } },
      limit: 200,
    } }) });
    if (!r.ok) throw new Error('OUTBOX_REVIEW_UNAVAILABLE');
    const rows = (await r.json()) as Array<{ document?: IndexDocument }>;
    return rows.flatMap(row => row.document ? [row.document] : []).filter(doc =>
      this.string(doc, 'organizationId') === organizationId && this.string(doc, 'channel') === 'whatsapp' &&
      this.string(doc, 'alertOutboxStatus') === 'needs_review',
    ).slice(0, 10).map(doc => ({
      id: createHash('sha256').update('outbox-review:' + organizationId + ':' + this.string(doc, 'messageId')).digest('hex'),
      sourceApp: 'whatsapp', trigger: 'inbox.message_received',
      conversationId: this.string(doc, 'conversationId'),
      occurredAt: this.string(doc, 'alertOutboxOccurredAt') || this.now().toISOString(),
      state: 'needs_review' as const, attempts: this.attempts(doc),
      resultCode: this.string(doc, 'alertOutboxCode') || 'unqueued_inbound_human_review',
    }));
  }

  async run(limit = 10): Promise<{ scanned: number; recovered: number; review: number; retry: number }> {
    const n = Number.isInteger(limit) ? Math.max(1, Math.min(10, limit)) : 10;
    const records = await this.pending(n);
    let recovered = 0, review = 0, retry = 0;
    for (const doc of records) {
      const outcome = await this.process(doc);
      if (outcome === 'recovered') recovered++;
      if (outcome === 'review') review++;
      if (outcome === 'retry') retry++;
    }
    // Bounded historical pass; does not require a new collection, index,
    // destructive migration or arbitrary caller-provided tenant scope.
    const legacy = await this.sweepLegacy(n);
    return { scanned: records.length + legacy.checked, recovered: recovered + legacy.recovered,
      review: review + legacy.review, retry };
  }
}
