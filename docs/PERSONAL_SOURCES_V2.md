# Personal Sources V2 — Relationship Memory

Status: implemented as the next owner-scoped Relationship Intelligence slice in Connect.

## Product goal

Personal Sources V2 turns authorized personal conversation exports into an explainable relationship memory without turning Connect into a generic CRM and without silently moving personal history into an organization.

The user should be able to answer practical questions such as:

- Where did I meet this person?
- Which imported group/conversation did this relationship come from?
- What changed since the last export?
- Who in Group X deserves a conversation now, and why?
- What should I say next without inventing intimacy or context?
- Which evidence supports an inferred identity or Radar signal?

## Non-negotiable boundaries

- Hub remains the authority for identity, organization context and RBAC.
- Personal data remains owner-scoped under the Personal Vault.
- A personal relationship is never auto-promoted into an organization opportunity.
- Personal history and organization history remain separate.
- WhatsApp personal history is accepted only through user-authorized official exports; no scraping or WhatsApp Web automation.
- Outreach generation is advisory. Automatic sending remains disabled.
- Probable identity is evidence-backed and must not be represented as a verified identity.
- No sensitive-trait segmentation is introduced.

## Canonical conversation model

A raw import is no longer the user-facing conversation identity.

`personalConversationGroups/{groupId}` represents the stable conversation/group. Each accepted export revision can create a raw source slice only for unseen messages. `rawSourceIds` preserves provenance back to those slices.

This keeps a single visible “Grupo Pastores Norte” even after many re-exports while retaining the ability to explain where each message came from.

## Incremental re-import

The V2 import flow is:

1. Decode and validate the official TXT/ZIP export.
2. Parse the full incoming export with the existing defensive WhatsApp parser.
3. Derive conversation label, kind and conversation key.
4. Resolve the stable canonical conversation using key/kind plus participant overlap.
5. Load or bootstrap a message-fingerprint index.
6. Compare occurrence-aware fingerprints built from timestamp + normalized sender + text.
7. Pass only unseen messages to the existing Personal Radar ingestion pipeline.
8. Append the raw delta source to the canonical conversation.
9. Update the fingerprint index and import history.
10. Surface the same canonical source in Radar, search and My Sources.

Fingerprints are occurrence-aware so two genuinely repeated identical messages can coexist while a repeated export does not duplicate them.

Existing legacy imports are bootstrapped into a canonical group on the first V2 interaction rather than requiring a destructive migration.

## My Sources surface

The live `sources` route provides:

- conversation/message/people/import totals;
- TXT/ZIP import and update;
- stable conversation cards;
- incremental/legacy status;
- people from the selected source;
- participant activity;
- recent messages;
- import history with “incoming vs newly added” counts;
- explainable relationship brief (“who deserves attention now”);
- group-scoped outreach preparation;
- owner-controlled deletion.

## Person 360 API

`GET /api/personal/v2/people/:personId/context`

Returns an owner-scoped relationship context containing:

- canonical sources;
- deterministic relationship state;
- `whyNow`;
- recommended next action;
- message/source stats;
- recent messages authored by that person;
- identity evidence;
- Radar signals.

The response intentionally exposes evidence instead of a mysterious lead score.

## Relationship brief

`GET /api/personal/v2/brief`

Current deterministic priority reasons include:

- follow-up due;
- user-marked priority;
- favorite relationship;
- explicit product interest with evidence;
- high/very-high explainable Radar potential.

The brief is an attention queue, not an automated sales score.

## Group/source outreach

`POST /api/personal/v2/sources/:sourceId/outreach`

Prepares individual drafts for a bounded number of people from one canonical source. It reuses the shared Composer and returns `automaticSend: false` at the response and item level.

The user can review, edit, copy, or open WhatsApp manually.

## API surface

- `POST /api/personal/v2/imports/whatsapp`
- `GET /api/personal/v2/radar`
- `GET /api/personal/v2/search?q=...`
- `GET /api/personal/v2/sources`
- `GET /api/personal/v2/sources/:sourceId`
- `POST /api/personal/v2/sources/:sourceId/outreach`
- `DELETE /api/personal/v2/sources/:sourceId`
- `GET /api/personal/v2/people/:personId/context`
- `GET /api/personal/v2/brief`

Existing `/api/personal/**` endpoints remain available for People, contact import, identity review, manual opportunity promotion, message models, Composer and commercial-action tracking.

## Tool-friendly future bridge

The V2 surface intentionally creates a clean server-side foundation for future authenticated Connect tools such as:

- `searchConversations`
- `searchPeople`
- `getPersonContext`
- `getRelationshipBrief`
- `prepareSourceOutreach`
- `getPendingFollowUps`

A future ChatGPT/custom connector must still implement its own authenticated handoff and authorization boundary. The existence of these APIs does not mean ChatGPT or any third party is automatically connected to the user's vault.

## Provider-authorized next integrations

The following are product-ready directions but require external provider authorization/credentials or a native/mobile integration and therefore must not be represented as active until configured and validated:

### Official WhatsApp Business

Use Meta's official Business Platform/webhooks as a new channel adapter. Incoming business conversations can become real-time Connect conversations while personal exports remain a separate private source. Sending must go through Tool Gateway/policy/consent/audit and explicit user confirmation where required.

### Instagram Professional

Connect only supported Professional accounts through Meta's official APIs and scopes. Do not pretend consumer Instagram accounts expose the same conversation/contact surface.

### iPhone Contacts continuous sync

VCF import is already supported by the People surface. Continuous Contacts sync requires a native iOS/companion implementation using Apple's Contacts authorization. A web/PWA must not claim CNContactStore access it does not have.

### Monitored import inbox

A future Google Drive/import-inbox adapter can watch an explicitly authorized folder and feed newly deposited exports through the same V2 ingestion/idempotency pipeline. It must not scrape WhatsApp or infer authorization from mere file visibility.

## Quality gates

Personal Sources V2 is covered by the Radar quality suite for:

- first import;
- incremental re-import;
- exact re-import idempotency;
- stable canonical conversation identity;
- deduplicated message totals;
- canonical Radar provenance;
- source details and import history;
- Person 360 context;
- explainable brief;
- manual-only source outreach;
- canonical source deletion;
- governance/private boundary.

Production activation still follows the repository's normal gated release workflow and smoke tests.
