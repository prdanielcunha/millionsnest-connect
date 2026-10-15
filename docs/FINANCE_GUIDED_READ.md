# Authorized Finance read in Assist

The live Assist screen offers an explicit NestFinance document-count query only when the canonical Hub session includes a matching, granted NestFinance app-access tuple. UI visibility is not authority: every request re-resolves Hub identity, organization and app grant, and the Finance domain independently verifies revoked-token/session binding, current membership/entitlement, finance.view and entity scope.

1. The user loads permitted entities via `POST /api/core/tools/nestfinance/entities`, body `{ organizationId }`.
2. The Core calls the official Finance `connect-entities` operation with the same transient Firebase identity. Only bounded ID/display-name choices and a limited-list indicator return. A limited list is never assumed complete; no entity is selected automatically.
3. After explicit selection and another click, `POST /api/core/tools/nestfinance/pending-documents`, body `{ organizationId, financeEntityId }`, returns only awaitingUpload, needsClassification and pendingReview counts. The Finance domain rechecks scope rather than trusting a previous list.

All reads are no-store and time-bounded. Nothing is fetched automatically on opening the screen. Session changes hide previous state immediately; account/organization changes and unmount abort requests, selection changes clear counts, and stale requests cannot replace a current result. Denied/expired-session errors remove previous choices. PT/EN/ES includes empty, unavailable, limited-list and recoverable-error states. No documents, amounts, bank data or bearer is persisted/displayed/logged. The existing native MusicScale chat is preserved.

Activation uses the existing default-off `CONNECT_NESTFINANCE_PENDING_DOCUMENTS_ENABLED` flag. The official release must prove both upstream read routes exist and refuse missing identity before enabling it; Core composition and post-release checks require both mounted routes to return401 without identity. Existing exact frontend/Core publication, private storage and rollback gates remain mandatory. Push and automation flags are unchanged.

Upstream contract is implemented in Finance PR227/228, canonical read-entry source0cacb0cef28a0657fc847faf6a66ac2d02cc3361. Both29/30 complete exact-head quality gates passed before source/release merge; deployment must be confirmed independently. Connect-bound tokens are explicitly admitted only at the Finance read entry; the ordinary Finance mutation resolver still rejects them. No minting/relabeling of claims, financial posting or duplicated business rules.

This guided authenticated tool is not autonomous financial advice, a commercial automation, or a claim that private Finance questions over WhatsApp are already solved. Such WhatsApp requests still use the real human fallback until a separately authorized channel/entity contract exists. Positive real-account browser/Meta end-to-end QA remains pending; synthetic tests and public401 probes do not replace it.
