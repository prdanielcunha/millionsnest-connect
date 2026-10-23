# Official support intake — 2026-10-23

## Behavior
The public site and MusicScale use the existing Connect WhatsApp provider. Public contact does not require an account, organization, entitlement or paid support plan. Existing priority support and email contracts remain available.

GET `/api/core/support/contact` presents a localized subject selector. Allowlisted query only: `product=hub|musicscale|nestfinance|nestjourney|nestlocal|nestaffiliate`, `source=website|app|hub`, `topic=help|error|access|billing|sales|other`, `locale=pt-BR|en-US|es-ES`. `open=1` redirects to a manual wa.me draft.

The destination is read with the existing provider's GET display-phone method from exactly one enabled existing binding. No guessed number, caller override, sends, templates, identity changes or new integration. Missing/ambiguous configuration returns 503; healthy metadata is coalesced and cached for 60 seconds per process. It uses the already configured support-draft availability gate; no new activation flag or secret.

The draft contains a human-readable product/subject/source and `[mn-support:v1:product:source:topic]`. This is editable, self-reported routing context, not cryptographic provenance, account verification or tenant access. If removed, origin cannot be reliably reconstructed. Direct messages continue through existing intake; explicit support requests without valid metadata are queued for human clarification. No hidden UTM/referral attribution is promised for ordinary wa.me links.

After signed Meta ingestion, metadata is saved as SUPPORT_CONTEXT_RECORDED in the existing private, tenant-scoped Inbox event stream and projection. No new collection, index, IAM or Rules is required. Existing deterministic event IDs, versioning and rebuild semantics apply. Six product/subject catalogs are routing labels only, not claims that each app exposes private tools.

Marked support requests enter the existing waiting_team human queue without an automatic outbound acknowledgement. Existing human assignment and paused automation are preserved. Inbox list, detail and loaded-conversation search display localized source/subject labels. Subject changes stay in event history. These labels never select a customer tenant or grant private app access. Existing archived-thread immutability is preserved; archive lifecycle is not redefined here.

## Privacy and costs
No user email, UID, organization ID, page query, token or error stack is put in the public URL. URL enums never choose a provider, phone, redirect origin or authority. The contact page is no-store, no-referrer, script-free, and CSP-constrained. No new paid provider, AI call or outbound automation is introduced. Meta's October 2026 service-message pricing still applies to any later replies sent by the existing API; this implementation does not claim those are unlimited/free.

## Validation and release
Local main and narrowly scoped production bases are validated independently. Tests cover fixed-provider redirects, malformed/duplicate/unknown query values, ambiguous bindings, coalesced metadata, six products/topics, three locales, no outbound dependency, tenant isolation, event retries and existing assignment. App UI tests verify public access and topic/locale URLs without reading auth or making background requests.

Production must publish Connect first, then verify the public selector, redirect destination from the real provider and exact health SHA before publishing Hub/MusicScale links. A physical user-initiated message and authorized Inbox observation are needed to certify the full external Meta delivery path. Synthetic tests do not certify physical WhatsApp delivery. Preserve production branch history and only promote scoped changes; never reconcile unrelated divergent branches by force.

## Official references (researched 2026-10-23)
- https://faq.whatsapp.com/5913398998672934
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
