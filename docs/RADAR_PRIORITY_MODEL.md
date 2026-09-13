# Radar Priority Model

The Relationship Intelligence Radar must rank authorized WhatsApp evidence by commercial usefulness for MusicScale without converting personal context into automatic CRM data.

Priority order:

1. **MusicScale/relevant pain** — explicit MusicScale interest, worship-team scheduling, repertoire, charts/lyrics, rehearsal, confirmations, WhatsApp organization, or repeated relevant themes.
2. **Direct relationship signal** — a direct conversation with the owner, an explicit mention of the owner's configured self name, or a conversation that already needs a manual follow-up.
3. **Pastor/leader relationship** — participants whose exported display name clearly identifies a pastoral/leadership role, when there is interaction evidence.
4. **Other pastor/leader contacts** — remaining clearly identified pastors/leaders from imported authorized sources, even when no MusicScale pain has yet appeared.

## Evidence-first gate

Commercial potential is always derived from evidence actually present in the authorized imported conversation. Generic religious language, devotional reflections, the words pastor/church/cult by themselves, message volume, or generic words such as challenge, organization, difficulty, desire, passion, system, app, test, value, price or technology do not prove MusicScale fit.

`very_high` / `high` are only valid when at least one visible evidence item independently demonstrates MusicScale domain relevance or explicit product interest. Relationship/activity may affect follow-up ordering, but never manufacture product fit.

## Cloud persistence invariant

Connect is a cloud application. User-owned Personal Sources, imported conversations, derived people, Radar signals, potential/priority, manual overrides, Composer state, follow-up state, identity resolution, message models and reprocessed metrics are canonical only after they are persisted in the owner-scoped Firestore vault. Browser/device memory and local storage are never the source of truth.

Every write-capable feature must follow these rules:

- persist to the owner-scoped cloud vault before reporting success;
- reload canonical state from the cloud after writes when the UI needs refreshed aggregates;
- preserve manual user decisions (`manualPotential`, `manualPriority`, favorite, snooze, not-relevant, sales/follow-up state) during automatic reprocessing;
- keep tenant/owner boundaries enforced by the canonical Hub context;
- never require the original device to reconstruct previously imported state;
- changes made on one device must be visible from another device after normal refresh/sign-in, without a local migration step.

## Reprocessing imported contacts

When Radar classification logic changes, existing imported contacts must be recalculated from the authorized raw message chunks already stored in the cloud. Reprocessing must update derived automatic signals, automatic potential, priority and metrics in Firestore while preserving manual overrides and relationship/commercial state. A logic upgrade is incomplete if it only affects future imports.

Guardrails:

- No automatic promotion to a commercial opportunity.
- Group exports do not fabricate reply-target attribution; WhatsApp TXT/ZIP does not reliably encode which group message a reply quoted.
- Pastor/leader detection is conservative and based only on explicit display-name role markers in the authorized export until a richer contact source is connected.
- Every surfaced signal must carry evidence from the authorized source.
- Existing owner-only vault, Hub/RBAC and tenant boundaries remain unchanged.
