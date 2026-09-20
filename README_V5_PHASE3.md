# GLP-1 Companion v5.0 — Phase 3 DEV

**Development checkpoint only. Do not deploy this package to the production GitHub Pages app.**

## Phase 3 objective

Move the large JavaScript runtime out of `index.html` and organize it by domain while preserving v4.1.7 behavior exactly.

## What changed

- `index.html` no longer contains the ~5,700-line application runtime.
- Firebase AI Logic was extracted into a real ES module: `src/firebase/ai-logic.js`.
- The remaining runtime is split into eight ordered domain modules under `public/runtime/`:
  1. core/platform
  2. state/sync/storage
  3. medication domain
  4. navigation/dashboard
  5. nutrition/AI UI
  6. injections/symptoms
  7. tools/reports/backups
  8. lifecycle/bootstrap
- `src/main.js` is the Vite ES-module entry point and imports local Tailwind CSS plus Firebase AI Logic.
- The domain runtime chunks intentionally remain ordered classic scripts for this checkpoint so existing inline handlers and shared lexical state keep the exact same semantics. This is a compatibility bridge, not a behavior rewrite.
- No schema, Firestore data model, calculations, UI behavior, synchronization logic, inventory logic, PK logic, backup format or security behavior was intentionally changed.

## Why the compatibility bridge is deliberate

Converting thousands of mutually dependent global functions to isolated ES-module scope in one jump would create unnecessary regression risk. Phase 3 first establishes clear file/domain boundaries. Phase 4 can then migrate Firebase dependencies against these boundaries without changing the user-facing app.

## Production status

Keep the stable v4.1.x release in production. This Phase 3 ZIP is a development checkpoint to retain until all v5 phases and parity testing are complete.
