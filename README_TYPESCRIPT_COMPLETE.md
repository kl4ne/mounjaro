# GLP-1 Companion v5.0.1 — TypeScript source migration complete

This checkpoint completes the TypeScript source migration before the final
100% Vite build/deployment pass.

## What is now TypeScript

- `src/main.ts`
- Firebase modular bridge: `src/firebase/*.ts`
- PWA update manager: `src/pwa/update-manager.ts`
- Service worker source: `src/pwa/sw.ts`
- All 8 compatibility runtime domains: `src/runtime/*.ts`
- Domain contracts and global declarations: `src/types/*.ts` / `*.d.ts`
- Vite configuration: `vite.config.ts`

There are no JavaScript source files outside generated build artifacts under
`public/`.

## Strict TypeScript validation

All TypeScript configurations pass:

- `tsconfig.json` — modular application core (`strict`, `noImplicitAny`)
- `tsconfig.runtime.json` — ordered classic runtime (`strict`, `noImplicitAny`)
- `tsconfig.sw.json` — service worker (`strict`, `noImplicitAny`)
- `tsconfig.tools.json` — Vite configuration (`strict`, `noImplicitAny`)

The compatibility runtime still contains explicit `any` annotations where the
legacy global/inline-handler architecture does not yet have narrow domain types.
Those are explicit and visible; implicit `any` is disabled.

## Generated JavaScript

`public/runtime/*.js` and `public/sw.js` are generated from TypeScript. They are
kept in the source checkpoint because the current static production fallback
still consumes them. The intended final Vite workflow regenerates these before
building `dist/`.

## Build scripts

```bash
npm run typecheck
npm run build:generated
npm run build
```

`npm run build` performs full type checking, regenerates the ordered runtime and
service worker JavaScript from TypeScript, then runs the Vite production build.

## Data compatibility

This migration does not change the persisted data model:

- App version remains `v5.0.1`
- Client schema remains `13`
- Existing local/cloud persistence keys are preserved
- Firebase collection paths remain unchanged

This is a development/source checkpoint. Do not replace the current production
site with this source ZIP. The next step is the final Vite 100% build and parity
validation.
