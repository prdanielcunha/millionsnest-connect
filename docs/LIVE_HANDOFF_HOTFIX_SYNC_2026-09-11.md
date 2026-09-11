# Live handoff hotfix sync

Targeted back-sync of the certified production live handoff bootstrap safeguards into `main`.

Scope:
- accept a successful Firebase custom-token exchange when `idToken` is present and `localId` is omitted;
- continue failing closed when an explicit `localId` conflicts with the handoff UID;
- preserve canonical Hub UID + tenant verification immediately after exchange;
- preserve safe canonical session error codes;
- regression tests only.

No RBAC, tenant authority, billing, Radar, Tool Gateway, or production behavior changes are introduced by this back-sync.
