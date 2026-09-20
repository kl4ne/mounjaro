"use strict";
/**
 * GLP-1 Companion v5 Phase 3 compatibility module
 * Medication profiles, presentations, inventory/storage helpers and daily model access.
 *
 * Loaded as an ordered classic script on purpose: this preserves the existing
 * shared global lexical environment and inline-handler contract while the v5
 * architecture is modularized without behavior changes.
 */
/* ==========================================================================
   MEDICATION PROFILES — compatible with existing v3 data model
   ========================================================================== */
const MEDICATION_PROFILES = {
    mounjaro: { key: 'mounjaro', name: 'Mounjaro', generic: 'tirzepatide', route: 'injection', frequencyDays: 7, halfLifeDays: 5, pkTmaxHours: 24, roomTempDays: 21, roomTempMaxF: 86, roomTempMaxC: 30, inventoryUnitEs: 'unidades', inventoryUnitEn: 'units', doses: [
            ['2.5 mg', 'Dosis inicial', 'Starter dose'], ['5.0 mg', 'Dosis', 'Dose'], ['7.5 mg', 'Dosis', 'Dose'], ['10.0 mg', 'Dosis', 'Dose'], ['12.5 mg', 'Dosis', 'Dose'], ['15.0 mg', 'Dosis', 'Dose']
        ] },
    zepbound: { key: 'zepbound', name: 'Zepbound', generic: 'tirzepatide', route: 'injection', frequencyDays: 7, halfLifeDays: 5, pkTmaxHours: 24, roomTempDays: 21, roomTempMaxF: 86, roomTempMaxC: 30, inventoryUnitEs: 'unidades', inventoryUnitEn: 'units', doses: [
            ['2.5 mg', 'Dosis inicial', 'Starter dose'], ['5.0 mg', 'Dosis', 'Dose'], ['7.5 mg', 'Dosis', 'Dose'], ['10.0 mg', 'Dosis', 'Dose'], ['12.5 mg', 'Dosis', 'Dose'], ['15.0 mg', 'Dosis', 'Dose']
        ] },
    ozempic: { key: 'ozempic', name: 'Ozempic', generic: 'semaglutide', route: 'injection', frequencyDays: 7, halfLifeDays: 7, pkTmaxHours: 48, roomTempDays: 56, roomTempMaxF: 86, roomTempMaxC: 30, inventoryUnitEs: 'unidades', inventoryUnitEn: 'units', doses: [
            ['0.25 mg', 'Dosis inicial', 'Starter dose'], ['0.5 mg', 'Dosis', 'Dose'], ['1.0 mg', 'Dosis', 'Dose'], ['2.0 mg', 'Dosis', 'Dose']
        ] },
    wegovy: { key: 'wegovy', name: 'Wegovy', generic: 'semaglutide', route: 'injection', frequencyDays: 7, halfLifeDays: 7, pkTmaxHours: 48, roomTempDays: 28, roomTempMaxF: 86, roomTempMaxC: 30, inventoryUnitEs: 'unidades', inventoryUnitEn: 'units', doses: [
            ['0.25 mg', 'Dosis inicial', 'Starter dose'], ['0.5 mg', 'Dosis', 'Dose'], ['1.0 mg', 'Dosis', 'Dose'], ['1.7 mg', 'Dosis', 'Dose'], ['2.4 mg', 'Dosis', 'Dose']
        ] },
    trulicity: { key: 'trulicity', name: 'Trulicity', generic: 'dulaglutide', route: 'injection', frequencyDays: 7, halfLifeDays: 5, pkTmaxHours: 48, roomTempDays: 14, roomTempMaxF: 86, roomTempMaxC: 30, inventoryUnitEs: 'unidades', inventoryUnitEn: 'units', doses: [
            ['0.75 mg', 'Dosis', 'Dose'], ['1.5 mg', 'Dosis', 'Dose'], ['3.0 mg', 'Dosis', 'Dose'], ['4.5 mg', 'Dosis', 'Dose']
        ] },
    saxenda: { key: 'saxenda', name: 'Saxenda', generic: 'liraglutide', route: 'injection', frequencyDays: 1, halfLifeDays: 0.54, pkTmaxHours: 11, roomTempDays: 30, roomTempMaxF: 86, roomTempMaxC: 30, inventoryUnitEs: 'unidades', inventoryUnitEn: 'units', doses: [
            ['0.6 mg', 'Dosis', 'Dose'], ['1.2 mg', 'Dosis', 'Dose'], ['1.8 mg', 'Dosis', 'Dose'], ['2.4 mg', 'Dosis', 'Dose'], ['3.0 mg', 'Dosis', 'Dose']
        ] },
    victoza: { key: 'victoza', name: 'Victoza', generic: 'liraglutide', route: 'injection', frequencyDays: 1, halfLifeDays: 0.54, pkTmaxHours: 11, roomTempDays: 30, roomTempMaxF: 86, roomTempMaxC: 30, inventoryUnitEs: 'unidades', inventoryUnitEn: 'units', doses: [
            ['0.6 mg', 'Dosis', 'Dose'], ['1.2 mg', 'Dosis', 'Dose'], ['1.8 mg', 'Dosis', 'Dose']
        ] },
    ozempic_tablets: { key: 'ozempic_tablets', name: 'Ozempic Tablets', generic: 'semaglutide', route: 'oral', frequencyDays: 1, halfLifeDays: 7, pkTmaxHours: 1, roomTempDays: null, inventoryUnitEs: 'tabletas', inventoryUnitEn: 'tablets', doses: [
            ['1.5 mg', 'Dosis inicial', 'Starter dose'], ['4 mg', 'Dosis', 'Dose'], ['9 mg', 'Dosis', 'Dose']
        ] }
};
const MEDICATION_PRESENTATIONS = Object.freeze({
    mounjaro: [
        { key: 'single_dose', es: 'Pluma o vial monodosis', en: 'Single-dose pen or vial', timerMode: 'cumulative_room', roomTempDays: 21, maxF: 86, maxC: 30, inventoryMode: 'perDose' },
        { key: 'multi_dose', es: 'Vial multidosis / KwikPen (4 dosis)', en: 'Multi-dose vial / KwikPen (4 doses)', timerMode: 'combined', roomTempDays: 30, firstUseDays: 30, maxUnitDoses: 4, maxF: 86, maxC: 30, inventoryMode: 'manual' }
    ],
    zepbound: [
        { key: 'single_dose', es: 'Pluma o vial monodosis', en: 'Single-dose pen or vial', timerMode: 'cumulative_room', roomTempDays: 21, noReturnToFridge: true, maxF: 86, maxC: 30, inventoryMode: 'perDose' },
        { key: 'multi_dose', es: 'Vial multidosis / KwikPen (4 dosis)', en: 'Multi-dose vial / KwikPen (4 doses)', timerMode: 'combined', roomTempDays: 30, firstUseDays: 30, maxUnitDoses: 4, maxF: 86, maxC: 30, inventoryMode: 'manual' }
    ],
    ozempic: [
        { key: 'multi_pen', es: 'Pluma multidosis', en: 'Multi-dose pen', timerMode: 'first_use', firstUseDays: 56, roomTempDays: 56, maxF: 86, maxC: 30, inventoryMode: 'manual' },
        { key: 'single_syringe', es: 'Jeringa prellenada monodosis', en: 'Single-dose prefilled syringe', timerMode: 'cumulative_room', roomTempDays: 28, maxF: 86, maxC: 30, inventoryMode: 'perDose' }
    ],
    wegovy: [{ key: 'single_pen', es: 'Pluma monodosis', en: 'Single-dose pen', timerMode: 'cumulative_room', roomTempDays: 28, maxF: 86, maxC: 30, inventoryMode: 'perDose' }],
    trulicity: [{ key: 'single_pen', es: 'Pluma monodosis', en: 'Single-dose pen', timerMode: 'cumulative_room', roomTempDays: 14, maxF: 86, maxC: 30, inventoryMode: 'perDose' }],
    saxenda: [{ key: 'multi_pen', es: 'Pluma multidosis', en: 'Multi-dose pen', timerMode: 'first_use', firstUseDays: 30, roomTempDays: 30, maxF: 86, maxC: 30, inventoryMode: 'manual' }],
    victoza: [{ key: 'multi_pen', es: 'Pluma multidosis', en: 'Multi-dose pen', timerMode: 'first_use', firstUseDays: 30, roomTempDays: 30, maxF: 86, maxC: 30, inventoryMode: 'manual' }],
    ozempic_tablets: [{ key: 'tablets', es: 'Tabletas', en: 'Tablets', timerMode: 'none', roomTempDays: null, maxF: null, maxC: null, inventoryMode: 'perDose' }]
});
function getPresentationOptions(medKey = state?.settings?.medication || 'mounjaro') { return MEDICATION_PRESENTATIONS[medKey] || [{ key: 'default', es: 'Estándar', en: 'Standard', timerMode: 'none', inventoryMode: 'manual' }]; }
function getDefaultPresentationKey(medKey = state?.settings?.medication || 'mounjaro') { return getPresentationOptions(medKey)[0].key; }
function getPresentationProfile(medKey = state?.settings?.medication || 'mounjaro', presentationKey = state?.settings?.presentation) { const opts = getPresentationOptions(medKey); return opts.find((x) => x.key === presentationKey) || opts[0]; }
function getProductKey(medKey = state?.settings?.medication || 'mounjaro', presentationKey = state?.settings?.presentation) { return `${medKey}:${presentationKey || getDefaultPresentationKey(medKey)}`; }
function getCurrentProductKey() { return getProductKey(state.settings.medication, state.settings.presentation); }
function sanitizeInventoryEvents(input) {
    if (!Array.isArray(input))
        return [];
    const byId = new Map();
    input.forEach((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return;
        const obj = raw;
        const id = typeof obj.id === 'string' ? obj.id.trim() : '';
        const productKey = typeof obj.productKey === 'string' ? obj.productKey.trim() : '';
        const delta = Math.trunc(Number(obj.delta));
        const updatedAt = Math.max(0, Math.floor(Number(obj.updatedAt) || 0));
        if (!id || !productKey || !Number.isFinite(delta) || Math.abs(delta) > 10000)
            return;
        const evt = { id: id.slice(0, 180), productKey: productKey.slice(0, 180), delta, reason: String(obj.reason || 'manual').slice(0, 40), sourceId: String(obj.sourceId || '').slice(0, 180), updatedAt };
        const prev = byId.get(evt.id);
        if (!prev || evt.updatedAt >= prev.updatedAt)
            byId.set(evt.id, evt);
    });
    return Array.from(byId.values());
}
function inventoryEventTotal(productKey) {
    return sanitizeInventoryEvents(state.inventoryEvents).reduce((sum, e) => e.productKey === productKey ? sum + e.delta : sum, 0);
}
function recalcInventoryCount(productKey = getCurrentProductKey()) {
    if (!state.settings.inventoryByProduct || typeof state.settings.inventoryByProduct !== 'object' || Array.isArray(state.settings.inventoryByProduct))
        state.settings.inventoryByProduct = {};
    if (!state.settings.inventoryBaseByProduct || typeof state.settings.inventoryBaseByProduct !== 'object' || Array.isArray(state.settings.inventoryBaseByProduct))
        state.settings.inventoryBaseByProduct = {};
    const baseRaw = Number(state.settings.inventoryBaseByProduct[productKey]);
    const base = Number.isFinite(baseRaw) && baseRaw >= 0 ? Math.floor(baseRaw) : 0;
    const count = Math.max(0, base + inventoryEventTotal(productKey));
    state.settings.inventoryByProduct[productKey] = count;
    if (productKey === getCurrentProductKey())
        state.settings.pensInStock = count;
    return count;
}
function ensureInventoryLedgerState(productKey = getCurrentProductKey()) {
    if (!state.settings.inventoryByProduct || typeof state.settings.inventoryByProduct !== 'object' || Array.isArray(state.settings.inventoryByProduct))
        state.settings.inventoryByProduct = {};
    if (!state.settings.inventoryBaseByProduct || typeof state.settings.inventoryBaseByProduct !== 'object' || Array.isArray(state.settings.inventoryBaseByProduct))
        state.settings.inventoryBaseByProduct = {};
    state.inventoryEvents = sanitizeInventoryEvents(state.inventoryEvents);
    const keys = new Set([...Object.keys(state.settings.inventoryByProduct), ...Object.keys(state.settings.inventoryBaseByProduct), productKey]);
    keys.forEach((key) => {
        if (!key)
            return;
        if (!Number.isFinite(Number(state.settings.inventoryBaseByProduct[key]))) {
            const legacy = Number(state.settings.inventoryByProduct[key]);
            const fallback = key === productKey ? Number(state.settings.pensInStock) : 0;
            state.settings.inventoryBaseByProduct[key] = Math.max(0, Math.floor(Number.isFinite(legacy) ? legacy : (Number.isFinite(fallback) ? fallback : 0)));
        }
        recalcInventoryCount(key);
    });
}
function getInventoryCount(productKey = getCurrentProductKey()) { ensureInventoryLedgerState(productKey); return recalcInventoryCount(productKey); }
function setInventoryCount(value, productKey = getCurrentProductKey()) {
    ensureInventoryLedgerState(productKey);
    const target = Math.max(0, Math.floor(Number(value) || 0));
    state.settings.inventoryBaseByProduct[productKey] = Math.max(0, target - inventoryEventTotal(productKey));
    return recalcInventoryCount(productKey);
}
function upsertInventoryEvent(id, delta, productKey = getCurrentProductKey(), reason = 'manual', sourceId = '') {
    ensureInventoryLedgerState(productKey);
    const eventId = String(id || '').trim();
    if (!eventId)
        return getInventoryCount(productKey);
    const d = Math.trunc(Number(delta) || 0);
    const ts = mutationNow();
    const evt = { id: eventId.slice(0, 180), productKey: String(productKey).slice(0, 180), delta: d, reason: String(reason || 'manual').slice(0, 40), sourceId: String(sourceId || '').slice(0, 180), updatedAt: ts };
    const idx = state.inventoryEvents.findIndex((e) => e && e.id === evt.id);
    if (idx >= 0)
        state.inventoryEvents[idx] = evt;
    else
        state.inventoryEvents.push(evt);
    return recalcInventoryCount(productKey);
}
function recordInventoryDelta(delta, productKey = getCurrentProductKey(), reason = 'manual', sourceId = '') {
    ensureInventoryLedgerState(productKey);
    const requested = Math.trunc(Number(delta) || 0);
    if (!requested)
        return getInventoryCount(productKey);
    const current = getInventoryCount(productKey);
    const actual = requested < 0 ? Math.max(requested, -current) : requested;
    if (!actual)
        return current;
    const ts = mutationNow();
    const id = `inv_${ts}_${Math.random().toString(36).slice(2, 9)}`;
    state.inventoryEvents.push({ id, productKey: String(productKey).slice(0, 180), delta: actual, reason: String(reason || 'manual').slice(0, 40), sourceId: String(sourceId || '').slice(0, 180), updatedAt: ts });
    return recalcInventoryCount(productKey);
}
function getDoseInventoryEventId(injectionId) { return `dose:${String(injectionId || '')}`; }
function getLegacyReturnInventoryEventId(injectionId) { return `legacy-return:${String(injectionId || '')}`; }
function hasInventoryEvent(id) { return Array.isArray(state.inventoryEvents) && state.inventoryEvents.some((e) => e && e.id === id); }
function consumeInventoryForDose(injectionId, productKey) {
    return upsertInventoryEvent(getDoseInventoryEventId(injectionId), -1, productKey, 'dose', injectionId);
}
function returnInventoryForDeletedDose(injectionId, productKey) {
    const doseId = getDoseInventoryEventId(injectionId);
    if (hasInventoryEvent(doseId))
        return upsertInventoryEvent(doseId, 0, productKey, 'dose-deleted', injectionId);
    return upsertInventoryEvent(getLegacyReturnInventoryEventId(injectionId), 1, productKey, 'legacy-dose-return', injectionId);
}
function reverseInventoryReturnForUndo(injectionId, productKey) {
    const doseId = getDoseInventoryEventId(injectionId);
    if (hasInventoryEvent(doseId))
        return upsertInventoryEvent(doseId, -1, productKey, 'dose', injectionId);
    const legacyId = getLegacyReturnInventoryEventId(injectionId);
    if (hasInventoryEvent(legacyId))
        return upsertInventoryEvent(legacyId, 0, productKey, 'legacy-return-undone', injectionId);
    return getInventoryCount(productKey);
}
function getRoomTempTracker(productKey = getCurrentProductKey()) {
    if (!state.settings.roomTempTrackers || typeof state.settings.roomTempTrackers !== 'object')
        state.settings.roomTempTrackers = {};
    if (!state.settings.roomTempTrackers[productKey])
        state.settings.roomTempTrackers[productKey] = { active: false, startedAt: 0, accumulatedMs: 0, firstUseAt: 0, updatedAt: 0 };
    return state.settings.roomTempTrackers[productKey];
}
function simpleStableHash(text) {
    let h = 2166136261;
    for (let i = 0; i < String(text).length; i++) {
        h ^= String(text).charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
}
function ensureGranularDayData(dateKey, day) {
    if (!Array.isArray(day.waterEvents)) {
        day.waterEvents = [];
        const legacy = Number(day.water) || 0;
        if (legacy !== 0)
            day.waterEvents.push({ id: `water_base_${dateKey}`, delta: legacy, updatedAt: Number(day.waterUpdatedAt) || 0 });
    }
    day.waterEvents = day.waterEvents.filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && Number.isFinite(Number(e.delta))).map((e) => ({ id: e.id, delta: Number(e.delta), updatedAt: Math.max(0, Number(e.updatedAt) || 0) }));
    const total = day.waterEvents.reduce((sum, e) => sum + Number(e.delta || 0), 0);
    day.water = Math.max(0, total);
    day.waterUpdatedAt = Math.max(Number(day.waterUpdatedAt) || 0, ...day.waterEvents.map((e) => Number(e.updatedAt) || 0), 0);
    if (!Array.isArray(day.bowelMovementRecords)) {
        const legacy = Array.isArray(day.bowelMovements) ? day.bowelMovements : [];
        day.bowelMovementRecords = legacy.filter((v) => typeof v === 'string' && !isNaN(new Date(v).getTime())).map((v) => ({ id: `bm_${simpleStableHash(dateKey + '|' + v)}`, at: v, updatedAt: Number(day.bowelMovementsUpdatedAt) || 0 }));
    }
    const seen = new Set();
    day.bowelMovementRecords = day.bowelMovementRecords.filter((r) => {
        if (!r || typeof r.id !== 'string' || seen.has(r.id) || typeof r.at !== 'string' || isNaN(new Date(r.at).getTime()))
            return false;
        seen.add(r.id);
        return true;
    }).map((r) => ({ id: r.id, at: r.at, updatedAt: Math.max(0, Number(r.updatedAt) || 0) }));
    const dels = state.deletedRecords?.bowelMovements || {};
    day.bowelMovementRecords = day.bowelMovementRecords.filter((r) => (Number(dels[r.id]) || 0) <= (Number(r.updatedAt) || 0));
    day.bowelMovements = day.bowelMovementRecords.map((r) => r.at).sort();
    day.bowelMovementsUpdatedAt = Math.max(Number(day.bowelMovementsUpdatedAt) || 0, ...day.bowelMovementRecords.map((r) => Number(r.updatedAt) || 0), 0);
    return day;
}
function recalcWaterFromEvents(day) {
    if (!day)
        return 0;
    const total = (Array.isArray(day.waterEvents) ? day.waterEvents : []).reduce((sum, e) => sum + Number(e?.delta || 0), 0);
    day.water = Math.max(0, total);
    day.waterUpdatedAt = Math.max(Number(day.waterUpdatedAt) || 0, ...(day.waterEvents || []).map((e) => Number(e?.updatedAt) || 0), 0);
    return day.water;
}
function getMedicationProfile(key = null) {
    return MEDICATION_PROFILES[key || state.settings.medication] || MEDICATION_PROFILES.mounjaro;
}
function getMedicationLabel(profile = null, includeGeneric = false) {
    const p = profile || getMedicationProfile();
    return includeGeneric ? `${p.name} (${p.generic})` : p.name;
}
function getRegimenLabel(profile = null) {
    const p = profile || getMedicationProfile();
    if (p.route === 'oral')
        return uiText('Tableta oral · una vez al día', 'Oral tablet · once daily');
    if (p.frequencyDays === 1)
        return uiText('Inyección · una vez al día', 'Injection · once daily');
    return uiText('Inyección · una vez por semana', 'Injection · once weekly');
}
/* ==========================================================================
   ADAPTACIÓN DINÁMICA: MOUNJARO VS OZEMPIC
   ========================================================================== */
function handleMedicationChange(selectedMed) {
    if (!MEDICATION_PROFILES[selectedMed])
        selectedMed = 'mounjaro';
    state.settings.medication = selectedMed;
    const valid = getPresentationOptions(selectedMed).map((x) => x.key);
    if (!valid.includes(state.settings.presentation))
        state.settings.presentation = getDefaultPresentationKey(selectedMed);
    state.settings.pensInStock = getInventoryCount(getCurrentProductKey());
    markSettingsChanged(['medication', 'presentation']);
    persistState({ userMutation: true });
    applyMedicationTheme();
    updateHalfLifeAndNextDose();
    renderMounjaroView();
    renderPersonalInsights();
    showToast(isEnglish() ? `Medication set: ${getMedicationLabel(getMedicationProfile(), true)}` : `Medicamento configurado: ${getMedicationLabel(getMedicationProfile(), true)}`);
}
function renderPresentationSelector() {
    const select = document.getElementById('setting-presentation'), wrap = document.getElementById('setting-presentation-wrap'), help = document.getElementById('setting-presentation-help'), label = document.getElementById('setting-presentation-label');
    if (!select)
        return;
    if (label)
        label.innerText = uiText('Presentación:', 'Presentation:');
    const opts = getPresentationOptions();
    if (!opts.some((x) => x.key === state.settings.presentation))
        state.settings.presentation = opts[0].key;
    select.innerHTML = opts.map((x) => `<option value="${escapeHtml(x.key)}">${escapeHtml(isEnglish() ? x.en : x.es)}</option>`).join('');
    select.value = state.settings.presentation;
    if (wrap)
        wrap.classList.toggle('hidden', opts.length === 1 && getMedicationProfile().route === 'oral');
    const pr = getPresentationProfile();
    if (help)
        help.innerText = isEnglish() ? `Storage and inventory rules use this exact presentation. ${pr.maxF ? `Maximum ${pr.maxF}°F (${pr.maxC}°C).` : ''}` : `Las reglas de almacenamiento e inventario usan esta presentación exacta. ${pr.maxF ? `Máximo ${pr.maxF}°F (${pr.maxC}°C).` : ''}`;
}
function handlePresentationChange(value) {
    const opts = getPresentationOptions();
    const next = opts.some((x) => x.key === value) ? value : opts[0].key;
    if (next === state.settings.presentation)
        return;
    state.settings.presentation = next;
    state.settings.pensInStock = getInventoryCount(getCurrentProductKey());
    markSettingsChanged(['presentation']);
    persistState({ userMutation: true });
    applyMedicationTheme();
    renderMounjaroView();
    showToast(uiText('Presentación actualizada. Se aplicaron las reglas de almacenamiento correspondientes.', 'Presentation updated. The matching storage rules are now active.'));
}
function storageTrackerElapsedRoomMs(tracker, now = Date.now()) { return Math.max(0, Number(tracker.accumulatedMs) || 0) + (tracker.active && Number(tracker.startedAt) > 0 ? Math.max(0, now - Number(tracker.startedAt)) : 0); }
function getStorageTrackerStatus(now = Date.now()) {
    const pr = getPresentationProfile(), t = getRoomTempTracker(), dayMs = 86400000;
    let roomLeft = null, firstUseLeft = null;
    if (pr.roomTempDays)
        roomLeft = pr.roomTempDays - storageTrackerElapsedRoomMs(t, now) / dayMs;
    if (pr.firstUseDays && Number(t.firstUseAt) > 0)
        firstUseLeft = pr.firstUseDays - Math.max(0, now - Number(t.firstUseAt)) / dayMs;
    let doseCount = 0;
    if (pr.maxUnitDoses && Number(t.firstUseAt) > 0) {
        const key = getCurrentProductKey();
        doseCount = (state.injections || []).filter((i) => i && String(i.productKey || '') === key && (injectionTimestamp(i) || 0) >= Number(t.firstUseAt)).length;
    }
    const values = [roomLeft, firstUseLeft].filter((v) => typeof v === 'number' && Number.isFinite(v));
    const left = values.length ? Math.min(...values) : null;
    const doseLimitExpired = Boolean(pr.maxUnitDoses && doseCount >= pr.maxUnitDoses);
    return { presentation: pr, tracker: t, roomLeft, firstUseLeft, daysLeft: left, doseCount, doseLimitExpired, expired: (typeof left === 'number' && Number.isFinite(left) && left <= 0) || doseLimitExpired };
}
function noteFirstUseForCurrentProduct(atMs = Date.now()) {
    const pr = getPresentationProfile();
    if (!pr.firstUseDays)
        return;
    const t = getRoomTempTracker();
    if (!Number(t.firstUseAt)) {
        t.firstUseAt = atMs;
        t.updatedAt = mutationNow();
        markSettingsChanged([`roomTempTrackers.${getCurrentProductKey()}`]);
    }
}
function resetStorageTrackerForNewUnit() {
    const pr = getPresentationProfile();
    if (pr.timerMode === 'none')
        return;
    if (!confirm(uiText('¿Comenzaste una unidad nueva de este medicamento? Esto reiniciará únicamente el historial de almacenamiento de esta presentación.', 'Did you start a new unit of this medication? This resets only the storage history for this presentation.')))
        return;
    if (!confirm(uiText('Segunda confirmación: el tiempo ya consumido de la unidad anterior no podrá recuperarse desde este contador. ¿Continuar?', 'Second confirmation: time already used by the previous unit will no longer appear in this tracker. Continue?')))
        return;
    state.settings.roomTempTrackers[getCurrentProductKey()] = { active: false, startedAt: 0, accumulatedMs: 0, firstUseAt: 0, updatedAt: mutationNow() };
    markSettingsChanged([`roomTempTrackers.${getCurrentProductKey()}`]);
    persistState({ userMutation: true });
    renderMounjaroView();
    showToast(uiText('Seguimiento preparado para una unidad nueva.', 'Storage tracking reset for a new unit.'));
}
function applyMedicationTheme() {
    const p = getMedicationProfile();
    const medName = p.name;
    const isOral = p.route === 'oral';
    document.getElementById('header-app-title').innerText = `${medName} Companion`;
    document.getElementById('nav-label-med').innerText = isEnglish() ? `${medName} & health` : `${medName} y salud`;
    document.getElementById('hub-card-title').innerText = isOral ? uiText(`Control de ${medName}`, `${medName} tracking`) : uiText(`Control de ${medName}`, `${medName} tracking`);
    document.getElementById('modal-inj-title').innerText = isOral ? uiText(`Registrar dosis de ${medName}`, `Log ${medName} dose`) : uiText(`Registrar dosis de ${medName}`, `Log ${medName} dose`);
    const subtitle = document.getElementById('hub-regimen-subtitle');
    if (subtitle)
        subtitle.innerText = getRegimenLabel(p);
    const medSelector = document.getElementById('setting-medication');
    if (medSelector)
        medSelector.value = state.settings.medication;
    renderPresentationSelector();
    const help = document.getElementById('medication-regimen-help');
    if (help)
        help.innerText = `${getRegimenLabel(p)} · ${uiText('Vida media aproximada', 'Approx. half-life')}: ${p.halfLifeDays < 1 ? Math.round(p.halfLifeDays * 24) + ' h' : p.halfLifeDays + ' ' + uiText('días', 'days')}. ${uiText('La app no modifica ni recomienda tratamiento.', 'The app does not change or recommend treatment.')}`;
    const doseSelect = document.getElementById('inj-dose');
    if (doseSelect) {
        doseSelect.innerHTML = '';
        p.doses.forEach((d) => {
            const opt = document.createElement('option');
            opt.value = d[0];
            opt.innerText = `${d[0]} (${isEnglish() ? d[2] : d[1]})`;
            doseSelect.appendChild(opt);
        });
    }
    const siteWrap = document.getElementById('inj-site-wrap');
    const hubSiteRow = document.getElementById('hub-site-row');
    const zones = document.getElementById('injection-zones-card');
    [siteWrap, hubSiteRow, zones].forEach((el) => {
        if (el)
            el.classList.toggle('hidden', isOral);
    });
    const dateLabel = document.getElementById('inj-date-label');
    if (dateLabel)
        dateLabel.innerText = isOral ? uiText('Fecha de dosis:', 'Dose date:') : uiText('Fecha de inyección:', 'Injection date:');
    const saveBtn = document.getElementById('inj-save-button');
    if (saveBtn)
        saveBtn.innerText = uiText('Confirmar dosis', 'Confirm dose');
    const roomCard = document.getElementById('room-temp-card');
    const roomBadge = document.getElementById('room-temp-status-badge');
    const roomExpl = document.getElementById('room-temp-expl-text');
    const pr = getPresentationProfile();
    if (roomCard)
        roomCard.classList.toggle('hidden', pr.timerMode === 'none');
    if (pr.timerMode !== 'none') {
        if (roomBadge)
            roomBadge.innerText = uiText('Reglas por presentación', 'Presentation-specific');
        if (roomExpl)
            roomExpl.innerText = pr.timerMode === 'first_use' ? uiText('Esta presentación vence según el tiempo desde el primer uso, aunque vuelva a refrigerarse.', 'This presentation expires based on time since first use, even if returned to refrigeration.') : pr.timerMode === 'combined' ? uiText('Se aplica el límite que ocurra primero: tiempo fuera de refrigeración, tiempo desde primer uso o el límite del producto.', 'The earliest applicable limit wins: room-temperature exposure, time since first use, or product-use limit.') : uiText('El tiempo fuera de refrigeración se acumula; apagar el seguimiento lo pausa, no reinicia el tiempo consumido.', 'Time out of refrigeration accumulates; turning tracking off pauses it and does not reset time already used.');
    }
    const invTitle = document.getElementById('inventory-card-title');
    const invSubtitle = document.getElementById('inventory-card-subtitle');
    if (invTitle)
        invTitle.innerText = uiText('Inventario de medicamento', 'Medication inventory');
    if (invSubtitle)
        invSubtitle.innerText = isOral ? uiText('Tabletas disponibles para seguimiento.', 'Tablets available for tracking.') : uiText('Unidades disponibles para seguimiento.', 'Units available for tracking.');
    const penVal = document.getElementById('pen-stock-val');
    const inv = getInventoryCount();
    state.settings.pensInStock = inv;
    if (penVal)
        penVal.innerText = `${inv} ${isEnglish() ? p.inventoryUnitEn : p.inventoryUnitEs}`;
}
function updateTitrationStatus() {
    const textEl = document.getElementById('titration-status-text');
    const badgeEl = document.getElementById('titration-badge');
    if (!textEl || !badgeEl)
        return;
    const p = getMedicationProfile();
    if (!state.injections || state.injections.length === 0) {
        textEl.innerText = uiText('Sin dosis para resumir el régimen.', 'No doses logged to summarize the regimen.');
        badgeEl.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
        badgeEl.innerText = uiText('Sin datos', 'No data');
        return;
    }
    const sorted = getInjectionsForMedication(p.key).sort((a, b) => (injectionTimestamp(b) || 0) - (injectionTimestamp(a) || 0));
    if (sorted.length === 0) {
        textEl.innerText = uiText('Sin dosis para este medicamento.', 'No doses logged for this medication.');
        badgeEl.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
        badgeEl.innerText = uiText('Sin datos', 'No data');
        return;
    }
    const currentDose = sorted[0].dose || '--';
    const consecutiveStreak = [];
    for (const inj of sorted) {
        if (inj.dose === currentDose)
            consecutiveStreak.push(inj);
        else
            break;
    }
    const sameDose = consecutiveStreak;
    const earliest = sameDose.map((i) => String(i.date).split('T')[0]).sort()[0];
    const elapsedDays = earliest ? Math.max(0, Math.floor((Date.now() - new Date(earliest + 'T12:00:00').getTime()) / 86400000)) : 0;
    if (p.frequencyDays === 1) {
        textEl.innerText = isEnglish() ? `${elapsedDays + 1} day(s) logged at ${currentDose}. Review any dose change only with your prescriber.` : `${elapsedDays + 1} día(s) registrados en ${currentDose}. Revisa cualquier cambio de dosis únicamente con tu profesional.`;
        badgeEl.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
        badgeEl.innerText = uiText('Régimen diario', 'Daily regimen');
    }
    else {
        const weeks = Math.floor(elapsedDays / 7) + 1;
        textEl.innerText = isEnglish() ? `Week ${weeks} at ${currentDose} · ${sameDose.length} logged dose(s). Dose changes should follow your prescribed plan.` : `Semana ${weeks} en ${currentDose} · ${sameDose.length} dosis registrada(s). Los cambios deben seguir tu plan prescrito.`;
        badgeEl.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
        badgeEl.innerText = isEnglish() ? `Week ${weeks}` : `Semana ${weeks}`;
    }
}
function addToAppleCalendar() {
    if (!state.injections || state.injections.length === 0) {
        showToast(uiText('Registra primero una dosis para generar el recordatorio.', 'Log a dose first to create the reminder.'));
        return;
    }
    const p = getMedicationProfile(), sorted = getInjectionsForMedication(p.key).sort((a, b) => (injectionTimestamp(b) || 0) - (injectionTimestamp(a) || 0)), latest = sorted[0];
    if (!latest) {
        showToast(uiText('Registra primero una dosis de este medicamento.', 'Log a dose of this medication first.'));
        return;
    }
    const baseDate = String(latest.date).split('T')[0];
    if (!isValidDateKey(baseDate)) {
        showToast(uiText('Revisa la fecha de la última dosis.', 'Review the latest dose date.'));
        return;
    }
    const time = (latest.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(latest.time)) ? latest.time : '09:00';
    const startDate = new Date(`${baseDate}T${time}:00`);
    startDate.setDate(startDate.getDate() + p.frequencyDays);
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    const freq = p.frequencyDays === 1 ? 'DAILY' : 'WEEKLY', medName = p.name;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GLP1 Companion//BILINGUAL', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `SUMMARY:${uiText('Dosis de', 'Dose of')} ${medName} (${latest.dose})`, `DESCRIPTION:${uiText('Recordatorio según el régimen registrado en GLP-1 Companion. Sigue siempre tu plan prescrito.', 'Reminder based on the regimen logged in GLP-1 Companion. Always follow your prescribed plan.')}`, `DTSTART:${fmt(startDate)}`, `DTEND:${fmt(endDate)}`, `RRULE:FREQ=${freq}`, 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${uiText('Recordatorio de dosis', 'Dose reminder')}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = `${medName.toLowerCase().replace(/\s+/g, '_')}_reminder.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(uiText('Archivo de calendario generado. Registros antiguos sin hora usan 9:00 AM y duran 30 minutos.', 'Calendar file created. Older records without a time use 9:00 AM and a 30-minute duration.'));
}
// v4.0.5 — iOS/iPadOS standalone PWAs can silently ignore window.print().
// For Apple mobile devices we generate a real PDF locally and present it through
// the native Share Sheet. Desktop keeps the existing browser print workflow.
function isIOSLikeDevice() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
}
function normalizePdfText(value) {
    return String(value == null ? '' : value)
        .replace(/\r/g, '')
        .replace(/[–—]/g, '-')
        .replace(/→/g, '->')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/…/g, '...')
        .replace(/≥/g, '>=')
        .replace(/≤/g, '<=')
        .replace(/\u00a0/g, ' ');
}
function cp1252Bytes(value) {
    const special = new Map([
        [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
        [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91],
        [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98],
        [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]
    ]);
    const out = [];
    for (const ch of String(value)) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp <= 0xFF)
            out.push(cp);
        else if (special.has(cp))
            out.push(special.get(cp));
        else
            out.push(0x3F);
    }
    return new Uint8Array(out);
}
function pdfEscapeLiteral(value) {
    return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function wrapPdfLine(line, maxChars = 88) {
    const clean = normalizePdfText(line);
    if (!clean)
        return [''];
    const prefix = clean.startsWith('• ') ? '• ' : '';
    const continuation = prefix ? '  ' : '';
    const body = prefix ? clean.slice(2) : clean;
    const words = body.split(/\s+/).filter(Boolean);
    if (!words.length)
        return [prefix.trimEnd()];
    const rows = [];
    let current = prefix;
    for (const word of words) {
        const candidate = (current.trim().length ? current + ' ' : current) + word;
        if (candidate.length > maxChars && current.trim().length) {
            rows.push(current);
            current = continuation + word;
        }
        else
            current = candidate;
    }
    if (current.length)
        rows.push(current);
    return rows;
}
function buildTextPdfBytes(title, bodyText, language) {
    const W = 612, H = 792, margin = 48, topY = 738, bottomY = 48;
    const wrapped = [];
    normalizePdfText(bodyText).split('\n').forEach((raw) => {
        const trimmed = raw.trim();
        const isHeading = Boolean(trimmed && trimmed.length <= 70 && trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed));
        wrapPdfLine(raw, isHeading ? 74 : 88).forEach((line, idx) => wrapped.push({ text: line, heading: isHeading && idx === 0 }));
    });
    const pages = [];
    let page = [], y = topY - 58;
    for (const row of wrapped) {
        const step = row.heading ? 18 : 13;
        if (y - step < bottomY) {
            pages.push(page);
            page = [];
            y = topY - 58;
        }
        page.push({ text: row.text, heading: row.heading, y });
        y -= step;
    }
    if (page.length || !pages.length)
        pages.push(page);
    const objects = [];
    const pageIds = [];
    const contentIds = [];
    const regularFontId = 3, boldFontId = 4;
    for (let i = 0; i < pages.length; i++) {
        pageIds.push(5 + i * 2);
        contentIds.push(6 + i * 2);
    }
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => id + ' 0 R').join(' ')}] /Count ${pages.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const generated = (language === 'en' ? 'Generated' : 'Generado') + `: ${new Date().toLocaleString(language === 'en' ? 'en-US' : 'es-US')} · GLP-1 Companion ${APP_VERSION}`;
    pages.forEach((rows, idx) => {
        const pid = pageIds[idx], cid = contentIds[idx];
        const commands = [];
        commands.push(`BT /F2 17 Tf 1 0 0 1 ${margin} ${topY} Tm (${pdfEscapeLiteral(title)}) Tj ET`);
        commands.push(`BT /F1 8 Tf 0.35 0.4 0.48 rg 1 0 0 1 ${margin} ${topY - 18} Tm (${pdfEscapeLiteral(generated)}) Tj ET`);
        commands.push(`0.85 0.88 0.92 RG 0.8 w ${margin} ${topY - 29} m ${W - margin} ${topY - 29} l S`);
        rows.forEach((row) => {
            const font = row.heading ? '/F2 11' : '/F1 9.5';
            commands.push(`BT ${font} Tf 0.06 0.09 0.14 rg 1 0 0 1 ${margin} ${row.y} Tm (${pdfEscapeLiteral(row.text)}) Tj ET`);
        });
        const pageLabel = (language === 'en' ? 'Page' : 'Página') + ` ${idx + 1}/${pages.length}`;
        const devCredit = `Designed & Developed by ${DEVELOPER_NAME} · ${DEVELOPER_EMAIL}`;
        commands.push(`BT /F1 7.5 Tf 0.4 0.45 0.52 rg 1 0 0 1 ${margin} 28 Tm (${pdfEscapeLiteral(devCredit)}) Tj ET`);
        commands.push(`BT /F1 8 Tf 0.4 0.45 0.52 rg 1 0 0 1 ${W - margin - 58} 28 Tm (${pdfEscapeLiteral(pageLabel)}) Tj ET`);
        const content = commands.join('\n');
        const contentBytes = cp1252Bytes(content);
        objects[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${cid} 0 R >>`;
        objects[cid] = { stream: content, length: contentBytes.length };
    });
    const byteParts = [];
    const pushBytes = (b) => byteParts.push(b instanceof Uint8Array ? b : cp1252Bytes(b));
    pushBytes('%PDF-1.4\n%GLP1\n');
    const offsets = [0];
    let length = byteParts.reduce((n, b) => n + b.length, 0);
    const maxObj = objects.length - 1;
    for (let id = 1; id <= maxObj; id++) {
        offsets[id] = length;
        let head = `${id} 0 obj\n`;
        let part;
        const obj = objects[id];
        if (obj && typeof obj === 'object' && 'stream' in obj) {
            part = cp1252Bytes(`${head}<< /Length ${obj.length} >>\nstream\n${obj.stream}\nendstream\nendobj\n`);
        }
        else
            part = cp1252Bytes(`${head}${String(obj ?? '')}\nendobj\n`);
        byteParts.push(part);
        length += part.length;
    }
    const xrefOffset = length;
    let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= maxObj; id++)
        xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
    xref += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    pushBytes(xref);
    const total = byteParts.reduce((n, b) => n + b.length, 0);
    const result = new Uint8Array(total);
    let pos = 0;
    byteParts.forEach((b) => { result.set(b, pos); pos += b.length; });
    return result;
}
async function presentPdfOnApple(title, bodyText, language, filenameBase) {
    try {
        const bytes = buildTextPdfBytes(title, bodyText, language);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
        const filename = `${filenameBase}_${stamp}.pdf`;
        let file = null;
        try {
            file = new File([blob], filename, { type: 'application/pdf', lastModified: Date.now() });
        }
        catch (_) { }
        if (file && navigator.share) {
            const shareData = { files: [file] }; // File only: most reliable WebKit path.
            const canShare = !navigator.canShare || navigator.canShare(shareData);
            if (canShare) {
                try {
                    await navigator.share(shareData);
                    return true;
                }
                catch (err) {
                    if (err instanceof DOMException && err.name === 'AbortError')
                        return true;
                    console.warn('PDF share failed; falling back to file download.', err);
                }
            }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showToast(uiText('PDF creado. Ábrelo desde Archivos/Descargas para imprimir o compartir.', 'PDF created. Open it from Files/Downloads to print or share.'), 6500);
        return true;
    }
    catch (err) {
        console.error('PDF generation failed', err);
        showToast(uiText('No se pudo crear el PDF. Intenta nuevamente.', 'The PDF could not be created. Please try again.'), 6500);
        return false;
    }
}
function triggerPrintReport() {
    const p = getMedicationProfile();
    const printDateEl = document.getElementById('print-date');
    const printPatientEl = document.getElementById('print-patient-info');
    if (printDateEl)
        printDateEl.innerText = isEnglish() ? `Date: ${new Date().toLocaleDateString('en-US')}` : `Fecha: ${new Date().toLocaleDateString('es-US')}`;
    if (printPatientEl) {
        const who = currentUser ? currentUser.email : uiText('Usuario activo', 'Active user');
        printPatientEl.textContent = `${uiText('Paciente', 'Patient')}: ${who} · ${uiText('Medicamento', 'Medication')}: ${getMedicationLabel(p, true)}`;
    }
    document.body.classList.remove('appointment-print-mode');
    if (isIOSLikeDevice()) {
        const lang = state.settings.language || 'es';
        const title = lang === 'en' ? 'GLP-1 Clinical Progress Report' : 'Reporte clínico de evolución GLP-1';
        const report = buildAppointmentSummary('all', lang);
        presentPdfOnApple(title, report, lang, 'GLP1_Clinical_Report');
        return;
    }
    if (typeof window.print === 'function')
        window.print();
    else
        showToast(uiText('La impresión no está disponible en este navegador.', 'Printing is not available in this browser.'));
}
function checkFoodSymptomCorrelation() {
    const alertBox = document.getElementById('correlation-alert-box');
    const alertText = document.getElementById('correlation-alert-text');
    if (!alertBox || !alertText)
        return;
    const day = getSelectedDay();
    const savedSymptoms = (day.symptoms && typeof day.symptoms === 'object') ? day.symptoms : {};
    const nauseaInput = document.getElementById('input-symptom-nausea');
    const heartburnInput = document.getElementById('input-symptom-heartburn');
    const sulfurInput = document.getElementById('input-symptom-sulfur');
    const s = {
        nausea: nauseaInput ? nauseaInput.value : (savedSymptoms.nausea || 'none'),
        heartburn: heartburnInput ? heartburnInput.value : (savedSymptoms.heartburn || 'none'),
        sulfur: sulfurInput ? sulfurInput.value : (savedSymptoms.sulfur || 'none')
    };
    const hasDigestiveSymptoms = (s.nausea && s.nausea !== 'none') ||
        (s.heartburn && s.heartburn !== 'none') ||
        (s.sulfur && s.sulfur !== 'none');
    let highFatMeals = [];
    let totalFatToday = 0;
    (day.meals || []).forEach((m) => {
        const f = Number(m.fat || 0);
        totalFatToday += f;
        if (f >= 14) {
            highFatMeals.push(`${mealLocalizedName(m)} (${f}g ${uiText('grasa', 'fat')})`);
        }
    });
    if (hasDigestiveSymptoms && (highFatMeals.length > 0 || totalFatToday >= 25)) {
        alertBox.classList.remove('hidden');
        alertText.innerText = isEnglish()
            ? `Digestive symptoms were logged on a day with ${highFatMeals.length > 0 ? highFatMeals.join(', ') : `${totalFatToday}g total fat`}. This is an observed association in your log, not proof of cause.`
            : `Se registraron síntomas digestivos en un día con ${highFatMeals.length > 0 ? highFatMeals.join(', ') : `${totalFatToday}g de grasa total`}. Es una asociación observada en tu registro, no prueba de causa.`;
    }
    else {
        alertBox.classList.add('hidden');
    }
    lucide.createIcons();
}
function getSelectedDay() {
    if (!state.daysData[state.selectedDate]) {
        state.daysData[state.selectedDate] = {
            water: 0, waterUpdatedAt: 0, waterEvents: [], meals: [],
            symptoms: { hunger: 3, nausea: "none", heartburn: "none", sulfur: "none", fatigue: "none", notes: "" }, symptomsUpdatedAt: 0,
            bowelMovements: [], bowelMovementRecords: [], bowelMovementsUpdatedAt: 0,
            electrolytes: { mg: false, k: false, na: false, multi: false }, electrolytesUpdatedAt: 0
        };
    }
    return ensureGranularDayData(state.selectedDate, state.daysData[state.selectedDate]);
}
