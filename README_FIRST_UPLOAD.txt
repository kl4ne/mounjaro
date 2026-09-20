GLP-1 Companion v5.3.0 — AI History & Smart Cache FINAL QA
============================================================

BASELINE
--------
This release was rebuilt from the last known-good v5.2.0 Phase 2 CLEAN CORRECTED package.
It intentionally keeps the proven 10-runtime-module architecture. AI History & Smart Cache
is integrated into the existing runtime/10-ai-phase2 module so GitHub web uploads only need
to replace existing runtime source files instead of adding a new nested runtime module.

UPLOAD STEPS
------------
1) Extract the ZIP on your computer.
2) Upload ALL package contents to the root of the existing clean GitHub repository.
3) Do NOT recreate legacy root folders: assets/, icons/, runtime/, sw.js, manifest.webmanifest.
4) Windows may hide .github because its name begins with a dot.
5) ALWAYS replace .github/workflows/deploy.yml manually with the separate deploy.yml supplied
   with this release. This is now part of the normal release procedure.
6) In GitHub, open .github/workflows/deploy.yml and confirm these exact step names:

   Verify v5.3.0 source before install
   TypeScript strict validation
   Build and validate v5.3.0 with Vite
   Final v5.3.0 deployment guard

7) Commit to main. GitHub Actions should start automatically.
8) Do not consider v5.3.0 deployed until BOTH build and deploy jobs are green.

WHAT v5.3.0 ADDS
----------------
- AI History for Ask My Data, Weekly AI Check-In, AI Pattern Finder and Prepare My Visit.
- Bilingual history storage (Spanish + English) from the original AI response.
- Smart Cache using a deterministic data/request fingerprint.
- Reuse of an identical saved report without spending AI tokens again.
- Generate New option to intentionally bypass cache once.
- Favorites / pin behavior.
- Filters by report type, date and favorites.
- Open and delete saved reports.
- Reopen and reprint saved Prepare My Visit reports.
- Firebase synchronization through the existing app-state sync model.
- Backup/restore support for AI History.
- Schema version 14 and min client v5.3.0 to prevent older clients from overwriting history.

RELEASE ARCHITECTURE
--------------------
Source runtime modules: 10
AI History location: src/runtime/10-ai-phase2.ts
Production history code: dist/runtime/10-ai-phase2.js
Service worker: v5.3.0-pwa
App/schema: v5.3.0 / schema 14
