# Reviewed shared privacy dependency — 2026-10-21

The pending natural-question release c901b5713c93f51c51ea62ec7eca2d85e4b2fe73 failed closed before any serving mutation in run39608587110/job119251161416. Its current approved Rules pin was older than the canonical Hub Rules. No retry of the unchanged build or relaxation of the gate is appropriate.

## Independently reviewed source and protected published proof

Canonical Hub commit5fb11db71f57550e9c32617a5da13ecf2bcfd45a published exact Rules SHA2565372febb59a285e40a567d6caaf5b35ac9ed97f23646e0ffe93959a6bf55f8cd via protected run39324830021/job118307818773 SUCCESS. The source at that immutable commit is byte-identical to current Hub production Rules. The job records CONNECT_PRIVATE_STORE_RULES_CHECKS_PASSED=445 both before publication and against downloaded actual published bytes, CONNECT_PUBLISHED_RULES_SHA256 with the exact hash above, and CONNECT_ACTUAL_PUBLISHED_PRIVATE_STORAGE_PROOF_OK. The independent failed Connect GET-only gate sees that same published hash.

The source diff from the previous d91b2d1d513a7a25a7f97b8d4b8238d6c95b24c1 review preserves all Connect private-store blocks and their catch-all exclusions. User-profile protected authority fields are extended; root-profile deletion is restricted and the recursive user-subcollection wildcard no longer overlaps the root. Membership writes/legacy mirrors become server-only, permission-audit writes are restricted, and the generic organization catch-all excludes members/audit writes and peopleDirectory namespaces. Journey adds its scoped birthday collection, server-mediated people creation and immutable centralPersonId, with localized expression-budget changes. No Connect browser storage access, grant/secret/device access or tenant privilege is widened by these changes. Journey/authority/Finance/MusicScale/Affiliate rule checks also passed in the canonical release.

This updates only Connect's reviewed manifest provenance; it does not write Rules, IAM, TTL, customer data or provider configuration. Both exact-byte published privacy gates and all ACTIVE TTL requirements remain unchanged and must pass in the actual new application release. The accompanying imperative-presence recognition fix is a real application increment: “Confirme minha presença” is clarified as an unsupported write rather than silently treated as an attendance read.

This proves the shared privacy dependency, not actual WhatsApp delivery or general LLM interpretation. Actual serving SHA and protected release result must be checked separately.
