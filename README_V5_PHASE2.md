# GLP-1 Companion v5.0 — Phase 2 DEV checkpoint

This checkpoint continues the internal v5.0 migration. It is **not a production release** and should not replace the current v4.1.x GitHub Pages deployment.

## Phase 2 completed

- Removed the Tailwind Play/CDN runtime script from `index.html`.
- Added Tailwind CSS v4 as a local development dependency.
- Added `@tailwindcss/vite` to the Vite build pipeline.
- Added `src/styles.css` with the CSS-first Tailwind v4 theme equivalent of the prior runtime `tailwind.config`.
- `src/main.js` now imports the locally compiled stylesheet.
- Preserved relative GitHub Pages build paths (`base: './'`).
- Kept application behavior, Firebase logic, schema, sync, PK calculations, backups, reports, and UI markup unchanged.

## Development commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Migration status

1. Vite shell — complete
2. Tailwind local compilation — complete
3. JavaScript modules — next
4. Firebase Modular — pending
5. PWA / Service Worker migration — pending

Production remains on the stable v4.1.x line until all five phases and parity testing are complete.
