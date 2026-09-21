GLP-1 Companion v5.6.0 — Adaptive Goals & Personal Progress

UPLOAD METHOD: CLEAN / LIMPIAR PRIMERO

This release keeps generated JavaScript out of the repository. A web overlay can leave old public/runtime/*.js and public/sw.js files behind, so clean the code files first.

1) Keep the repository itself, Pages settings and history, but remove the current code files from main.
2) Extract this ZIP and upload all of its contents to the repository root.
3) Replace .github/workflows/deploy.yml manually with the separately supplied deploy.yml because .github can be hidden on Windows.
4) Commit to main.
5) Wait for both the build and deploy jobs to turn green before considering v5.6.0 deployed.

The workflow generates public/runtime/*.js and public/sw.js from TypeScript during CI. Those generated files must not be added back to the source repository.

WHAT v5.6.0 ADDS
- TypeScript is the sole source for all 10 runtime modules and the Service Worker.
- CI rejects checked-in generated runtime JavaScript and regenerates clean output for every build.
- GitHub Actions use Node 24-compatible releases on ubuntu-24.04.
- AI Status separates user actions from real API attempts.
- Monthly Primary/Fallback attempts, successes, failures, cache hits, avoided API calls and translations.
- Primary/Fallback usage percentages and a real rolling 30-day activity summary.
- Estimated Smart Cache efficiency based on app telemetry, without inventing remaining Google quota.
- Monthly buckets preserve prior history automatically when the calendar month changes.
- User-configurable water, protein, activity and target-weight goals.
- Deterministic daily progress and current 7 days versus previous 7 days with a 4/7 coverage rule.
- Explicit symptom-record coverage, weight context and goal adherence without inventing missing data.
- Bilingual Explain My Progress reports integrated with Primary/Fallback, AI History and Smart Cache.
- Daily activity minutes sync through Firebase and survive backup/restore, including v5.5.0 backups.

TECHNICAL
App: v5.6.0
Schema: 16
Minimum supported client: v5.5.0
Service worker: v5.6.0-pwa
Runtime architecture: proven 10-module layout generated from src/runtime/*.ts.
Smart Cache fingerprint remains v5.3.0-cache1 for compatibility with existing saved reports.
