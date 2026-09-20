# GLP-1 Companion v5.0.2 — Vite production pipeline

This source release closes the v5 infrastructure migration:

- TypeScript source is fully migrated and strict-checked.
- Vite 8 is the production builder.
- Tailwind CSS v4 is compiled by Vite.
- Firebase Modular is bundled by Vite.
- Chart.js 4.5.1 and Lucide 1.46.0 are npm dependencies bundled locally; the production HTML no longer needs those CDNs.
- Runtime and service-worker JavaScript are generated from TypeScript before Vite builds `dist/`.
- GitHub Actions installs dependencies, typechecks, builds, verifies `dist/`, and deploys only `dist/` to GitHub Pages.
- The first remote build uploads the generated `package-lock.json` as an artifact so it can be committed afterward for fully locked transitive dependencies.

## Production path

`TypeScript source -> npm install -> npm run typecheck -> npm run build -> dist/ -> GitHub Pages`

## Important

This source package must be committed as source. GitHub Pages should be switched from **Deploy from a branch** to **GitHub Actions** before using the workflow for production deployment.
