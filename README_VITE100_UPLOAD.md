# GLP-1 Companion v5.0.2 — Vite 100% deployment checkpoint

This repository source is prepared for the first real Vite production build on GitHub-hosted runners.

## What this changes

- Production is built from TypeScript source with Vite 8.
- Tailwind CSS is compiled locally by Vite.
- Firebase Modular, Chart.js, and Lucide are installed through npm and bundled by Vite.
- GitHub Pages deploys only the generated `dist/` directory.
- The TypeScript-generated classic runtime and service worker are rebuilt before each Vite build.
- Source and final `dist/` both have automated validation steps.

## First deployment

1. Keep a copy of the current v5.0.1 production ZIP.
2. **Before uploading the source**, go to GitHub: Settings -> Pages -> Build and deployment -> Source -> **GitHub Actions**. This prevents GitHub Pages from ever serving the raw TypeScript source from `main`.
3. Upload this source tree to the repository `main` branch and commit it.
4. Open the Actions tab. The workflow **Build and deploy GLP-1 Companion** should start automatically; if needed, use **Run workflow**.
5. The build must pass: install -> source verification -> strict TypeScript -> generated runtime/SW -> Vite build -> dist verification -> Pages deployment.
6. After success, open the PWA on one device and confirm v5.0.2, sync, and auto-update.

The workflow also uploads the first generated `package-lock.json` as an artifact. After the first successful run, commit that lockfile so later builds can switch from `npm install` to `npm ci` for fully locked transitive dependencies.
