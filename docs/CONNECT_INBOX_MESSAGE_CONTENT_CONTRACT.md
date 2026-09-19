# Connect Inbox — Message Content & PII Contract

Status: **contract frozen; runtime adapter not mounted**

The canonical Inbox thread event store intentionally contains no message body,
phone number, contact name, e-mail, free-form pastoral note or provider secret.
Real omnichannel support therefore requires a separate content boundary before
WhatsApp or any other provider can be attached to Inbox.

## Non-negotiable separation

The following remain in the existing canonical thread event store:

- organization/thread scope;
- state transitions;
- assignment/handoff;
- automation pause;
- stable evidence references;
- timestamps and routing metadata.

The following belong only to a dedicated message-content store:

- inbound/outbound message body;
- provider sender/recipient identifiers;
- provider message ID;
- media references;
- delivery/read/failure status;
- limited contact display metadata needed to operate Inbox.

The content store must never become a replacement authority for Hub identity,
membership, RBAC or app access.

## Scope and tenancy

Every content record is pinned to:

- `organizationId`;
- `conversationId`;
- `messageId`;
- `channel`.

No cross-tenant query is allowed. Browser-supplied tenant, role or capability
is never authority.

## Evidence link

Every content record must expose a stable evidence reference that can be used
by the PII-minimal thread event stream without copying the body or identifiers
into that stream.

For WhatsApp, provider message IDs may be used as provider evidence only after
normalization and length validation. Conversation IDs used by the routing store
must not embed raw phone numbers.

## Retention

Retention must be explicit and configurable before production mounting.

Required states:

- active retention window;
- expired/tombstoned;
- legal/operational hold only when explicitly supported;
- media retention separately configurable from text.

No indefinite retention by default.

## Sensitive content

The first production adapter must not infer or persist pastoral, health,
financial, political or other sensitive classifications from message text.

AI-generated labels must not be silently added to durable content. Any future
classification feature requires its own purpose, visibility, retention and
access rules.

## Provider credentials

Provider access tokens, app secrets, webhook verify tokens and Firebase bearer
tokens are forbidden from message records and client responses.

They remain server-side secret/configuration material only.

## Idempotency

Provider message ingestion must be idempotent.

A repeated provider event with the same normalized provider message ID and
fingerprint must be treated as a retry. A conflicting payload for the same ID
must fail closed and be auditable.

## Ingestion ordering

A provider adapter must not acknowledge a real user message until the durable
ingestion boundary can guarantee recoverability.

The preferred contract is:

1. verify provider authenticity/signature;
2. resolve the official channel connection to one organization;
3. normalize provider envelope;
4. persist message content idempotently;
5. append/open the PII-minimal Inbox thread using the content evidence ref;
6. acknowledge the provider only after recoverable durable state exists.

If step 5 fails after step 4, a provider retry must be able to reconcile using
the persisted idempotency key instead of duplicating the message.

## Human reply

Human reply is a separate outbound boundary.

Before mounting it, Connect must have:

- canonical Hub authorization for `connect.inbox.manage` or equivalent;
- organization/channel pinning;
- consent/window/template policy as required by the provider;
- provider dispatch implemented server-side;
- idempotency persistence;
- provider message ID reconciliation;
- PII-minimal audit;
- failure/retry semantics;
- opt-out enforcement where applicable.

## Current production gate

This contract does **not** activate message persistence or WhatsApp dispatch.

Activation remains blocked until the dedicated Connect runtime has the required
Firestore data-plane permissions and the content-store adapter, official
provider ingestor and human-reply boundary are implemented and smoke-tested.
