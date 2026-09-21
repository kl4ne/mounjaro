import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const required = [
  'dist/index.html',
  'dist/assets/main.js',
  'dist/assets/app.css',
  'dist/sw.js',
  'dist/manifest.webmanifest',
  'dist/runtime/01-core-platform.js',
  'dist/runtime/02-state-sync-storage.js',
  'dist/runtime/03-medication-domain.js',
  'dist/runtime/04-navigation-dashboard.js',
  'dist/runtime/05-nutrition-ai-ui.js',
  'dist/runtime/06-injections-symptoms.js',
  'dist/runtime/07-tools-reports-backups.js',
  'dist/runtime/08-lifecycle-bootstrap.js',
  'dist/runtime/09-ai-intelligence.js',
  'dist/runtime/10-ai-phase2.js',
  'dist/icons/icon-192.png',
  'dist/icons/icon-512.png'
];

for (const path of required) {
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new Error(`Missing Vite output: ${path}`);
}

const unexpected11 = await stat('dist/runtime/11-ai-history-cache.js').catch(() => null);
if (unexpected11) throw new Error('Unexpected runtime 11 output: v5.6.1 must use the proven 10-module runtime architecture');

const html = await readFile('dist/index.html', 'utf8');
if (html.includes('/src/main.ts')) throw new Error('dist/index.html still references TypeScript source');
for (const needle of ['cdn.jsdelivr.net/npm/chart.js', 'unpkg.com/lucide', 'gstatic.com/firebasejs', 'cdn.tailwindcss.com']) {
  if (html.includes(needle)) throw new Error(`dist/index.html still depends on legacy runtime CDN: ${needle}`);
}
if (!html.includes('./assets/main.js') && !html.includes('assets/main.js')) {
  throw new Error('dist/index.html does not reference the Vite main bundle');
}
if (!html.includes('v5.6.1')) throw new Error('dist/index.html does not identify v5.6.1');
if (!html.includes('id="personal-progress-panel"')) throw new Error('dist/index.html is missing Personal Progress UI');
if (!html.includes('id="ai-history-panel"')) throw new Error('dist/index.html is missing AI History UI');
if (!html.includes('id="progress-timeline-panel"')) throw new Error('dist/index.html is missing Progress Timeline UI');
for (const marker of ['id="ai-user-actions"', 'id="ai-api-calls"', 'id="ai-cache-hits"', 'id="ai-calls-avoided"', 'id="ai-cache-efficiency"', 'id="ai-last-30-days"']) {
  if (!html.includes(marker)) throw new Error(`dist/index.html is missing AI Usage Analytics UI: ${marker}`);
}

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
if (manifest.version !== '5.6.1') throw new Error(`Unexpected manifest version: ${manifest.version}`);

const sw = await readFile('dist/sw.js', 'utf8');
if (!sw.includes("v5.6.1-pwa")) throw new Error('Service worker build ID is not v5.6.1-pwa');
if (!sw.includes('./runtime/10-ai-phase2.js')) throw new Error('Service worker does not precache runtime 10');
if (sw.includes('11-ai-history-cache')) throw new Error('Service worker still references runtime 11');

const phase2 = await readFile('dist/runtime/10-ai-phase2.js', 'utf8');
for (const marker of [
  'v5.3.0-cache1',
  'function createAiHistoryFingerprint',
  'function tryUseAiHistoryCache',
  'function saveAiHistoryReport',
  'function renderAiHistoryView',
  'function openAiHistoryRecord',
  'function forceRegenerateAiReport',
  'function renderProgressTimelineView',
  'function renderProgressComparisonPreview',
  'function explainProgressComparison',
  "tryUseAiHistoryCache('progress-comparison'",
  "tryUseAiHistoryCache('personal-progress'",
  'function renderPersonalProgressView',
  'function saveAdaptiveGoals',
  'function explainPersonalProgress'
]) {
  if (!phase2.includes(marker)) throw new Error(`Production runtime 10 is missing AI History marker: ${marker}`);
}

const phase1 = await readFile('dist/runtime/09-ai-intelligence.js', 'utf8');
for (const marker of ["tryUseAiHistoryCache('ask-data'", "tryUseAiHistoryCache('weekly-checkin'"]) {
  if (!phase1.includes(marker)) throw new Error(`Production runtime 09 is missing Smart Cache integration: ${marker}`);
}

const storage = await readFile('dist/runtime/02-state-sync-storage.js', 'utf8');
for (const marker of ['function recordAiUserAction', 'function recordAiCacheHit', 'function recordAiGenerationOutcome', 'function aggregateAiLast30Days', 'apiCallsAvoided']) {
  if (!storage.includes(marker)) throw new Error(`Production runtime 02 is missing AI Usage Analytics marker: ${marker}`);
}

const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path); else files.push(path);
  }
}
await walk('dist');
for (const marker of ['function personalCompareMetric', 'function personalDailyProgress', 'pointRadius: markerRadius']) {
  const target = marker.includes('pointRadius') ? await readFile('dist/runtime/06-injections-symptoms.js', 'utf8') : phase2;
  if (!target.includes(marker)) throw new Error(`Production corrective marker missing: ${marker}`);
}
console.log(`Verified v5.6.1 Vite dist: ${files.length} files, 10 runtime modules, corrective Personal Progress + PK markers + AI History present.`);
