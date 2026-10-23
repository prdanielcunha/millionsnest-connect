# Reviewed shared privacy dependency — 2026-10-23

Support release e0e12f87bfbebb1a298421e641cb6d91a94ff694 failed closed before serving mutation in run 39973080930/job 120480557909. No unchanged retry or relaxed gate is used.

Independently reviewed Hub source at immutable commit 8983f0024815bbeb0312dde9cd04ad42d787b341 has SHA256 f4751402d5cf9daf37c8685b2dcd4b5367ed62f91276242c5c784938634d480c, byte-identical to Hub production Rules. Compared with the previous reviewed source 5fb11db71f57550e9c32617a5da13ecf2bcfd45a, the entire Rules diff is two lines: organization catch-all create/update/delete additionally exclude trial_usage and musicscaleLiveAiUsage. This narrows browser writes to server-owned usage counters. Every Connect private-store block and existing catch-all exclusion remains unchanged. No browser/tenant grant is widened.

Protected Hub deploy run 39852181752/job 120080984327 SUCCESS records candidate cloud compiler errors=0, CONNECT_PRIVATE_STORE_RULES_CHECKS_PASSED=445 before deployment, exact CONNECT_PUBLISHED_RULES_SHA256 above, the same 445 private-store checks against downloaded published bytes and CONNECT_ACTUAL_PUBLISHED_PRIVATE_STORAGE_PROOF_OK. The failed independent Connect GET-only gate observed that same hash. This pin derives from immutable reviewed source and a protected published proof, not from trusting a live hash.

Only manifest provenance and this evidence are updated. Rules, IAM, TTL, customer data and WhatsApp configuration are untouched. Both existing exact-byte privacy gates and ACTIVE TTL checks remain mandatory in the next application release. This certifies the storage dependency only; the public contact redirect and exact serving SHA must still be verified after deployment.
