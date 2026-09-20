# Vite production build — GLP-1 Companion v5.0.2

The production build is generated from TypeScript source with Vite 8.

```bash
npm install
npm run typecheck
npm run build
```

`npm run build` performs strict TypeScript validation, emits the classic runtime and service worker from TypeScript, runs Vite, and validates the resulting `dist/` directory.

Production publishes **only `dist/`**.

The repository includes `.github/workflows/deploy-pages.yml` to run the complete build on GitHub-hosted runners and deploy `dist/` to GitHub Pages.
