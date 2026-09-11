# Radar Priority Model

The Relationship Intelligence Radar must rank authorized WhatsApp evidence by commercial usefulness for MusicScale without converting personal context into automatic CRM data.

Priority order:

1. **MusicScale/relevant pain** — explicit MusicScale interest, worship-team scheduling, repertoire, charts/lyrics, rehearsal, confirmations, WhatsApp organization, or repeated relevant themes.
2. **Direct relationship signal** — a direct conversation with the owner, an explicit mention of the owner's configured self name, or a conversation that already needs a manual follow-up.
3. **Pastor/leader relationship** — participants whose exported display name clearly identifies a pastoral/leadership role, when there is interaction evidence.
4. **Other pastor/leader contacts** — remaining clearly identified pastors/leaders from imported authorized sources, even when no MusicScale pain has yet appeared.

Guardrails:

- No automatic promotion to a commercial opportunity.
- Group exports do not fabricate reply-target attribution; WhatsApp TXT/ZIP does not reliably encode which group message a reply quoted.
- Pastor/leader detection is conservative and based only on explicit display-name role markers in the authorized export until a richer contact source is connected.
- Every surfaced signal must carry evidence from the authorized source.
- Existing owner-only vault, Hub/RBAC and tenant boundaries remain unchanged.
