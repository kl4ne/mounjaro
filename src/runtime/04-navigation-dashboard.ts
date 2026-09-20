/**
 * GLP-1 Companion v5 Phase 3 compatibility module
 * Navigation, dashboard rendering, daily metrics, bowel movement and symptom UI.
 *
 * Loaded as an ordered classic script on purpose: this preserves the existing
 * shared global lexical environment and inline-handler contract while the v5
 * architecture is modularized without behavior changes.
 */
/* ==========================================================================
   NAVIGATION & TAB SWITCHING
   ========================================================================== */
function scrollActivePageToTop() {
    const mainEl = document.querySelector('main');
    if (mainEl) {
        mainEl.scrollTop = 0;
        if (typeof mainEl.scrollTo === 'function') {
            mainEl.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }
    // Fallback for browsers/PWA modes that scroll the document instead of <main>.
    window.scrollTo(0, 0);
}
function switchTab(tabId: string): void {
    activeTab = tabId;
    scrollActivePageToTop();
    document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach((el) => el.classList.remove('tab-active'));
    const targetSec = document.getElementById(`tab-${tabId}`);
    const targetNav = document.getElementById(`nav-${tabId}`);
    if (targetSec)
        targetSec.classList.remove('hidden');
    if (targetNav)
        targetNav.classList.add('tab-active');
    if (tabId === 'dashboard')
        updateDashboardView();
    if (tabId === 'mounjaro')
        renderMounjaroView();
    if (tabId === 'intelligence')
        renderAiIntelligenceView();
    if (tabId === 'tools')
        renderToolsView();
    // Re-apply after the selected tab finishes rendering; this avoids preserved
    // scroll position in iOS Safari/PWA when switching between long sections.
    requestAnimationFrame(scrollActivePageToTop);
    lucide.createIcons();
}
function changeDate(delta: number): void {
    const cur = new Date(state.selectedDate + "T12:00:00");
    cur.setDate(cur.getDate() + delta);
    const nextDateStr = getFormattedDate(cur);
    const todayStr = getFormattedDate(new Date());
    if (delta > 0 && nextDateStr > todayStr) {
        showToast(uiText("El diario opera únicamente hasta el día de hoy.", "Daily diary only logs up to today."));
        return;
    }
    state.selectedDate = nextDateStr;
    updateDateBadge();
}
function updateDateBadge() {
    const todayStr = getFormattedDate(new Date());
    const badge = document.getElementById('current-date-badge');
    const nextBtn = document.getElementById('btn-next-day');
    if (nextBtn) {
        if (state.selectedDate >= todayStr) {
            nextBtn.classList.add('opacity-30', 'cursor-not-allowed');
        }
        else {
            nextBtn.classList.remove('opacity-30', 'cursor-not-allowed');
        }
    }
    if (state.selectedDate === todayStr) {
        badge.innerText = uiText('Hoy', 'Today');
    }
    else {
        const parts = state.selectedDate.split('-');
        badge.innerText = `${parts[2]}/${parts[1]}`;
    }
    renderCurrentDay();
}
function renderCurrentDay() {
    updateDashboardView();
    renderMealsList();
    renderMounjaroView();
    checkBowelMovementAlert();
    if (activeTab === 'intelligence')
        renderAiIntelligenceView();
}
function getRollingDateKeys(endDateKey: string, days: number): string[] {
    const result: string[] = [];
    const end = new Date(endDateKey + "T12:00:00");
    for (let offset = days - 1; offset >= 0; offset--) {
        const d = new Date(end);
        d.setDate(end.getDate() - offset);
        result.push(getFormattedDate(d));
    }
    return result;
}
function dayHasMeaningfulTracking(day: RuntimeDayData | null | undefined): boolean {
    if (!day || typeof day !== 'object')
        return false;
    if (Number(day.water || 0) > 0)
        return true;
    if (Array.isArray(day.meals) && day.meals.length > 0)
        return true;
    if (Array.isArray(day.bowelMovements) && day.bowelMovements.length > 0)
        return true;
    const s = day.symptoms || {};
    if ((s.nausea && s.nausea !== 'none') || (s.heartburn && s.heartburn !== 'none') ||
        (s.sulfur && s.sulfur !== 'none') || (s.fatigue && s.fatigue !== 'none') ||
        String(s.notes || '').trim())
        return true;
    const e = day.electrolytes || {};
    if (Object.values(e).some(Boolean))
        return true;
    return false;
}
function getWeekMetrics(endDateKey: string) {
    const keys = getRollingDateKeys(endDateKey, 7);
    const startKey = keys[0];
    const endKey = keys[keys.length - 1];
    let trackedDays = 0, symptomDays = 0, waterTotal = 0, waterDays = 0, proteinTotal = 0, proteinDays = 0;
    keys.forEach((key) => {
        const day = state.daysData[key];
        if (!day)
            return;
        if (dayHasMeaningfulTracking(day))
            trackedDays++;
        const water = Number(day.water || 0);
        if (water > 0) {
            waterTotal += water;
            waterDays++;
        }
        if (Array.isArray(day.meals) && day.meals.length) {
            proteinTotal += day.meals.reduce((sum, meal) => sum + Number(meal && meal.protein || 0), 0);
            proteinDays++;
        }
        const s = day.symptoms || {};
        if ((s.nausea && s.nausea !== 'none') || (s.heartburn && s.heartburn !== 'none') ||
            (s.sulfur && s.sulfur !== 'none') || (s.fatigue && s.fatigue !== 'none'))
            symptomDays++;
    });
    const rangeWeights = (Array.isArray(state.weights) ? state.weights : [])
        .filter((w) => w && w.date >= startKey && w.date <= endKey && Number.isFinite(Number(w.weight)))
        .sort((a, b) => a.date.localeCompare(b.date));
    let weightDelta = null;
    if (rangeWeights.length >= 2)
        weightDelta = Number(rangeWeights[rangeWeights.length - 1].weight) - Number(rangeWeights[0].weight);
    const doseCount = getInjectionsForMedication().filter((i) => i.date >= startKey && i.date <= endKey).length;
    return {
        startKey, endKey, trackedDays, symptomDays, doseCount,
        waterAvg: waterDays ? waterTotal / waterDays : null,
        proteinAvg: proteinDays ? proteinTotal / proteinDays : null,
        weightDelta,
        singleWeight: rangeWeights.length === 1 ? Number(rangeWeights[0].weight) : null
    };
}
function comparisonText(labelEs: string, labelEn: string, current: number | null | undefined, previous: number | null | undefined, suffix: string = '', reverseGood: boolean = false): string {
    const label = uiText(labelEs, labelEn);
    if (current === null || current === undefined || previous === null || previous === undefined) {
        return `<div class="bg-[#111a2e] p-2 rounded-lg border border-[#223455]"><span class="text-slate-500">${escapeHtml(label)}</span><p class="font-bold text-slate-300">--</p></div>`;
    }
    const delta = current - previous;
    const sign = delta > 0 ? '+' : '';
    const decimals = Math.abs(delta) < 10 && !Number.isInteger(delta) ? 1 : 0;
    let trend = 'text-slate-300';
    if (delta !== 0) {
        const favorable = reverseGood ? delta < 0 : delta > 0;
        trend = favorable ? 'text-emerald-300' : 'text-amber-300';
    }
    return `<div class="bg-[#111a2e] p-2 rounded-lg border border-[#223455]"><span class="text-slate-500">${escapeHtml(label)}</span><p class="font-bold ${trend}">${sign}${delta.toFixed(decimals)}${suffix}</p></div>`;
}
function renderWeeklySummary() {
    const cur = getWeekMetrics(state.selectedDate);
    const prevEndDate = new Date(cur.startKey + 'T12:00:00');
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prev = getWeekMetrics(getFormattedDate(prevEndDate));
    let weightText = '--';
    if (cur.weightDelta !== null)
        weightText = `${cur.weightDelta > 0 ? '+' : cur.weightDelta < 0 ? '-' : ''}${formatWeight(Math.abs(cur.weightDelta), 1)}`;
    else if (cur.singleWeight !== null)
        weightText = formatWeight(cur.singleWeight, 1);
    const pStart = cur.startKey.split('-');
    const pEnd = cur.endKey.split('-');
    document.getElementById('weekly-summary-range').innerText = `${pStart[2]}/${pStart[1]}–${pEnd[2]}/${pEnd[1]}`;
    document.getElementById('weekly-weight-change').innerText = weightText;
    document.getElementById('weekly-water-avg').innerText = cur.waterAvg !== null ? formatWater(cur.waterAvg) : '--';
    document.getElementById('weekly-protein-avg').innerText = cur.proteinAvg !== null ? `${Math.round(cur.proteinAvg)} g` : '--';
    document.getElementById('weekly-tracked-days').innerText = `${cur.trackedDays}/7`;
    document.getElementById('weekly-symptom-days').innerText = String(cur.symptomDays);
    document.getElementById('weekly-dose-count').innerText = String(cur.doseCount);
    const note = document.getElementById('weekly-summary-note');
    if (cur.trackedDays === 0)
        note.innerText = uiText('Aún no hay registros suficientes en estos 7 días.', 'There are not enough records in these 7 days yet.');
    else if (cur.trackedDays < 4)
        note.innerText = uiText('Hay pocos días registrados; el resumen será más útil con mayor continuidad.', 'Only a few days are recorded; this summary improves with more consistent tracking.');
    else
        note.innerText = uiText('Resumen calculado con tus registros de los últimos 7 días.', 'Summary calculated from your last 7 days of records.');
    const grid = document.getElementById('weekly-comparison-grid');
    if (grid) {
        grid.innerHTML = [
            comparisonText('Agua prom.', 'Avg. water', cur.waterAvg === null ? null : displayWater(cur.waterAvg), prev.waterAvg === null ? null : displayWater(prev.waterAvg), ` ${waterUnit()}`),
            comparisonText('Proteína prom.', 'Avg. protein', cur.proteinAvg, prev.proteinAvg, ' g'),
            comparisonText('Días con síntomas', 'Symptom days', cur.symptomDays, prev.symptomDays, '', true),
            comparisonText('Días registrados', 'Tracked days', cur.trackedDays, prev.trackedDays)
        ].join('');
    }
}
function getLastNDaysKeys(days: number = 30) { const end = new Date(); end.setHours(12, 0, 0, 0); const out = []; for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(getFormattedDate(d));
} return out; }
function calculatePersonalInsights(days: number = 30) {
    const keys = getLastNDaysKeys(days), waterGoal = Number(state.settings.waterGoal || 96), proteinGoal = Number(state.settings.proteinGoal || 110);
    let lowWaterDays = 0, lowWaterSymptomDays = 0, adequateWaterDays = 0, adequateWaterSymptomDays = 0, proteinTracked = 0, proteinGoalDays = 0, tracked = 0, symptomDays = 0;
    keys.forEach((k) => { const d = state.daysData[k]; if (!d)
        return; if (dayHasMeaningfulTracking(d))
        tracked++; const s = d.symptoms || {}; const symptomatic = !!((s.nausea && s.nausea !== 'none') || (s.heartburn && s.heartburn !== 'none') || (s.sulfur && s.sulfur !== 'none')); if (symptomatic)
        symptomDays++; const w = Number(d.water || 0); if (w > 0) {
        if (w < waterGoal * .7) {
            lowWaterDays++;
            if (symptomatic)
                lowWaterSymptomDays++;
        }
        else {
            adequateWaterDays++;
            if (symptomatic)
                adequateWaterSymptomDays++;
        }
    } if (Array.isArray(d.meals) && d.meals.length) {
        proteinTracked++;
        const prot = d.meals.reduce((sum, m) => sum + Number(m && m.protein || 0), 0);
        if (prot >= proteinGoal * .8)
            proteinGoalDays++;
    } });
    const weights = (state.weights || []).filter((w) => w && keys.includes(String(w.date).split('T')[0]) && Number.isFinite(Number(w.weight))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const weightDelta = weights.length >= 2 ? Number(weights.at(-1)!.weight) - Number(weights[0].weight) : null;
    const postDoseKeys = new Set();
    getInjectionsForMedication().forEach((i) => { if (!i || !i.date)
        return; const base = String(i.date).split('T')[0]; [0, 1, 2].forEach((o) => postDoseKeys.add(getDateOffsetKey(base, o))); });
    let postTracked = 0, postSym = 0, otherTracked = 0, otherSym = 0;
    keys.forEach((k) => { const d = state.daysData[k]; if (!d || !dayHasMeaningfulTracking(d))
        return; const s = d.symptoms || {}; const symptomatic = !!((s.nausea && s.nausea !== 'none') || (s.heartburn && s.heartburn !== 'none') || (s.sulfur && s.sulfur !== 'none')); if (postDoseKeys.has(k)) {
        postTracked++;
        if (symptomatic)
            postSym++;
    }
    else {
        otherTracked++;
        if (symptomatic)
            otherSym++;
    } });
    return { days, tracked, symptomDays, lowWaterDays, lowWaterSymptomDays, adequateWaterDays, adequateWaterSymptomDays, proteinTracked, proteinGoalDays, weightDelta, postTracked, postSym, otherTracked, otherSym };
}
function renderPersonalInsights() {
    const el = document.getElementById('personal-insights-list');
    if (!el)
        return;
    const x = calculatePersonalInsights(30), items: Array<{ icon: string; text: string }> = [];
    if (x.lowWaterDays >= 2 && x.adequateWaterDays >= 2) {
        const low = Math.round(x.lowWaterSymptomDays / x.lowWaterDays * 100), good = Math.round(x.adequateWaterSymptomDays / x.adequateWaterDays * 100);
        items.push({ icon: 'droplets', text: isEnglish() ? `Digestive symptoms were logged on ${low}% of lower-hydration days vs ${good}% of better-hydrated days.` : `Registraste síntomas digestivos en ${low}% de los días con menor hidratación vs ${good}% de los días con mejor hidratación.` });
    }
    if (x.postTracked >= 2 && x.otherTracked >= 2) {
        const a = Math.round(x.postSym / x.postTracked * 100), b = Math.round(x.otherSym / x.otherTracked * 100);
        items.push({ icon: 'syringe', text: isEnglish() ? `Digestive symptoms appeared on ${a}% of tracked days within ~72h of a dose vs ${b}% on other tracked days.` : `Los síntomas digestivos aparecieron en ${a}% de los días registrados dentro de ~72 h de una dosis vs ${b}% en otros días registrados.` });
    }
    if (x.proteinTracked >= 3) {
        const pct = Math.round(x.proteinGoalDays / x.proteinTracked * 100);
        items.push({ icon: 'drumstick', text: isEnglish() ? `You reached at least 80% of your protein goal on ${pct}% of days with meals logged.` : `Alcanzaste al menos 80% de tu meta de proteína en ${pct}% de los días con comidas registradas.` });
    }
    if (x.weightDelta !== null) {
        items.push({ icon: 'trending-up', text: isEnglish() ? `Recorded weight change over the last 30 days: ${x.weightDelta > 0 ? '+' : x.weightDelta < 0 ? '-' : ''}${formatWeight(Math.abs(x.weightDelta), 1)}.` : `Cambio de peso registrado en los últimos 30 días: ${x.weightDelta > 0 ? '+' : x.weightDelta < 0 ? '-' : ''}${formatWeight(Math.abs(x.weightDelta), 1)}.` });
    }
    if (!items.length)
        items.push({ icon: 'info', text: uiText('Sigue registrando agua, comidas, síntomas y dosis para generar insights personales más útiles.', 'Keep logging water, meals, symptoms and doses to generate more useful personal insights.') });
    el.innerHTML = items.slice(0, 4).map((i) => `<div class="p-2.5 bg-[#111a2e] border border-[#223455] rounded-xl flex gap-2 items-start"><i data-lucide="${i.icon}" class="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5"></i><span class="text-slate-300 leading-relaxed">${escapeHtml(i.text)}</span></div>`).join('');
    lucide.createIcons();
}
/* ==========================================================================
   DASHBOARD METRICS & CURVA BIOLÓGICA CALIBRADA
   ========================================================================== */
function updateDashboardView() {
    const day = getSelectedDay();
    renderWeeklySummary();
    renderPersonalInsights();
    let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
    (day.meals || []).forEach((m) => {
        totalCal += Number(m.calories || 0);
        totalP += Number(m.protein || 0);
        totalC += Number(m.carbs || 0);
        totalF += Number(m.fat || 0);
    });
    const calGoal = state.settings.calGoal || 1400;
    const tdee = state.settings.tdee || 2000;
    const deficit = totalCal - tdee;
    document.getElementById('dash-cal-consumed').innerText = String(totalCal);
    document.getElementById('dash-cal-goal').innerText = String(calGoal);
    document.getElementById('dash-cal-deficit').innerText = `${deficit > 0 ? '+' : ''}${deficit}`;
    const calPct = Math.min(100, Math.round((totalCal / calGoal) * 100));
    document.getElementById('dash-cal-pct').innerText = `${calPct}%`;
    document.getElementById('dash-cal-bar').style.width = `${calPct}%`;
    const defBadge = document.getElementById('dash-deficit-badge');
    if (deficit <= -800) {
        defBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40";
        defBadge.innerText = uiText("Déficit severo (riesgo masa muscular)", "Large deficit");
    }
    else if (deficit <= -300) {
        defBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
        defBadge.innerText = uiText("Déficit óptimo", "Optimal deficit");
    }
    else if (deficit <= 0) {
        defBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30";
        defBadge.innerText = uiText("Déficit ligero", "Light deficit");
    }
    else {
        defBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30";
        defBadge.innerText = uiText("Superávit calórico", "Calorie surplus");
    }
    const proteinGoal = state.settings.proteinGoal || 110;
    document.getElementById('dash-protein-badge').innerText = `${totalP} / ${proteinGoal} g`;
    const pPct = Math.min(100, Math.round((totalP / proteinGoal) * 100));
    document.getElementById('dash-protein-bar').style.width = `${pPct}%`;
    document.getElementById('dash-carbs-val').innerText = `${totalC} g`;
    document.getElementById('dash-fat-val').innerText = `${totalF} g`;
    const waterGoal = state.settings.waterGoal || 96;
    const curWater = day.water || 0;
    document.getElementById('dash-water-badge').innerText = `${Math.round(displayWater(curWater)!)} / ${Math.round(displayWater(waterGoal)!)} ${waterUnit()}`;
    const wPct = waterGoal > 0 ? Math.max(0, Math.round((curWater / waterGoal) * 100)) : 0;
    const wBarPct = Math.min(100, wPct);
    document.getElementById('dash-water-fill-bar').style.width = `${wBarPct}%`;
    document.getElementById('dash-water-fill-text').innerText = `${wPct}% (${Math.round(displayWater(curWater)!)} ${waterUnit()})`;
    updateHalfLifeAndNextDose();
    updateTitrationStatus();
    checkBowelMovementAlert();
    renderMealsList();
    applyStaticTranslations();
    applyUnitLabels();
}
function updateHalfLifeAndNextDose() {
    const p = getMedicationProfile();
    const isOral = p.route === 'oral';
    if (!state.injections || state.injections.length === 0) {
        document.getElementById('dash-next-inj-text').innerText = uiText('Sin dosis registrada', 'No dose recorded');
        document.getElementById('dash-rotation-hint').innerHTML = `<i data-lucide="${isOral ? 'pill' : 'map-pin'}" class="w-3.5 h-3.5 text-emerald-400"></i><span>${isOral ? uiText('Registra tu primera dosis oral', 'Log your first oral dose') : uiText('Toca Hub para registrar tu primera dosis', 'Tap Hub to log your first dose')}</span>`;
        document.getElementById('dash-halflife-pct').innerText = '0%';
        document.getElementById('dash-halflife-bar').style.width = '0%';
        document.getElementById('dash-halflife-expl').innerText = uiText('Registra una dosis para calcular el nivel estimado.', 'Log a dose to calculate the estimated medication level.');
        lucide.createIcons();
        return;
    }
    const sorted = getInjectionsForMedication(p.key).sort((a, b) => (injectionTimestamp(b) || 0) - (injectionTimestamp(a) || 0));
    const latest = sorted[0];
    if (!latest) {
        document.getElementById('dash-next-inj-text').innerText = uiText('Sin dosis de este medicamento', 'No dose for this medication');
        document.getElementById('dash-halflife-pct').innerText = '0%';
        document.getElementById('dash-halflife-bar').style.width = '0%';
        return;
    }
    const lastDate = new Date(String(latest.date).split('T')[0] + 'T12:00:00');
    if (isNaN(lastDate.getTime())) {
        document.getElementById('dash-next-inj-text').innerText = uiText('Revisar fecha de dosis', 'Review dose date');
        return;
    }
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + p.frequencyDays);
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const diff = Math.round((nextDate.getTime() - now.getTime()) / 86400000);
    let due = '';
    if (diff > 1)
        due = isEnglish() ? `In ${diff} days (${nextDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })})` : `En ${diff} días (${nextDate.toLocaleDateString('es-US', { weekday: 'short', day: 'numeric', month: 'short' })})`;
    else if (diff === 1)
        due = uiText('Próxima dosis: mañana', 'Next dose: tomorrow');
    else if (diff === 0)
        due = uiText('¡Dosis programada para hoy!', 'Dose scheduled for today!');
    else
        due = isEnglish() ? `Past scheduled date by ${Math.abs(diff)} day(s)` : `Pasó la fecha programada por ${Math.abs(diff)} día(s)`;
    document.getElementById('dash-next-inj-text').innerText = due;
    const hint = document.getElementById('dash-rotation-hint');
    if (isOral) {
        hint.innerHTML = `<i data-lucide="pill" class="w-3.5 h-3.5 text-emerald-400"></i><span>${uiText('Régimen registrado', 'Logged regimen')}: <strong>${escapeHtml(getRegimenLabel(p))}</strong></span>`;
    }
    else {
        const rotations: Record<string, string> = { 'Abdomen derecho': 'Abdomen izquierdo', 'Abdomen izquierdo': 'Muslo derecho', 'Muslo derecho': 'Muslo izquierdo', 'Muslo izquierdo': 'Brazo derecho', 'Brazo derecho': 'Brazo izquierdo', 'Brazo izquierdo': 'Abdomen derecho' };
        const nextSite = rotations[latest.site || ''] || 'Abdomen izquierdo';
        hint.innerHTML = `<i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-400"></i><span>${uiText('Rotación sugerida', 'Suggested rotation')}: <strong>${escapeHtml(translateSite(nextSite))}</strong></span>`;
    }
    const pk = calculatePkEstimate(p);
    const pct = pk && Number.isFinite(pk.pct) ? Math.round(Number(pk.pct)) : 0;
    document.getElementById('dash-halflife-pct').innerText = pk ? `${pct}%` : '--';
    document.getElementById('dash-halflife-bar').style.width = `${Math.min(100, Math.max(0, pct))}%`;
    const hl = p.halfLifeDays < 1 ? `${Math.round(p.halfLifeDays * 24)} h` : `~${p.halfLifeDays} ${uiText('días', 'days')}`;
    const amount = pk ? `${pk.active.toFixed(2)} mg` : '--';
    document.getElementById('dash-halflife-expl').innerText = pk ? (isEnglish() ? `Simplified PK estimate from all logged doses: ~${amount} active dose-equivalent. Approx. half-life: ${hl} (${p.generic}). Relative to an estimated expected peak for the logged regimen; not a blood measurement.` : `Estimación PK simplificada de todas las dosis registradas: ~${amount} de dosis-equivalente activa. Vida media aprox.: ${hl} (${p.generic}). Relativa al pico esperado estimado del régimen registrado; no es una medición en sangre.`) : uiText('Registra una dosis para calcular el nivel estimado.', 'Log a dose to calculate the estimated medication level.');
    lucide.createIcons();
}
function quickWater(multiplier: number): void {
    const displayAmount = isMetric() ? 250 * Math.abs(multiplier) : 8 * Math.abs(multiplier);
    const signed = multiplier < 0 ? -displayAmount : displayAmount;
    addWater(storageWater(signed)!);
}
function addWater(oz: number): void {
    const day = getSelectedDay();
    const current = Math.max(0, Number(day.water) || 0), requested = Number(oz) || 0, target = Math.max(0, current + requested), actualDelta = target - current;
    if (actualDelta !== 0) {
        const ts = mutationNow();
        day.waterEvents.push({ id: `water_${ts}_${Math.random().toString(36).slice(2, 8)}`, delta: actualDelta, updatedAt: ts });
        recalcWaterFromEvents(day);
        persistState({ userMutation: true });
    }
    updateDashboardView();
    const shown = displayWater(Math.abs(actualDelta));
    const total = displayWater(day.water);
    const sign = actualDelta > 0 ? '+' : actualDelta < 0 ? '-' : '';
    showToast(isEnglish() ? `${sign}${Math.round(shown!)} ${waterUnit()} water logged (Total: ${Math.round(total!)} ${waterUnit()})` : `${sign}${Math.round(shown!)} ${waterUnit()} de agua registradas (Total: ${Math.round(total!)} ${waterUnit()})`);
}
function toggleUrineGuideDetails() {
    const el = document.getElementById('urine-guide-expanded');
    el.classList.toggle('hidden');
}
/* ==========================================================================
   BOWEL MOVEMENT & SÍNTOMAS
   ========================================================================== */
function logBowelMovementNow() {
    const todayStr = getFormattedDate(new Date());
    if (!state.daysData[todayStr])
        state.daysData[todayStr] = { water: 0, waterUpdatedAt: 0, waterEvents: [], meals: [], bowelMovements: [], bowelMovementRecords: [], bowelMovementsUpdatedAt: 0, symptoms: { hunger: 3, nausea: 'none', heartburn: 'none', sulfur: 'none', fatigue: 'none', notes: '' }, symptomsUpdatedAt: 0, electrolytes: { mg: false, k: false, na: false, multi: false }, electrolytesUpdatedAt: 0 };
    const day = ensureGranularDayData(todayStr, state.daysData[todayStr]);
    const ts = mutationNow();
    const rec = { id: `bm_${ts}_${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), updatedAt: ts };
    day.bowelMovementRecords.push(rec);
    ensureGranularDayData(todayStr, day);
    persistState({ userMutation: true });
    checkBowelMovementAlert();
    renderCurrentDay();
    showUndoToast(uiText('Evacuación registrada hoy.', 'Bowel movement recorded today.'), () => { state.deletedRecords.bowelMovements[rec.id] = mutationNow(); day.bowelMovementRecords = day.bowelMovementRecords.filter((r) => r.id !== rec.id); ensureGranularDayData(todayStr, day); persistState({ userMutation: true }); checkBowelMovementAlert(); renderCurrentDay(); });
}
function removeBowelMovement(dateKey: string, idx: number): void {
    const day = state.daysData && state.daysData[dateKey];
    if (!day)
        return;
    ensureGranularDayData(dateKey, day);
    const at = day.bowelMovements?.[idx];
    if (!at)
        return;
    const pos = day.bowelMovementRecords.findIndex((r) => r.at === at);
    if (pos < 0)
        return;
    const removed = JSON.parse(JSON.stringify(day.bowelMovementRecords[pos]));
    const delTs = mutationNow();
    state.deletedRecords.bowelMovements[removed.id] = delTs;
    day.bowelMovementRecords.splice(pos, 1);
    ensureGranularDayData(dateKey, day);
    persistState({ userMutation: true });
    checkBowelMovementAlert();
    renderCurrentDay();
    showUndoToast(uiText('Registro de evacuación eliminado.', 'Bowel record deleted.'), () => { delete state.deletedRecords.bowelMovements[removed.id]; removed.updatedAt = mutationNow(); day.bowelMovementRecords.push(removed); ensureGranularDayData(dateKey, day); persistState({ userMutation: true }); checkBowelMovementAlert(); renderCurrentDay(); });
}
function checkBowelMovementAlert() {
    let latestBMTime = 0;
    Object.keys(state.daysData).forEach((d) => {
        const list = state.daysData[d]?.bowelMovements || [];
        list.forEach((ts) => {
            const t = new Date(ts).getTime();
            if (t > latestBMTime)
                latestBMTime = t;
        });
    });
    const banner = document.getElementById('bowel-alert-banner');
    const statusText = document.getElementById('bowel-movement-status-text');
    if (latestBMTime === 0) {
        banner.classList.add('hidden');
        banner.classList.remove('flex');
        if (statusText)
            statusText.innerText = uiText("Sin registros recientes de evacuación.", "No recent bowel movement records.");
        renderBowelStats();
        return;
    }
    const diffHours = (Date.now() - latestBMTime) / (1000 * 60 * 60);
    if (statusText) {
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 0)
            statusText.innerText = uiText("Última evacuación registrada: Hoy", "Last bowel movement: Today");
        else if (diffDays === 1)
            statusText.innerText = uiText("Última evacuación registrada: Ayer (~24h)", "Last bowel movement: Yesterday (~24h)");
        else
            statusText.innerText = isEnglish() ? `Last bowel movement: ${diffDays} days ago (${Math.round(diffHours)}h)` : `Última evacuación: Hace ${diffDays} días (${Math.round(diffHours)}h)`;
    }
    if (diffHours >= 48) {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
        lucide.createIcons();
    }
    else {
        banner.classList.add('hidden');
        banner.classList.remove('flex');
    }
    renderBowelStats();
}
function translateMealSlot(slot: unknown): string {
    const map: Record<string, readonly [string, string]> = { Desayuno: ['Desayuno', 'Breakfast'], Almuerzo: ['Almuerzo', 'Lunch'], Cena: ['Cena', 'Dinner'], Merienda: ['Merienda', 'Snack'], Comida: ['Comida', 'Meal'], Breakfast: ['Desayuno', 'Breakfast'], Lunch: ['Almuerzo', 'Lunch'], Dinner: ['Cena', 'Dinner'], Snack: ['Merienda', 'Snack'], Meal: ['Comida', 'Meal'] };
    const pair = map[String(slot || 'Comida')];
    return pair ? uiText(pair[0], pair[1]) : String(slot || uiText('Comida', 'Meal'));
}
function mealLocalizedName(meal: RuntimeMeal | null | undefined, lang: 'en' | 'es' = isEnglish() ? 'en' : 'es'): string {
    if (!meal || typeof meal !== 'object')
        return uiText('Comida', 'Meal');
    if (lang === 'en')
        return String(meal.nameEn || meal.name || meal.nameEs || 'Meal');
    return String(meal.nameEs || meal.name || meal.nameEn || 'Comida');
}
function mealLocalizedTip(meal: RuntimeMeal | null | undefined, lang: 'en' | 'es' = isEnglish() ? 'en' : 'es'): string {
    if (!meal || typeof meal !== 'object')
        return '';
    if (lang === 'en')
        return String(meal.tipEn || meal.tip || meal.tipEs || '');
    return String(meal.tipEs || meal.tip || meal.tipEn || '');
}
function mealNeedsCurrentLanguageTranslation(meal: RuntimeMeal | null | undefined): boolean {
    if (!meal || !meal.tip)
        return false;
    return !(meal.nameEs && meal.nameEn && meal.tipEs && meal.tipEn);
}
function renderMealsList() {
    const day = getSelectedDay();
    const container = document.getElementById('daily-meals-container');
    if (!container)
        return;
    container.innerHTML = '';
    if (!day.meals || day.meals.length === 0) {
        container.innerHTML = `
          <div class="text-center py-6 bg-[#111a2e]/50 rounded-2xl border border-dashed border-[#223455] p-5">
            <i data-lucide="utensils" class="w-7 h-7 text-slate-500 mx-auto mb-2"></i>
            <p class="text-xs font-bold text-slate-300">${uiText('Sin alimentos registrados en esta fecha', 'No foods logged for this date')}</p>
            <p class="text-[10px] text-slate-500 mt-0.5">${uiText("Usa 'Analizar plato' para fotografiar tu comida o añade manualmente.", "Use 'Analyze meal' to photograph your food or add it manually.")}</p>
          </div>
        `;
        lucide.createIcons();
        return;
    }
    day.meals.forEach((meal, idx) => {
        const card = document.createElement('div');
        const mealName = mealLocalizedName(meal);
        const mealTip = mealLocalizedTip(meal);
        const needsTranslation = mealNeedsCurrentLanguageTranslation(meal);
        card.className = "bg-[#111a2e] rounded-2xl p-3 border border-[#223455] space-y-2";
        card.innerHTML = `
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-800 text-slate-300 uppercase">${escapeHtml(translateMealSlot(meal.slot))}</span>
                <span class="text-[10px] text-slate-500">${escapeHtml(meal.time || '')}</span>
              </div>
              <h4 class="text-xs font-bold text-white mt-0.5">${escapeHtml(mealName)}</h4>
            </div>
            <button data-delete-meal="${idx}" class="text-slate-500 hover:text-rose-400 p-1 transition-colors">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <div class="flex items-center gap-3 text-xs pt-1 border-t border-[#223455]">
            <div>
              <span class="text-[10px] text-slate-400 font-medium">Cal:</span>
              <span class="font-black text-white">${Number(meal.calories || 0)}</span>
            </div>
            <div>
              <span class="text-[10px] text-amber-400 font-medium">${uiText('Proteína:', 'Protein:')}</span>
              <span class="font-black text-amber-400">${Number(meal.protein || 0)}g</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 font-medium">${uiText('Carbos:', 'Carbs:')}</span>
              <span class="font-semibold text-slate-300">${Number(meal.carbs || 0)}g</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 font-medium">${uiText('Grasas:', 'Fat:')}</span>
              <span class="font-semibold text-slate-300">${Number(meal.fat || 0)}g</span>
            </div>
          </div>

          ${mealTip ? `
            <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-[10px] text-emerald-300 flex items-start gap-1.5">
              <i data-lucide="info" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
              <span>${escapeHtml(mealTip)}</span>
            </div>
          ` : ''}
          ${needsTranslation ? `<button data-translate-meal="${idx}" class="w-full py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[9px] font-bold hover:bg-cyan-500/20">${uiText('Crear versión bilingüe', 'Create bilingual version')}</button>` : ''}
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
}
let pendingUndoAction: (() => void) | null = null;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
function showUndoToast(message: string, restoreFn: (() => void) | null | undefined): void {
    const btn = document.getElementById('toast-undo-btn');
    pendingUndoAction = typeof restoreFn === 'function' ? restoreFn : null;
    if (btn) {
        btn.innerText = uiText('Deshacer', 'Undo');
        btn.classList.toggle('hidden', !pendingUndoAction);
        btn.onclick = () => {
            if (!pendingUndoAction)
                return;
            const fn = pendingUndoAction;
            pendingUndoAction = null;
            if (undoTimer)
                clearTimeout(undoTimer);
            btn.classList.add('hidden');
            fn();
            showToast(uiText('Eliminación deshecha.', 'Deletion undone.'));
        };
    }
    showToast(message, 5000, true);
    if (undoTimer)
        clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { pendingUndoAction = null; if (btn)
        btn.classList.add('hidden'); }, 5000);
}
function removeMealItem(idx: number): void {
    const day = getSelectedDay();
    if (day.meals && day.meals[idx]) {
        const meal = day.meals[idx];
        if (meal.id) {
            if (!state.deletedRecords)
                state.deletedRecords = { meals: {}, weights: {}, injections: {}, measurements: {}, bowelMovements: {} };
            if (!state.deletedRecords.meals)
                state.deletedRecords.meals = {};
            state.deletedRecords.meals[meal.id] = mutationNow();
        }
        const removedMeal = JSON.parse(JSON.stringify(meal));
        const removedDate = state.selectedDate;
        day.meals.splice(idx, 1);
        persistState({ userMutation: true });
        updateDashboardView();
        checkFoodSymptomCorrelation();
        showUndoToast(uiText("Comida eliminada.", "Meal deleted."), () => {
            const target = state.daysData[removedDate] || getSelectedDay();
            if (!Array.isArray(target.meals))
                target.meals = [];
            removedMeal.updatedAt = mutationNow();
            target.meals.splice(Math.min(idx, target.meals.length), 0, removedMeal);
            if (removedMeal.id && state.deletedRecords?.meals)
                delete state.deletedRecords.meals[removedMeal.id];
            persistState({ userMutation: true });
            updateDashboardView();
            checkFoodSymptomCorrelation();
        });
    }
}

