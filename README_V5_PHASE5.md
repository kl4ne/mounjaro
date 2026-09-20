# GLP-1 Companion v5.0 — Phase 5 DEV checkpoint

## Goal

Rebuild the PWA/service-worker layer while preserving the Phase 4 Firebase Modular migration, the current UI, schema 13, Firestore paths, offline data model, synchronization semantics, backups, reports, medication inventory, PK calculations, and bilingual behavior.

## What changed

- Added `src/pwa/update-manager.js` as the single owner of service-worker registration and update orchestration.
- Rebuilt `public/sw.js` with separate shell/runtime caches.
- Service-worker activation is no longer forced during `install`.
- A waiting update discovered during a fresh app launch activates automatically without showing the normal update prompt.
- If an update arrives while a modal or actively edited field could lose input, activation is deferred and the existing update banner becomes a safety fallback only.
- Deferred updates automatically activate once the UI becomes safe.
- `updateViaCache: 'none'` plus an explicit startup `registration.update()` reduces stale update checks.
- Same-origin JavaScript/CSS use network-first caching so stable `runtime/*.js` filenames cannot remain stale after a deployment.
- Navigation is network-first with an offline app-shell fallback.
- Firebase/AI/data requests are not intercepted by the service worker.
- Legacy `glp1-cache-*` and superseded v5 caches are cleaned during activation.
- Added a worker build-info message protocol for update bookkeeping.
- Added a stable PWA manifest `id`.

## Compatibility

- Application data schema remains **13**.
- Minimum compatible synchronized client remains **v4.1.2** during this internal migration checkpoint.
- The legacy-compatible application display/runtime version remains **v4.1.7** until the final v5 release is approved.
- No user data migration is introduced in Phase 5.
- No Firestore document paths or Security Rules assumptions changed.

## Phase 5 update behavior

1. Fresh launch + waiting update → activate silently, reload once, then show the success toast.
2. Active session with no unsafe editor state → activate automatically.
3. Active unsaved modal/field → defer activation and show the safety banner.
4. Once the editor state is safe → activate automatically.
5. The manual **Update now** button remains available only as a fallback.

## Files of interest

- `src/pwa/update-manager.js`
- `public/sw.js`
- `src/main.js`
- `public/runtime/01-core-platform.js`
- `public/manifest.webmanifest`

## Production status

**DEV checkpoint only. Do not deploy this Phase 5 ZIP to the production GitHub Pages site yet.**

After Phase 5, the next step is the full v5 parity/build validation across all five migration phases before creating the production `GLP1_Companion_v5.0_GitHub.zip`.
