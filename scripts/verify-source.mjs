import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'index.html',
  'package.json',
  'vite.config.ts',
  'src/main.ts',
  'src/styles.css',
  'src/firebase/platform.ts',
  'src/firebase/ai-logic.ts',
  'src/pwa/update-manager.ts',
  'src/pwa/sw.ts',
  'src/runtime/09-ai-intelligence.ts',
  'public/manifest.webmanifest',
  'scripts/verify-dist.mjs'
];

for (const rel of required) {
  const info = await stat(join(root, rel)).catch(() => null);
  if (!info?.isFile()) throw new Error(`Missing source file: ${rel}`);
}

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (pkg.version !== '5.1.0') throw new Error(`Unexpected package version: ${pkg.version}`);
for (const dep of ['firebase', 'chart.js', 'lucide']) {
  if (!pkg.dependencies?.[dep]) throw new Error(`Missing production dependency: ${dep}`);
}
for (const dep of ['vite', 'typescript', 'tailwindcss', '@tailwindcss/vite']) {
  if (!pkg.devDependencies?.[dep]) throw new Error(`Missing build dependency: ${dep}`);
}

const html = await readFile(join(root, 'index.html'), 'utf8');
if (!html.includes('src="/src/main.ts"')) throw new Error('index.html is not using the Vite TypeScript entry');
const forbiddenHtml = [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net/npm/chart.js',
  'unpkg.com/lucide',
  'gstatic.com/firebasejs'
];
for (const needle of forbiddenHtml) {
  if (html.includes(needle)) throw new Error(`Legacy CDN reference remains in index.html: ${needle}`);
}

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const srcFiles = await walk(join(root, 'src'));
const jsSource = srcFiles.filter((p) => /\.(?:js|jsx|mjs|cjs)$/.test(p));
if (jsSource.length) throw new Error(`JavaScript source remains under src/: ${jsSource.join(', ')}`);

const runtimeFiles = srcFiles.filter((p) => /src\/runtime\/(?!.*\.d\.ts$).*\.ts$/.test(p));
if (runtimeFiles.length !== 9) throw new Error(`Expected 9 TypeScript runtime modules, found ${runtimeFiles.length}`);

const sw = await readFile(join(root, 'src/pwa/sw.ts'), 'utf8');
if (!sw.includes("v5.1.0-pwa")) throw new Error('Service worker source build ID is not v5.1.0-pwa');

console.log(`Verified Vite source: ${srcFiles.length} src files, ${runtimeFiles.length} runtime modules, no legacy runtime CDNs.`);
