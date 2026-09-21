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
  'src/runtime/01-core-platform.ts',
  'src/runtime/02-state-sync-storage.ts',
  'src/runtime/07-tools-reports-backups.ts',
  'src/runtime/09-ai-intelligence.ts',
  'src/runtime/10-ai-phase2.ts',
  'src/runtime/runtime-globals.d.ts',
  'src/types/domain.ts',
  'public/manifest.webmanifest',
  'scripts/verify-dist.mjs'
  ,'scripts/verify-yaml.mjs'
  ,'scripts/verify-v561-fixtures.mjs'
  ,'scripts/verify-generated-js.mjs'
];

for (const rel of required) {
  const info = await stat(join(root, rel)).catch(() => null);
  if (!info?.isFile()) throw new Error(`Missing source file: ${rel}`);
}

// v5.6.1 keeps the proven 10-runtime architecture while making TypeScript the only runtime source.
// AI History & Smart Cache lives in runtime/10 so web uploads only replace an
// existing file instead of depending on a brand-new nested runtime file.
for (const forbidden of [
  'src/runtime/11-ai-history-cache.ts',
  'public/runtime',
  'public/sw.js'
]) {
  const info = await stat(join(root, forbidden)).catch(() => null);
  if (info) throw new Error(`Unexpected experimental runtime file remains: ${forbidden}`);
}

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (pkg.version !== '5.6.1') throw new Error(`Unexpected package version: ${pkg.version}`);
if (pkg.scripts?.['build:runtime'] !== 'tsc -p tsconfig.runtime.emit.json') {
  throw new Error(`Unexpected runtime build command: ${pkg.scripts?.['build:runtime']}`);
}
for (const dep of ['firebase', 'chart.js', 'lucide']) {
  if (!pkg.dependencies?.[dep]) throw new Error(`Missing production dependency: ${dep}`);
}
for (const dep of ['vite', 'typescript', 'tailwindcss', '@tailwindcss/vite']) {
  if (!pkg.devDependencies?.[dep]) throw new Error(`Missing build dependency: ${dep}`);
}

const manifest = JSON.parse(await readFile(join(root, 'public/manifest.webmanifest'), 'utf8'));
if (manifest.version !== '5.6.1') throw new Error(`Unexpected manifest version: ${manifest.version}`);

const html = await readFile(join(root, 'index.html'), 'utf8');
if (!html.includes('src="/src/main.ts"')) throw new Error('index.html is not using the Vite TypeScript entry');
for (const needle of [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net/npm/chart.js',
  'unpkg.com/lucide',
  'gstatic.com/firebasejs'
]) {
  if (html.includes(needle)) throw new Error(`Legacy CDN reference remains in index.html: ${needle}`);
}
for (const marker of [
  'id="pattern-ai-title"',
  'id="visit-ai-title"',
  'onclick="findAiPatterns()"',
  'onclick="prepareMyVisit()"',
  'onclick="printVisitPrepReport()"',
  'id="ai-history-panel"',
  'id="progress-timeline-panel"',
  'id="progress-compare-newer"',
  'id="progress-compare-older"',
  'onclick="explainProgressComparison()"',
  'id="ai-history-list"',
  'onclick="scrollToAiHistory()"',
  "forceRegenerateAiReport('ask-data')",
  "forceRegenerateAiReport('weekly-checkin')",
  "forceRegenerateAiReport('pattern-finder')",
  "forceRegenerateAiReport('visit-prep')",
  'id="personal-progress-panel"',
  'onclick="saveAdaptiveGoals()"',
  'onclick="saveTodayActivity()"',
  'onclick="explainPersonalProgress()"',
  "forceRegenerateAiReport('personal-progress')",
  'v5.6.1 · Progressive Web App',
  'id="personal-periods"',
  'id="personal-this-week-grid"',
  'id="maintenance-explanation"',
  'id="ai-user-actions"',
  'id="ai-api-calls"',
  'id="ai-cache-efficiency"',
  'id="ai-last-30-days"'
]) {
  if (!html.includes(marker)) throw new Error(`Missing v5.6.1 UI marker: ${marker}`);
}

const core = await readFile(join(root, 'src/runtime/01-core-platform.ts'), 'utf8');
for (const marker of [
  'const APP_VERSION = "v5.6.1"',
  'const CLIENT_SCHEMA_VERSION = 16',
  'const MIN_SUPPORTED_CLIENT_VERSION = "v5.5.0"'
]) {
  if (!core.includes(marker)) throw new Error(`Missing v5.6.1 core marker: ${marker}`);
}

const stateStorage = await readFile(join(root, 'src/runtime/02-state-sync-storage.ts'), 'utf8');
for (const marker of [
  'aiHistory: []',
  'function sanitizeAiHistory',
  'function mergeAiHistory',
  'state.aiHistory = mergeAiHistory',
  'function recordAiUserAction',
  'function recordAiCacheHit',
  'function recordAiGenerationOutcome',
  'function aggregateAiLast30Days',
  'apiCallsAvoided'
]) {
  if (!stateStorage.includes(marker)) throw new Error(`Missing AI history persistence marker: ${marker}`);
}

const backups = await readFile(join(root, 'src/runtime/07-tools-reports-backups.ts'), 'utf8');
if (!backups.includes("['injections', 'weights', 'measurements', 'aiHistory']")) {
  throw new Error('Backup validation does not include aiHistory');
}
if (!backups.includes('next.aiHistory = sanitizeAiHistory(imported.aiHistory)')) {
  throw new Error('Backup restore does not restore aiHistory');
}

const aiRuntime = await readFile(join(root, 'src/runtime/09-ai-intelligence.ts'), 'utf8');
for (const marker of [
  "tryUseAiHistoryCache('ask-data'",
  "saveAiHistoryReport({\n            type: 'ask-data'",
  "tryUseAiHistoryCache('weekly-checkin'",
  "type: 'weekly-checkin'"
]) {
  if (!aiRuntime.includes(marker)) throw new Error(`Missing Phase 1 history integration: ${marker}`);
}

const phase2Runtime = await readFile(join(root, 'src/runtime/10-ai-phase2.ts'), 'utf8');
for (const fn of [
  'findAiPatterns',
  'prepareMyVisit',
  'printVisitPrepReport',
  'renderAiPhase2View',
  'createAiHistoryFingerprint',
  'tryUseAiHistoryCache',
  'saveAiHistoryReport',
  'renderAiHistoryView',
  'openAiHistoryRecord',
  'toggleAiHistoryFavorite',
  'deleteAiHistoryRecord',
  'forceRegenerateAiReport',
  'clearAiHistoryDateFilter',
  'renderProgressTimelineView',
  'renderProgressComparisonPreview',
  'explainProgressComparison',
  'printProgressComparison',
  'renderPersonalProgressView',
  'saveAdaptiveGoals',
  'saveTodayActivity',
  'explainPersonalProgress'
]) {
  if (!phase2Runtime.includes(`function ${fn}`) && !phase2Runtime.includes(`async function ${fn}`)) {
    throw new Error(`Missing v5.6.1 runtime function in module 10: ${fn}`);
  }
}
for (const marker of [
  "const AI_HISTORY_CACHE_VERSION = 'v5.3.0-cache1'",
  "tryUseAiHistoryCache('pattern-finder'",
  "tryUseAiHistoryCache('visit-prep'",
  "tryUseAiHistoryCache('progress-comparison'",
  "tryUseAiHistoryCache('personal-progress'"
]) {
  if (!phase2Runtime.includes(marker)) throw new Error(`Missing Smart Cache integration: ${marker}`);
}

const globals = await readFile(join(root, 'src/runtime/runtime-globals.d.ts'), 'utf8');
for (const marker of [
  "type RuntimeAiReportType = 'ask-data' | 'weekly-checkin' | 'pattern-finder' | 'visit-prep'",
  'interface RuntimeAiHistoryRecord',
  'aiHistory: RuntimeAiHistoryRecord[]'
]) {
  if (!globals.includes(marker)) throw new Error(`Missing AI history type declaration: ${marker}`);
}


const stateHistory = await readFile(join(root, 'src/runtime/02-state-sync-storage.ts'), 'utf8');
if (!stateHistory.includes("'progress-comparison'")) throw new Error('AI history sanitizer does not allow progress-comparison');
const globalTypes = await readFile(join(root, 'src/runtime/runtime-globals.d.ts'), 'utf8');
if (!globalTypes.includes("'progress-comparison'")) throw new Error('Runtime AI history type union is missing progress-comparison');

const aiLogic = await readFile(join(root, 'src/firebase/ai-logic.ts'), 'utf8');
for (const bridge of ['firebaseAiPatternFinder', 'firebaseAiPrepareVisit', 'firebaseAiProgressComparison', 'firebaseAiPersonalProgress']) {
  if (!aiLogic.includes(bridge)) throw new Error(`Missing Firebase AI bridge: ${bridge}`);
}

const main = await readFile(join(root, 'src/main.ts'), 'utf8');
if (!main.includes("'./runtime/10-ai-phase2.js'")) throw new Error('main.ts does not load runtime 10');
if (main.includes('11-ai-history-cache')) throw new Error('main.ts still references experimental runtime 11');

const sw = await readFile(join(root, 'src/pwa/sw.ts'), 'utf8');
if (!sw.includes("v5.6.1-pwa")) throw new Error('Service worker source build ID is not v5.6.1-pwa');
if (!sw.includes("./runtime/10-ai-phase2.js")) throw new Error('Service worker does not precache runtime 10');
if (sw.includes('11-ai-history-cache')) throw new Error('Service worker still references experimental runtime 11');

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

const runtimeFiles = srcFiles.filter((p) => /src[\\/]runtime[\\/](?!.*\.d\.ts$).*\.ts$/.test(p));
if (runtimeFiles.length !== 10) throw new Error(`Expected proven 10-module runtime architecture, found ${runtimeFiles.length}`);


// HTML integrity: duplicate IDs or missing inline handlers can make the UI look
// healthy while buttons silently fail. Check both before any dependency install.
const htmlIds = Array.from(html.matchAll(/\bid="([^"]+)"/g), (m) => m[1]);
const idCounts = new Map();
for (const id of htmlIds) idCounts.set(id, (idCounts.get(id) || 0) + 1);
const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
if (duplicateIds.length) throw new Error(`Duplicate HTML IDs: ${duplicateIds.join(', ')}`);

const runtimeSource = (await Promise.all(runtimeFiles.map((file) => readFile(file, 'utf8')))).join('\n');
const inlineHandlerAttrs = Array.from(html.matchAll(/\bon(?:click|change|input|submit)="([^"]+)"/g), (m) => m[1]);
const inlineHandlers = new Set();
for (const attr of inlineHandlerAttrs) {
  for (const match of attr.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) inlineHandlers.add(match[1]);
}
for (const ignored of ['if', 'confirm', 'Number', 'String', 'parseInt', 'parseFloat', 'setTimeout', 'stopPropagation']) inlineHandlers.delete(ignored);
const missingHandlers = [...inlineHandlers].filter((name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !(new RegExp(`\\b(?:async\\s+)?function\\s+${escaped}\\b`).test(runtimeSource) || new RegExp(`\\b${escaped}\\s*=`).test(runtimeSource));
});
if (missingHandlers.length) throw new Error(`Inline HTML handlers missing from runtime source: ${missingHandlers.join(', ')}`);

for (const marker of ['function personalCompareMetric', 'missingDays:', 'percentageChange:', 'previousStartDate:', 'currentPeriodWeight', 'symptomMissingDays']) {
  if (!phase2Runtime.includes(marker)) throw new Error(`Missing v5.6.1 compliance calculation marker: ${marker}`);
}
const pkRuntime = await readFile(join(root, 'src/runtime/06-injections-symptoms.ts'), 'utf8');
for (const marker of ['pointRadius: markerRadius', 'pointHitRadius: 12', 'pkSelectedPointIndex']) {
  if (!pkRuntime.includes(marker) && !stateStorage.includes(marker)) throw new Error(`Missing persistent PK marker behavior: ${marker}`);
}
console.log(`Verified v5.6.1 source: ${srcFiles.length} src files, ${runtimeFiles.length} TypeScript runtime modules, no generated JavaScript checked in, corrective compliance markers present, no duplicate IDs, all inline handlers resolved.`);
