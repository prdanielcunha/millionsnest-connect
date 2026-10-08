import express from 'express';
import type {
  CanonicalContextProvider,
  CanonicalContextResolution,
} from './connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import type { ConnectThreadStore } from '../inbox/threadStore';
import type { ConnectMessageContentStore } from '../inbox/messageContentStore';
import type { InboxContactProfileStore } from '../inbox/inboxContactProfileStore';
import { filterAuthorizedInboxContactProfiles, inboxContactSearchTerm } from '../inbox/inboxContactProfileStore';

export interface ConnectInboxQueryHttpHandlerOptions {
  contextProvider: CanonicalContextProvider;
  threadStore: ConnectThreadStore;
  messageStore: ConnectMessageContentStore;
  contactProfileStore?: InboxContactProfileStore;
}

function bearer(req: express.Request): string {
  const raw = req.headers.authorization;
  return typeof raw === 'string' && /^Bearer\s+\S+$/i.test(raw.trim())
    ? raw.trim()
    : '';
}

function safeId(value: unknown, maxLength = 180): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  if (
    !clean ||
    clean.length > maxLength ||
    clean.includes('/') ||
    clean.includes('\\')
  ) {
    return '';
  }
  return clean;
}

function limitOf(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed)
    ? Math.max(1, Math.min(parsed, max))
    : fallback;
}

function setPrivateHeaders(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

function mapResolution(resolution: CanonicalContextResolution): {
  status: number;
  code: string;
} {
  if (resolution.status === 'identity_required') {
    return { status: 401, code: 'IDENTITY_REQUIRED' };
  }
  if (resolution.status === 'organization_required') {
    return { status: 400, code: 'ORGANIZATION_REQUIRED' };
  }
  return { status: 403, code: 'INBOX_ACCESS_DENIED' };
}

async function resolveReadContext(
  req: express.Request,
  res: express.Response,
  options: ConnectInboxQueryHttpHandlerOptions,
  organizationId: string,
) {
  const authorization = bearer(req);
  if (!authorization) {
    res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      humanSummary: 'Sua sessão precisa ser confirmada novamente.',
    });
    return null;
  }

  let resolution: CanonicalContextResolution;
  try {
    resolution = await options.contextProvider.resolve({
      authToken: authorization,
      requestedOrganizationId: organizationId,
    });
  } catch {
    res.status(503).json({
      success: false,
      code: 'CANONICAL_CONTEXT_UNAVAILABLE',
      humanSummary: 'Não foi possível confirmar sua autorização agora.',
    });
    return null;
  }

  if (resolution.status !== 'resolved') {
    const mapped = mapResolution(resolution);
    res.status(mapped.status).json({
      success: false,
      code: mapped.code,
    });
    return null;
  }

  if (resolution.context.organizationId !== organizationId) {
    res.status(409).json({
      success: false,
      code: 'ORGANIZATION_CONTEXT_MISMATCH',
    });
    return null;
  }

  const authority = evaluateConnectInboxAuthority(resolution.context, 'read');
  if ('reason' in authority) {
    res.status(403).json({
      success: false,
      code: authority.reason,
    });
    return null;
  }

  return resolution.context;
}

function storageFailure(error: unknown): {
  status: number;
  code: string;
} {
  const code = error instanceof Error ? error.message : '';
  if (code === 'INBOX_STORAGE_NOT_READY') {
    return { status: 503, code };
  }
  return { status: 503, code: 'INBOX_STORAGE_UNAVAILABLE' };
}

export function createConnectInboxConversationListHttpHandler(
  options: ConnectInboxQueryHttpHandlerOptions,
) {
  return async function connectInboxConversationListHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    setPrivateHeaders(res);

    const organizationId = safeId(req.query.organizationId);
    const limit = limitOf(req.query.limit, 50, 100);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        code: 'INBOX_SCOPE_REQUIRED',
      });
    }

    const context = await resolveReadContext(req, res, options, organizationId);
    if (!context) return;

    try {
      const conversations = await options.threadStore.listByOrganization({
        organizationId: context.organizationId,
        limit,
      });
      // Identity enrichment is derived only from these authorized threads.
      // No caller-supplied phone number or arbitrary profile ID is accepted.
      let profiles: Awaited<ReturnType<InboxContactProfileStore['list']>> = [];
      if (options.contactProfileStore && conversations.length) {
        try {
          profiles = await options.contactProfileStore.list({
            organizationId: context.organizationId,
            conversationIds: conversations.map(thread => thread.conversationId),
          });
        } catch {
          // Contact display labels are optional; remain functional without them.
        }
      }
      const profileById = new Map(
        filterAuthorizedInboxContactProfiles(
          profiles,
          context.organizationId,
          conversations.map(thread => thread.conversationId),
        ).map(profile => [profile.conversationId, profile]),
      );
      return res.status(200).json({
        success: true,
        organizationId: context.organizationId,
        conversations: conversations.map(conversation => {
          const profile = profileById.get(conversation.conversationId);
          return {
            ...conversation,
            ...(profile ? {
              contact: {
                displayName: profile.displayName,
                source: 'whatsapp_profile',
              },
            } : {}),
          };
        }),
      });
    } catch (error) {
      const mapped = storageFailure(error);
      return res.status(mapped.status).json({
        success: false,
        code: mapped.code,
      });
    }
  };
}

export function createConnectInboxMessageListHttpHandler(
  options: ConnectInboxQueryHttpHandlerOptions,
) {
  return async function connectInboxMessageListHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    setPrivateHeaders(res);

    const organizationId = safeId(req.query.organizationId);
    const conversationId = safeId(req.params.conversationId);
    const limit = limitOf(req.query.limit, 100, 200);
    if (!organizationId || !conversationId) {
      return res.status(400).json({
        success: false,
        code: 'INBOX_SCOPE_REQUIRED',
      });
    }

    const context = await resolveReadContext(req, res, options, organizationId);
    if (!context) return;

    let thread;
    try {
      thread = await options.threadStore.load({
        organizationId: context.organizationId,
        conversationId,
      });
    } catch (error) {
      const mapped = storageFailure(error);
      return res.status(mapped.status).json({
        success: false,
        code: mapped.code,
      });
    }

    if (!thread) {
      return res.status(404).json({
        success: false,
        code: 'THREAD_NOT_FOUND',
      });
    }

    try {
      const records = await options.messageStore.listConversation({
        organizationId: context.organizationId,
        conversationId,
        limit,
      });

      // Deliberately omit senderRef, recipientRef and providerMessageId from
      // the browser contract. Authorized operators get the conversation body
      // without leaking raw channel identifiers or provider correlation keys.
      const messages = records.map((record) => ({
        messageId: record.messageId,
        channel: record.channel,
        direction: record.direction,
        messageType: record.messageType,
        body: record.body ?? null,
        occurredAt: record.occurredAt,
        deliveryStatus: record.deliveryStatus,
        deliveryUpdatedAt: record.deliveryUpdatedAt ?? null,
      }));

      return res.status(200).json({
        success: true,
        organizationId: context.organizationId,
        conversationId,
        messages,
      });
    } catch {
      return res.status(503).json({
        success: false,
        code: 'MESSAGE_CONTENT_UNAVAILABLE',
      });
    }
  };
}

/**
 * Scoped Inbox contact search. Only index-backed, expiring, self-reported
 * display labels are searched. A matching label cannot bypass canonical
 * thread membership or Hub's read authority.
 */
export function createConnectInboxContactSearchHttpHandler(
  options: ConnectInboxQueryHttpHandlerOptions,
) {
  return async function inboxContactSearchHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    setPrivateHeaders(res);
    const organizationId = safeId(req.query.organizationId);
    const term = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = limitOf(req.query.limit, 20, 30);
    if (!organizationId || term.length < 2 || term.length > 80 || !inboxContactSearchTerm(term)) {
      return res.status(400).json({ success: false, code: 'INBOX_SEARCH_INVALID' });
    }
    const context = await resolveReadContext(req, res, options, organizationId);
    if (!context) return;

    if (!options.contactProfileStore?.search) {
      return res.status(200).json({
        success: true,
        organizationId: context.organizationId,
        enabled: false,
        conversations: [],
      });
    }
    try {
      const candidates = await options.contactProfileStore.search({
        organizationId: context.organizationId,
        term,
        limit,
      });
      const profiles = filterAuthorizedInboxContactProfiles(
        candidates,
        context.organizationId,
        candidates.map(item => item.conversationId),
      ).slice(0, limit);
      const conversations = await Promise.all(profiles.map(async profile => {
        const projection = await options.threadStore.load({
          organizationId: context.organizationId,
          conversationId: profile.conversationId,
        });
        if (!projection) return null;
        return {
          ...projection,
          contact: { displayName: profile.displayName, source: 'whatsapp_profile' as const },
        };
      }));
      return res.status(200).json({
        success: true,
        organizationId: context.organizationId,
        enabled: true,
        conversations: conversations.filter(Boolean),
      });
    } catch (error) {
      const mapped = storageFailure(error);
      return res.status(mapped.status).json({ success: false, code: mapped.code });
    }
  };
}
