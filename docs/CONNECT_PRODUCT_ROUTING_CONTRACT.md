# Product routing contract (#224)

Default off. Mounted only alongside the existing official Assist/runtime after durable Meta ingestion. Channel organization comes from the existing number binding. Routing does not create Hub identity or domain authority.

- MusicScale: recognized requests continue through existing channel grant -> Hub -> Core -> authorized Tool Gateway.
- NestFinance/NestJourney: route and persist product context; human fallback. No private domain query exists in this increment.
- Product support owner configuration is server-owned and revalidated with the canonical operator directory. Missing/invalid owner leaves the request visible and unassigned in the durable Inbox. Human ownership prevents automatic queries/replies; product context may still switch.
- Generic direct messages ask which app. Conflicting explicit products/origin hints ask clarification. Bare phone is never an identity.
- Provider events outside 24h never cause an outbound service-window reply. Inbound evidence must belong to the mapped tenant/thread/sender. Older link confirmation cannot automatically resume a request after its conversation moved on.
- Routing state persists only product IDs, hashes, scope and timestamps. No raw text, phone or bearer. Private `connectProductRoutes` + 90-day expiresAt TTL must be proved before flags are enabled.

## Signed CTA origin — consumer implemented, upstream generation pending

Append `[mn-origin:<payload-base64url>.<signature-base64url>]` to the WhatsApp support draft.
Payload: JSON `{ "version": 1, "product": "musicscale"|"nestfinance"|"nestjourney", "issuedAt": <epoch milliseconds>, "expiresAt": <epoch milliseconds> }`.
Signature: HMAC-SHA256 over UTF-8 `connect-product-origin:v1:` + exact encoded payload, with a dedicated server-side origin secret of at least 32 characters. Lifetime <=10 minutes; future-issued tolerance <=30 seconds. Never put the secret in browser code.

Apps/Hub must authenticate and authorize the caller before signing an origin. That upstream signing/CTA implementation is not delivered here. The hint conveys product provenance only; it never selects an organization, supplies UID, or authorizes a tool. Tampered, expired or conflicting hints trigger clarification.

## Outstanding contracts

Hub must expose canonical `appAccess.nestfinance`/`appAccess.nestjourney` and their capability/consent evidence before a domain tool can run. Each app must independently revalidate identity, organization, required permission and consent via its official tool endpoint. Financial/pastoral scopes cannot be inferred from MusicScale access. Keep human fallback until those contracts are implemented and verified.

## Authenticated origin issuing endpoint

When product routing is actually mounted and the dedicated origin secret is configured, `POST /api/core/support/origin` accepts exactly `{product, organizationId}` with the user's Firebase Bearer. The Hub resolves organization and that product's current canonical access; mismatches/denials return 403. Output is `{product, expiresAt, originHint}` with the signed hint above, containing no UID, tenant, bearer or phone. Caller retains the existing official support number and appends the hint to its support draft. Missing routing/secret keeps the endpoint disabled (404). No browser receives signing keys. Actual upstream buttons must call this endpoint rather than fabricate a signed hint.
