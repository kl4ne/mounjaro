import { rm } from 'node:fs/promises';

await Promise.all([
  rm('public/runtime', { recursive: true, force: true }),
  rm('public/sw.js', { force: true }),
  rm('dist', { recursive: true, force: true })
]);

console.log('Removed generated runtime, service worker and previous dist output.');
