# Radar Priority Model

The Relationship Intelligence Radar must rank authorized WhatsApp evidence by **real MusicScale relevance**, not by profession, church context, message volume, or generic relationship strength.

## Evidence gate

A person only becomes a MusicScale Radar candidate when at least one imported message contains verifiable MusicScale-domain evidence. Being a pastor, leader, active participant, known contact, or frequent sender is never sufficient by itself.

Evidence tiers:

1. **Explicit / strong** — MusicScale named directly, or product/tool language tied to a real MusicScale domain.
2. **Operational pain / intent** — concrete worship-team need such as scheduling, repertoire, charts, rehearsal, confirmations, musical key, or organization, with a pain/intention marker.
3. **Relevant topic only** — genuine worship/music context without a demonstrated pain or buying intent. This may be surfaced conservatively, but must not become `very_high` automatically.
4. **None** — devotional, pastoral, administrative, generic technology, or unrelated content. It must not create MusicScale potential.

## Ambiguity rules

Generic words are not product evidence on their own. In particular:

- `tom` only means musical key when tied to music/chart/song/worship context; `tom contemplativo`, `tom pastoral`, etc. are unrelated.
- `escala`, `presença`, `confirmação`, `disponibilidade`, `organização` and similar terms require music/worship/team context.
- `pastor`, `igreja`, `culto`, leadership titles and message volume never raise MusicScale potential by themselves.

## Relationship and leadership

Relationship, direct conversation, owner mention, and leadership role are **secondary ordering signals only after the evidence gate passed**. They can help decide whom to contact first, but cannot manufacture product fit.

## Potential

Automatic potential is recalculated from current evidence instead of trusting legacy persisted scores. Old imports that were incorrectly promoted by ambiguous text must be downgraded by the current classifier. Manual user overrides remain authoritative.

## Cloud-first persistence invariant

Connect is a cloud application. Personal Sources, imported conversations, raw message chunks, derived contacts, Radar signals, automatic potential, priority, metrics, identity resolution, manual overrides, Composer/follow-up state and message models are canonical only after they are persisted in the owner-scoped Firestore vault.

Browser memory, local storage and a specific phone/computer are never the source of truth. A successful write means the cloud write completed. Opening Connect on another authorized device must reconstruct the same current state from Firestore without a device-specific migration.

Automatic reprocessing must preserve user decisions such as manual potential, manual priority, favorite, not-relevant, snooze and commercial/follow-up state.

## Existing imported data and logic upgrades

When Radar classification logic changes, existing imported contacts must be reprocessed from the authorized raw WhatsApp message chunks already stored in Firestore. The upgrade must persist the recalculated signals, automatic potential, priority and source/contact metrics back to the cloud.

The current logic version is tracked in the owner-scoped Radar metadata. On the first Radar read after a new logic version is deployed, stale cloud data is reprocessed and persisted before the Radar response is returned. Subsequent devices/reads use the cloud version marker and do not repeat the migration.

A manual cloud reprocess endpoint may be used for recovery or verification, but normal use must not depend on the original import device.

## Required regression examples

- `Me permita uma breve reflexão em tom contemplativo` → no MusicScale evidence.
- `Nosso maior desafio é vencer nossas paixões carnais` → no MusicScale evidence.
- `Qual tom da música de domingo?` → relevant MusicScale topic.
- `A escala do louvor está confusa e ninguém confirma` → strong operational pain.
- `Quanto custa o MusicScale?` → explicit product interest.

## Guardrails

- No automatic promotion to a commercial opportunity.
- Group exports do not fabricate reply-target attribution.
- Every surfaced product signal carries evidence from the authorized source.
- No lead score without explainable evidence.
- Existing owner-only vault, Hub/RBAC, multi-tenant and privacy boundaries remain unchanged.
