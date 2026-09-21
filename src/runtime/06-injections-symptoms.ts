/**
 * GLP-1 Companion v5 Phase 3 compatibility module
 * Injection logging, medication storage tracking, PK and symptom trend rendering.
 *
 * Loaded as an ordered classic script on purpose: this preserves the existing
 * shared global lexical environment and inline-handler contract while the v5
 * architecture is modularized without behavior changes.
 */
/* ==========================================================================
   CONTROL DE INYECCIONES Y REFRIGERADOR
   ========================================================================== */
function openLogInjectionModal() {
    document.getElementById('inj-date').value = state.selectedDate;
    const now = new Date();
    document.getElementById('inj-time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('modal-injection').classList.remove('hidden');
    document.getElementById('modal-injection').classList.add('flex');
}
function closeLogInjectionModal() {
    document.getElementById('modal-injection').classList.add('hidden');
    document.getElementById('modal-injection').classList.remove('flex');
}
function saveInjectionRecord() {
    const date = document.getElementById('inj-date').value || state.selectedDate, timeInput = document.getElementById('inj-time').value, time = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeInput) ? timeInput : '', dose = document.getElementById('inj-dose').value, medProfile = getMedicationProfile(), presentation = getPresentationProfile(), site = medProfile.route === 'oral' ? 'Oral' : document.getElementById('inj-site').value, notes = document.getElementById('inj-notes').value.trim();
    if (!isValidDateKey(date)) {
        showToast(uiText('Selecciona una fecha válida.', 'Select a valid date.'));
        return;
    }
    const eventTs = new Date(`${date}T${time || '12:00'}:00`).getTime();
    if (Number.isFinite(eventTs) && eventTs > Date.now() + 5 * 60 * 1000) {
        showToast(uiText('La hora de la dosis no puede estar en el futuro.', 'Dose time cannot be in the future.'));
        return;
    }
    const duplicate = (state.injections || []).find((i) => i && getInjectionMedicationKey(i) === medProfile.key && String(i.date).split('T')[0] === date && (i.time || '') === time);
    if (duplicate && !confirm(uiText(`Ya existe una dosis de ${medProfile.name} con esta misma fecha${time ? ' y hora' : ''}. ¿Guardar otra de todos modos?`, `A ${medProfile.name} dose already exists with this same date${time ? ' and time' : ''}. Save another anyway?`)))
        return;
    const productKey = getCurrentProductKey(), today = getFormattedDate(new Date()), isHistorical = date < today;
    let inventoryConsumed = false;
    const newId = `inj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (presentation.inventoryMode === 'perDose' && getInventoryCount(productKey) > 0) {
        let consume = !isHistorical;
        if (isHistorical)
            consume = confirm(uiText('Esta dosis es histórica. ¿También deseas descontar una unidad del inventario actual?', 'This is a historical dose. Also subtract one unit from current inventory?'));
        if (consume) {
            consumeInventoryForDose(newId, productKey);
            inventoryConsumed = true;
        }
    }
    if (state.deletedRecords?.injections)
        delete state.deletedRecords.injections[newId];
    state.injections.push({ id: newId, date, time, dose, medication: medProfile.key, presentation: state.settings.presentation, productKey, site, notes, inventoryConsumed, updatedAt: mutationNow() });
    if (date === today && presentation.firstUseDays && !getRoomTempTracker(productKey).firstUseAt) {
        const t = getRoomTempTracker(productKey);
        t.firstUseAt = eventTs;
        t.updatedAt = mutationNow();
        markSettingsChanged([`roomTempTrackers.${productKey}`]);
    }
    persistState({ userMutation: true });
    closeLogInjectionModal();
    renderMounjaroView();
    updateDashboardView();
    showToast(isEnglish() ? `Dose saved: ${dose}${time ? ` · ${time}` : ''}${medProfile.route === 'oral' ? '' : ` (${site})`}` : `Dosis guardada: ${dose}${time ? ` · ${time}` : ''}${medProfile.route === 'oral' ? '' : ` (${site})`}`);
}
function adjustPenCount(delta: number): void { const key = getCurrentProductKey(); const next = recordInventoryDelta(delta, key, 'manual-adjustment'); const p = getMedicationProfile(); const el = document.getElementById('pen-stock-val'); if (el)
    el.innerText = `${next} ${isEnglish() ? p.inventoryUnitEn : p.inventoryUnitEs}`; persistState({ userMutation: true }); renderMounjaroView(); }
function startRoomTempCountdown() {
    const pr = getPresentationProfile(), key = getCurrentProductKey(), t = getRoomTempTracker(key);
    if (pr.timerMode === 'none') {
        showToast(uiText('Esta presentación no usa este seguimiento.', 'This presentation does not use this tracker.'));
        return;
    }
    if (pr.timerMode === 'first_use') {
        if (t.firstUseAt) {
            showToast(uiText('El reloj de primer uso ya está activo y no puede pausarse. Usa “Nueva unidad” solamente cuando realmente abras una unidad nueva.', 'The first-use clock is already running and cannot be paused. Use “New unit” only when you actually start a new unit.'));
            return;
        }
        if (!confirm(uiText('¿Comenzar ahora el reloj desde el primer uso? Continuará aunque la pluma vuelva a la nevera.', 'Start the first-use clock now? It will continue even if the pen returns to the refrigerator.')))
            return;
        t.firstUseAt = Date.now();
        t.updatedAt = mutationNow();
    }
    else {
        if (t.active) {
            showToast(uiText('El seguimiento fuera de la nevera ya está activo.', 'Out-of-refrigerator tracking is already active.'));
            return;
        }
        if (!confirm(uiText('¿La unidad está ahora fuera de refrigeración? El tiempo se acumulará y no se reiniciará al pausarlo.', 'Is the unit now out of refrigeration? Time will accumulate and will not reset when paused.')))
            return;
        t.active = true;
        t.startedAt = Date.now();
        if (pr.firstUseDays && !t.firstUseAt)
            t.firstUseAt = Date.now();
        t.updatedAt = mutationNow();
    }
    markSettingsChanged([`roomTempTrackers.${key}`]);
    persistState({ userMutation: true });
    renderMounjaroView();
    showToast(uiText('Seguimiento de almacenamiento actualizado.', 'Storage tracking updated.'));
}
function toggleRoomTempTracking() {
    const pr = getPresentationProfile(), key = getCurrentProductKey(), t = getRoomTempTracker(key);
    if (pr.noReturnToFridge && t.active) {
        showToast(uiText('Esta presentación no debe volver a refrigerarse una vez iniciada la ventana a temperatura ambiente. El contador continuará.', 'This presentation should not be returned to refrigeration once the room-temperature window starts. The timer will continue.'));
        return;
    }
    if (pr.timerMode === 'none')
        return;
    if (pr.timerMode === 'first_use') {
        startRoomTempCountdown();
        return;
    }
    if (!t.active) {
        startRoomTempCountdown();
        return;
    }
    if (!confirm(uiText('¿Pausar el conteo de tiempo fuera de refrigeración porque la unidad volvió a refrigerarse? El tiempo ya consumido se conservará.', 'Pause out-of-refrigeration time because the unit returned to refrigeration? Time already used will be preserved.')))
        return;
    t.accumulatedMs = storageTrackerElapsedRoomMs(t);
    t.active = false;
    t.startedAt = 0;
    t.updatedAt = mutationNow();
    markSettingsChanged([`roomTempTrackers.${key}`]);
    persistState({ userMutation: true });
    renderMounjaroView();
    showToast(uiText('Seguimiento pausado; el tiempo acumulado se conservó.', 'Tracking paused; accumulated time was preserved.'));
}
function getDateOffsetKey(dateKey: string, offsetDays: number): string | null {
    const d = new Date(dateKey + "T12:00:00");
    if (Number.isNaN(d.getTime()))
        return null;
    d.setDate(d.getDate() + offsetDays);
    return getFormattedDate(d);
}
function hasDigestiveSymptomsForDay(day: RuntimeDayData | null | undefined): boolean {
    const s = day && day.symptoms || {};
    return Boolean((s.nausea && s.nausea !== 'none') || (s.heartburn && s.heartburn !== 'none') || (s.sulfur && s.sulfur !== 'none'));
}
function getDailyInsightMetrics(dateKey: string | null, targetLang: 'en' | 'es' | null = null) {
    const day = dateKey ? state.daysData?.[dateKey] : undefined;
    if (!day)
        return { dateKey, exists: false, symptoms: [], water: 0, protein: 0, hunger: null, bowelCount: 0, mealCount: 0 };
    const s = day.symptoms || {};
    const symptoms = [];
    const isEn = targetLang ? targetLang === 'en' : isEnglish();
    if (s.nausea && s.nausea !== 'none')
        symptoms.push(isEn ? 'nausea' : 'náuseas');
    if (s.heartburn && s.heartburn !== 'none')
        symptoms.push(isEn ? 'reflux' : 'reflujo');
    if (s.sulfur && s.sulfur !== 'none')
        symptoms.push(isEn ? 'sulfur burps' : 'eructos de azufre');
    if (s.fatigue && s.fatigue !== 'none')
        symptoms.push(isEn ? 'fatigue' : 'fatiga');
    const meals = Array.isArray(day.meals) ? day.meals : [];
    return {
        dateKey,
        exists: dayHasMeaningfulTracking(day),
        symptoms,
        water: Number(day.water || 0),
        protein: meals.reduce((sum, m) => sum + Number(m && m.protein || 0), 0),
        hunger: Number.isFinite(Number(s.hunger)) ? Number(s.hunger) : null,
        bowelCount: Array.isArray(day.bowelMovements) ? day.bowelMovements.length : 0,
        mealCount: meals.length
    };
}
function getInjectionResponse(inj: RuntimeInjection | null | undefined, targetLang: 'en' | 'es' | null = null) {
    if (!inj || !inj.date)
        return [];
    return [0, 1, 2].map((offset) => getDailyInsightMetrics(getDateOffsetKey(String(inj.date).split('T')[0], offset), targetLang));
}
function renderDoseResponseInsights() {
    const badge = document.getElementById('dose-response-dose');
    const grid = document.getElementById('dose-response-grid');
    if (!badge || !grid)
        return;
    const sorted = getInjectionsForMedication().sort((a, b) => (injectionTimestamp(b) || 0) - (injectionTimestamp(a) || 0));
    if (!sorted.length) {
        badge.innerText = '--';
        grid.innerHTML = `<div class="sm:col-span-3 p-3 bg-[#111a2e] border border-[#223455] rounded-xl text-slate-400 text-[11px]">${uiText('Registra una dosis para comenzar a relacionarla con tus registros de los tres días siguientes.', 'Log a dose to compare it with your records from the following three days.')}</div>`;
        return;
    }
    const inj = sorted[0];
    badge.innerText = `${inj.dose || '--'} · ${String(inj.date).split('T')[0]}${inj.time ? ` · ${inj.time}` : ''}`;
    const windows = getInjectionResponse(inj);
    const labels = ['0–24 h', '24–48 h', '48–72 h'];
    grid.innerHTML = windows.map((m, idx) => {
        if (!m.exists)
            return `<div class="p-3 bg-[#111a2e] border border-[#223455] rounded-xl"><span class="text-[10px] font-black text-emerald-300">${labels[idx]}</span><p class="text-[10px] text-slate-500 mt-2">${uiText('Sin datos registrados', 'No records')}</p></div>`;
        const symptomText = m.symptoms.length ? m.symptoms.join(', ') : uiText('sin síntomas digestivos registrados', 'no digestive symptoms recorded');
        return `<div class="p-3 bg-[#111a2e] border border-[#223455] rounded-xl space-y-1"><span class="text-[10px] font-black text-emerald-300">${labels[idx]}</span><p class="text-[10px] text-slate-300">${escapeHtml(symptomText)}</p><p class="text-[9px] text-slate-500">${uiText('Agua', 'Water')}: ${Math.round(displayWater(m.water)!)} ${waterUnit()} · ${uiText('Proteína', 'Protein')}: ${Math.round(m.protein)} g</p><p class="text-[9px] text-slate-500">${uiText('Apetito', 'Appetite')}: ${m.hunger ?? '--'}/10 · ${uiText('Evacuaciones', 'Bowel')}: ${m.bowelCount}</p></div>`;
    }).join('');
}
function calculateTolerancePatterns(days: number = 30) {
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    const startKey = getFormattedDate(start), endKey = getFormattedDate(end);
    let highFatDays = 0, highFatSymptomDays = 0, symptomDays = 0, trackedDays = 0, lowWaterDays = 0, lowWaterSymptomDays = 0;
    const waterGoal = Number(state.settings.waterGoal || 96);
    Object.keys(state.daysData || {}).forEach((key) => {
        if (key < startKey || key > endKey)
            return;
        const day = state.daysData[key];
        if (!day)
            return;
        if (dayHasMeaningfulTracking(day))
            trackedDays++;
        const digestive = hasDigestiveSymptomsForDay(day);
        if (digestive)
            symptomDays++;
        const meals = Array.isArray(day.meals) ? day.meals : [];
        const highFat = meals.some((m) => Number(m && m.fat || 0) >= 20);
        if (highFat) {
            highFatDays++;
            if (digestive)
                highFatSymptomDays++;
        }
        const water = Number(day.water || 0);
        const lowWater = water > 0 && water < waterGoal * 0.65;
        if (lowWater) {
            lowWaterDays++;
            if (digestive)
                lowWaterSymptomDays++;
        }
    });
    const postDoseTrackedDates = new Set();
    const postDoseSymptomDates = new Set();
    getInjectionsForMedication().forEach((inj) => {
        if (!inj || !inj.date || inj.date < startKey || inj.date > endKey)
            return;
        getInjectionResponse(inj).forEach((m) => {
            if (m.exists) {
                postDoseTrackedDates.add(m.dateKey);
                if (m.symptoms.some((s) => ['náuseas', 'nausea', 'reflujo', 'reflux', 'eructos de azufre', 'sulfur burps'].includes(s))) {
                    postDoseSymptomDates.add(m.dateKey);
                }
            }
        });
    });
    const postDoseTracked = postDoseTrackedDates.size;
    const postDoseSymptoms = postDoseSymptomDates.size;
    return { trackedDays, symptomDays, highFatDays, highFatSymptomDays, lowWaterDays, lowWaterSymptomDays, postDoseTracked, postDoseSymptoms };
}
function renderTolerancePatterns() {
    const el = document.getElementById('tolerance-patterns-list');
    if (!el)
        return;
    const p = calculateTolerancePatterns(30);
    const items = [];
    if (p.highFatDays >= 2)
        items.push(`${uiText('Comidas con ≥20 g de grasa', 'Meals with ≥20 g fat')}: <strong class="text-amber-300">${p.highFatSymptomDays}/${p.highFatDays}</strong> ${uiText('días coincidieron con síntomas digestivos.', 'days coincided with digestive symptoms.')}`);
    if (p.lowWaterDays >= 2)
        items.push(`${uiText('Días por debajo de ~65% de tu meta de agua', 'Days below ~65% of your water goal')}: <strong class="text-cyan-300">${p.lowWaterSymptomDays}/${p.lowWaterDays}</strong> ${uiText('coincidieron con síntomas digestivos.', 'coincided with digestive symptoms.')}`);
    if (p.postDoseTracked >= 3)
        items.push(`${uiText('Dentro de los 3 días posteriores a dosis registradas', 'Within the 3 days after logged doses')}: <strong class="text-emerald-300">${p.postDoseSymptoms}/${p.postDoseTracked}</strong> ${uiText('días con datos incluyeron síntomas digestivos.', 'tracked days included digestive symptoms.')}`);
    if (p.trackedDays >= 4)
        items.push(`${uiText('En total', 'Overall')}: <strong class="text-violet-300">${p.symptomDays}/${p.trackedDays}</strong> ${uiText('días con seguimiento tuvieron algún síntoma digestivo.', 'tracked days had a digestive symptom.')}`);
    if (!items.length)
        items.push(uiText('Todavía no hay suficientes registros consistentes para mostrar patrones. Continúa registrando comidas, agua y síntomas.', 'There are not enough consistent records to show patterns yet. Keep logging meals, water and symptoms.'));
    el.innerHTML = items.slice(0, 4).map((txt) => `<div class="p-2.5 bg-[#111a2e] border border-[#223455] rounded-xl text-slate-300 leading-relaxed">${txt}</div>`).join('');
}
function getBowelStats() {
    const all: number[] = [];
    Object.values(state.daysData || {}).forEach((day: RuntimeDayData) => {
        (Array.isArray(day.bowelMovements) ? day.bowelMovements : []).forEach((ts: string) => {
            const t = new Date(ts).getTime();
            if (Number.isFinite(t))
                all.push(t);
        });
    });
    all.sort((a, b) => a - b);
    const now = Date.now(), thirty = now - 30 * 86400000, seven = now - 7 * 86400000;
    const recent = all.filter((t) => t >= thirty);
    const intervals: number[] = [];
    for (let i = 1; i < recent.length; i++)
        intervals.push((recent[i] - recent[i - 1]) / 3600000);
    return { avgHours: intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null, sevenCount: all.filter((t) => t >= seven).length, lastTime: all.length ? all[all.length - 1] : null };
}
function renderBowelStats() {
    const avgEl = document.getElementById('bowel-average-interval'), countEl = document.getElementById('bowel-seven-day-count'), note = document.getElementById('bowel-trend-note');
    if (!avgEl || !countEl || !note)
        return;
    const b = getBowelStats();
    avgEl.innerText = b.avgHours !== null ? (b.avgHours < 48 ? `${Math.round(b.avgHours)} h` : `${(b.avgHours / 24).toFixed(1)} d`) : '--';
    countEl.innerText = String(b.sevenCount);
    if (b.avgHours === null)
        note.innerText = uiText('Registra al menos dos evacuaciones para calcular un intervalo promedio.', 'Log at least two bowel movements to calculate an average interval.');
    else
        note.innerText = uiText(`Promedio descriptivo de ${Math.round(b.avgHours)} horas entre registros durante los últimos 30 días.`, `Descriptive average of ${Math.round(b.avgHours)} hours between records over the last 30 days.`);
}
function openInjectionDetailModal(id: string): void {
    const inj = (state.injections || []).find((i) => i && i.id === id);
    if (!inj)
        return;
    const subtitle = document.getElementById('injection-detail-subtitle');
    const body = document.getElementById('injection-detail-body');
    subtitle.innerText = `${inj.dose || '--'} · ${String(inj.date).split('T')[0]}${inj.time ? ` · ${inj.time}` : ''} · ${translateSite(inj.site)}`;
    const windows = getInjectionResponse(inj), labels = ['0–24 h', '24–48 h', '48–72 h'];
    const cards = windows.map((m, idx) => `<div class="p-3 bg-[#111a2e] border border-[#223455] rounded-xl"><div class="flex justify-between"><span class="font-black text-emerald-300">${labels[idx]}</span><span class="text-[10px] text-slate-500">${escapeHtml(m.dateKey || '')}</span></div>${m.exists ? `<p class="mt-1 text-slate-300">${escapeHtml(m.symptoms.length ? m.symptoms.join(', ') : uiText('Sin síntomas digestivos registrados', 'No digestive symptoms recorded'))}</p><p class="text-[10px] text-slate-500 mt-1">${uiText('Agua', 'Water')}: ${Math.round(displayWater(m.water)!)} ${waterUnit()} · ${uiText('Proteína', 'Protein')}: ${Math.round(m.protein)} g · ${uiText('Apetito', 'Appetite')}: ${m.hunger ?? '--'}/10 · ${uiText('Evacuaciones', 'Bowel')}: ${m.bowelCount}</p>` : `<p class="mt-1 text-slate-500">${uiText('Sin datos registrados', 'No records')}</p>`}</div>`).join('');
    body.innerHTML = `<div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><p class="font-bold text-white">${escapeHtml(inj.dose || '--')} · ${escapeHtml(translateSite(inj.site))}</p><p class="text-[10px] text-slate-400">${escapeHtml(inj.notes || uiText('Sin observaciones', 'No notes'))}</p></div>${cards}<p class="text-[9px] text-slate-500">${uiText('Resumen aproximado por días; no sustituye evaluación médica.', 'Approximate day-based summary; not a substitute for medical evaluation.')}</p>`;
    const modal = document.getElementById('modal-injection-detail');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
}
function closeInjectionDetailModal() { const modal = document.getElementById('modal-injection-detail'); modal.classList.add('hidden'); modal.classList.remove('flex'); }
function doseMgValue(dose: unknown): number | null {
    const n = parseFloat(String(dose || '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
}
function injectionTimestamp(inj: RuntimeInjection | null | undefined): number | null {
    if (!inj || !isValidDateKey(String(inj.date || '').split('T')[0]))
        return null;
    const date = String(inj.date).split('T')[0];
    // Legacy entries without a recorded time use noon only for this estimate; the stored record is not modified.
    const time = typeof inj.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(inj.time) ? inj.time : '12:00';
    const ts = new Date(`${date}T${time}:00`).getTime();
    return Number.isFinite(ts) ? ts : null;
}
function solveAbsorptionKa(ke: number, tmaxHours: number): number {
    const t = Math.max(0.25, Number(tmaxHours) || 24);
    const f = (ka: number) => Math.log(ka / ke) / (ka - ke) - t;
    let lo = ke * 1.0001, hi = Math.max(1, ke * 10000);
    // For ka -> ke, Tmax -> 1/ke. If target is beyond that mathematical range, use near-ke absorption.
    if (t >= 1 / ke)
        return lo;
    while (f(hi) > 0 && hi < 1000)
        hi *= 2;
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > 0)
            lo = mid;
        else
            hi = mid;
    }
    return (lo + hi) / 2;
}
function activeDoseEquivalent(doseMg: number, hours: number, profile: MedicationProfile): number {
    if (!Number.isFinite(doseMg) || doseMg <= 0 || !Number.isFinite(hours) || hours < 0)
        return 0;
    const ke = Math.log(2) / (Math.max(0.01, Number(profile.halfLifeDays)) * 24);
    const ka = solveAbsorptionKa(ke, profile.pkTmaxHours || 24);
    if (Math.abs(ka - ke) < 1e-8)
        return doseMg * (ke * hours) * Math.exp(-ke * hours);
    const value = doseMg * (ka / (ka - ke)) * (Math.exp(-ke * hours) - Math.exp(-ka * hours));
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}
function getPkRecords(profile: MedicationProfile = getMedicationProfile(), atTs: number = Date.now()): PkRecord[] {
    return getInjectionsForMedication(profile.key)
        .map((i) => ({ inj: i, ts: injectionTimestamp(i), dose: doseMgValue(i.dose) }))
        .filter((x): x is PkRecord => typeof x.ts === 'number' && Number.isFinite(x.ts) && x.ts > 0 && typeof x.dose === 'number' && Number.isFinite(x.dose) && x.dose > 0 && x.ts <= atTs)
        .sort((a, b) => b.ts - a.ts);
}
function calculatePkLevelAt(profile: MedicationProfile, atTs: number, records: PkRecord[] | null = null): number {
    const source = records || getPkRecords(profile, atTs);
    let total = 0;
    source.forEach((x) => {
        if (x.ts <= atTs)
            total += activeDoseEquivalent(x.dose, (atTs - x.ts) / 3600000, profile);
    });
    return Number.isFinite(total) ? Math.max(0, total) : 0;
}
function calculatePkEstimate(profile: MedicationProfile = getMedicationProfile()): PkEstimate | null {
    const now = Date.now();
    const records = getPkRecords(profile, now);
    if (!records.length)
        return null;
    const latest = records[0], hoursSince = Math.max(0, (now - latest.ts) / 3600000);
    const interval = Math.max(1, Number(profile.frequencyDays) || 1) * 24;
    const tmax = Math.max(.25, Number(profile.pkTmaxHours) || 24);
    const active = calculatePkLevelAt(profile, now, records);
    // Expected peak for the currently logged dose/regimen at steady-state: latest dose
    // at Tmax plus accumulated residuals from prior scheduled doses of the same amount.
    let expectedPeak = 0;
    for (let n = 0; n < 80; n++)
        expectedPeak += activeDoseEquivalent(latest.dose, tmax + n * interval, profile);
    const peakPct = expectedPeak > 0 ? Math.max(0, Math.min(999, (active / expectedPeak) * 100)) : null;
    let phase: PkEstimate['phase'] = 'elimination';
    if (hoursSince < tmax * .8)
        phase = 'rising';
    else if (hoursSince <= tmax * 1.25)
        phase = 'peak';
    const nextDoseTs = latest.ts + interval * 3600000;
    return { active, pct: peakPct, peakPct, expectedPeak, hoursSince, phase, latest, nextDoseTs, legacyTime: !latest.inj.time, records };
}
function renderPkCurve(profile: MedicationProfile, est: PkEstimate | null): void {
    const canvas = document.getElementById('pkCurveChart');
    if (!canvas || typeof Chart === 'undefined')
        return;
    if (!est) {
        if (pkCurveChartInstance) {
            pkCurveChartInstance.data.labels = [];
            pkCurveChartInstance.data.datasets[0].data = [];
            pkCurveChartInstance.update('none');
        }
        return;
    }
    const start = est.latest.ts;
    const scheduledEnd = est.nextDoseTs;
    const end = Math.max(start + 3600000, scheduledEnd, Date.now());
    const span = Math.max(1, end - start);
    const step = Math.max(3600000, Math.round(span / 32));
    const labels: string[] = [], values: number[] = [], timestamps: number[] = [];
    for (let ts = start; ts <= end + step / 2; ts += step) {
        const pointTs = Math.min(ts, end);
        timestamps.push(pointTs);
        labels.push(new Date(pointTs).toLocaleString(isEnglish() ? 'en-US' : 'es-US', { month: 'short', day: 'numeric', hour: 'numeric' }));
        values.push(Number(calculatePkLevelAt(profile, pointTs, est.records).toFixed(3)));
        if (ts >= end)
            break;
    }
    // Keep the vertical scale stable for the current regimen. Small PK/time updates
    // should move the value, not make the entire chart appear to breathe up/down.
    const curveMax = Math.max(0, ...values);
    const referenceMax = Math.max(curveMax, Number(est.expectedPeak) || 0, Number(est.latest?.dose) || 0, 0.01);
    const stableYMax = Math.max(0.1, Math.ceil(referenceMax * 1.15 * 10) / 10);
    const datasetLabel = uiText('Nivel activo estimado', 'Estimated active level');
    pkCurrentPointIndex = timestamps.reduce((best, ts, index) => Math.abs(ts - Date.now()) < Math.abs(timestamps[best] - Date.now()) ? index : best, 0);
    if (pkSelectedPointIndex !== null && pkSelectedPointIndex >= values.length) pkSelectedPointIndex = null;
    const markerRadius = values.map((_, index) => index === pkSelectedPointIndex ? 6 : index === pkCurrentPointIndex ? 5 : (index === 0 || index === values.length - 1 || index % 4 === 0) ? 2.5 : 0);
    const markerColors = values.map((_, index) => index === pkSelectedPointIndex ? '#f59e0b' : index === pkCurrentPointIndex ? '#22c55e' : '#38bdf8');
    if (pkCurveChartInstance) {
        pkCurveChartInstance.data.labels = labels;
        pkCurveChartInstance.data.datasets[0].label = datasetLabel;
        pkCurveChartInstance.data.datasets[0].data = values;
        pkCurveChartInstance.data.datasets[0].pointRadius = markerRadius;
        pkCurveChartInstance.data.datasets[0].pointBackgroundColor = markerColors;
        pkCurveChartInstance.data.datasets[0].pointBorderColor = markerColors;
        if (pkCurveChartInstance.options.scales?.y) pkCurveChartInstance.options.scales.y.max = stableYMax;
        pkCurveChartInstance.update('none');
        return;
    }
    pkCurveChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ label: datasetLabel, data: values, tension: .3, pointRadius: markerRadius, pointBackgroundColor: markerColors, pointBorderColor: markerColors, pointHitRadius: 12, pointHoverRadius: 6, borderWidth: 2, fill: false }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            transitions: { active: { animation: { duration: 0 } }, resize: { animation: { duration: 0 } } },
            interaction: { mode: 'nearest', intersect: false },
            onClick: (_event: unknown, elements: Array<{ index: number }>) => { if (!elements.length || !pkCurveChartInstance) return; pkSelectedPointIndex = elements[0].index; const count = Array.isArray(pkCurveChartInstance.data.datasets[0].data) ? pkCurveChartInstance.data.datasets[0].data.length : values.length; pkCurveChartInstance.data.datasets[0].pointRadius = Array.from({ length: count }, (_, index) => index === pkSelectedPointIndex ? 6 : index === pkCurrentPointIndex ? 5 : (index === 0 || index === count - 1 || index % 4 === 0) ? 2.5 : 0); pkCurveChartInstance.update('none'); },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y.toFixed(2)} mg ${uiText('estimados', 'estimated')}` } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', maxTicksLimit: 5, font: { size: 8 } } },
                y: { beginAtZero: true, max: stableYMax, ticks: { color: '#64748b', font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}
function renderPkEstimate() {
    const p = getMedicationProfile(), est = calculatePkEstimate(p);
    const name = document.getElementById('pk-medication-name');
    if (name)
        name.innerText = getMedicationLabel(p, true);
    const active = document.getElementById('pk-active-mg'), pct = document.getElementById('pk-steady-percent'), hrs = document.getElementById('pk-hours-since'), phase = document.getElementById('pk-phase'), bar = document.getElementById('pk-level-bar'), note = document.getElementById('pk-note'), next = document.getElementById('pk-next-dose');
    if (!est) {
        if (active)
            active.innerText = '--';
        if (pct)
            pct.innerText = '--';
        if (hrs)
            hrs.innerText = '--';
        if (next)
            next.innerText = '--';
        if (phase) {
            phase.innerText = uiText('Sin datos', 'No data');
            phase.className = 'text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700';
        }
        if (bar)
            bar.style.width = '0%';
        if (note)
            note.innerText = uiText('Registra una dosis con fecha y hora para calcular una estimación educativa de dosis-equivalente activa.', 'Log a dose with date and time to calculate an educational active dose-equivalent estimate.');
        renderPkCurve(p, null);
        return;
    }
    if (active)
        active.innerText = `${est.active.toFixed(2)} mg`;
    if (pct)
        pct.innerText = typeof est.peakPct === 'number' && Number.isFinite(est.peakPct) ? `${est.peakPct.toFixed(0)}%` : '--';
    if (hrs)
        hrs.innerText = est.hoursSince < 48 ? `${est.hoursSince.toFixed(1)} h` : `${(est.hoursSince / 24).toFixed(1)} d`;
    if (next) {
        const d = new Date(est.nextDoseTs);
        next.innerText = d.toLocaleString(isEnglish() ? 'en-US' : 'es-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    const labels: Record<PkEstimate['phase'], string> = { rising: uiText('Subiendo · absorción', 'Rising · absorption'), peak: uiText('Cerca del pico', 'Near expected peak'), elimination: uiText('Fase de eliminación', 'Elimination phase') };
    if (phase) {
        phase.innerText = labels[est.phase];
        phase.className = est.phase === 'rising' ? 'text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : est.phase === 'peak' ? 'text-[9px] font-bold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'text-[9px] font-bold px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30';
    }
    if (bar)
        bar.style.width = `${Math.max(0, Math.min(100, est.peakPct || 0))}%`;
    if (note)
        note.innerText = (est.legacyTime ? uiText('La última dosis es de una versión anterior sin hora; para esta estimación se usa 12:00 PM sin modificar el registro. ', 'Latest dose is from an older version without a time; 12:00 PM is used for this estimate without changing the record. ') : '') + uiText('Modelo simplificado de absorción, eliminación y acumulación. El porcentaje compara el nivel estimado actual con un pico esperado del régimen registrado. No representa una concentración sanguínea medida ni guía cambios de dosis.', 'Simplified absorption, elimination, and accumulation model. The percentage compares the current estimate with an expected peak for the logged regimen. It is not a measured blood concentration and does not guide dose changes.');
    renderPkCurve(p, est);
}
function renderMounjaroView() {
    ensureInjectionIds();
    const medProfile = getMedicationProfile();
    const isOral = medProfile.route === 'oral';
    const maxDays = medProfile.roomTempDays || 0;
    const sorted = getInjectionsForMedication(medProfile.key).sort((a, b) => (injectionTimestamp(b) || 0) - (injectionTimestamp(a) || 0));
    if (sorted.length > 0) {
        const latest = sorted[0];
        document.getElementById('hub-last-dose').innerText = latest.dose || (medProfile.doses[0]?.[0] || '--');
        document.getElementById('hub-last-date').innerText = `${(typeof latest.date === 'string' ? latest.date.split('T')[0] : latest.date) || '--'}${latest.time ? ` · ${latest.time}` : ''}`;
        document.getElementById('hub-last-site').innerText = isOral ? uiText('Vía oral', 'Oral') : translateSite(latest.site);
    }
    else {
        document.getElementById('hub-last-dose').innerText = uiText("Sin dosis", "No dose");
        document.getElementById('hub-last-date').innerText = "--";
        document.getElementById('hub-last-site').innerText = uiText("Sin registro", "No record");
    }
    const inv = getInventoryCount();
    state.settings.pensInStock = inv;
    document.getElementById('pen-stock-val').innerText = `${inv} ${isEnglish() ? medProfile.inventoryUnitEn : medProfile.inventoryUnitEs}`;
    const warningEl = document.getElementById('dash-pen-warning');
    warningEl.classList.toggle('hidden', inv > 1);
    const pr = getPresentationProfile(), storage = getStorageTrackerStatus();
    const badge = document.getElementById('room-temp-status-badge'), textEl = document.getElementById('room-temp-days-left'), panel = document.getElementById('room-temp-countdown-panel'), toggle = document.getElementById('room-temp-toggle'), title = document.getElementById('room-temp-card-title'), daysLabel = document.getElementById('room-temp-days-label'), maxLabel = document.getElementById('room-temp-max-label'), maxValue = document.getElementById('room-temp-max-value'), limitLabel = document.getElementById('room-temp-limit-label'), limitValue = document.getElementById('room-temp-limit-value'), newUnit = document.getElementById('room-temp-restart-btn');
    if (pr.timerMode !== 'none') {
        if (title)
            title.innerText = pr.timerMode === 'first_use' ? uiText('Ventana desde primer uso', 'First-use window') : uiText('Fuera de la nevera', 'Out of refrigerator');
        if (maxLabel)
            maxLabel.innerText = uiText('Temperatura máxima', 'Maximum temperature');
        if (maxValue)
            maxValue.innerText = `${pr.maxF}°F (${pr.maxC}°C)`;
        if (limitLabel)
            limitLabel.innerText = uiText('Límite aplicable', 'Applicable limit');
        const pieces = [];
        if (pr.roomTempDays)
            pieces.push(`${pr.roomTempDays} ${uiText('días fuera', 'days out')}`);
        if (pr.firstUseDays)
            pieces.push(`${pr.firstUseDays} ${uiText('días desde primer uso', 'days from first use')}`);
        if (pr.maxUnitDoses)
            pieces.push(`${pr.maxUnitDoses} ${uiText('dosis por unidad', 'doses per unit')}`);
        if (pr.noReturnToFridge)
            pieces.push(uiText('no volver a refrigerar', 'do not return to refrigerator'));
        if (limitValue)
            limitValue.innerText = pieces.join(' · ');
        if (newUnit)
            newUnit.innerText = uiText('Nueva unidad', 'New unit');
        const hasClock = storage.tracker.active || storage.tracker.accumulatedMs > 0 || storage.tracker.firstUseAt > 0;
        if (panel)
            panel.classList.toggle('hidden', !hasClock);
        if (daysLabel)
            daysLabel.innerText = uiText('Tiempo restante:', 'Time remaining:');
        if (storage.doseLimitExpired) {
            if (textEl)
                textEl.innerText = uiText('4 dosis usadas (Desechar unidad)', '4 doses used (Discard unit)');
        }
        else if (Number.isFinite(storage.daysLeft)) {
            const d = Math.max(0, Math.ceil(storage.daysLeft!));
            if (textEl)
                textEl.innerText = storage.expired ? uiText('Ventana terminada (Desechar)', 'Window ended (Discard)') : (isEnglish() ? `${d} days` : `${d} días`);
        }
        else if (textEl)
            textEl.innerText = '--';
        if (storage.expired) {
            badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30';
            badge.innerText = uiText('Desechar', 'Discard');
        }
        else if (typeof storage.daysLeft === 'number' && Number.isFinite(storage.daysLeft) && storage.daysLeft <= 4) {
            badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30';
            badge.innerText = uiText('Por vencer', 'Expiring soon');
        }
        else if (hasClock) {
            badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
            badge.innerText = storage.tracker.active ? uiText('Activo', 'Active') : uiText('En curso', 'Running');
        }
        else {
            badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300 border border-slate-500/30';
            badge.innerText = uiText('Sin iniciar', 'Not started');
        }
        if (toggle) {
            if (pr.timerMode === 'first_use') {
                toggle.innerText = storage.tracker.firstUseAt ? uiText('Reloj de primer uso activo', 'First-use clock active') : uiText('Iniciar reloj de primer uso', 'Start first-use clock');
                toggle.disabled = Boolean(storage.tracker.firstUseAt);
                toggle.className = storage.tracker.firstUseAt ? 'w-full py-2 bg-slate-700/40 text-slate-400 text-[10px] font-bold rounded-xl border border-slate-600/40' : 'w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/35 text-cyan-200 text-[10px] font-bold rounded-xl border border-cyan-500/35';
            }
            else if (pr.noReturnToFridge && storage.tracker.active) {
                toggle.disabled = true;
                toggle.innerText = uiText('Ventana ambiente activa · no pausar', 'Room-temperature window active · do not pause');
                toggle.className = 'w-full py-2 bg-slate-700/40 text-slate-400 text-[10px] font-bold rounded-xl border border-slate-600/40';
            }
            else {
                toggle.disabled = false;
                toggle.innerText = storage.tracker.active ? uiText('Volvió a la nevera · Pausar', 'Back in refrigerator · Pause') : uiText('Ahora fuera de la nevera · Activar', 'Now out of refrigerator · Start');
                toggle.className = storage.tracker.active ? 'w-full py-2 bg-amber-600/15 hover:bg-amber-600/25 text-amber-300 text-[10px] font-bold rounded-xl border border-amber-500/30' : 'w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/35 text-cyan-200 text-[10px] font-bold rounded-xl border border-cyan-500/35';
            }
        }
    }
    const listEl = document.getElementById('hub-injections-list');
    listEl.innerHTML = '';
    if (sorted.length === 0) {
        listEl.innerHTML = `<p class="text-slate-500 italic">${uiText("No hay dosis guardadas aún.", "No doses recorded yet.")}</p>`;
    }
    else {
        sorted.forEach((inj) => {
            const item = document.createElement('div');
            item.className = "flex justify-between items-center p-2.5 rounded-xl bg-[#111a2e] border border-[#223455] cursor-pointer hover:border-emerald-500/40 transition-colors";
            item.setAttribute('data-open-inj', inj.id);
            const cleanDate = typeof inj.date === 'string' ? inj.date.split('T')[0] : inj.date;
            item.innerHTML = `
            <div>
              <span class="font-bold text-white">${escapeHtml(inj.dose)} &bull; ${escapeHtml(translateSite(inj.site))}</span>
              <p class="text-[10px] text-slate-500">${escapeHtml(cleanDate)}${inj.time ? ` · ${escapeHtml(inj.time)}` : ''} ${inj.notes ? `&bull; ${escapeHtml(inj.notes)}` : ''}</p>
            </div>
            <button data-delete-inj="${escapeHtml(inj.id)}" class="text-slate-500 hover:text-rose-400 p-1 transition-colors" title="Eliminar registro">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          `;
            listEl.appendChild(item);
        });
    }
    const day = getSelectedDay();
    const s = day.symptoms || {};
    document.getElementById('input-symptom-hunger').value = String(s.hunger || 3);
    updateHungerLabel(s.hunger || 3);
    document.getElementById('input-symptom-nausea').value = String(s.nausea || "none");
    document.getElementById('input-symptom-heartburn').value = String(s.heartburn || "none");
    document.getElementById('input-symptom-sulfur').value = String(s.sulfur || "none");
    document.getElementById('input-symptom-fatigue').value = String(s.fatigue || "none");
    document.getElementById('input-symptom-notes').value = s.notes || "";
    renderSymptomsLoggedStatus();
    checkBowelMovementAlert();
    renderBowelStats();
    checkFoodSymptomCorrelation();
    renderDoseResponseInsights();
    renderPkEstimate();
    renderTolerancePatterns();
    renderSymptomTrendChart();
    applyStaticTranslations();
    applyMedicationTheme();
    renderPersonalInsights();
    if (activeTab === 'tools')
        renderMaintenanceMode();
    lucide.createIcons();
}
function removeInjection(id: string): void {
    if (!id || id === 'undefined')
        return;
    if (!state.deletedRecords)
        state.deletedRecords = { meals: {}, weights: {}, injections: {}, measurements: {}, bowelMovements: {} };
    if (!state.deletedRecords.injections)
        state.deletedRecords.injections = {};
    const removed = state.injections.find((i) => i.id === id);
    if (!removed)
        return;
    if (!confirm(uiText('¿Eliminar este registro de dosis?', 'Delete this dose record?')))
        return;
    const removedCopy = JSON.parse(JSON.stringify(removed));
    let inventoryReturned = false;
    if (removed.inventoryConsumed && removed.productKey) {
        inventoryReturned = confirm(uiText('Esta dosis descontó 1 unidad del inventario. ¿Deseas devolver esa unidad al inventario? Pulsa Cancelar si el medicamento sí fue administrado y solo deseas borrar el registro.', 'This dose subtracted 1 unit from inventory. Return that unit to inventory? Press Cancel if the medication was actually used and you only want to delete the record.'));
        if (inventoryReturned)
            returnInventoryForDeletedDose(id, removed.productKey);
    }
    state.deletedRecords.injections[id] = mutationNow();
    state.injections = state.injections.filter((i) => i.id !== id);
    persistState({ userMutation: true });
    renderMounjaroView();
    updateDashboardView();
    showUndoToast(uiText('Registro de dosis eliminado.', 'Dose record deleted.'), () => { if (inventoryReturned && removedCopy.inventoryConsumed && removedCopy.productKey)
        reverseInventoryReturnForUndo(id, removedCopy.productKey); removedCopy.updatedAt = mutationNow(); state.injections.push(removedCopy); state.injections.sort((a, b) => (injectionTimestamp(a) || 0) - (injectionTimestamp(b) || 0)); if (state.deletedRecords?.injections)
        delete state.deletedRecords.injections[id]; persistState({ userMutation: true }); renderMounjaroView(); updateDashboardView(); });
}
function updateHungerLabel(val: string | number): void {
    const lbl = document.getElementById('symptom-hunger-label');
    const n = Number(val) || 3;
    let label = '';
    if (n <= 2)
        label = uiText('Apetito nulo', 'No appetite');
    else if (n <= 4)
        label = uiText('Poco apetito', 'Low appetite');
    else if (n <= 6)
        label = uiText('Apetito moderado', 'Moderate appetite');
    else if (n <= 8)
        label = uiText('Apetito alto', 'High appetite');
    else
        label = uiText('Hambre intensa', 'Intense hunger');
    lbl.innerText = `${n} / 10 (${label})`;
}
function renderSymptomsLoggedStatus() {
    const badge = document.getElementById('symptoms-today-status');
    if (!badge)
        return;
    const day = state.daysData?.[state.selectedDate];
    const saved = Boolean(day && Number(day.symptomsUpdatedAt) > 0);
    const isToday = state.selectedDate === getFormattedDate(new Date());
    badge.innerText = saved ? (isToday ? uiText("Síntomas de hoy: Guardados", "Today's symptoms: Saved") : uiText('Este día: Guardado', 'This day: Saved')) : (isToday ? uiText("Síntomas de hoy: No registrados", "Today's symptoms: Not logged today") : uiText('Este día: Sin datos', 'This day: No data'));
    badge.className = saved ? 'text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700';
}
function saveDailySymptoms() {
    const day = getSelectedDay();
    day.symptoms = {
        hunger: Number(document.getElementById('input-symptom-hunger').value),
        nausea: document.getElementById('input-symptom-nausea').value,
        heartburn: document.getElementById('input-symptom-heartburn').value,
        sulfur: document.getElementById('input-symptom-sulfur').value,
        fatigue: document.getElementById('input-symptom-fatigue').value,
        notes: document.getElementById('input-symptom-notes').value.trim()
    };
    day.symptomsUpdatedAt = mutationNow();
    persistState({ userMutation: true });
    renderSymptomsLoggedStatus();
    renderSymptomTrendChart();
    checkFoodSymptomCorrelation();
    showToast(uiText("Tolerancia y síntomas guardados.", "Symptoms and tolerance saved."));
}
function symptomSeverity(value: string | number | undefined, type: 'standard' | 'sulfur' = 'standard'): number {
    if (!value || value === 'none')
        return 0;
    if (value === 'mild')
        return 1;
    if (value === 'moderate')
        return 2;
    if (value === 'severe')
        return 3;
    if (type === 'sulfur' && value === 'frequent')
        return 3;
    return 1;
}
function renderSymptomTrendChart() {
    const canvas = document.getElementById('symptomTrendChart');
    if (!canvas || typeof Chart === 'undefined')
        return;
    const keys = getLastNDaysKeys(30);
    const labels = keys.map((k) => { const p = k.split('-'); return `${p[2]}/${p[1]}`; });
    const series = (field: keyof RuntimeSymptoms, type: 'standard' | 'sulfur' = 'standard'): Array<number | null> => keys.map((k) => {
        const day = state.daysData?.[k];
        // Explicitly saved "None" is 0. A day never saved is null / No data.
        if (!day || !(Number(day.symptomsUpdatedAt) > 0))
            return null;
        return symptomSeverity(day.symptoms?.[field], type);
    });
    if (symptomTrendChartInstance)
        symptomTrendChartInstance.destroy();
    symptomTrendChartInstance = new Chart(canvas.getContext('2d'), { type: 'line', data: { labels, datasets: [
                { label: uiText('Náuseas', 'Nausea'), data: series('nausea'), tension: .25, pointRadius: 1.5, borderWidth: 2, spanGaps: false },
                { label: uiText('Reflujo', 'Reflux'), data: series('heartburn'), tension: .25, pointRadius: 1.5, borderWidth: 2, spanGaps: false },
                { label: uiText('Eructos de azufre', 'Sulfur burps'), data: series('sulfur', 'sulfur'), tension: .25, pointRadius: 1.5, borderWidth: 2, spanGaps: false },
                { label: uiText('Fatiga', 'Fatigue'), data: series('fatigue'), tension: .25, pointRadius: 1.5, borderWidth: 2, spanGaps: false }
            ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 10, font: { size: 9 } } }, tooltip: { callbacks: { label: (ctx: { raw: unknown; dataset: { label?: string }; parsed: { y?: number } }) => { if (ctx.raw === null || ctx.raw === undefined)
                            return ` ${ctx.dataset.label}: ${uiText('Sin datos', 'No data')}`; const words = isEnglish() ? ['None', 'Mild', 'Moderate', 'High'] : ['Ninguno', 'Leve', 'Moderado', 'Alto']; return ` ${ctx.dataset.label}: ${words[Math.max(0, Math.min(3, ctx.parsed.y || 0))]}`; } } } }, scales: { x: { grid: { display: false }, ticks: { color: '#64748b', maxTicksLimit: 8 } }, y: { min: 0, max: 3, ticks: { stepSize: 1, color: '#64748b', callback: (v: string | number) => isEnglish() ? ['None', 'Mild', 'Moderate', 'High'][Number(v)] : ['Ninguno', 'Leve', 'Moderado', 'Alto'][Number(v)] }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
}
