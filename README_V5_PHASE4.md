# GLP-1 Companion v5.0 — Phase 4 DEV

**Internal migration checkpoint — do not deploy to production.**

## Objective

Replace the Firebase compat SDK with the modern Firebase modular SDK while preserving the existing v4.1.7 data model, Firestore paths, App Check behavior, authentication flow, cloud synchronization semantics, backups, and UI behavior.

## Changes in Phase 4

- Added `firebase@12.19.0` as an npm dependency.
- Removed Firebase compat `<script>` tags from `index.html`.
- Added `src/firebase/platform.js` as the single modular Firebase initialization point.
- Auth now uses modular `getAuth`, `onAuthStateChanged`, `signInWithPopup`, `signInWithRedirect`, and `signOut`.
- Firestore now uses modular `getFirestore`, `doc`, `collection`, `getDoc`, `getDocs`, `onSnapshot`, `runTransaction`, and `serverTimestamp`.
- App Check now uses modular `initializeAppCheck` with `ReCaptchaEnterpriseProvider` and automatic token refresh.
- Firebase AI Logic reuses the same modular Firebase app and App Check instance instead of creating a second Firebase app.
- The Phase 3 classic runtime chunks are now loaded in order by `src/main.js` after Firebase modular initialization. This preserves the current inline-handler/global contract while the migration remains staged.
- Firestore `DocumentSnapshot.exists` calls were updated to modular `exists()` semantics.
- Startup is resilient if the ordered runtime finishes loading after `DOMContentLoaded`.

## Intentionally unchanged

- Production display version remains `v4.1.7` during the internal v5 migration.
- Schema remains `13`.
- Minimum compatible client remains `v4.1.2`.
- Firestore document paths remain `trackers/{uid}` and `trackers/{uid}/safety/{slot}`.
- No data migrations.
- No changes to medication calculations, inventory-event logic, water-event logic, backup format, reports, visual design, or Firebase Security Rules.

## Validation scope

Static validation checks confirm that the old compat namespace is no longer referenced, all known Firebase call sites route through the modular bridge, JavaScript parses successfully, inline handlers still resolve to runtime functions, and the package/manifest/ZIP structure is valid.

A full dependency-resolving Vite build requires `npm install` for the declared npm packages and is part of the final v5 build/parity validation before production deployment.
