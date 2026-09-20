GLP-1 Companion v5.2.0 — AI Phase 2 CLEAN
===========================================

THIS PACKAGE UPDATES THE CLEAN VITE + TYPESCRIPT REPOSITORY THAT ALREADY RAN GREEN IN PHASE 1.

PHASE 2 ADDS
------------
- AI Pattern Finder.
- App-calculated association candidates before AI explanation.
- Dose-window vs symptom comparison when enough records exist.
- Logged hydration/protein vs symptom-day comparisons when enough records exist.
- Weight trend evidence.
- Prepare My Visit.
- 7 / 30 / 60 / 90 day visit ranges.
- Bilingual Spanish + English visit summary.
- Neutral topics to discuss with a healthcare professional.
- Data-gap / coverage reporting.
- Printable bilingual Letter-size visit report.
- No schema change: schema remains 13.
- Visible app version is v5.2.0.
- PWA build ID is v5.2.0-pwa so existing v5.1.0 installations detect the update.

EXPECTED ROOT FOLDERS — EXACTLY THESE 4
---------------------------------------
  .github/
  public/
  scripts/
  src/

UPLOAD
------
1. Extract this ZIP on your computer.
2. Upload ALL extracted contents to the ROOT of the existing clean GitHub repository.
3. Do NOT upload the ZIP itself.
4. IMPORTANT: .github starts with a dot and may appear hidden on Windows.
   After uploading, verify in GitHub Code that this exact file exists:
      .github/workflows/deploy.yml
5. If .github was skipped by your computer/browser, create the path directly in GitHub
   and use the standalone deploy.yml delivered with this package.
6. Commit to main.
7. The push to main must start:
      Actions > Build and deploy GLP-1 Companion
8. Do not consider the phase deployed until Actions is GREEN.

DO NOT REINTRODUCE LEGACY ROOT PATHS
------------------------------------
  assets/
  icons/
  runtime/
  sw.js
  manifest.webmanifest
  dist/
  node_modules/
  .github/workflows/deploy-pages.yml

GITHUB ACTIONS GATE
-------------------
The workflow refuses to deploy if the repository contains the legacy root structure.
It also requires:
- package version 5.2.0
- 10 TypeScript runtime modules
- runtime/09-ai-intelligence.js
- runtime/10-ai-phase2.js
- service worker build ID v5.2.0-pwa
- manifest version 5.2.0
- TypeScript validation
- Vite production build
- dist verification before GitHub Pages deployment

TEST AFTER GREEN DEPLOY
-----------------------
1. Open the app normally and confirm v5.2.0.
2. Open AI & Insights.
3. Confirm Ask My Data and Weekly AI Check-In still work (Phase 1 regression check).
4. Run AI Pattern Finder with 30 days.
5. Change Pattern Finder to 60/90 days and confirm the local coverage preview updates.
6. Run Prepare My Visit with 30 days.
7. Change language and confirm the Phase 2 cards render in the selected language.
8. Open the bilingual print report from Prepare My Visit.
9. Test on PC and iPhone/PWA.

SAFETY / PRIVACY
----------------
- AI receives minimized structured tracking context, not name, email or Firebase UID.
- The app calculates numeric evidence first; AI explains the supplied evidence.
- Pattern Finder describes associations only and does not claim causation.
- Prepare My Visit organizes records and discussion topics; it does not diagnose or recommend treatment/dose changes.
