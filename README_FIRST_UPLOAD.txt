GLP-1 Companion v5.4.0 — AI Timeline & Progress Comparison

UPLOAD METHOD
1) This is an additive update over the stable v5.3.0 repository. No full cleanup is required unless GitHub contains stale/mixed files.
2) Upload all ZIP contents to the repository root and replace existing files.
3) Because .github may be hidden on Windows, replace .github/workflows/deploy.yml manually using the separately supplied deploy.yml.
4) Commit to main.
5) Do not consider v5.4.0 deployed until BOTH build and deploy jobs are green.

WHAT v5.4.0 ADDS
- AI Timeline built from saved AI History reports.
- Deterministic comparison between two saved reports with the same range length.
- What Changed Since My Last Check-In summary using the two latest Weekly AI Check-Ins.
- Optional bilingual AI explanation that uses only app-calculated deltas.
- Smart Cache + History for Progress Comparison reports.
- Reopen, favorite, delete, filter and print progress comparisons.
- Existing v5.3.0 Smart Cache fingerprints remain compatible to avoid wasting tokens.

TECHNICAL
App: v5.4.0
Schema: 14 (unchanged)
Minimum supported client: v5.4.0
Service worker: v5.4.0-pwa
Runtime architecture: proven 10-module layout; v5.4.0 stays inside runtime 10.
