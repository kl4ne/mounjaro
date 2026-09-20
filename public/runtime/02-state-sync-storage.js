"use strict";
/**
 * GLP-1 Companion v5 Phase 3 compatibility module
 * State model, local safety backups, Firestore merge/sync and authentication.
 *
 * Loaded as an ordered classic script on purpose: this preserves the existing
 * shared global lexical environment and inline-handler contract while the v5
 * architecture is modularized without behavior changes.
 */
/* ==========================================================================
   STATE MANAGEMENT & LOCAL STORAGE ARCHITECTURE
   ========================================================================== */
const STORAGE_KEY = "mounjaro_pwa_data_v3";
function createDefaultState(devicePrefs = {}) {
    return {
        selectedDate: getFormattedDate(new Date()),
        settings: {
            medication: "mounjaro",
            presentation: "single_dose",
            inventoryByProduct: {},
            inventoryBaseByProduct: {},
            roomTempTrackers: {},
            goalWeight: 180,
            calGoal: 1400,
            tdee: 2000,
            proteinGoal: 110,
            waterGoal: 96,
            pensInStock: 4,
            roomTempTrackingEnabled: false,
            roomTempPenStart: null,
            fastingStart: null,
            isFasting: false,
            language: devicePrefs.language === 'en' ? 'en' : 'es',
            units: devicePrefs.units === 'metric' ? 'metric' : 'imperial',
            maintenanceEnabled: false,
            maintenanceRangeLb: 3
        },
        daysData: {},
        injections: [],
        inventoryEvents: [],
        weights: [],
        measurements: [],
        healthProfile: {
            sex: "",
            dob: "",
            heightIn: null,
            activity: "",
            updatedAt: 0
        },
        aiTelemetry: {},
        deletedRecords: {
            meals: {},
            weights: {},
            injections: {},
            measurements: {},
            bowelMovements: {}
        },
        meta: {
            schemaVersion: CLIENT_SCHEMA_VERSION,
            ownerUid: null,
            dataEpoch: 'legacy-v1',
            resetAt: 0,
            settingsUpdatedAt: 0,
            settingsFieldUpdatedAt: {},
            clientVersion: APP_VERSION,
            lastMutationAt: 0
        }
    };
}
let state = createDefaultState();
const AI_TELEMETRY_DEVICE_KEY = "glp1_ai_device_id_v4";
const AI_PRIMARY_MODEL = "gemini-3.5-flash";
const AI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
function getAiDeviceId() {
    let id = localStorage.getItem(AI_TELEMETRY_DEVICE_KEY);
    if (!id) {
        id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
            ? globalThis.crypto.randomUUID()
            : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(AI_TELEMETRY_DEVICE_KEY, id);
    }
    return id;
}
function currentMonthKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
function blankAiModelStats(modelName) {
    return { modelName, attempts: 0, successes: 0, failures: 0, lastSuccessAt: 0, lastFailureAt: 0, lastEventAt: 0, lastResult: '', consecutiveFailures: 0, lastLatencyMs: 0 };
}
function sanitizeHealthProfile(input) {
    const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const sex = typeof src.sex === 'string' && ['female', 'male'].includes(src.sex) ? src.sex : '';
    const dob = typeof src.dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.dob) ? src.dob : '';
    const height = Number(src.heightIn);
    const activity = typeof src.activity === 'string' && ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(src.activity) ? src.activity : '';
    const updatedAt = Number(src.updatedAt);
    return { sex, dob, heightIn: Number.isFinite(height) && height > 0 ? height : null, activity, updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0 };
}
function sanitizeAiModelStats(input, modelName) {
    const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const n = (key) => { const v = Number(src[key]); return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0; };
    return {
        modelName: typeof src.modelName === 'string' && src.modelName ? src.modelName : modelName,
        attempts: n('attempts'), successes: n('successes'), failures: n('failures'),
        lastSuccessAt: n('lastSuccessAt'), lastFailureAt: n('lastFailureAt'), lastEventAt: n('lastEventAt'),
        lastResult: src.lastResult === 'success' || src.lastResult === 'failure' ? src.lastResult : '',
        consecutiveFailures: n('consecutiveFailures'), lastLatencyMs: n('lastLatencyMs')
    };
}
function sanitizeAiTelemetry(input) {
    const out = {};
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return out;
    const inputRecord = input;
    Object.keys(inputRecord).forEach((month) => {
        if (!/^\d{4}-\d{2}$/.test(month))
            return;
        const bucket = inputRecord[month];
        if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket))
            return;
        const bucketRecord = bucket;
        const devices = {};
        const srcDevices = bucketRecord.devices && typeof bucketRecord.devices === 'object' && !Array.isArray(bucketRecord.devices) ? bucketRecord.devices : {};
        Object.keys(srcDevices).forEach((deviceId) => {
            const d = srcDevices[deviceId];
            if (!d || typeof d !== 'object' || Array.isArray(d))
                return;
            const dRecord = d;
            devices[deviceId] = {
                primary: sanitizeAiModelStats(dRecord.primary, AI_PRIMARY_MODEL),
                fallback: sanitizeAiModelStats(dRecord.fallback, AI_FALLBACK_MODEL),
                failovers: Math.max(0, Math.floor(Number(dRecord.failovers) || 0)),
                translations: Math.max(0, Math.floor(Number(dRecord.translations) || 0)),
                updatedAt: Math.max(0, Math.floor(Number(dRecord.updatedAt) || 0))
            };
        });
        out[month] = { devices, updatedAt: Math.max(0, Math.floor(Number(bucketRecord.updatedAt) || 0)) };
    });
    return out;
}
function ensureV4State() {
    state.healthProfile = sanitizeHealthProfile(state.healthProfile);
    state.aiTelemetry = sanitizeAiTelemetry(state.aiTelemetry);
    if (!state.settings || typeof state.settings !== 'object')
        state.settings = createDefaultState().settings;
    ensureStateMetadata();
    if (!state.deletedRecords || typeof state.deletedRecords !== 'object' || Array.isArray(state.deletedRecords))
        state.deletedRecords = { meals: {}, weights: {}, injections: {}, measurements: {}, bowelMovements: {} };
    if (!state.deletedRecords.bowelMovements || typeof state.deletedRecords.bowelMovements !== 'object' || Array.isArray(state.deletedRecords.bowelMovements))
        state.deletedRecords.bowelMovements = {};
    if (!state.settings.inventoryByProduct || typeof state.settings.inventoryByProduct !== 'object' || Array.isArray(state.settings.inventoryByProduct))
        state.settings.inventoryByProduct = {};
    if (!state.settings.inventoryBaseByProduct || typeof state.settings.inventoryBaseByProduct !== 'object' || Array.isArray(state.settings.inventoryBaseByProduct))
        state.settings.inventoryBaseByProduct = {};
    if (!state.settings.roomTempTrackers || typeof state.settings.roomTempTrackers !== 'object' || Array.isArray(state.settings.roomTempTrackers))
        state.settings.roomTempTrackers = {};
    state.inventoryEvents = sanitizeInventoryEvents(state.inventoryEvents);
    const med = MEDICATION_PROFILES[state.settings.medication] ? state.settings.medication : 'mounjaro';
    state.settings.medication = med;
    const presKeys = getPresentationOptions(med).map((x) => x.key);
    if (!presKeys.includes(state.settings.presentation))
        state.settings.presentation = getDefaultPresentationKey(med);
    const productKey = getCurrentProductKey();
    ensureInventoryLedgerState(productKey);
    // Migrate the old single countdown into the presentation-specific tracker once.
    if ((state.settings.roomTempPenStart || state.settings.roomTempTrackingEnabled) && !state.settings.roomTempTrackers[productKey]) {
        state.settings.roomTempTrackers[productKey] = { active: Boolean(state.settings.roomTempTrackingEnabled && state.settings.roomTempPenStart), startedAt: Number(state.settings.roomTempPenStart) || 0, accumulatedMs: 0, firstUseAt: 0, updatedAt: Number(state.meta.settingsUpdatedAt) || 0 };
    }
    Object.keys(state.daysData || {}).forEach((dateKey) => {
        const day = state.daysData[dateKey];
        if (day && typeof day === 'object' && !Array.isArray(day))
            ensureGranularDayData(dateKey, day);
    });
    ensureInjectionIds();
}
function mergeAiModelStats(a, b, modelName) {
    const x = sanitizeAiModelStats(a, modelName), y = sanitizeAiModelStats(b, modelName);
    const newer = y.lastEventAt > x.lastEventAt ? y : x;
    return {
        modelName: newer.modelName || modelName,
        attempts: Math.max(x.attempts, y.attempts), successes: Math.max(x.successes, y.successes), failures: Math.max(x.failures, y.failures),
        lastSuccessAt: Math.max(x.lastSuccessAt, y.lastSuccessAt), lastFailureAt: Math.max(x.lastFailureAt, y.lastFailureAt),
        lastEventAt: Math.max(x.lastEventAt, y.lastEventAt), lastResult: newer.lastResult,
        consecutiveFailures: newer.consecutiveFailures, lastLatencyMs: newer.lastLatencyMs
    };
}
function mergeAiTelemetry(localValue, cloudValue) {
    const local = sanitizeAiTelemetry(localValue), cloud = sanitizeAiTelemetry(cloudValue), out = JSON.parse(JSON.stringify(local));
    Object.keys(cloud).forEach((month) => {
        if (!out[month])
            out[month] = { devices: {}, updatedAt: 0 };
        const c = cloud[month];
        Object.keys(c.devices || {}).forEach((deviceId) => {
            const cd = c.devices[deviceId], ld = out[month].devices[deviceId] || {};
            out[month].devices[deviceId] = {
                primary: mergeAiModelStats(ld.primary, cd.primary, AI_PRIMARY_MODEL),
                fallback: mergeAiModelStats(ld.fallback, cd.fallback, AI_FALLBACK_MODEL),
                failovers: Math.max(Number(ld.failovers) || 0, Number(cd.failovers) || 0),
                translations: Math.max(Number(ld.translations) || 0, Number(cd.translations) || 0),
                updatedAt: Math.max(Number(ld.updatedAt) || 0, Number(cd.updatedAt) || 0)
            };
        });
        out[month].updatedAt = Math.max(Number(out[month].updatedAt) || 0, Number(c.updatedAt) || 0);
    });
    return out;
}
function ensureCurrentAiDeviceBucket() {
    ensureV4State();
    const month = currentMonthKey(), deviceId = getAiDeviceId();
    if (!state.aiTelemetry[month])
        state.aiTelemetry[month] = { devices: {}, updatedAt: 0 };
    if (!state.aiTelemetry[month].devices[deviceId])
        state.aiTelemetry[month].devices[deviceId] = { primary: blankAiModelStats(AI_PRIMARY_MODEL), fallback: blankAiModelStats(AI_FALLBACK_MODEL), failovers: 0, translations: 0, updatedAt: 0 };
    if (!Number.isFinite(Number(state.aiTelemetry[month].devices[deviceId].translations)))
        state.aiTelemetry[month].devices[deviceId].translations = 0;
    return { month, deviceId, bucket: state.aiTelemetry[month].devices[deviceId] };
}
function recordAiAttempt(role, success, latencyMs = 0) {
    const { month, bucket } = ensureCurrentAiDeviceBucket();
    const stats = role === 'fallback' ? bucket.fallback : bucket.primary;
    const now = mutationNow();
    stats.attempts += 1;
    if (success) {
        stats.successes += 1;
        stats.lastSuccessAt = now;
        stats.lastResult = 'success';
        stats.consecutiveFailures = 0;
    }
    else {
        stats.failures += 1;
        stats.lastFailureAt = now;
        stats.lastResult = 'failure';
        stats.consecutiveFailures += 1;
    }
    stats.lastEventAt = now;
    stats.lastLatencyMs = Math.max(0, Math.round(Number(latencyMs) || 0));
    bucket.updatedAt = now;
    state.aiTelemetry[month].updatedAt = now;
}
function recordAiFailover() {
    const { month, bucket } = ensureCurrentAiDeviceBucket();
    const now = mutationNow();
    bucket.failovers += 1;
    bucket.updatedAt = now;
    state.aiTelemetry[month].updatedAt = now;
}
function recordAiTranslation() {
    const { month, bucket } = ensureCurrentAiDeviceBucket();
    const now = mutationNow();
    bucket.translations = (Number(bucket.translations) || 0) + 1;
    bucket.updatedAt = now;
    state.aiTelemetry[month].updatedAt = now;
}
function aggregateAiMonth(month = currentMonthKey()) {
    const t = sanitizeAiTelemetry(state.aiTelemetry), bucket = t[month] || { devices: {} };
    const result = { primary: blankAiModelStats(AI_PRIMARY_MODEL), fallback: blankAiModelStats(AI_FALLBACK_MODEL), failovers: 0, translations: 0 };
    ['primary', 'fallback'].forEach((role) => {
        let latest = blankAiModelStats(role === 'primary' ? AI_PRIMARY_MODEL : AI_FALLBACK_MODEL);
        Object.values(bucket.devices || {}).forEach((d) => {
            const st = sanitizeAiModelStats(d[role], role === 'primary' ? AI_PRIMARY_MODEL : AI_FALLBACK_MODEL);
            result[role].attempts += st.attempts;
            result[role].successes += st.successes;
            result[role].failures += st.failures;
            result[role].lastSuccessAt = Math.max(result[role].lastSuccessAt, st.lastSuccessAt);
            result[role].lastFailureAt = Math.max(result[role].lastFailureAt, st.lastFailureAt);
            if (st.lastEventAt > latest.lastEventAt)
                latest = st;
        });
        result[role].lastEventAt = latest.lastEventAt;
        result[role].lastResult = latest.lastResult;
        result[role].consecutiveFailures = latest.consecutiveFailures;
        result[role].lastLatencyMs = latest.lastLatencyMs;
    });
    Object.values(bucket.devices || {}).forEach((d) => { result.failovers += Math.max(0, Number(d.failovers) || 0); result.translations += Math.max(0, Number(d.translations) || 0); });
    return result;
}
function formatAiLast(ts) {
    const n = Number(ts);
    if (!n)
        return '--';
    return new Date(n).toLocaleString(isEnglish() ? 'en-US' : 'es-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function renderAiStatus() {
    const agg = aggregateAiMonth();
    const monthLabel = new Date(`${currentMonthKey()}-01T12:00:00`).toLocaleDateString(isEnglish() ? 'en-US' : 'es-US', { month: 'long', year: 'numeric' });
    const m = document.getElementById('ai-status-month');
    if (m)
        m.innerText = isEnglish() ? `Current month · ${monthLabel}` : `Mes actual · ${monthLabel}`;
    const f = document.getElementById('ai-failover-total');
    if (f)
        f.innerText = `${agg.failovers} ${agg.failovers === 1 ? 'failover' : 'failovers'}`;
    const tr = document.getElementById('ai-translation-total');
    if (tr)
        tr.innerText = isEnglish() ? `${agg.translations} ${agg.translations === 1 ? 'translation' : 'translations'}` : `${agg.translations} ${agg.translations === 1 ? 'traducción' : 'traducciones'}`;
    const renderRole = (role, st) => {
        const attempts = document.getElementById(`ai-${role}-attempts`), suc = document.getElementById(`ai-${role}-success`), fail = document.getElementById(`ai-${role}-fail`), rate = document.getElementById(`ai-${role}-rate`), last = document.getElementById(`ai-${role}-last`), status = document.getElementById(`ai-${role}-status`), light = document.getElementById(`ai-${role}-light`);
        if (attempts)
            attempts.innerText = String(st.attempts);
        if (suc)
            suc.innerText = String(st.successes);
        if (fail)
            fail.innerText = String(st.failures);
        if (rate)
            rate.innerText = st.attempts ? `${((st.successes / st.attempts) * 100).toFixed(1)}%` : '--';
        if (last)
            last.innerText = (isEnglish() ? 'Last use: ' : 'Último uso: ') + formatAiLast(st.lastEventAt);
        let label = uiText('Sin comprobar', 'Unchecked'), cls = 'bg-slate-500';
        if (st.attempts > 0 && st.lastResult === 'success') {
            label = uiText('Disponible', 'Available');
            cls = 'bg-emerald-500';
        }
        else if (st.attempts > 0 && st.lastResult === 'failure' && st.consecutiveFailures >= 2) {
            label = uiText('Error reciente', 'Recent error');
            cls = 'bg-rose-500';
        }
        else if (st.attempts > 0 && st.lastResult === 'failure') {
            label = uiText('Degradado', 'Degraded');
            cls = 'bg-amber-500';
        }
        if (status)
            status.innerText = label;
        if (light)
            light.className = `w-2.5 h-2.5 rounded-full ${cls}`;
    };
    renderRole('primary', agg.primary);
    renderRole('fallback', agg.fallback);
}
function ensureStateMetadata() {
    if (!state.meta || typeof state.meta !== 'object' || Array.isArray(state.meta))
        state.meta = {};
    state.meta.schemaVersion = CLIENT_SCHEMA_VERSION;
    if (typeof state.meta.ownerUid !== 'string')
        state.meta.ownerUid = null;
    if (!state.meta.dataEpoch || typeof state.meta.dataEpoch !== 'string')
        state.meta.dataEpoch = 'legacy-v1';
    if (!Number.isFinite(Number(state.meta.resetAt)) || Number(state.meta.resetAt) < 0)
        state.meta.resetAt = 0;
    if (!Number.isFinite(Number(state.meta.settingsUpdatedAt)) || Number(state.meta.settingsUpdatedAt) < 0)
        state.meta.settingsUpdatedAt = 0;
    if (!state.meta.settingsFieldUpdatedAt || typeof state.meta.settingsFieldUpdatedAt !== 'object' || Array.isArray(state.meta.settingsFieldUpdatedAt))
        state.meta.settingsFieldUpdatedAt = {};
    Object.keys(state.meta.settingsFieldUpdatedAt).forEach((k) => {
        const n = Number(state.meta.settingsFieldUpdatedAt[k]);
        if (!Number.isFinite(n) || n < 0)
            delete state.meta.settingsFieldUpdatedAt[k];
    });
    state.meta.clientVersion = APP_VERSION;
    if (!Number.isFinite(Number(state.meta.lastMutationAt)) || Number(state.meta.lastMutationAt) < 0)
        state.meta.lastMutationAt = 0;
}
function cloudSettingKeys() {
    return Object.keys(state.settings || {}).filter((k) => !['language', 'units'].includes(k));
}
function markSettingsChanged(fields = null) {
    ensureStateMetadata();
    const ts = mutationNow();
    state.meta.settingsUpdatedAt = ts;
    const list = Array.isArray(fields) && fields.length ? fields : cloudSettingKeys();
    list.forEach((k) => {
        if (k && !['language', 'units'].includes(k))
            state.meta.settingsFieldUpdatedAt[k] = ts;
    });
    return ts;
}
function getInjectionMedicationKey(injection) {
    const key = injection && injection.medication;
    return key && MEDICATION_PROFILES[key] ? key : state.settings.medication;
}
function getInjectionsForMedication(key = state.settings.medication) {
    return (Array.isArray(state.injections) ? state.injections : [])
        .filter((i) => i && i.date && getInjectionMedicationKey(i) === key);
}
let activeTab = 'dashboard';
let weightChartInstance = null;
let symptomTrendChartInstance = null;
let pkCurveChartInstance = null;
let selectedImageBase64 = null;
let pendingAiBilingualResult = null;
let pacingTimerInterval = null;
let pacingSecondsLeft = 20 * 60;
function getFormattedDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function isValidDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day;
}
function normalizeDateKey(value) {
    if (typeof value !== 'string')
        return null;
    const dateKey = value.split('T')[0];
    return isValidDateKey(dateKey) ? dateKey : null;
}
function cleanupTombstones() {
    if (!state.deletedRecords || typeof state.deletedRecords !== 'object' || Array.isArray(state.deletedRecords)) {
        state.deletedRecords = { meals: {}, weights: {}, injections: {}, measurements: {}, bowelMovements: {} };
    }
    ['meals', 'weights', 'injections', 'measurements', 'bowelMovements'].forEach((type) => {
        if (!state.deletedRecords[type] || typeof state.deletedRecords[type] !== 'object' || Array.isArray(state.deletedRecords[type]))
            state.deletedRecords[type] = {};
        Object.keys(state.deletedRecords[type]).forEach((id) => {
            const ts = Number(state.deletedRecords[type][id]);
            if (!Number.isFinite(ts) || ts <= 0)
                delete state.deletedRecords[type][id];
        });
    });
    // v3.8 intentionally keeps valid tombstones indefinitely. Automatic age-based
    // pruning could let a device that stayed offline for months resurrect deleted data.
}
function ensureInjectionIds() {
    if (Array.isArray(state.injections)) {
        state.injections.forEach((inj, idx) => {
            if (!inj || typeof inj !== 'object')
                return;
            if (!inj.id) {
                const dateClean = inj.date ? String(inj.date).replace(/[^0-9]/g, '') : '';
                inj.id = "inj_" + (dateClean || mutationNow()) + "_" + idx + "_" + Math.random().toString(36).substring(2, 6);
            }
            if (!inj.medication || !MEDICATION_PROFILES[inj.medication])
                inj.medication = state.settings.medication;
            if (typeof inj.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(inj.time))
                inj.time = '';
        });
    }
}
function initData() {
    hadLocalStateAtBoot = false;
    localDirtySinceBoot = false;
    loadPendingMutationFlag();
    const blank = createDefaultState();
    state = blank;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                throw new Error('Invalid local state');
            if (parsed.settings && parsed.settings.apiKey) {
                // Remove legacy embedded Gemini keys from old local state. Firebase AI Logic no longer uses them.
                delete parsed.settings.apiKey;
                localStorage.removeItem("gemini_api_key_vault");
            }
            const localLanguage = parsed.settings && parsed.settings.language === 'en' ? 'en' : 'es';
            const localUnits = parsed.settings && parsed.settings.units === 'metric' ? 'metric' : 'imperial';
            state = createDefaultState({ language: localLanguage, units: localUnits });
            if (parsed.settings && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings))
                state.settings = Object.assign(state.settings, parsed.settings);
            if (parsed.daysData && typeof parsed.daysData === 'object' && !Array.isArray(parsed.daysData))
                state.daysData = parsed.daysData;
            if (Array.isArray(parsed.injections))
                state.injections = parsed.injections;
            if (Array.isArray(parsed.inventoryEvents))
                state.inventoryEvents = sanitizeInventoryEvents(parsed.inventoryEvents);
            if (Array.isArray(parsed.weights))
                state.weights = parsed.weights;
            if (Array.isArray(parsed.measurements))
                state.measurements = parsed.measurements;
            if (parsed.healthProfile && typeof parsed.healthProfile === 'object' && !Array.isArray(parsed.healthProfile))
                state.healthProfile = sanitizeHealthProfile(parsed.healthProfile);
            if (parsed.aiTelemetry && typeof parsed.aiTelemetry === 'object' && !Array.isArray(parsed.aiTelemetry))
                state.aiTelemetry = sanitizeAiTelemetry(parsed.aiTelemetry);
            if (parsed.deletedRecords && typeof parsed.deletedRecords === 'object' && !Array.isArray(parsed.deletedRecords))
                state.deletedRecords = parsed.deletedRecords;
            if (parsed.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
                state.meta = Object.assign(state.meta, parsed.meta);
            if (!MEDICATION_PROFILES[state.settings.medication])
                state.settings.medication = "mounjaro";
            if (!Number.isFinite(Number(state.settings.goalWeight)) || Number(state.settings.goalWeight) <= 0)
                state.settings.goalWeight = 180;
            if (!['es', 'en'].includes(state.settings.language))
                state.settings.language = 'es';
            if (!['imperial', 'metric'].includes(state.settings.units))
                state.settings.units = 'imperial';
            if (typeof state.settings.maintenanceEnabled !== "boolean")
                state.settings.maintenanceEnabled = false;
            if (!Number.isFinite(Number(state.settings.maintenanceRangeLb)))
                state.settings.maintenanceRangeLb = 3;
            cleanupTombstones();
            ensureStateMetadata();
            ensureV4State();
            hadLocalStateAtBoot = true;
        }
        // Fresh installs stay neutral. Never create demo/default tracking records.
    }
    catch (err) {
        console.error("Error loading LocalStorage:", err);
        state = createDefaultState();
        hadLocalStateAtBoot = false;
        clearExplicitMutationPending();
    }
    ensureStateMetadata();
    ensureV4State();
    state.selectedDate = getFormattedDate(new Date());
}
function bindStateToAuthenticatedUser(uid) {
    ensureStateMetadata();
    if (state.meta.ownerUid && state.meta.ownerUid !== uid) {
        const prefs = { language: state.settings.language, units: state.settings.units };
        state = createDefaultState(prefs);
        state.meta.ownerUid = uid;
        hadLocalStateAtBoot = false;
        clearExplicitMutationPending();
        writePrimaryLocalState();
        applyMedicationTheme();
        renderCurrentDay();
        if (activeTab === 'tools')
            renderToolsView();
        showToast(uiText('Cuenta diferente detectada. Se cargará únicamente su información desde Firebase.', 'Different account detected. Only that account’s Firebase data will be loaded.'));
    }
    else if (!state.meta.ownerUid) {
        state.meta.ownerUid = uid;
        writePrimaryLocalState();
    }
}
function isPassiveEmptyDay(day) {
    if (!day || typeof day !== 'object' || Array.isArray(day))
        return true;
    const symptoms = (day.symptoms && typeof day.symptoms === 'object' && !Array.isArray(day.symptoms)) ? day.symptoms : {};
    const electrolytes = (day.electrolytes && typeof day.electrolytes === 'object' && !Array.isArray(day.electrolytes)) ? day.electrolytes : {};
    const symptomsAreDefault = Number(symptoms.hunger ?? 3) === 3 &&
        (!symptoms.nausea || symptoms.nausea === 'none') &&
        (!symptoms.heartburn || symptoms.heartburn === 'none') &&
        (!symptoms.sulfur || symptoms.sulfur === 'none') &&
        (!symptoms.fatigue || symptoms.fatigue === 'none') &&
        !String(symptoms.notes || '').trim();
    return Number(day.water || 0) <= 0 &&
        (!Array.isArray(day.meals) || day.meals.length === 0) &&
        (!Array.isArray(day.bowelMovements) || day.bowelMovements.length === 0) &&
        (!Array.isArray(day.waterEvents) || day.waterEvents.length === 0) &&
        (!Array.isArray(day.bowelMovementRecords) || day.bowelMovementRecords.length === 0) &&
        symptomsAreDefault &&
        !Object.values(electrolytes).some(Boolean) &&
        (Number(day.waterUpdatedAt) || 0) === 0 &&
        (Number(day.symptomsUpdatedAt) || 0) === 0 &&
        (Number(day.electrolytesUpdatedAt) || 0) === 0;
}
function getCloudSafeStateSnapshot() {
    ensureStateMetadata();
    const cleanCopy = JSON.parse(JSON.stringify(state));
    delete cleanCopy.selectedDate;
    if (cleanCopy.settings) {
        delete cleanCopy.settings.apiKey;
        delete cleanCopy.settings.language;
        delete cleanCopy.settings.units;
        delete cleanCopy.settings.pensInStock;
        delete cleanCopy.settings.roomTempTrackingEnabled;
        delete cleanCopy.settings.roomTempPenStart;
    }
    if (cleanCopy._sync)
        delete cleanCopy._sync;
    if (cleanCopy.daysData && typeof cleanCopy.daysData === 'object' && !Array.isArray(cleanCopy.daysData)) {
        Object.keys(cleanCopy.daysData).forEach((dateKey) => {
            if (isPassiveEmptyDay(cleanCopy.daysData[dateKey]))
                delete cleanCopy.daysData[dateKey];
        });
    }
    cleanCopy.meta = Object.assign({}, cleanCopy.meta, {
        schemaVersion: CLIENT_SCHEMA_VERSION,
        ownerUid: currentUser ? currentUser.uid : (cleanCopy.meta && cleanCopy.meta.ownerUid) || null,
        clientVersion: APP_VERSION
    });
    return cleanCopy;
}
function sanitizeCloudForCompare(value) {
    const copy = JSON.parse(JSON.stringify(value || {}));
    delete copy.selectedDate;
    delete copy._sync;
    if (copy.settings) {
        delete copy.settings.apiKey;
        delete copy.settings.language;
        delete copy.settings.units;
    }
    return copy;
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}
let localSafetyBackupCache = [];
let localSafetyBackupsReady = false;
let localBackupInitPromise = Promise.resolve();
function openLocalBackupDb() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('INDEXEDDB_UNAVAILABLE'));
            return;
        }
        const req = indexedDB.open(LOCAL_BACKUP_DB_NAME, LOCAL_BACKUP_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('backups'))
                db.createObjectStore('backups', { keyPath: 'slot' });
            if (!db.objectStoreNames.contains('emergency'))
                db.createObjectStore('emergency', { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('INDEXEDDB_OPEN_FAILED'));
    });
}
async function idbPut(storeName, value) { const db = await openLocalBackupDb(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).put(value); tx.oncomplete = () => { db.close(); resolve(true); }; tx.onerror = () => { const e = tx.error; db.close(); reject(e || new Error('INDEXEDDB_WRITE_FAILED')); }; }); }
async function idbGetAll(storeName) { const db = await openLocalBackupDb(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readonly'); const req = tx.objectStore(storeName).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error || new Error('INDEXEDDB_READ_FAILED')); tx.oncomplete = () => db.close(); }); }
async function idbClear(storeName) { const db = await openLocalBackupDb(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).clear(); tx.oncomplete = () => { db.close(); resolve(true); }; tx.onerror = () => { const e = tx.error; db.close(); reject(e || new Error('INDEXEDDB_CLEAR_FAILED')); }; }); }
async function initLocalSafetyBackups() {
    try {
        // One-time migration from v4.0.5 localStorage snapshots into IndexedDB.
        for (let i = 0; i < LOCAL_SAFETY_BACKUP_SLOTS; i++) {
            const key = `${LOCAL_SAFETY_BACKUP_PREFIX}${i}`;
            const raw = localStorage.getItem(key);
            if (!raw)
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.snapshot && typeof parsed.snapshot === 'object')
                    await idbPut('backups', { slot: i, savedAt: Number(parsed.savedAt) || Date.now(), appVersion: parsed.appVersion || '', snapshot: parsed.snapshot });
            }
            catch (_) { }
            try {
                localStorage.removeItem(key);
            }
            catch (_) { }
        }
        localSafetyBackupCache = (await idbGetAll('backups')).filter((x) => Boolean(x && x.snapshot && typeof x.snapshot === 'object')).sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
    }
    catch (err) {
        console.warn('IndexedDB safety backups unavailable; continuing without rotating local snapshots.', err);
        localSafetyBackupCache = [];
    }
    localSafetyBackupsReady = true;
    updateLocalBackupStatus();
    return localSafetyBackupCache;
}
function getLocalSafetyBackups() { return localSafetyBackupCache.slice().sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0)); }
function commitLocalSafetySnapshot(previous) {
    try {
        if (!previous || typeof previous !== 'object')
            return;
        const existing = getLocalSafetyBackups();
        const previousComparable = stableStringify(previous);
        if (existing.some((x) => {
            try {
                return stableStringify(x.snapshot) === previousComparable;
            }
            catch (_) {
                return false;
            }
        }))
            return;
        let target = Number(localStorage.getItem(LOCAL_SAFETY_BACKUP_CURSOR_KEY));
        if (!Number.isInteger(target) || target < 0 || target >= LOCAL_SAFETY_BACKUP_SLOTS)
            target = 0;
        const maxSaved = existing.reduce((m, x) => Math.max(m, Number(x.savedAt) || 0), 0);
        const item = { slot: target, savedAt: Math.max(Date.now(), maxSaved + 1), appVersion: APP_VERSION, snapshot: previous };
        localSafetyBackupCache = localSafetyBackupCache.filter((x) => Number(x.slot) !== target);
        localSafetyBackupCache.push(item);
        localSafetyBackupCache.sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
        try {
            localStorage.setItem(LOCAL_SAFETY_BACKUP_CURSOR_KEY, String((target + 1) % LOCAL_SAFETY_BACKUP_SLOTS));
        }
        catch (_) { }
        idbPut('backups', item).catch((err) => console.warn('Could not persist local safety snapshot to IndexedDB:', err));
        updateLocalBackupStatus();
    }
    catch (err) {
        console.warn('Local safety snapshot skipped:', err);
    }
}
function rotateLocalSafetySnapshot() {
    let previous = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw)
            previous = JSON.parse(raw);
    }
    catch (_) { }
    if (!previous || typeof previous !== 'object')
        return;
    if (!localSafetyBackupsReady) {
        localBackupInitPromise.then(() => commitLocalSafetySnapshot(previous)).catch(() => { });
        return;
    }
    commitLocalSafetySnapshot(previous);
}
async function replaceLocalSafetyBackups(items) {
    const clean = (Array.isArray(items) ? items : []).slice(0, LOCAL_SAFETY_BACKUP_SLOTS).map((x, idx) => { const obj = (x && typeof x === 'object' && !Array.isArray(x)) ? x : {}; const snapshot = (obj.snapshot && typeof obj.snapshot === 'object' && !Array.isArray(obj.snapshot)) ? obj.snapshot : createDefaultState(); return { slot: idx, savedAt: Number(obj.savedAt) || Date.now() + idx, appVersion: String(obj.appVersion || APP_VERSION), snapshot }; });
    try {
        await idbClear('backups');
        for (const item of clean)
            await idbPut('backups', item);
        localSafetyBackupCache = clean.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        localSafetyBackupsReady = true;
        try {
            localStorage.setItem(LOCAL_SAFETY_BACKUP_CURSOR_KEY, String(clean.length % LOCAL_SAFETY_BACKUP_SLOTS));
        }
        catch (_) { }
        updateLocalBackupStatus();
        return true;
    }
    catch (err) {
        console.warn('Could not restore local backup history:', err);
        return false;
    }
}
function isQuotaExceededError(err) { const e = (err && typeof err === 'object') ? err : {}; return Boolean(e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014); }
function emergencyStateToIndexedDb(snapshot) { return idbPut('emergency', { key: 'latest', savedAt: Date.now(), appVersion: APP_VERSION, snapshot: JSON.parse(JSON.stringify(snapshot)) }).catch((err) => console.error('Emergency IndexedDB save failed:', err)); }
async function recoverEmergencyStateIfNewer() {
    try {
        const rows = await idbGetAll('emergency');
        const item = (rows || []).find((x) => x && x.key === 'latest' && x.snapshot && typeof x.snapshot === 'object');
        if (!item)
            return false;
        const localMutation = Number(state?.meta?.lastMutationAt) || 0, emergencyMutation = Number(item.snapshot?.meta?.lastMutationAt) || Number(item.savedAt) || 0;
        const localOwner = state?.meta?.ownerUid || null, emergencyOwner = item.snapshot?.meta?.ownerUid || null;
        if (localOwner && emergencyOwner && localOwner !== emergencyOwner)
            return false;
        if (emergencyMutation <= localMutation)
            return false;
        state = JSON.parse(JSON.stringify(item.snapshot));
        ensureStateMetadata();
        ensureV4State();
        state.selectedDate = getFormattedDate(new Date());
        const saved = writePrimaryLocalState();
        markExplicitMutationPending();
        if (saved)
            await idbClear('emergency');
        applyMedicationTheme();
        renderCurrentDay();
        if (activeTab === 'tools')
            renderToolsView();
        renderAiStatus();
        showToast(uiText('Se recuperó un cambio desde la copia de emergencia local.', 'A change was recovered from the local emergency copy.'), 6000);
        return true;
    }
    catch (err) {
        console.warn('Emergency recovery check failed:', err);
        return false;
    }
}
function writePrimaryLocalState() {
    const raw = JSON.stringify(state);
    try {
        localStorage.setItem(STORAGE_KEY, raw);
        return true;
    }
    catch (err) {
        if (!isQuotaExceededError(err)) {
            console.error('Local state save failed:', err);
            return false;
        }
        // v4.0.6 snapshots no longer consume localStorage; clear legacy slots and retry once.
        for (let i = 0; i < LOCAL_SAFETY_BACKUP_SLOTS; i++) {
            try {
                localStorage.removeItem(`${LOCAL_SAFETY_BACKUP_PREFIX}${i}`);
            }
            catch (_) { }
        }
        try {
            localStorage.setItem(STORAGE_KEY, raw);
            return true;
        }
        catch (err2) {
            console.error('Local storage quota exhausted:', err2);
            emergencyStateToIndexedDb(state);
            showToast(uiText('Almacenamiento local lleno. Se creó una copia de emergencia y se intentará sincronizar este cambio con Firebase. Exporta un backup pronto.', 'Local storage is full. An emergency copy was created and this change will still try to sync with Firebase. Export a backup soon.'), 8000);
            return false;
        }
    }
}
function updateLocalBackupStatus() {
    const el = document.getElementById('backup-local-status');
    if (el)
        el.innerText = isEnglish() ? `Rotating local backups: ${getLocalSafetyBackups().length}/3` : `Backups locales rotativos: ${getLocalSafetyBackups().length}/3`;
}
const CLOUD_SYNC_DELAY_MS = 1800;
let cloudSyncTimer = null;
let cloudSyncInFlight = false;
let cloudSyncPending = false;
function persistState(options = {}) {
    cleanupTombstones();
    ensureStateMetadata();
    ensureV4State();
    if (currentUser)
        state.meta.ownerUid = currentUser.uid;
    state.meta.clientVersion = APP_VERSION;
    if (options.userMutation === true && options.skipLocalSafetyBackup !== true)
        rotateLocalSafetySnapshot();
    // Mark the mutation BEFORE the local write so a QuotaExceededError can never make
    // an explicit user change disappear from the cloud-sync queue.
    if (options.userMutation === true)
        markExplicitMutationPending();
    const localSaved = writePrimaryLocalState();
    updateLocalBackupStatus();
    if (options.localOnly)
        return localSaved;
    if (options.userMutation !== true) {
        console.warn('Cloud write skipped: persistState was called without an explicit user mutation.');
        return localSaved;
    }
    if (!currentUser)
        return localSaved;
    if (cloudWriteBlockedByVersion) {
        setSyncStatus('update-required');
        return localSaved;
    }
    if (!cloudInitialReadComplete) {
        cloudSyncDeferredUntilBootstrap = true;
        setSyncStatus('waiting');
        return localSaved;
    }
    scheduleCloudSync(Boolean(options.immediateCloud) || !localSaved);
    return localSaved;
}
function scheduleCloudSync(immediate = false) {
    if (!pendingExplicitMutation)
        return;
    if (!currentUser || cloudWriteBlockedByVersion)
        return;
    if (!cloudInitialReadComplete) {
        cloudSyncDeferredUntilBootstrap = true;
        setSyncStatus('waiting');
        return;
    }
    if (cloudSyncTimer)
        clearTimeout(cloudSyncTimer);
    setSyncStatus('syncing');
    cloudSyncTimer = setTimeout(() => {
        cloudSyncTimer = null;
        flushCloudSync();
    }, immediate ? 0 : CLOUD_SYNC_DELAY_MS);
}
function mergeSnapshotForTransaction(localSnapshot, cloud) {
    const originalState = state;
    try {
        state = JSON.parse(JSON.stringify(localSnapshot));
        ensureStateMetadata();
        applyCloudDataMerge(cloud, {
            skipCloudWrite: true,
            suppressRender: true,
            suppressLocalSave: true,
            preferCloudOnTie: false
        });
        return getCloudSafeStateSnapshot();
    }
    finally {
        state = originalState;
    }
}
async function flushCloudSync() {
    if (!pendingExplicitMutation)
        return;
    if (!currentUser || !cloudInitialReadComplete || cloudWriteBlockedByVersion) {
        if (currentUser && !cloudWriteBlockedByVersion)
            cloudSyncDeferredUntilBootstrap = true;
        return;
    }
    if (cloudSyncInFlight) {
        cloudSyncPending = true;
        return;
    }
    const currentSyncRevision = localMutationRevision;
    cloudSyncInFlight = true;
    cloudSyncPending = false;
    const docRef = firebasePlatform.trackerRef(currentUser.uid);
    let localSnapshot = getCloudSafeStateSnapshot();
    try {
        const localBytes = estimateUtf8Bytes(localSnapshot);
        if (localBytes >= CLOUD_SIZE_HARD_LIMIT_BYTES) {
            try {
                localStorage.setItem(CLOUD_SIZE_BACKUP_KEY, JSON.stringify(state));
            }
            catch (_) { }
            setSyncStatus('error');
            showToast(uiText('Sincronización detenida antes del límite de Firestore. Se guardó una copia local de seguridad; exporta un backup.', 'Sync stopped before the Firestore limit. A local safety copy was saved; export a backup.'), 7000);
            console.error('Cloud sync blocked by safety size limit:', localBytes);
            return;
        }
        if (localBytes >= CLOUD_SIZE_WARN_BYTES) {
            console.warn('GLP-1 Companion cloud document is becoming large:', localBytes);
        }
        await firebasePlatform.runTransaction(async (transaction) => {
            const serverSnap = await transaction.get(docRef);
            let merged = localSnapshot;
            let previousRevision = 0;
            if (serverSnap.exists()) {
                const remote = serverSnap.data();
                updateServerClockAnchor(remote);
                // updateServerClockAnchor may normalize clearly impossible future timestamps.
                // Rebuild the transaction snapshot so those repaired values, not stale ones, are merged.
                localSnapshot = getCloudSafeStateSnapshot();
                const minRequired = remote && remote._sync && remote._sync.minClientVersion;
                if (minRequired && versionNumber(APP_VERSION) < versionNumber(minRequired)) {
                    throw new Error('CLIENT_UPDATE_REQUIRED');
                }
                previousRevision = Number(remote && remote._sync && remote._sync.revision) || 0;
                try {
                    localStorage.setItem(PRE_CLOUD_WRITE_BACKUP_KEY, JSON.stringify({ savedAt: Date.now(), revision: previousRevision, state: remote }));
                }
                catch (_) { }
                merged = mergeSnapshotForTransaction(localSnapshot, remote);
                // Rolling server-side safety snapshot. Three slots preserve several
                // immediately previous server states without unbounded storage growth.
                const safetySlot = `slot${previousRevision % 3}`;
                const safetyRef = firebasePlatform.safetyRef(currentUser.uid, safetySlot);
                transaction.set(safetyRef, {
                    ownerUid: currentUser.uid,
                    schemaVersion: CLIENT_SCHEMA_VERSION,
                    revision: previousRevision,
                    savedAt: firebasePlatform.serverTimestamp(),
                    snapshot: remote
                });
            }
            const bytes = estimateUtf8Bytes(merged);
            if (bytes >= CLOUD_SIZE_HARD_LIMIT_BYTES)
                throw new Error('CLOUD_DOCUMENT_TOO_LARGE');
            const payload = Object.assign({}, merged, {
                _sync: {
                    schemaVersion: CLIENT_SCHEMA_VERSION,
                    clientVersion: APP_VERSION,
                    minClientVersion: MIN_SUPPORTED_CLIENT_VERSION,
                    dataEpoch: merged.meta && merged.meta.dataEpoch ? merged.meta.dataEpoch : 'legacy-v1',
                    revision: previousRevision + 1,
                    serverUpdatedAt: firebasePlatform.serverTimestamp()
                }
            });
            transaction.set(docRef, payload);
        });
        clearExplicitMutationPending(currentSyncRevision);
        // The transaction commit is acknowledged by Firestore, but the UI waits
        // for the subsequent non-cache snapshot before displaying Synced.
        setSyncStatus('waiting');
    }
    catch (err) {
        if (runtimeErrorMessage(err).includes('CLIENT_UPDATE_REQUIRED')) {
            cloudWriteBlockedByVersion = true;
            setSyncStatus('update-required');
            showToast(uiText('Esta versión necesita actualizarse antes de sincronizar.', 'This version must be updated before syncing.'), 6500);
        }
        else if (runtimeErrorMessage(err).includes('CLOUD_DOCUMENT_TOO_LARGE')) {
            setSyncStatus('error');
            showToast(uiText('Sincronización detenida para evitar superar el límite de Firestore. Exporta un backup.', 'Sync stopped to avoid exceeding the Firestore limit. Export a backup.'), 6500);
        }
        else {
            setSyncStatus('error');
            console.error("Error sincronizando en Firestore:", err);
        }
    }
    finally {
        cloudSyncInFlight = false;
        if (cloudSyncPending || localMutationRevision > currentSyncRevision)
            scheduleCloudSync(true);
    }
}
function syncMergedStateToCloudIfNeeded(incomingCloud) {
    // v3.8: intentionally disabled. Receiving/merging cloud data is read-only.
    // A Firestore write may only originate from persistState({userMutation:true}).
    return;
}
/* Fusión bidireccional profunda con timestamps y tombstones */
function renderSettingsFormFromState() {
    const activeEl = document.activeElement;
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && el !== activeEl)
            el.value = String(value);
    };
    setValue('setting-goal-weight', displayWeight(state.settings.goalWeight || 180).toFixed(1));
    setValue('setting-cal-goal', state.settings.calGoal || 1400);
    setValue('setting-tdee', state.settings.tdee || 2000);
    setValue('setting-protein-goal', state.settings.proteinGoal || 110);
    setValue('setting-water-goal', Math.round(displayWater(state.settings.waterGoal || 96)));
    setValue('setting-language', state.settings.language || 'es');
    setValue('setting-units', state.settings.units || 'imperial');
    applyUnitLabels();
    updateLocalBackupStatus();
}
function applyCloudDataMerge(cloud, options = {}) {
    if (!cloud || typeof cloud !== 'object' || Array.isArray(cloud))
        return;
    ensureStateMetadata();
    updateServerClockAnchor(cloud);
    const localLanguage = state.settings && state.settings.language === 'en' ? 'en' : 'es';
    const localUnits = state.settings && state.settings.units === 'metric' ? 'metric' : 'imperial';
    const localSelectedDate = state.selectedDate || getFormattedDate(new Date());
    const cloudMetaRaw = (cloud.meta && typeof cloud.meta === 'object' && !Array.isArray(cloud.meta)) ? cloud.meta : {};
    const cloudMeta = {
        schemaVersion: Number(cloudMetaRaw.schemaVersion) || Number(cloud._sync && cloud._sync.schemaVersion) || 0,
        ownerUid: typeof cloudMetaRaw.ownerUid === 'string' ? cloudMetaRaw.ownerUid : (currentUser ? currentUser.uid : null),
        dataEpoch: typeof cloudMetaRaw.dataEpoch === 'string' && cloudMetaRaw.dataEpoch ? cloudMetaRaw.dataEpoch : (cloud._sync && cloud._sync.dataEpoch) || 'legacy-v1',
        resetAt: Number(cloudMetaRaw.resetAt) || 0,
        settingsUpdatedAt: Number(cloudMetaRaw.settingsUpdatedAt) || 0,
        settingsFieldUpdatedAt: (cloudMetaRaw.settingsFieldUpdatedAt && typeof cloudMetaRaw.settingsFieldUpdatedAt === 'object' && !Array.isArray(cloudMetaRaw.settingsFieldUpdatedAt)) ? cloudMetaRaw.settingsFieldUpdatedAt : {},
        clientVersion: String(cloudMetaRaw.clientVersion || (cloud._sync && cloud._sync.clientVersion) || '')
    };
    // A newer reset/restore generation is authoritative. This prevents an old
    // offline device from resurrecting records after Factory Reset or Restore.
    if (cloudMeta.dataEpoch !== state.meta.dataEpoch) {
        const localResetAt = Number(state.meta.resetAt) || 0;
        const cloudResetAt = Number(cloudMeta.resetAt) || 0;
        if (cloudResetAt > localResetAt || (cloudResetAt === localResetAt && cloudMeta.dataEpoch !== 'legacy-v1')) {
            const replacement = createDefaultState({ language: localLanguage, units: state.settings.units });
            const replacementCloudSettings = (cloud.settings && typeof cloud.settings === 'object' && !Array.isArray(cloud.settings)) ? Object.assign({}, cloud.settings) : {};
            delete replacementCloudSettings.language;
            delete replacementCloudSettings.units;
            replacement.settings = Object.assign(replacement.settings, replacementCloudSettings);
            replacement.settings.language = localLanguage;
            replacement.settings.units = localUnits;
            replacement.daysData = (cloud.daysData && typeof cloud.daysData === 'object' && !Array.isArray(cloud.daysData)) ? JSON.parse(JSON.stringify(cloud.daysData)) : {};
            replacement.injections = Array.isArray(cloud.injections) ? JSON.parse(JSON.stringify(cloud.injections)) : [];
            replacement.inventoryEvents = sanitizeInventoryEvents(cloud.inventoryEvents);
            replacement.weights = Array.isArray(cloud.weights) ? JSON.parse(JSON.stringify(cloud.weights)) : [];
            replacement.measurements = Array.isArray(cloud.measurements) ? JSON.parse(JSON.stringify(cloud.measurements)) : [];
            replacement.healthProfile = sanitizeHealthProfile(cloud.healthProfile);
            replacement.aiTelemetry = mergeAiTelemetry({}, cloud.aiTelemetry);
            replacement.deletedRecords = (cloud.deletedRecords && typeof cloud.deletedRecords === 'object' && !Array.isArray(cloud.deletedRecords)) ? JSON.parse(JSON.stringify(cloud.deletedRecords)) : { meals: {}, weights: {}, injections: {}, measurements: {}, bowelMovements: {} };
            replacement.meta = Object.assign(replacement.meta, cloudMeta, { schemaVersion: CLIENT_SCHEMA_VERSION, ownerUid: currentUser ? currentUser.uid : cloudMeta.ownerUid, clientVersion: APP_VERSION });
            replacement.selectedDate = localSelectedDate;
            state = replacement;
            cleanupTombstones();
            ensureV4State();
            if (!options.suppressLocalSave)
                writePrimaryLocalState();
            if (!options.suppressRender) {
                applyMedicationTheme();
                renderCurrentDay();
                if (activeTab === 'tools')
                    renderToolsView();
            }
            return;
        }
        if (localResetAt > cloudResetAt) {
            // Local reset/restore is newer; ignore the obsolete cloud generation.
            return;
        }
    }
    const cloudSettings = (cloud.settings && typeof cloud.settings === 'object' && !Array.isArray(cloud.settings)) ? Object.assign({}, cloud.settings) : {};
    delete cloudSettings.apiKey;
    delete cloudSettings.language;
    delete cloudSettings.units;
    const localSettingsTs = Number(state.meta.settingsUpdatedAt) || 0, cloudSettingsTs = Number(cloudMeta.settingsUpdatedAt) || 0;
    const localFieldTs = state.meta.settingsFieldUpdatedAt || {}, cloudFieldTs = cloudMeta.settingsFieldUpdatedAt || {};
    const localHasFieldMap = Object.keys(localFieldTs).length > 0, cloudHasFieldMap = Object.keys(cloudFieldTs).length > 0;
    const fieldStamp = (map, hasMap, globalTs, key, parentKey = null) => {
        if (Object.prototype.hasOwnProperty.call(map, key))
            return Number(map[key]) || 0;
        if (parentKey && Object.prototype.hasOwnProperty.call(map, parentKey))
            return Number(map[parentKey]) || 0;
        return hasMap ? 0 : globalTs; // global timestamp is legacy fallback only
    };
    let settingsChangedFromCloud = false;
    const mergeNestedSetting = (key) => {
        const settingsRecord = state.settings;
        const localValue = settingsRecord[key];
        const cloudValue = cloudSettings[key];
        const localObj = (localValue && typeof localValue === 'object' && !Array.isArray(localValue)) ? localValue : {};
        const cloudObj = (cloudValue && typeof cloudValue === 'object' && !Array.isArray(cloudValue)) ? cloudValue : {};
        const out = JSON.parse(JSON.stringify(localObj));
        new Set([...Object.keys(localObj), ...Object.keys(cloudObj)]).forEach((sub) => {
            const stampKey = `${key}.${sub}`, lts = fieldStamp(localFieldTs, localHasFieldMap, localSettingsTs, stampKey, key), cts = fieldStamp(cloudFieldTs, cloudHasFieldMap, cloudSettingsTs, stampKey, key);
            if (sub in cloudObj && (cts > lts || (cts === lts && cts === 0 && options.preferCloudOnTie !== false && !(sub in localObj)))) {
                out[sub] = JSON.parse(JSON.stringify(cloudObj[sub]));
                if (cts > 0)
                    state.meta.settingsFieldUpdatedAt[stampKey] = cts;
                settingsChangedFromCloud = true;
            }
        });
        settingsRecord[key] = out;
    };
    mergeNestedSetting('inventoryByProduct');
    mergeNestedSetting('inventoryBaseByProduct');
    mergeNestedSetting('roomTempTrackers');
    Object.keys(cloudSettings).forEach((key) => {
        if (['language', 'units', 'apiKey', 'inventoryByProduct', 'inventoryBaseByProduct', 'roomTempTrackers', 'pensInStock', 'roomTempTrackingEnabled', 'roomTempPenStart'].includes(key))
            return;
        const lts = fieldStamp(localFieldTs, localHasFieldMap, localSettingsTs, key), cts = fieldStamp(cloudFieldTs, cloudHasFieldMap, cloudSettingsTs, key);
        const cloudWins = cts > lts || (cts === lts && cts === 0 && options.preferCloudOnTie !== false && !(key in state.settings));
        if (cloudWins) {
            state.settings[key] = JSON.parse(JSON.stringify(cloudSettings[key]));
            if (cts > 0)
                state.meta.settingsFieldUpdatedAt[key] = cts;
            settingsChangedFromCloud = true;
        }
    });
    state.meta.settingsUpdatedAt = Math.max(localSettingsTs, cloudSettingsTs, ...Object.values(state.meta.settingsFieldUpdatedAt || {}).map((v) => Number(v) || 0), 0);
    state.settings.language = localLanguage;
    state.settings.units = localUnits;
    if (settingsChangedFromCloud) {
        ensureV4State();
        renderSettingsFormFromState();
    }
    state.meta.dataEpoch = cloudMeta.dataEpoch || state.meta.dataEpoch;
    state.meta.resetAt = Math.max(Number(state.meta.resetAt) || 0, cloudMeta.resetAt || 0);
    state.meta.ownerUid = currentUser ? currentUser.uid : (state.meta.ownerUid || cloudMeta.ownerUid);
    state.meta.schemaVersion = CLIENT_SCHEMA_VERSION;
    state.meta.clientVersion = APP_VERSION;
    // v4.0.5 Health Profile: last-write-wins by explicit updatedAt.
    const localHealth = sanitizeHealthProfile(state.healthProfile);
    const cloudHealth = sanitizeHealthProfile(cloud.healthProfile);
    if (cloudHealth.updatedAt > localHealth.updatedAt || (cloudHealth.updatedAt === localHealth.updatedAt && options.preferCloudOnTie !== false && cloudHealth.updatedAt > 0)) {
        state.healthProfile = cloudHealth;
    }
    else {
        state.healthProfile = localHealth;
    }
    // v4.0.5 AI telemetry: per-device monotonic counters prevent cross-device increments from being lost.
    state.aiTelemetry = mergeAiTelemetry(state.aiTelemetry, cloud.aiTelemetry);
    // v4.1.2 inventory ledger: merge per-event IDs so two offline devices can
    // consume different doses without collapsing both changes into one LWW count.
    const inventoryEventMap = new Map();
    [...sanitizeInventoryEvents(cloud.inventoryEvents), ...sanitizeInventoryEvents(state.inventoryEvents)].forEach((evt) => {
        const prev = inventoryEventMap.get(evt.id);
        if (!prev || evt.updatedAt >= prev.updatedAt)
            inventoryEventMap.set(evt.id, evt);
    });
    state.inventoryEvents = Array.from(inventoryEventMap.values());
    ensureInventoryLedgerState();
    // Fusión de registros eliminados (tombstones)
    if (cloud.deletedRecords && typeof cloud.deletedRecords === 'object' && !Array.isArray(cloud.deletedRecords)) {
        ['meals', 'weights', 'injections', 'measurements', 'bowelMovements'].forEach((type) => {
            if (!state.deletedRecords[type])
                state.deletedRecords[type] = {};
            const cloudDeletes = (cloud.deletedRecords[type] && typeof cloud.deletedRecords[type] === 'object')
                ? cloud.deletedRecords[type]
                : {};
            Object.keys(cloudDeletes).forEach((id) => {
                const cloudDelTime = Number(cloudDeletes[id]);
                if (!Number.isFinite(cloudDelTime) || cloudDelTime <= 0)
                    return;
                const localDelTime = Number(state.deletedRecords[type][id]) || 0;
                state.deletedRecords[type][id] = Math.max(localDelTime, cloudDelTime);
            });
        });
    }
    cleanupTombstones();
    // Fusión profunda de días
    if (cloud.daysData && typeof cloud.daysData === 'object' && !Array.isArray(cloud.daysData)) {
        Object.keys(cloud.daysData).forEach((dateKey) => {
            if (!isValidDateKey(dateKey))
                return;
            const rawCloudDay = cloud.daysData[dateKey];
            if (!rawCloudDay || typeof rawCloudDay !== 'object' || Array.isArray(rawCloudDay))
                return;
            const cloudDay = JSON.parse(JSON.stringify(rawCloudDay));
            const cloudMeals = Array.isArray(cloudDay.meals) ? cloudDay.meals : [];
            const cloudBowelMovements = Array.isArray(cloudDay.bowelMovements) ? cloudDay.bowelMovements : [];
            if (!state.daysData[dateKey] || typeof state.daysData[dateKey] !== 'object' || Array.isArray(state.daysData[dateKey])) {
                cloudDay.meals = cloudMeals.filter((m) => {
                    if (!m || typeof m !== 'object' || !m.id)
                        return false;
                    const delTime = Number(state.deletedRecords.meals[m.id]) || 0;
                    return delTime <= (Number(m.updatedAt) || 0);
                });
                cloudDay.bowelMovements = cloudBowelMovements.filter((bm) => typeof bm === 'string' && !isNaN(new Date(bm).getTime()));
                cloudDay.bowelMovementsUpdatedAt = Number(cloudDay.bowelMovementsUpdatedAt) || 0;
                state.daysData[dateKey] = cloudDay;
                ensureGranularDayData(dateKey, state.daysData[dateKey]);
            }
            else {
                const localDay = state.daysData[dateKey];
                const localMeals = Array.isArray(localDay.meals) ? localDay.meals : [];
                // Fusión de comidas por ID respetando tombstones y updatedAt
                const mealMap = new Map();
                cloudMeals.forEach((m) => {
                    if (m && typeof m === 'object' && m.id) {
                        const delTime = Number(state.deletedRecords.meals[m.id]) || 0;
                        if (delTime <= (Number(m.updatedAt) || 0)) {
                            mealMap.set(m.id, m);
                        }
                    }
                });
                localMeals.forEach((m) => {
                    if (m && typeof m === 'object' && m.id) {
                        const delTime = Number(state.deletedRecords.meals[m.id]) || 0;
                        if (delTime <= (Number(m.updatedAt) || 0)) {
                            if (!mealMap.has(m.id)) {
                                mealMap.set(m.id, m);
                            }
                            else {
                                const existing = mealMap.get(m.id);
                                if ((Number(m.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
                                    mealMap.set(m.id, m);
                                }
                            }
                        }
                    }
                });
                localDay.meals = Array.from(mealMap.values());
                // v4.0.6 water: merge immutable additive events by ID so concurrent
                // offline additions from two devices are preserved instead of last-write-wins.
                ensureGranularDayData(dateKey, localDay);
                ensureGranularDayData(dateKey, cloudDay);
                const waterMap = new Map();
                [...(cloudDay.waterEvents || []), ...(localDay.waterEvents || [])].forEach((e) => {
                    if (!e || !e.id)
                        return;
                    const prev = waterMap.get(e.id);
                    if (!prev || (Number(e.updatedAt) || 0) >= (Number(prev.updatedAt) || 0))
                        waterMap.set(e.id, { id: e.id, delta: Number(e.delta) || 0, updatedAt: Number(e.updatedAt) || 0 });
                });
                localDay.waterEvents = Array.from(waterMap.values());
                recalcWaterFromEvents(localDay);
                // v4.0.6 bowel movements: records have unique IDs and deletion tombstones.
                const bmMap = new Map();
                [...(cloudDay.bowelMovementRecords || []), ...(localDay.bowelMovementRecords || [])].forEach((r) => {
                    if (!r || !r.id)
                        return;
                    const del = Number(state.deletedRecords.bowelMovements?.[r.id]) || 0;
                    if (del > (Number(r.updatedAt) || 0))
                        return;
                    const prev = bmMap.get(r.id);
                    if (!prev || (Number(r.updatedAt) || 0) >= (Number(prev.updatedAt) || 0))
                        bmMap.set(r.id, r);
                });
                localDay.bowelMovementRecords = Array.from(bmMap.values());
                ensureGranularDayData(dateKey, localDay);
                // Fusión de síntomas mediante timestamp
                const localSymptomsTs = Number(localDay.symptomsUpdatedAt) || 0;
                const cloudSymptomsTs = Number(cloudDay.symptomsUpdatedAt) || 0;
                if (cloudSymptomsTs && (!localSymptomsTs || cloudSymptomsTs > localSymptomsTs)) {
                    localDay.symptoms = (cloudDay.symptoms && typeof cloudDay.symptoms === 'object' && !Array.isArray(cloudDay.symptoms))
                        ? cloudDay.symptoms
                        : {};
                    localDay.symptomsUpdatedAt = cloudSymptomsTs;
                }
                else if (!localSymptomsTs && !cloudSymptomsTs) {
                    localDay.symptoms = Object.assign({}, (cloudDay.symptoms && typeof cloudDay.symptoms === 'object' && !Array.isArray(cloudDay.symptoms)) ? cloudDay.symptoms : {}, (localDay.symptoms && typeof localDay.symptoms === 'object' && !Array.isArray(localDay.symptoms)) ? localDay.symptoms : {});
                }
                // Fusión de electrolitos mediante timestamp
                const localElectrolytesTs = Number(localDay.electrolytesUpdatedAt) || 0;
                const cloudElectrolytesTs = Number(cloudDay.electrolytesUpdatedAt) || 0;
                if (cloudElectrolytesTs && (!localElectrolytesTs || cloudElectrolytesTs > localElectrolytesTs)) {
                    localDay.electrolytes = (cloudDay.electrolytes && typeof cloudDay.electrolytes === 'object' && !Array.isArray(cloudDay.electrolytes))
                        ? cloudDay.electrolytes
                        : {};
                    localDay.electrolytesUpdatedAt = cloudElectrolytesTs;
                }
                else if (!localElectrolytesTs && !cloudElectrolytesTs) {
                    localDay.electrolytes = Object.assign({}, (cloudDay.electrolytes && typeof cloudDay.electrolytes === 'object' && !Array.isArray(cloudDay.electrolytes)) ? cloudDay.electrolytes : {}, (localDay.electrolytes && typeof localDay.electrolytes === 'object' && !Array.isArray(localDay.electrolytes)) ? localDay.electrolytes : {});
                }
            }
        });
    }
    // Fusión de pesajes con tombstones y updatedAt
    if (Array.isArray(cloud.weights)) {
        const weightMap = new Map();
        (Array.isArray(state.weights) ? state.weights : []).forEach((w) => {
            if (!w || typeof w !== 'object' || Array.isArray(w))
                return;
            const date = normalizeDateKey(w.date);
            const num = parseFloat(String(w.weight));
            if (!date || !Number.isFinite(num) || num <= 0)
                return;
            const delTime = Number(state.deletedRecords.weights[date]) || 0;
            if (delTime <= (Number(w.updatedAt) || 0)) {
                weightMap.set(date, Object.assign({}, w, { date, weight: num }));
            }
        });
        cloud.weights.forEach((w) => {
            if (!w || typeof w !== 'object' || Array.isArray(w))
                return;
            const date = normalizeDateKey(w.date);
            const num = parseFloat(String(w.weight));
            if (!date || !Number.isFinite(num) || num <= 0)
                return;
            const delTime = Number(state.deletedRecords.weights[date]) || 0;
            if (delTime <= (Number(w.updatedAt) || 0)) {
                const normalized = Object.assign({}, w, { date, weight: num });
                if (!weightMap.has(date)) {
                    weightMap.set(date, normalized);
                }
                else {
                    const existing = weightMap.get(date);
                    if ((Number(normalized.updatedAt) || 0) > (Number(existing.updatedAt) || 0)) {
                        weightMap.set(date, normalized);
                    }
                }
            }
        });
        state.weights = (Array.from(weightMap.values())).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    // Fusión de inyecciones con tombstones y updatedAt
    if (Array.isArray(cloud.injections)) {
        const injMap = new Map();
        (Array.isArray(state.injections) ? state.injections : []).forEach((i) => {
            if (!i || typeof i !== 'object' || !i.id)
                return;
            const delTime = Number(state.deletedRecords.injections[i.id]) || 0;
            if (delTime <= (Number(i.updatedAt) || 0)) {
                injMap.set(i.id, i);
            }
        });
        cloud.injections.forEach((i) => {
            if (i && typeof i === 'object' && i.id) {
                const delTime = Number(state.deletedRecords.injections[i.id]) || 0;
                if (delTime <= (Number(i.updatedAt) || 0)) {
                    if (!injMap.has(i.id)) {
                        injMap.set(i.id, i);
                    }
                    else {
                        const existing = injMap.get(i.id);
                        if ((Number(i.updatedAt) || 0) > (Number(existing.updatedAt) || 0)) {
                            injMap.set(i.id, i);
                        }
                    }
                }
            }
        });
        state.injections = Array.from(injMap.values());
        ensureInjectionIds();
    }
    // Fusión de medidas corporales con tombstones y updatedAt
    if (Array.isArray(cloud.measurements)) {
        const measMap = new Map();
        (Array.isArray(state.measurements) ? state.measurements : []).forEach((m) => {
            if (!m || typeof m !== 'object' || Array.isArray(m))
                return;
            const date = normalizeDateKey(m.date);
            if (!date)
                return;
            const delTime = Number(state.deletedRecords.measurements[date]) || 0;
            if (delTime <= (Number(m.updatedAt) || 0)) {
                measMap.set(date, Object.assign({}, m, { date }));
            }
        });
        cloud.measurements.forEach((m) => {
            if (!m || typeof m !== 'object' || Array.isArray(m))
                return;
            const date = normalizeDateKey(m.date);
            if (!date)
                return;
            const delTime = Number(state.deletedRecords.measurements[date]) || 0;
            if (delTime <= (Number(m.updatedAt) || 0)) {
                const normalized = Object.assign({}, m, { date });
                if (!measMap.has(date)) {
                    measMap.set(date, normalized);
                }
                else {
                    const existing = measMap.get(date);
                    if ((Number(normalized.updatedAt) || 0) > (Number(existing.updatedAt) || 0)) {
                        measMap.set(date, normalized);
                    }
                }
            }
        });
        state.measurements = (Array.from(measMap.values())).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    cleanupTombstones();
    ensureInventoryLedgerState();
    ensureStateMetadata();
    state.selectedDate = localSelectedDate;
    state.settings.language = localLanguage;
    state.settings.units = localUnits;
    if (!options.suppressLocalSave)
        writePrimaryLocalState();
    if (!options.suppressRender) {
        applyMedicationTheme();
        renderCurrentDay();
        if (activeTab === 'tools')
            renderToolsView();
        renderAiStatus();
    }
    // v3.8: cloud snapshots are never written back automatically.
}
function replaceStateFromCloudCanonical(cloud) {
    if (!cloud || typeof cloud !== 'object' || Array.isArray(cloud))
        return;
    try {
        localStorage.setItem(PRE_CLOUD_REPLACE_BACKUP_KEY, JSON.stringify({ savedAt: Date.now(), state }));
    }
    catch (_) { }
    const localLanguage = state?.settings?.language === 'en' ? 'en' : 'es';
    const localUnits = state?.settings?.units === 'metric' ? 'metric' : 'imperial';
    const localSelectedDate = state?.selectedDate || getFormattedDate(new Date());
    // Start from a neutral state so stale local values cannot win merely because
    // they existed on this device. Then hydrate from the confirmed server copy.
    state = createDefaultState({ language: localLanguage, units: localUnits });
    state.selectedDate = localSelectedDate;
    if (currentUser)
        state.meta.ownerUid = currentUser.uid;
    applyCloudDataMerge(cloud, {
        skipCloudWrite: true,
        preferCloudOnTie: true,
        suppressRender: true
    });
    state.selectedDate = localSelectedDate;
    state.settings.language = localLanguage;
    ensureStateMetadata();
    writePrimaryLocalState();
    applyMedicationTheme();
    renderCurrentDay();
    if (activeTab === 'tools')
        renderToolsView();
    renderAiStatus();
}
function setupFirebaseAuthListener() {
    firebasePlatform.onAuthStateChanged((user) => {
        currentUser = user;
        const authLabel = document.getElementById('auth-label-header');
        cloudInitialReadComplete = false;
        cloudSyncDeferredUntilBootstrap = false;
        cloudWriteBlockedByVersion = false;
        if (cloudSyncTimer) {
            clearTimeout(cloudSyncTimer);
            cloudSyncTimer = null;
        }
        if (unsubscribeFirestore) {
            unsubscribeFirestore();
            unsubscribeFirestore = null;
        }
        if (user) {
            clearPrivacyLock();
            renderPrivacyLock();
            bindStateToAuthenticatedUser(user.uid);
            setSyncStatus('waiting');
            if (authLabel)
                authLabel.innerText = uiText("Salir", "Sign out");
            const docRef = firebasePlatform.trackerRef(user.uid);
            let serverBootstrapComplete = false;
            unsubscribeFirestore = firebasePlatform.listenTracker(user.uid, (docSnap) => {
                // Cache snapshots never unlock cloud writes and never count as Synced.
                if (docSnap.metadata && docSnap.metadata.fromCache) {
                    if (!serverBootstrapComplete)
                        setSyncStatus('waiting');
                    return;
                }
                const isPending = Boolean(docSnap.metadata && docSnap.metadata.hasPendingWrites);
                const cloud = docSnap.exists() ? docSnap.data() : null;
                if (cloud)
                    updateServerClockAnchor(cloud);
                const minRequired = cloud && cloud._sync && cloud._sync.minClientVersion;
                if (minRequired && versionNumber(APP_VERSION) < versionNumber(minRequired)) {
                    cloudWriteBlockedByVersion = true;
                    setSyncStatus('update-required');
                    showToast(uiText('Hay una versión más nueva requerida para proteger tus datos.', 'A newer version is required to protect your data.'), 6500);
                    return;
                }
                if (!serverBootstrapComplete) {
                    serverBootstrapComplete = true;
                    cloudInitialReadComplete = true;
                    if (docSnap.exists()) {
                        if (pendingExplicitMutation) {
                            // Preserve only genuine user changes that were explicitly marked
                            // pending. Never upload them merely because the app opened.
                            applyCloudDataMerge(cloud, { skipCloudWrite: true, preferCloudOnTie: true });
                            setSyncStatus('waiting');
                            if (pendingExplicitMutation) {
                                scheduleCloudSync(true);
                            }
                        }
                        else {
                            // No pending user mutation: the confirmed server document is
                            // authoritative. Stale local/default values cannot compete.
                            replaceStateFromCloudCanonical(cloud);
                            if (!isPending)
                                setSyncStatus('synced');
                        }
                    }
                    else {
                        // An empty cloud is not an invitation to upload local data on open.
                        // Only a user mutation made in this session may create the document.
                        if (pendingExplicitMutation) {
                            setSyncStatus('waiting');
                            if (pendingExplicitMutation) {
                                scheduleCloudSync(true);
                            }
                        }
                        else if (!isPending) {
                            setSyncStatus('local');
                        }
                    }
                    cloudSyncDeferredUntilBootstrap = false;
                    hadLocalStateAtBoot = true;
                    return;
                }
                // Never let an incoming snapshot overwrite an explicit local mutation
                // while it is pending/in flight. The transaction reads the latest server
                // state and resolves concurrency before writing.
                if (pendingExplicitMutation || cloudSyncInFlight) {
                    setSyncStatus('syncing');
                    return;
                }
                if (docSnap.exists()) {
                    replaceStateFromCloudCanonical(cloud);
                    if (!isPending)
                        setSyncStatus('synced');
                    else
                        setSyncStatus('syncing');
                }
                else if (!isPending) {
                    setSyncStatus('local');
                }
            }, (err) => {
                setSyncStatus('error');
                console.error("Error en escucha Firestore:", err);
            });
            showToast(isEnglish() ? `Connected as: ${user.email}` : `Conectado como: ${user.email}`);
        }
        else {
            clearPrivacyLock();
            renderPrivacyLock();
            cloudInitialReadComplete = false;
            cloudSyncDeferredUntilBootstrap = false;
            cloudWriteBlockedByVersion = false;
            setSyncStatus('local');
            if (authLabel)
                authLabel.innerText = uiText("Entrar", "Sign in");
        }
        lucide.createIcons();
    });
}
async function handleAuthAction() {
    if (currentUser) {
        try {
            clearPrivacyLock();
            await firebasePlatform.signOut();
            renderPrivacyLock();
            showToast(uiText("Sesión cerrada. La sincronización en la nube está desactivada; puedes seguir usando tus registros locales.", "Signed out. Cloud sync is off; you can continue using your local records."));
        }
        catch (err) {
            showToast(uiText("Error al cerrar sesión: ", "Sign-out error: ") + runtimeErrorMessage(err));
        }
    }
    else {
        try {
            await firebasePlatform.signInWithPopup();
        }
        catch (err) {
            console.error("Error al autenticar:", err);
            const fallbackCodes = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']);
            if (fallbackCodes.has(runtimeErrorCode(err))) {
                showToast(uiText('El navegador bloqueó la ventana. Cambiando al inicio de sesión por redirección…', 'The browser blocked the popup. Switching to redirect sign-in…'));
                try {
                    await firebasePlatform.signInWithRedirect();
                    return;
                }
                catch (redirectErr) {
                    console.error('Redirect sign-in failed:', redirectErr);
                }
            }
            showToast(uiText("Error de conexión: ", "Connection error: ") + runtimeErrorMessage(err));
        }
    }
}
