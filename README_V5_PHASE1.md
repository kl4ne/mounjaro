# GLP-1 Companion v5.0 Migration — Phase 1

Status: **development only — do not deploy to production yet**.

Phase 1 introduces Vite as the development/build shell while preserving the v4.1.7 application behavior and data model.

## What changed
- Added Vite 8 project structure.
- Added `package.json`, `vite.config.js`, and `src/main.js` bootstrap.
- Moved PWA static files (`sw.js`, manifest, icons) into `public/` so Vite copies them to the build root.
- Set `base: './'` for GitHub Pages-compatible relative build paths.

## What intentionally did NOT change
- App behavior and UI logic.
- Firebase implementation.
- Tailwind CDN.
- Chart.js CDN.
- Lucide CDN.
- Service Worker behavior.
- Schema 13 / cloud sync model.
- APP_VERSION remains v4.1.7 inside the legacy app during this internal migration phase.

## Local commands
```bash
npm install
npm run dev
npm run build
npm run preview
```

The deployable output of a completed v5 build will eventually be `dist/`, but this Phase 1 package is not intended for production deployment.
