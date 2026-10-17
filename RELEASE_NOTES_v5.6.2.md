# GLP-1 Companion v5.6.2 — Data integrity and AI maintenance

Source baseline: v5.6.1, schema 16. Backward-compatible release (minimum client v5.5.0).

## Changes
- Gemini primary upgraded from `gemini-3.5-flash` to stable `gemini-3.8-flash`; `gemini-3.5-flash-lite` remains the automatic fallback.
- Runtime model names now use the Firebase AI bridge as their single source of truth. Existing role counters, failovers, history and Smart Cache are preserved. The status panel no longer implies that historical success proves current live availability.
- Fixed metric weekly water adherence: goal and consumption are compared in the same units (mL), as they already are in daily progress.
- Preserve activity-only days (including an explicitly saved zero) during cloud snapshot filtering and include activity in tracked-day coverage.
- Legacy backup import reconstructs water events and bowel movement event records when those older fields are missing, preserving stored totals/timestamps. Explicitly present modern arrays remain authoritative.
- Complete-package imports retain a recovery point for the state immediately before restore, even when included local backup history is imported.
- Show a user-visible, once-per-session early warning when the Firestore snapshot is approaching its existing preventive size threshold.
- Add a red-flag escalation notice to the bilingual SOS guide.
- Service worker/build/manifest version advanced together to v5.6.2 for PWA update detection.
- GitHub Actions builds and runs regression fixtures on PRs without deploying; production Pages deploy remains restricted to main.
- Added deterministic regression fixtures for metric water goals and legacy backup event reconstruction.

## Non-changes and release cautions
- No user data migration, destructive cleanup, AI History deletion, medication dose adjustment, Firestore schema upgrade, or Firebase console configuration was performed.
- Existing `index.html` UI and 10-runtime-module architecture retained; cache/history fingerprints intentionally unchanged to preserve saved reports.
- Live Gemini requests and Firebase security rules cannot be verified by static CI alone. Validate provider access/App Check and Firestore access rules separately.
- JSON backup export is not password encrypted. Do not store exported health data in public/shared locations.
- Large-history archival requires a separate design and review of Firestore rules and backup recovery; a warning does not eliminate the per-document size ceiling.
- The historical `README_FIRST_UPLOAD.txt` describes installation of v5.6.1 and is retained as historical documentation, not as v5.6.2 release instructions.

Validation: PR GitHub Actions `Build and deploy GLP-1 Companion` build job (TypeScript, Vite, generated JS, regression fixtures); Pages deployment allowed only after merge to main.
