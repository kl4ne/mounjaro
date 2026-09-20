GLP-1 Companion v5.2.0 — AI Phase 2 CLEAN
==========================================

IMPORTANT: This package is for the CLEAN Vite/TypeScript repository structure.

1) Extract the ZIP on your computer.
2) Upload ALL package contents to the root of the existing clean GitHub repository.
3) Windows may hide the .github folder because its name begins with a dot.
4) After upload, verify in GitHub Code that this exact file exists and was updated:

   .github/workflows/deploy.yml

5) Open that file in GitHub and confirm the workflow step names say:

   Verify v5.2.0 source before install
   Build and validate v5.2.0 with Vite
   Final v5.2.0 deployment guard

   If GitHub still shows v5.1.0 in those step names, the hidden .github folder did NOT update.
   In that case, replace .github/workflows/deploy.yml manually with the separate deploy.yml supplied with this release.

6) Commit to main. GitHub Actions should start automatically.
7) Do not consider the release deployed until both build and deploy jobs are green.

DO NOT recreate legacy root folders:
assets/
icons/
runtime/
sw.js
manifest.webmanifest

Those are generated into dist during the Vite build and are not source-root folders anymore.
