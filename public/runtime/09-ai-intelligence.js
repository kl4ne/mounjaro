"use strict";
/**
 * GLP-1 Companion v5.1.0 — AI Intelligence Phase 1
 * Ask My Data + Weekly AI Check-In.
 *
 * Numeric summaries are calculated locally first. Firebase AI Logic receives a
 * minimized, structured context with no name, email, Firebase UID or health-profile
 * identifiers. AI explains the supplied records; it does not calculate treatment,
 * diagnose conditions or recommend medication changes.
 */
let lastAskMyDataResult = null;
let lastWeeklyAiResult = null;
let aiIntelligenceBusy = false;
function roundAiMetric(value, decimals = 1) {
    if (value === null || !Number.isFinite(value))
        return null;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
function truncateAiText(value, maxLength = 80) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (text.length <= maxLength)
        return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
function getAiBowelCount(day) {
    if (Array.isArray(day.bowelMovementRecords) && day.bowelMovementRecords.length)
        return day.bowelMovementRecords.length;
    if (Array.isArray(day.bowelMovements))
        return day.bowelMovements.length;
    return 0;
}
function getAiSymptomSnapshot(day) {
    const symptoms = day.symptoms || {};
    const out = {};
    const symptomKeys = ['nausea', 'heartburn', 'sulfur', 'fatigue'];
    symptomKeys.forEach((key) => {
        const value = symptoms[key];
        if (value !== undefined && value !== null && String(value) !== '' && String(value) !== 'none') {
            out[String(key)] = typeof value === 'number' ? value : truncateAiText(value, 32);
        }
    });
    const hunger = Number(symptoms.hunger);
    if (Number.isFinite(hunger))
        out.hunger = hunger;
    return out;
}
function getAiDoseEntriesForDate(dateKey) {
    return (Array.isArray(state.injections) ? state.injections : [])
        .filter((inj) => inj && String(inj.date || '').split('T')[0] === dateKey)
        .map((inj) => ({
        medication: truncateAiText(inj.medication || getMedicationProfile().key, 40),
        dose: truncateAiText(inj.dose || '', 24),
        time: truncateAiText(inj.time || '', 16)
    }));
}
function buildAiDailySnapshot(dateKey) {
    const day = state.daysData[dateKey];
    if (!day) {
        return {
            date: dateKey,
            tracked: false,
            water: null,
            waterUnit: waterUnit(),
            calories: null,
            proteinG: null,
            carbsG: null,
            fatG: null,
            meals: [],
            symptoms: {},
            bowelMovements: 0,
            doses: getAiDoseEntriesForDate(dateKey)
        };
    }
    const meals = Array.isArray(day.meals) ? day.meals : [];
    const totals = meals.reduce((acc, meal) => {
        acc.calories += Number(meal && meal.calories || 0);
        acc.protein += Number(meal && meal.protein || 0);
        acc.carbs += Number(meal && meal.carbs || 0);
        acc.fat += Number(meal && meal.fat || 0);
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const displayedWater = Number(day.water || 0) > 0 ? displayWater(day.water) : null;
    const symptoms = getAiSymptomSnapshot(day);
    const doses = getAiDoseEntriesForDate(dateKey);
    const tracked = dayHasMeaningfulTracking(day) || doses.length > 0;
    return {
        date: dateKey,
        tracked,
        water: displayedWater === null ? null : roundAiMetric(displayedWater, 0),
        waterUnit: waterUnit(),
        calories: meals.length ? roundAiMetric(totals.calories, 0) : null,
        proteinG: meals.length ? roundAiMetric(totals.protein, 1) : null,
        carbsG: meals.length ? roundAiMetric(totals.carbs, 1) : null,
        fatG: meals.length ? roundAiMetric(totals.fat, 1) : null,
        meals: meals.slice(0, 8).map((meal) => truncateAiText(isEnglish() ? (meal.nameEn || meal.name || meal.nameEs) : (meal.nameEs || meal.name || meal.nameEn), 72)).filter(Boolean),
        symptoms,
        bowelMovements: getAiBowelCount(day),
        doses
    };
}
function toAiWeekMetrics(metrics) {
    const shownWater = metrics.waterAvg === null ? null : displayWater(metrics.waterAvg);
    const shownWeightChange = metrics.weightDelta === null ? null : displayWeight(metrics.weightDelta);
    const shownSingleWeight = metrics.singleWeight === null ? null : displayWeight(metrics.singleWeight);
    return {
        startDate: metrics.startKey,
        endDate: metrics.endKey,
        trackedDays: metrics.trackedDays,
        symptomDays: metrics.symptomDays,
        doseCount: metrics.doseCount,
        avgWater: shownWater === null ? null : roundAiMetric(shownWater, 0),
        waterUnit: waterUnit(),
        avgProteinG: metrics.proteinAvg === null ? null : roundAiMetric(metrics.proteinAvg, 1),
        weightChange: shownWeightChange === null ? null : roundAiMetric(shownWeightChange, 1),
        singleWeight: shownSingleWeight === null ? null : roundAiMetric(shownSingleWeight, 1),
        weightUnit: weightUnit()
    };
}
function buildAiDataContext(rangeDays) {
    const safeDays = [7, 30, 90].includes(rangeDays) ? rangeDays : 30;
    const endDate = getFormattedDate(new Date());
    const keys = getRollingDateKeys(endDate, safeDays);
    const daily = keys.map(buildAiDailySnapshot);
    let trackedDays = 0;
    let waterDays = 0;
    let waterTotal = 0;
    let mealDays = 0;
    let mealEntries = 0;
    let caloriesTotal = 0;
    let proteinTotal = 0;
    let symptomDays = 0;
    let bowelMovementEntries = 0;
    let doseEntries = 0;
    daily.forEach((day) => {
        if (day.tracked)
            trackedDays++;
        if (day.water !== null) {
            waterDays++;
            waterTotal += day.water;
        }
        if (day.calories !== null) {
            mealDays++;
            caloriesTotal += day.calories;
            proteinTotal += Number(day.proteinG || 0);
            mealEntries += day.meals.length;
        }
        if (Object.keys(day.symptoms).some((key) => key !== 'hunger'))
            symptomDays++;
        bowelMovementEntries += day.bowelMovements;
        doseEntries += day.doses.length;
    });
    const weights = (Array.isArray(state.weights) ? state.weights : [])
        .filter((weight) => weight && weight.date >= keys[0] && weight.date <= keys[keys.length - 1] && Number.isFinite(Number(weight.weight)))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((weight) => ({
        date: String(weight.date).split('T')[0],
        value: roundAiMetric(Number(displayWeight(weight.weight)), 1) || 0,
        unit: weightUnit()
    }));
    const weightChange = weights.length >= 2 ? roundAiMetric(weights[weights.length - 1].value - weights[0].value, 1) : null;
    const currentWeekRaw = getWeekMetrics(endDate);
    const previousEnd = new Date(currentWeekRaw.startKey + 'T12:00:00');
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousWeekRaw = getWeekMetrics(getFormattedDate(previousEnd));
    const currentWeek = toAiWeekMetrics(currentWeekRaw);
    const previousWeek = safeDays >= 14 ? toAiWeekMetrics(previousWeekRaw) : null;
    const profile = getMedicationProfile();
    const presentation = getPresentationProfile();
    return {
        generatedAt: new Date().toISOString(),
        range: { startDate: keys[0], endDate: keys[keys.length - 1], days: safeDays },
        displayUnits: { weight: weightUnit(), water: waterUnit() },
        activeMedication: {
            name: getMedicationLabel(profile, true),
            route: profile.route,
            presentation: isEnglish() ? presentation.en : presentation.es
        },
        goals: {
            water: roundAiMetric(Number(displayWater(state.settings.waterGoal)), 0) || 0,
            waterUnit: waterUnit(),
            proteinG: Number(state.settings.proteinGoal || 0),
            calories: Number(state.settings.calGoal || 0),
            goalWeight: roundAiMetric(Number(displayWeight(state.settings.goalWeight)), 1) || 0,
            weightUnit: weightUnit()
        },
        summary: {
            avgWater: waterDays ? roundAiMetric(waterTotal / waterDays, 0) : null,
            avgProteinG: mealDays ? roundAiMetric(proteinTotal / mealDays, 1) : null,
            avgCalories: mealDays ? roundAiMetric(caloriesTotal / mealDays, 0) : null,
            weightChange,
            weightUnit: weightUnit(),
            symptomDays,
            trackedDays,
            doseEntries,
            bowelMovementEntries
        },
        currentWeek,
        previousWeek,
        coverage: {
            rangeDays: safeDays,
            trackedDays,
            waterDays,
            mealDays,
            mealEntries,
            symptomDays,
            bowelMovementEntries,
            doseEntries,
            weightEntries: weights.length
        },
        weights,
        daily
    };
}
function normalizeAskMyDataResult(data) {
    return {
        answerEs: String(data.answerEs || '').trim(),
        answerEn: String(data.answerEn || '').trim(),
        evidenceEs: String(data.evidenceEs || '').trim(),
        evidenceEn: String(data.evidenceEn || '').trim(),
        coverageEs: String(data.coverageEs || '').trim(),
        coverageEn: String(data.coverageEn || '').trim()
    };
}
function normalizeWeeklyAiResult(data) {
    return {
        headlineEs: String(data.headlineEs || '').trim(),
        headlineEn: String(data.headlineEn || '').trim(),
        summaryEs: String(data.summaryEs || '').trim(),
        summaryEn: String(data.summaryEn || '').trim(),
        positiveEs: String(data.positiveEs || '').trim(),
        positiveEn: String(data.positiveEn || '').trim(),
        watchEs: String(data.watchEs || '').trim(),
        watchEn: String(data.watchEn || '').trim(),
        coverageEs: String(data.coverageEs || '').trim(),
        coverageEn: String(data.coverageEn || '').trim()
    };
}
function renderAiEvidenceLines(targetId, value) {
    const target = document.getElementById(targetId);
    const lines = String(value || '').split(/\n+/).map((line) => line.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean).slice(0, 6);
    target.innerHTML = lines.length
        ? lines.map((line) => `<div class="flex gap-2 items-start"><i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-cyan-300 shrink-0 mt-0.5"></i><span>${escapeHtml(line)}</span></div>`).join('')
        : `<span class="text-slate-500">${escapeHtml(uiText('Sin evidencia adicional para mostrar.', 'No additional evidence to display.'))}</span>`;
}
function renderAskMyDataResult() {
    const card = document.getElementById('ai-data-answer-card');
    if (!lastAskMyDataResult) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');
    document.getElementById('ai-data-answer').innerText = isEnglish() ? lastAskMyDataResult.answerEn : lastAskMyDataResult.answerEs;
    document.getElementById('ai-data-coverage').innerText = isEnglish() ? lastAskMyDataResult.coverageEn : lastAskMyDataResult.coverageEs;
    renderAiEvidenceLines('ai-data-evidence', isEnglish() ? lastAskMyDataResult.evidenceEn : lastAskMyDataResult.evidenceEs);
}
function renderWeeklyAiResult() {
    const card = document.getElementById('weekly-ai-result-card');
    if (!lastWeeklyAiResult) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');
    document.getElementById('weekly-ai-headline').innerText = isEnglish() ? lastWeeklyAiResult.headlineEn : lastWeeklyAiResult.headlineEs;
    document.getElementById('weekly-ai-summary').innerText = isEnglish() ? lastWeeklyAiResult.summaryEn : lastWeeklyAiResult.summaryEs;
    document.getElementById('weekly-ai-positive').innerText = isEnglish() ? lastWeeklyAiResult.positiveEn : lastWeeklyAiResult.positiveEs;
    document.getElementById('weekly-ai-watch').innerText = isEnglish() ? lastWeeklyAiResult.watchEn : lastWeeklyAiResult.watchEs;
    document.getElementById('weekly-ai-coverage').innerText = isEnglish() ? lastWeeklyAiResult.coverageEn : lastWeeklyAiResult.coverageEs;
}
function renderWeeklyDeterministicPreview() {
    const current = getWeekMetrics(getFormattedDate(new Date()));
    const previousEnd = new Date(current.startKey + 'T12:00:00');
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previous = getWeekMetrics(getFormattedDate(previousEnd));
    const weight = current.weightDelta === null ? '--' : `${current.weightDelta > 0 ? '+' : ''}${formatWeight(current.weightDelta, 1)}`;
    const water = current.waterAvg === null ? '--' : formatWater(current.waterAvg);
    const protein = current.proteinAvg === null ? '--' : `${Math.round(current.proteinAvg)} g`;
    document.getElementById('weekly-ai-weight-preview').innerText = weight;
    document.getElementById('weekly-ai-water-preview').innerText = water;
    document.getElementById('weekly-ai-protein-preview').innerText = protein;
    document.getElementById('weekly-ai-tracked-preview').innerText = `${current.trackedDays}/7`;
    document.getElementById('weekly-ai-symptoms-preview').innerText = String(current.symptomDays);
    document.getElementById('weekly-ai-dose-preview').innerText = String(current.doseCount);
    const comparison = document.getElementById('weekly-ai-local-comparison');
    comparison.innerHTML = [
        comparisonText('Agua prom.', 'Avg. water', current.waterAvg === null ? null : displayWater(current.waterAvg), previous.waterAvg === null ? null : displayWater(previous.waterAvg), ` ${waterUnit()}`),
        comparisonText('Proteína prom.', 'Avg. protein', current.proteinAvg, previous.proteinAvg, ' g'),
        comparisonText('Días con síntomas', 'Symptom days', current.symptomDays, previous.symptomDays, '', true),
        comparisonText('Días registrados', 'Tracked days', current.trackedDays, previous.trackedDays)
    ].join('');
}
function updateAiIntelligenceLanguage() {
    document.getElementById('nav-label-ai').innerText = uiText('IA e insights', 'AI & insights');
    document.getElementById('ai-intelligence-eyebrow').innerText = uiText('Inteligencia personal', 'Personal intelligence');
    document.getElementById('ai-intelligence-title').innerText = uiText('Entiende tus propios datos', 'Understand your own data');
    document.getElementById('ai-intelligence-subtitle').innerText = uiText('La app calcula primero; la IA explica después.', 'The app calculates first; AI explains second.');
    document.getElementById('ask-data-title').innerText = uiText('Pregúntale a tus datos', 'Ask My Data');
    document.getElementById('ask-data-subtitle').innerText = uiText('Haz preguntas sobre tus registros de peso, agua, comida, síntomas y dosis.', 'Ask questions about your weight, water, meals, symptoms and dose records.');
    document.getElementById('ask-data-button-text').innerText = uiText('Preguntar a mis datos', 'Ask my data');
    document.getElementById('weekly-ai-title').innerText = uiText('Weekly AI Check-In', 'Weekly AI Check-In');
    document.getElementById('weekly-ai-subtitle').innerText = uiText('Resumen de 7 días con comparación contra la semana anterior.', '7-day summary compared with the previous week.');
    document.getElementById('weekly-ai-button-text').innerText = uiText('Generar check-in semanal', 'Generate weekly check-in');
    document.getElementById('ai-privacy-note').innerText = uiText('Privacidad: este contexto no incluye tu nombre, email ni Firebase UID, a menos que tú los escribas en la pregunta.', 'Privacy: this context does not include your name, email or Firebase UID unless you type them in your question.');
    document.getElementById('ai-safety-note').innerText = uiText('La IA resume tus registros. No diagnostica ni recomienda cambios de dosis o tratamiento.', 'AI summarizes your records. It does not diagnose or recommend dose or treatment changes.');
    const question = document.getElementById('ai-data-question');
    question.placeholder = uiText('Ej: ¿Cómo me fue esta semana comparado con la anterior?', 'Example: How did I do this week compared with last week?');
}
function renderAiIntelligenceView() {
    updateAiIntelligenceLanguage();
    renderWeeklyDeterministicPreview();
    renderAskMyDataResult();
    renderWeeklyAiResult();
    lucide.createIcons();
}
function setAskMyDataPreset(preset) {
    const input = document.getElementById('ai-data-question');
    const presets = {
        week: ['¿Cómo me fue esta semana comparado con la anterior?', 'How did I do this week compared with the previous week?'],
        symptoms: ['¿Qué patrones aparecen entre mis dosis y los síntomas que he registrado?', 'What patterns appear between my doses and the symptoms I have logged?'],
        weight: ['¿Cómo han cambiado mi peso, hidratación y proteína en este periodo?', 'How have my weight, hydration and protein changed during this period?']
    };
    const selected = presets[preset] || presets.week;
    input.value = isEnglish() ? selected[1] : selected[0];
    input.focus();
}
async function runAiIntelligenceRequest(request, busyLabelId) {
    if (aiIntelligenceBusy)
        throw new Error('AI_INTELLIGENCE_BUSY');
    if (navigator.onLine === false)
        throw new Error('AI_INTELLIGENCE_OFFLINE');
    if (window.firebaseAiLogicReady === false)
        throw new Error('AI_INTELLIGENCE_UNAVAILABLE');
    aiIntelligenceBusy = true;
    const label = document.getElementById(busyLabelId);
    const original = label.innerText;
    label.innerText = uiText('Analizando…', 'Analyzing…');
    let telemetryChanged = false;
    try {
        const t0 = performance.now();
        try {
            const output = await request(AI_PRIMARY_MODEL);
            recordAiAttempt('primary', true, performance.now() - t0);
            telemetryChanged = true;
            return output;
        }
        catch (primaryError) {
            const classification = classifyAiFailure(primaryError);
            if (!classification.recoverable)
                throw primaryError;
            recordAiAttempt('primary', false, performance.now() - t0);
            recordAiFailover();
            telemetryChanged = true;
        }
        const t1 = performance.now();
        try {
            const output = await request(AI_FALLBACK_MODEL);
            recordAiAttempt('fallback', true, performance.now() - t1);
            telemetryChanged = true;
            return output;
        }
        catch (fallbackError) {
            recordAiAttempt('fallback', false, performance.now() - t1);
            telemetryChanged = true;
            throw fallbackError;
        }
    }
    finally {
        if (telemetryChanged) {
            persistState({ userMutation: true });
            renderAiStatus();
        }
        aiIntelligenceBusy = false;
        label.innerText = original;
    }
}
function showAiIntelligenceError(error) {
    const classification = classifyAiFailure(error);
    if (String(error instanceof Error ? error.message : error).includes('OFFLINE') || classification.reason === 'offline') {
        showToast(uiText('Ask My Data necesita conexión para usar Firebase AI Logic. Tus datos locales siguen disponibles.', 'Ask My Data needs a connection to use Firebase AI Logic. Your local data remain available.'), 5200);
        return;
    }
    if (classification.reason === 'security') {
        showToast(uiText('La IA fue bloqueada por autenticación, permisos o App Check. No se enviaron resultados inventados.', 'AI was blocked by authentication, permissions or App Check. No invented result was shown.'), 5200);
        return;
    }
    showToast(uiText('No se pudo completar el análisis de IA ahora. Inténtalo nuevamente.', 'The AI analysis could not be completed right now. Please try again.'), 5200);
}
async function askMyData() {
    const question = document.getElementById('ai-data-question').value.trim();
    if (!question) {
        showToast(uiText('Escribe una pregunta sobre tus registros.', 'Enter a question about your records.'));
        return;
    }
    if (typeof window.firebaseAiAskMyData !== 'function') {
        showToast(uiText('Ask My Data aún no está disponible.', 'Ask My Data is not available yet.'));
        return;
    }
    const range = Number(document.getElementById('ai-data-range').value || 30);
    const context = buildAiDataContext(range);
    if (context.coverage.trackedDays === 0 && context.coverage.weightEntries === 0 && context.coverage.doseEntries === 0) {
        showToast(uiText('No hay suficientes registros en ese periodo para analizar.', 'There are not enough records in that period to analyze.'));
        return;
    }
    document.getElementById('ai-data-answer-card').classList.add('hidden');
    try {
        const output = await runAiIntelligenceRequest((modelName) => window.firebaseAiAskMyData({ question, contextJson: JSON.stringify(context), modelName }), 'ask-data-button-text');
        lastAskMyDataResult = normalizeAskMyDataResult(output);
        renderAskMyDataResult();
        lucide.createIcons();
    }
    catch (error) {
        console.warn('Ask My Data failed:', error);
        showAiIntelligenceError(error);
    }
}
async function generateWeeklyAiCheckIn() {
    if (typeof window.firebaseAiWeeklyCheckIn !== 'function') {
        showToast(uiText('Weekly AI Check-In aún no está disponible.', 'Weekly AI Check-In is not available yet.'));
        return;
    }
    const context = buildAiDataContext(30);
    const currentWeekTracked = Number(context.currentWeek.trackedDays || 0);
    if (currentWeekTracked === 0 && context.coverage.weightEntries === 0 && context.coverage.doseEntries === 0) {
        showToast(uiText('No hay suficientes registros esta semana para generar el check-in.', 'There are not enough records this week to generate a check-in.'));
        return;
    }
    const weeklyContext = {
        generatedAt: context.generatedAt,
        displayUnits: context.displayUnits,
        activeMedication: context.activeMedication,
        goals: context.goals,
        currentWeek: context.currentWeek,
        previousWeek: context.previousWeek,
        currentWeekDaily: context.daily.slice(-7),
        previousWeekDaily: context.daily.slice(-14, -7),
        recentWeightEntries: context.weights.slice(-8),
        coverage: context.coverage
    };
    document.getElementById('weekly-ai-result-card').classList.add('hidden');
    try {
        const output = await runAiIntelligenceRequest((modelName) => window.firebaseAiWeeklyCheckIn({ contextJson: JSON.stringify(weeklyContext), modelName }), 'weekly-ai-button-text');
        lastWeeklyAiResult = normalizeWeeklyAiResult(output);
        renderWeeklyAiResult();
        lucide.createIcons();
    }
    catch (error) {
        console.warn('Weekly AI Check-In failed:', error);
        showAiIntelligenceError(error);
    }
}
