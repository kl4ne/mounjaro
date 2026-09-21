import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const phase2 = await readFile('public/runtime/10-ai-phase2.js', 'utf8');
const state = {
  settings: { units: 'imperial', waterGoal: 80, proteinGoal: 100, activityGoalMinutes: 30, goalWeight: 175, waterGoalConfigured: true, proteinGoalConfigured: true, activityGoalConfigured: true, weightGoalConfigured: true, language: 'en' },
  daysData: {}, weights: [], aiHistory: []
};
const cacheTelemetry = { actions: 0, hits: 0 };
const context = vm.createContext({
  console, state, window: {}, document: { getElementById: () => null, activeElement: null }, navigator: { onLine: true },
  crypto: globalThis.crypto, performance, setTimeout, requestAnimationFrame: (fn) => fn(),
  getFormattedDate: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  displayWater: (v) => Number(v), displayWeight: (v) => Number(v), storageWater: (v) => Number(v), storageWeight: (v) => Number(v),
  ensureGranularDayData: (_key, day) => day, stableStringify: (v) => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort().reduce((out, key) => { out[key] = value[key]; return out; }, {}) : value),
  uiText: (es, en) => en, isEnglish: () => true, escapeHtml: (v) => String(v), lucide: { createIcons() {} },
  mutationNow: () => 1, persistState() {}, renderAiStatus() {}, showToast() {}, markSettingsChanged() {}, ensureV4State() {},
  recordAiUserAction: () => cacheTelemetry.actions++, recordAiCacheHit: () => cacheTelemetry.hits++,
  waterUnit: () => 'oz', weightUnit: () => 'lb'
});
vm.runInContext(`${phase2}\nglobalThis.__p={personalDateKeys,personalWeek,personalCompareMetric,personalDailyProgress,buildPersonalProgressContext,createAiHistoryFingerprint,buildAiHistorySnapshot,consumeAiHistoryForce,tryUseAiHistoryCache,AI_HISTORY_FORCE_ONCE};`, context);
const p = context.__p;

const day = ({ water = 0, protein = 0, activity = 0, waterLogged = false, proteinLogged = false, activityLogged = false, symptomsLogged = false, symptom = 'none' } = {}) => ({
  water, waterUpdatedAt: waterLogged ? 1 : 0, waterEvents: waterLogged ? [{ id: 'w', delta: water, updatedAt: 1 }] : [],
  activityMinutes: activity, activityUpdatedAt: activityLogged ? 1 : 0,
  meals: proteinLogged ? [{ protein }] : [], symptoms: { nausea: symptom, fatigue: 'none', heartburn: 'none', sulfur: 'none' }, symptomsUpdatedAt: symptomsLogged ? 1 : 0,
  electrolytes: {}, electrolytesUpdatedAt: 0, bowelMovements: [], bowelMovementRecords: [], bowelMovementsUpdatedAt: 0
});
const keys = Array.from({ length: 7 }, (_, i) => `2026-01-0${i + 1}`);
for (const count of [0, 1, 3, 4, 7]) {
  state.daysData = {};
  keys.slice(0, count).forEach((key) => { state.daysData[key] = day({ water: 80, protein: 100, activity: 30, waterLogged: true, proteinLogged: true, activityLogged: true }); });
  const week = p.personalWeek(keys);
  assert.equal(week.metrics[0].loggedDays, count, `${count}/7 logged days`);
  assert.equal(week.metrics[0].missingDays, 7 - count, `${count}/7 missing semantics`);
  assert.equal(week.metrics[0].reliable, count >= 4, `${count}/7 threshold`);
}

assert.equal(p.personalDailyProgress(50, null, true).percentage, null, 'missing goal has no percentage');
assert.deepEqual({ ...p.personalDailyProgress(80, 80, true) }, { current: 80, goal: 80, logged: true, percentage: 100, remaining: 0, reached: true }, 'exact goal reached');
assert.equal(p.personalDailyProgress(100, 80, true).remaining, 0, 'goal exceeded never produces negative remaining');
assert.equal(p.personalDailyProgress(100, 80, true).percentage, 125, 'goal exceeded percentage');

const metric = (average, loggedDays = 7) => ({ key: 'water', goal: 80, unit: 'oz', loggedDays, missingDays: 7 - loggedDays, achievedDays: loggedDays, average, adherencePct: 100, reliable: loggedDays >= 4 });
assert.equal(p.personalCompareMetric(metric(110), metric(100)).percentageChange, 10, 'valid percentage change');
assert.equal(p.personalCompareMetric(metric(10), metric(0)).percentageChange, null, 'zero denominator');
assert.equal(p.personalCompareMetric(metric(10), metric(null)).percentageChange, null, 'missing previous average');
assert.equal(p.personalCompareMetric(metric(10, 3), metric(8, 7)).limitation, 'current', 'one period insufficient');
assert.equal(p.personalCompareMetric(metric(10, 3), metric(8, 1)).limitation, 'both', 'both periods insufficient');

const currentKeys = p.personalDateKeys(0), previousKeys = p.personalDateKeys(7);
state.daysData = {};
[...currentKeys, ...previousKeys].forEach((key, index) => { state.daysData[key] = day({ water: index < 7 ? 90 : 80, protein: 100, activity: 30, waterLogged: true, proteinLogged: true, activityLogged: true, symptomsLogged: true, symptom: index % 2 ? 'mild' : 'none' }); });
state.weights = [{ date: previousKeys[6], weight: 180 }, { date: currentKeys[6], weight: 178 }];
let built = p.buildPersonalProgressContext();
assert.equal(built.weight.difference, -2, 'weight in both periods');
assert.equal(built.weight.direction, 'decreased');
assert.equal(built.symptoms.reliable, true, 'explicit symptom coverage');
assert.equal(built.currentWeek.symptomLoggedDays, 7);
assert.equal(built.today.activity.current, 30, 'activityMinutes preserved');

state.weights = [{ date: previousKeys[6], weight: 180 }];
built = p.buildPersonalProgressContext(); assert.equal(built.weight.reliable, false, 'weight missing current period');
state.weights = [{ date: currentKeys[6], weight: 178 }];
built = p.buildPersonalProgressContext(); assert.equal(built.weight.reliable, false, 'weight missing previous period');
state.daysData = {}; built = p.buildPersonalProgressContext(); assert.equal(built.currentWeek.symptomLoggedDays, 0, 'no symptom logs');
currentKeys.slice(0, 3).forEach((key) => { state.daysData[key] = day({ symptomsLogged: true, symptom: 'mild' }); });
built = p.buildPersonalProgressContext(); assert.equal(built.currentWeek.symptomLoggedDays, 3, 'partial symptom coverage'); assert.equal(built.symptoms.reliable, false);

const cacheBase = { type: 'personal-progress', language: 'en', context: { range: { start: 'a', end: 'b' }, goals: { water: 80 }, currentWeek: { average: 70 } } };
const fp = p.createAiHistoryFingerprint(cacheBase);
assert.equal(p.createAiHistoryFingerprint(structuredClone(cacheBase)), fp, 'identical cache input');
assert.notEqual(p.createAiHistoryFingerprint({ ...cacheBase, context: { ...cacheBase.context, goals: { water: 90 } } }), fp, 'changed goal invalidates');
assert.notEqual(p.createAiHistoryFingerprint({ ...cacheBase, context: { ...cacheBase.context, currentWeek: { average: 71 } } }), fp, 'changed data invalidates');
assert.notEqual(p.createAiHistoryFingerprint({ ...cacheBase, context: { ...cacheBase.context, range: { start: 'c', end: 'd' } } }), fp, 'changed period invalidates');
p.AI_HISTORY_FORCE_ONCE.add('personal-progress'); assert.equal(p.consumeAiHistoryForce('personal-progress'), true, 'Generate New bypasses once'); assert.equal(p.consumeAiHistoryForce('personal-progress'), false, 'bypass consumed once');
const sourceContext = { generatedAt: 'now', range: { startDate: 'a' }, context: { goals: { water: 80 }, result: { summaryEs: 'ES', summaryEn: 'EN' } } };
const snapshot = p.buildAiHistorySnapshot(sourceContext); sourceContext.context.goals.water = 90; assert.equal(snapshot.context.goals.water, 80, 'history snapshot immutable clone');
state.aiHistory = [{ id: 'air_fixture1', type: 'personal-progress', createdAt: 1, updatedAt: 1, deletedAt: 0, favorite: false, fingerprint: fp, rangeDays: 7, rangeStart: 'a', rangeEnd: 'b', requestText: '', result: { summaryEs: 'ES', summaryEn: 'EN' }, snapshot: { context: { goals: { water: 80 } } }, appVersion: 'v5.6.1' }];
assert.equal(p.tryUseAiHistoryCache('personal-progress', fp), true, 'identical report is cache hit'); assert.deepEqual(cacheTelemetry, { actions: 1, hits: 1 }, 'cache hit records action and avoided call without invoking AI');

const storageJs = await readFile('public/runtime/02-state-sync-storage.js', 'utf8');
function extractFunction(source, name) { const start = source.indexOf(`function ${name}(`); assert.ok(start >= 0, `missing ${name}`); let brace = source.indexOf('{', start), depth = 0; for (let i = brace; i < source.length; i++) { if (source[i] === '{') depth++; if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1); } throw new Error(`unterminated ${name}`); }
const migrationContext = vm.createContext({}); vm.runInContext(`${extractFunction(storageJs, 'resolveGoalConfigured')};globalThis.resolveGoalConfigured=resolveGoalConfigured;`, migrationContext);
const resolve = migrationContext.resolveGoalConfigured;
assert.equal(resolve({ waterGoal: 96 }, { waterGoal: 123 }, 'waterGoalConfigured', 'waterGoal'), true, 'migrated explicitly updated v5.5 goal');
assert.equal(resolve({ waterGoal: 96 }, {}, 'waterGoalConfigured', 'waterGoal'), false, 'factory default not promoted');
assert.equal(resolve({ waterGoal: 96, waterGoalConfigured: false }, { waterGoal: 123 }, 'waterGoalConfigured', 'waterGoal'), false, 'v5.6 explicit cleared flag preserved');
assert.equal(resolve({ waterGoal: 96, waterGoalConfigured: true }, {}, 'waterGoalConfigured', 'waterGoal'), true, 'v5.6 configured flag preserved');

const backupSource = await readFile('src/runtime/07-tools-reports-backups.ts', 'utf8');
for (const marker of ['next.aiHistory = sanitizeAiHistory(imported.aiHistory)', 'next.aiTelemetry = sanitizeAiTelemetry(imported.aiTelemetry)', 'normalizeImportedActivityFields(raw)', 'resolveGoalConfigured(incoming', 'imported.weights', 'imported.injections', 'imported.measurements', 'imported.daysData']) assert.ok(backupSource.includes(marker), `backup/restore marker ${marker}`);
const backupJs = await readFile('public/runtime/07-tools-reports-backups.js', 'utf8');
const activityContext = vm.createContext({ Number, Math });
vm.runInContext(`${extractFunction(backupJs, 'normalizeImportedTimestamp')};${extractFunction(backupJs, 'normalizeImportedActivityFields')};globalThis.normalizeImportedActivityFields=normalizeImportedActivityFields;`, activityContext);
assert.deepEqual({ ...activityContext.normalizeImportedActivityFields({}) }, { activityMinutes: 0, activityUpdatedAt: 0 }, 'v5.5 backup missing activity imports safely');
assert.deepEqual({ ...activityContext.normalizeImportedActivityFields({ activityMinutes: 45, activityUpdatedAt: 123 }) }, { activityMinutes: 45, activityUpdatedAt: 123 }, 'v5.6 activity fields preserved');

const aiRuntime = await readFile('public/runtime/09-ai-intelligence.js', 'utf8');
const telemetry = { actions: 0, attempts: [], outcomes: [], failovers: 0 };
const aiContext = vm.createContext({
  console, navigator: { onLine: true }, window: { firebaseAiLogicReady: true }, performance,
  AI_PRIMARY_MODEL: 'primary', AI_FALLBACK_MODEL: 'fallback',
  document: { getElementById: () => ({ innerText: 'Explain' }) }, uiText: (es, en) => en,
  recordAiUserAction: () => telemetry.actions++, recordAiAttempt: (role, success) => telemetry.attempts.push([role, success]),
  recordAiGenerationOutcome: (success) => telemetry.outcomes.push(success), recordAiFailover: () => telemetry.failovers++,
  classifyAiFailure: (error) => ({ recoverable: error?.recoverable === true }), persistState() {}, renderAiStatus() {}
});
vm.runInContext(`${aiRuntime}\nglobalThis.__runAi=runAiIntelligenceRequest;`, aiContext);
await assert.rejects(() => aiContext.__runAi(async () => { const error = new Error('blocked'); error.recoverable = false; throw error; }, 'label'));
assert.deepEqual(telemetry.attempts, [['primary', false]], 'non-recoverable primary call counted');
assert.deepEqual(telemetry.outcomes, [false], 'generation failure counted');
telemetry.attempts.length = 0; telemetry.outcomes.length = 0;
const fallbackResult = await aiContext.__runAi(async (model) => { if (model === 'primary') { const error = new Error('retry'); error.recoverable = true; throw error; } return { ok: true }; }, 'label');
assert.equal(fallbackResult.ok, true); assert.deepEqual(telemetry.attempts, [['primary', false], ['fallback', true]], 'recoverable primary and real fallback counted'); assert.equal(telemetry.failovers, 1);

const pkRuntime = await readFile('public/runtime/06-injections-symptoms.js', 'utf8');
let capturedPkConfig = null;
function ChartMock(_context, config) { capturedPkConfig = config; return { data: config.data, options: config.options, update() {}, destroy() {} }; }
const pkContext = vm.createContext({
  console, Chart: ChartMock, pkCurveChartInstance: null, pkSelectedPointIndex: null, pkCurrentPointIndex: -1,
  document: { getElementById: () => ({ getContext: () => ({}) }) }, isEnglish: () => true, uiText: (_es, en) => en,
  calculatePkLevelAt: (_profile, ts, _records) => 1 + ((ts / 3600000) % 7) / 10
});
vm.runInContext(`${pkRuntime}\nglobalThis.__renderPkCurve=renderPkCurve;globalThis.__pkState=()=>({selected:pkSelectedPointIndex,current:pkCurrentPointIndex});`, pkContext);
const pkNow = Date.now();
pkContext.__renderPkCurve({ frequencyDays: 7 }, { latest: { ts: pkNow - 86400000, dose: 5 }, nextDoseTs: pkNow + 6 * 86400000, expectedPeak: 5, records: [] });
assert.ok(capturedPkConfig, 'PK chart config created');
const radii = capturedPkConfig.data.datasets[0].pointRadius;
assert.ok(radii.some((value) => value > 0), 'persistent PK markers visible');
assert.ok(radii.some((value) => value === 0), 'sparse marker strategy avoids wall of dots');
assert.equal(capturedPkConfig.data.datasets[0].pointHitRadius, 12, 'touch hit target');
capturedPkConfig.options.onClick({}, [{ index: 3 }]);
assert.equal(pkContext.__pkState().selected, 3, 'tapped PK point remains selected');

console.log('v5.6.1 deterministic fixtures PASS: coverage 0/1/3/4/7, goals, denominators, period weights, explicit symptoms, migration, activity, cache, immutable history and Primary/Fallback telemetry.');
