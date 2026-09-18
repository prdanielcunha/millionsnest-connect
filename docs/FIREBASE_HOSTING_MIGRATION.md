# Firebase Hosting migration

MillionsNest Connect is currently a client-only React/Vite application running in DEMO_MODE. Its migration target is therefore **Firebase Hosting only**. This change intentionally does not add Firebase persistence, authentication, Cloud Run, or a new backend.

## Target

- Firebase project: `millionsnest`
- Hosting target: `connect`
- Hosting site: `mn-connect-555464791734`
- Public domain after cutover: `connect.millionsnest.com`

## Safety

- Vercel remains available as a manual rollback during stabilization.
- The Zero Trust Client, Tool Gateway, tenant-boundary and confirmation policies are unchanged.
- No Gemini key or other private configuration is embedded in the Hosting bundle.
- Moving Connect out of DEMO_MODE is a separate product/backend project and is not part of this hosting migration.
