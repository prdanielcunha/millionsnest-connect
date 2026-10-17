# Connect privacy dependency review — 2026-10-17

The protected Connect release [39076026787](https://github.com/prdanielcunha/millionsnest-connect/actions/runs/39076026787) correctly rejected the changed shared Rules before image publication, Cloud Run traffic or Hosting mutation. Runtime remains the preceding serving release until a subsequent verified deployment. Do not retry that unchanged rejected SHA or restore the old shared Rules.

## Independent source and published-byte evidence

- Previous reviewed Hub source `fadb04ce60d4835fec099968723718f35f870d22`: `firestore.rules` SHA256 `277e117297a140c0d621286962efbd8552b10567571c5174e9601c3ba6f80ae5`.
- Current canonical Hub production source `831f0fc4c9ec0965f96e881a27a9b99cfe57a554`: local exact source SHA256 `03107a9367c9bb268ba39e13ad88a92092d1bd9bb6fcd59f0c7c680f1fe2f149`.
- Diff between these exact sources:103 additions,0 removals, all inside the existing NestJourney product boundary. Additions concern org-scoped rollout settings and staff team-interest intake. No Connect private store, automation outbox, device, consent, channel grant, membership, catch-all exclusion or financial Rules were changed by that diff.
- Hub [39069954671](https://github.com/prdanielcunha/millionsnest/actions/runs/39069954671), job117505317883, SUCCESS: cloud compiler comparison;445 Connect private-store assertions before publication; exact published/source SHA equality;445 assertions against the actual downloaded published Rules; `CONNECT_ACTUAL_PUBLISHED_PRIVATE_STORAGE_PROOF_OK`. Journey, MusicScale, medley, band and Affiliate boundary steps also passed.
- Connect's rejected release independently read the same live SHA `03107a…` and stopped with `ROUTING_PUBLISHED_PRIVACY_PROOF_CHANGED`. No secret, raw runtime configuration or customer record was required for this review.

## Decision and limits

Update only Connect's reviewed exact-byte dependency pin to that independently checked, already published Hub source. Keep GET-only fixed-project metadata reads, ruleset-reference validation, one-file SHA equality, strict rejection on future drift and ACTIVE TTL requirements. Internal automation imports this same gate; there is no second pin to bypass it.

The Firebase Security Rules Auditor checklist was applied to the affected Connect boundary: authority still comes from canonical server-side access; tenant checks, deny-by-default private collections and ownership exclusions remain unchanged. The existing445-assertion published-byte proof covers the private-store boundary. This is a bounded Connect privacy dependency review, not an unrestricted certification of new Journey product features. In particular, team-interest update schema validation is less complete than creation validation (type/length bounds); that is outside the Connect private-store decision and must not be represented as a grant of contact consent, membership or source activation.

No Firebase Rules, indexes, TTL configuration, IAM, identity, data, entitlement, recipient mapping, provider configuration or feature flag is modified by this Connect change. A later protected release must still re-read the live Rules and all required TTL states before any serving mutation. #226 remains OPEN.
