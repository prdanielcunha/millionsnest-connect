# Connect Inbox — Durable Firestore Storage Contract

Status: **P1 contract frozen; not runtime-mounted yet**

This document freezes the first durable, Connect-owned persistence layout for
canonical Inbox threads. It exists before production writes are enabled so
storage scope, concurrency, privacy and IAM can be reviewed independently from
UI activation.

## Ownership boundary

The Inbox event store belongs to **MillionsNest Connect**.

It must not reuse:

- `users/{uid}/connect/state` or any Personal Vault path;
- a MusicScale, NestJourney, NestLocal or Hub collection;
- a browser/user Firebase bearer as the backend worker identity.

The server-side adapter runs only as the dedicated Connect Cloud Run identity:

`mn-connect-runtime@millionsnest.iam.gserviceaccount.com`

Hub remains the authority for identity, organization membership, roles and
explicit Inbox grants. The storage adapter receives an already-canonical
`organizationId`; it is not an authorization engine.

## Firestore layout

Thread snapshot:

`connectOrganizations/{organizationId}/inboxThreads/{conversationId}`

Canonical append-only events:

`connectOrganizations/{organizationId}/inboxThreads/{conversationId}/events/{eventId}`

Every storage operation contains the organization in the document path. There
is no cross-tenant collection query in the adapter.

### Thread snapshot fields

The snapshot document contains only compact canonical routing state:

- `storageSchemaVersion`
- `organizationId`
- `conversationId`
- `sourceEventCount`
- `lastEventId`
- `updatedAt`
- `projectionJson`

`projectionJson` is a canonical JSON encoding of the existing
`ConnectThreadProjection`. It contains state-machine metadata only.

### Event fields

Each event document contains:

- `storageSchemaVersion`
- `organizationId`
- `conversationId`
- `eventId`
- `eventType`
- `occurredAt`
- `recordedAt`
- `eventFingerprint`
- `eventJson`

`eventJson` is a canonical JSON encoding of the existing
`ConnectThreadEvent`. The SHA-256 fingerprint is stored to distinguish a true
idempotent retry from an event-id collision.

## Data that is forbidden in this store

The canonical Inbox event/snapshot layer must not contain:

- message body;
- phone number;
- contact name;
- e-mail;
- free-form pastoral note;
- AI-generated pastoral classification;
- provider access token or Firebase bearer.

If message content is introduced later, it requires a separate storage,
retention and sensitivity contract. It must not silently enter this event
stream.

## Atomic append contract

An append is exactly one Firestore `documents:commit` containing:

1. creation of the event document with `currentDocument.exists=false`;
2. update of the thread snapshot in the same atomic commit.

For the snapshot:

- first event uses `currentDocument.exists=false`;
- subsequent events use the exact Firestore `updateTime` observed immediately
  before the commit.

This preserves optimistic concurrency across Cloud Run instances.

Before committing, the adapter rebuilds the projection from the persisted
event stream and compares it with the snapshot. Any drift fails closed.

## Idempotency and conflict semantics

- Same `eventId` + same canonical event fingerprint => `duplicate`.
- Same `eventId` + different fingerprint => `EVENT_ID_COLLISION`.
- Stale expected stream version => `THREAD_VERSION_CONFLICT`.
- Snapshot/event rebuild disagreement => `THREAD_SNAPSHOT_DRIFT`.
- Ambiguous commit failure may be recovered only if the durable event already
  exists with the exact same fingerprint.

No last-write-wins behavior is allowed.

## Reads and rebuild

`load()` reads the tenant/thread snapshot document directly.

`readEvents()` lists only the immediate `events` subcollection under the
already-scoped organization/thread document. Pagination is supported. The
canonical projector remains responsible for deterministic event ordering and
rebuild.

The first layout requires no compound query and therefore no custom composite
index for these operations.

## Minimum runtime IAM

The durable adapter requires exactly these Firestore data permissions:

- `datastore.entities.get`
- `datastore.entities.list`
- `datastore.entities.create`
- `datastore.entities.update`

It does **not** require:

- `datastore.entities.delete`;
- IAM policy mutation permissions;
- database administration;
- index administration.

The production readiness gate must prove all four required permissions before
the adapter is mounted. The intended next IAM step is a dedicated custom role
for the Connect runtime rather than a broad predefined datastore role.

## Activation gates

The adapter can be merged while remaining unmounted.

Production mounting is allowed only after:

1. the four minimum permissions are proven for `mn-connect-runtime`;
2. durable adapter regressions are green;
3. restart/rebuild and optimistic-concurrency behavior are green;
4. tenant-negative tests are green;
5. the server composition mounts the adapter behind an explicit feature flag;
6. production smoke proves persistence across a fresh Cloud Run request/runtime.

The historical Inbox UI remains in DEMO_MODE until those gates are complete.

## Rollback

Because this phase does not delete or mutate prior event documents, rollback is
performed by disabling the runtime feature flag and returning the UI to the
existing demo/live-safe path. No destructive data migration is required for the
initial activation.
