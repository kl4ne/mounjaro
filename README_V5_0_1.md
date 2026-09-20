# GLP-1 Companion v5.0.1 — Infrastructure Maintenance

This maintenance release is intentionally low-risk. It keeps data schema 13 and
all v5.0.0 application behavior while hardening the development foundation.

## Included

- Version bump to v5.0.1 for a real-world v5 -> v5 auto-update test.
- PWA startup behavior remains automatic when no unsaved editing is at risk.
- TypeScript introduced incrementally in the critical bootstrap/PWA layer.
- Initial typed contracts for schema-13 application state and cloud sync metadata.
- Strict TypeScript configuration and `npm run typecheck` script.
- Vite build remains the canonical source build (`npm run build`).

## Intentionally unchanged

- CLIENT_SCHEMA_VERSION = 13
- MIN_SUPPORTED_CLIENT_VERSION = v4.1.2
- Firebase project/configuration
- Firestore paths and security model
- Inventory ledger / water events / PK / meals / symptoms / backups / reports

## Build-environment note

The current execution environment cannot resolve registry.npmjs.org, so it
cannot download the npm dependencies required to execute a fresh Vite build.
The source is prepared for Vite and TypeScript, and the TypeScript layer is
validated here with the installed TypeScript compiler. A production Vite build
must be executed in an environment with npm package access before claiming the
Vite pipeline itself has been fully proven end-to-end.
