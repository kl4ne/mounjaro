import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const required = [
  'dist/index.html',
  'dist/assets/main.js',
  'dist/assets/app.css',
  'dist/sw.js',
  'dist/manifest.webmanifest',
  'dist/runtime/01-core-platform.js',
  'dist/runtime/08-lifecycle-bootstrap.js',
  'dist/icons/icon-192.png',
  'dist/icons/icon-512.png'
];

for (const path of required) {
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new Error(`Missing Vite output: ${path}`);
}

const html = await readFile('dist/index.html', 'utf8');
if (html.includes('/src/main.ts')) throw new Error('dist/index.html still references TypeScript source');
if (html.includes('cdn.jsdelivr.net/npm/chart.js') || html.includes('unpkg.com/lucide') || html.includes('gstatic.com/firebasejs') || html.includes('cdn.tailwindcss.com')) {
  throw new Error('dist/index.html still depends on a legacy runtime CDN');
}
if (!html.includes('./assets/main.js') && !html.includes('assets/main.js')) {
  throw new Error('dist/index.html does not reference the Vite main bundle');
}

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
if (manifest.version !== '5.0.2') throw new Error(`Unexpected manifest version: ${manifest.version}`);

const sw = await readFile('dist/sw.js', 'utf8');
if (!sw.includes("v5.0.2-pwa")) throw new Error('Service worker build ID is not v5.0.2-pwa');

const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path); else files.push(path);
  }
}
await walk('dist');
console.log(`Verified Vite dist: ${files.length} files`);
