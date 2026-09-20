"use strict";
/**
 * GLP-1 Companion v5 Phase 3 compatibility module
 * Weight/body metrics, reports, exports, backups, restore/reset and fasting lifecycle.
 *
 * Loaded as an ordered classic script on purpose: this preserves the existing
 * shared global lexical environment and inline-handler contract while the v5
 * architecture is modularized without behavior changes.
 */
/* ==========================================================================
   HERRAMIENTAS, PESO, PROYECCIÓN Y MEDIA MÓVIL (7 DÍAS)
   ========================================================================== */
function getLatestWeight() { const arr = (state.weights || []).filter((w) => w && Number.isFinite(Number(w.weight))).sort((a, b) => String(a.date).localeCompare(String(b.date))); const latest = arr.at(-1); return latest ? Number(latest.weight) : null; }
function getWeightVariation(days = 30) {
    const cutoff = getDateOffsetKey(getFormattedDate(new Date()), -(days - 1)) || '';
    const vals = (state.weights || []).filter((w) => w && String(w.date) >= cutoff && Number.isFinite(Number(w.weight))).map((w) => Number(w.weight));
    if (vals.length < 2)
        return null;
    return Math.max(...vals) - Math.min(...vals);
}
function toggleMaintenanceMode() {
    const input = document.getElementById('maintenance-range-input');
    const shown = Number(input && input.value);
    const range = storageWeight(shown);
    if (range !== null && Number.isFinite(range) && range >= 0.5 && range <= 15)
        state.settings.maintenanceRangeLb = range;
    state.settings.maintenanceEnabled = !state.settings.maintenanceEnabled;
    markSettingsChanged(['maintenanceRangeLb', 'maintenanceEnabled']);
    persistState({ userMutation: true });
    renderMaintenanceMode();
    showToast(state.settings.maintenanceEnabled ? uiText('Modo mantenimiento activado.', 'Maintenance mode enabled.') : uiText('Modo mantenimiento desactivado.', 'Maintenance mode disabled.'));
}
function renderMaintenanceMode() {
    const badge = document.getElementById('maintenance-status-badge'), summary = document.getElementById('maintenance-summary'), rangeEl = document.getElementById('maintenance-range'), curEl = document.getElementById('maintenance-current'), varEl = document.getElementById('maintenance-variation'), btn = document.getElementById('maintenance-toggle-btn'), input = document.getElementById('maintenance-range-input');
    if (!badge || !summary)
        return;
    const goal = Number(state.settings.goalWeight || 180), margin = Math.max(.5, Number(state.settings.maintenanceRangeLb || 3)), cur = getLatestWeight(), variation = getWeightVariation(30), low = goal - margin, high = goal + margin, enabled = !!state.settings.maintenanceEnabled;
    if (input) {
        input.value = displayWeight(margin).toFixed(1);
        input.min = isMetric() ? '0.5' : '1';
        input.max = isMetric() ? '6.8' : '15';
        input.step = '.5';
    }
    rangeEl.innerText = `${formatWeight(low, 1)}–${formatWeight(high, 1).replace(' ' + weightUnit(), '')} ${weightUnit()}`;
    curEl.innerText = cur === null ? '--' : formatWeight(cur, 1);
    varEl.innerText = variation === null ? '--' : formatWeight(variation, 1);
    badge.innerText = enabled ? uiText('Activo', 'Active') : uiText('Inactivo', 'Inactive');
    badge.className = enabled ? 'text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700';
    btn.innerText = enabled ? uiText('Desactivar', 'Disable') : uiText('Activar', 'Enable');
    if (!enabled) {
        summary.innerText = cur !== null && cur <= goal + margin ? uiText('Tu peso registrado está cerca del rango meta. Activa este modo cuando tú y tu profesional decidan entrar en mantenimiento.', 'Your recorded weight is near the goal range. Enable this mode when you and your clinician decide to enter maintenance.') : uiText('Actívalo cuando tú y tu profesional de salud decidan que entraste en una fase de mantenimiento.', 'Enable it when you and your healthcare professional decide you have entered a maintenance phase.');
        return;
    }
    if (cur === null) {
        summary.innerText = uiText('Registra un peso para evaluar estabilidad dentro del rango.', 'Log a weight to evaluate stability within the range.');
        return;
    }
    if (cur < low)
        summary.innerText = isEnglish() ? `Your latest weight is ${formatWeight(Math.abs(cur - low), 1)} below the configured range. Watch the trend and discuss it at your next visit.` : `Tu último peso está ${formatWeight(Math.abs(cur - low), 1)} por debajo del rango configurado. Observa la tendencia y coméntala en tu próxima consulta.`;
    else if (cur > high)
        summary.innerText = isEnglish() ? `Your latest weight is ${formatWeight(cur - high, 1)} above the configured range. Watch the trend and discuss it at your next visit.` : `Tu último peso está ${formatWeight(cur - high, 1)} por encima del rango configurado. Observa la tendencia y coméntala en tu próxima consulta.`;
    else
        summary.innerText = variation !== null && variation <= margin * 2 ? (isEnglish() ? `Your latest weight is within the configured range. 30-day variation: ${formatWeight(variation, 1)}.` : `Tu último peso está dentro del rango configurado. Variación de 30 días: ${formatWeight(variation, 1)}.`) : uiText('Tu último peso está dentro del rango configurado. Sigue observando la tendencia de varias semanas.', 'Your latest weight is within the configured range. Keep watching the multi-week trend.');
}
function calculateAgeFromDob(dob) {
    if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob))
        return null;
    const birth = new Date(`${dob}T12:00:00`);
    if (Number.isNaN(birth.getTime()) || birth.getTime() > Date.now())
        return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const md = now.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < birth.getDate()))
        age--;
    return age >= 0 && age <= 120 ? age : null;
}
function saveHealthProfile() {
    const sex = document.getElementById('health-sex').value;
    const dob = document.getElementById('health-dob').value;
    const shownHeight = Number(document.getElementById('health-height').value);
    const heightIn = storageLength(shownHeight);
    const activity = document.getElementById('health-activity').value;
    if (sex && !['female', 'male'].includes(sex)) {
        showToast(uiText('Selecciona un sexo válido para las fórmulas.', 'Select a valid sex for the formulas.'));
        return;
    }
    if (dob && calculateAgeFromDob(dob) === null) {
        showToast(uiText('Ingresa una fecha de nacimiento válida.', 'Enter a valid date of birth.'));
        return;
    }
    if (document.getElementById('health-height').value && (heightIn === null || !Number.isFinite(heightIn) || heightIn < 30 || heightIn > 100)) {
        showToast(uiText('Ingresa una altura válida.', 'Enter a valid height.'));
        return;
    }
    const normalizedSex = sex === 'female' || sex === 'male' ? sex : '';
    const normalizedActivity = ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(activity) ? activity : '';
    state.healthProfile = { sex: normalizedSex, dob, heightIn: heightIn !== null && Number.isFinite(heightIn) ? heightIn : null, activity: normalizedActivity, updatedAt: mutationNow() };
    persistState({ userMutation: true });
    renderHealthProfile();
    renderSmartBodyMetrics();
    showToast(uiText('Health Profile guardado.', 'Health Profile saved.'));
}
function renderHealthProfile() {
    ensureV4State();
    const h = state.healthProfile, active = document.activeElement;
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && el !== active)
            el.value = val == null ? '' : String(val);
    };
    set('health-sex', h.sex);
    set('health-dob', h.dob);
    set('health-height', h.heightIn ? displayLength(h.heightIn).toFixed(1) : '');
    set('health-activity', h.activity);
    const age = calculateAgeFromDob(h.dob), ageEl = document.getElementById('health-age');
    if (ageEl)
        ageEl.innerText = age === null ? uiText('Edad: --', 'Age: --') : (isEnglish() ? `Age: ${age}` : `Edad: ${age}`);
    const label = document.getElementById('health-height-label'), heightEl = document.getElementById('health-height');
    if (label)
        label.innerText = isEnglish() ? `Height (${lengthUnit()}):` : `Altura (${lengthUnit()}):`;
    if (heightEl) {
        heightEl.min = isMetric() ? '75' : '30';
        heightEl.max = isMetric() ? '254' : '100';
        heightEl.step = '0.1';
    }
    const complete = Boolean(h.sex && age !== null && h.heightIn && h.activity), badge = document.getElementById('health-profile-completion');
    if (badge) {
        badge.innerText = complete ? uiText('Completo', 'Complete') : uiText('Incompleto', 'Incomplete');
        badge.className = complete ? 'text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700';
    }
}
function latestWeightLb() {
    if (!Array.isArray(state.weights) || !state.weights.length)
        return null;
    const valid = state.weights.filter((w) => Number.isFinite(Number(w.weight)) && Number(w.weight) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return valid.length ? Number(valid[valid.length - 1].weight) : null;
}
function latestMeasurement() {
    if (!Array.isArray(state.measurements) || !state.measurements.length)
        return null;
    const valid = state.measurements.filter((m) => m && isValidDateKey(String(m.date || ''))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return valid.length ? valid[valid.length - 1] : null;
}
function calculateSmartBodyMetrics() {
    const h = sanitizeHealthProfile(state.healthProfile), weightLb = latestWeightLb(), heightIn = Number(h.heightIn), age = calculateAgeFromDob(h.dob), m = latestMeasurement();
    const kg = weightLb ? weightLb * LB_TO_KG : null, cm = heightIn ? heightIn * IN_TO_CM : null;
    const out = { bmi: null, bmr: null, tdee: null, whtr: null, bodyFat: null, fatMassLb: null, leanMassLb: null, hydrationOz: null };
    if (kg && cm)
        out.bmi = kg / Math.pow(cm / 100, 2);
    if (kg && cm && h.sex && age !== null) {
        out.bmr = 10 * kg + 6.25 * cm - 5 * age + (h.sex === 'male' ? 5 : -161);
        const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[String(h.activity)];
        if (mult)
            out.tdee = out.bmr * mult;
    }
    if (heightIn && m && Number(m.waist) > 0)
        out.whtr = Number(m.waist) / heightIn;
    if (heightIn && h.sex && m) {
        const waist = Number(m.waist), neck = Number(m.neck), hips = Number(m.hips);
        let bf = null;
        if (h.sex === 'male' && waist > neck && neck > 0)
            bf = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(heightIn) + 36.76;
        if (h.sex === 'female' && waist + hips > neck && waist > 0 && hips > 0 && neck > 0)
            bf = 163.205 * Math.log10(waist + hips - neck) - 97.684 * Math.log10(heightIn) - 78.387;
        if (bf !== null && Number.isFinite(bf) && bf > 2 && bf < 75)
            out.bodyFat = bf;
    }
    if (weightLb && out.bodyFat !== null) {
        out.fatMassLb = weightLb * out.bodyFat / 100;
        out.leanMassLb = weightLb - out.fatMassLb;
    }
    if (kg)
        out.hydrationOz = (kg * 30) / 29.5735;
    return out;
}
function renderSmartBodyMetrics() {
    const x = calculateSmartBodyMetrics(), set = (id, val) => {
        const el = document.getElementById(id);
        if (el)
            el.innerText = String(val);
    };
    set('metric-bmi', x.bmi !== null ? x.bmi.toFixed(1) : '--');
    let bmiClass = '--';
    if (x.bmi !== null)
        bmiClass = x.bmi < 18.5 ? uiText('Bajo peso', 'Underweight') : x.bmi < 25 ? uiText('Rango saludable', 'Healthy range') : x.bmi < 30 ? uiText('Sobrepeso', 'Overweight') : uiText('Obesidad', 'Obesity');
    set('metric-bmi-class', bmiClass);
    set('metric-bmr', x.bmr !== null ? Math.round(x.bmr) : '--');
    set('metric-tdee', x.tdee !== null ? Math.round(x.tdee) : '--');
    set('metric-whtr', x.whtr !== null ? x.whtr.toFixed(2) : '--');
    set('metric-whtr-class', x.whtr === null ? '--' : x.whtr < .5 ? uiText('Menor de 0.50', 'Below 0.50') : uiText('0.50 o más', '0.50 or above'));
    set('metric-bodyfat', x.bodyFat !== null ? `${x.bodyFat.toFixed(1)}%` : '--');
    set('metric-fatmass', x.fatMassLb !== null ? `${formatWeight(x.fatMassLb, 1)} ${uiText('grasa', 'fat')}` : '--');
    set('metric-leanmass', x.leanMassLb !== null ? `${formatWeight(x.leanMassLb, 1)} ${uiText('magra', 'lean')}` : '--');
    set('metric-hydration', x.hydrationOz !== null ? `${Math.round(displayWater(x.hydrationOz))} ${waterUnit()}/${uiText('día', 'day')}` : '--');
    const tb = document.getElementById('metric-tdee-use');
    if (tb)
        tb.classList.toggle('hidden', x.tdee === null);
    const hb = document.getElementById('metric-hydration-use');
    if (hb)
        hb.classList.toggle('hidden', x.hydrationOz === null);
}
function applySuggestedTdee() {
    const x = calculateSmartBodyMetrics(), el = document.getElementById('setting-tdee');
    if (!el || x.tdee === null) {
        showToast(uiText('Completa sexo, fecha de nacimiento, altura, actividad y peso.', 'Complete sex, date of birth, height, activity, and weight.'));
        return;
    }
    el.value = String(Math.round(x.tdee));
    showToast(uiText('TDEE sugerido colocado. Pulsa Guardar configuración para aplicarlo.', 'Suggested TDEE filled in. Tap Save settings to apply it.'));
}
function applySmartHydrationGoal() {
    const x = calculateSmartBodyMetrics(), el = document.getElementById('setting-water-goal');
    if (!el || x.hydrationOz === null) {
        showToast(uiText('Registra un peso válido primero.', 'Log a valid weight first.'));
        return;
    }
    el.value = String(Math.round(displayWater(x.hydrationOz)));
    showToast(uiText('Meta de hidratación sugerida colocada. Pulsa Guardar configuración para aplicarla.', 'Suggested hydration goal filled in. Tap Save settings to apply it.'));
}
function openMetricInfo(key) {
    const modal = document.getElementById('modal-metric-info'), title = document.getElementById('metric-info-title'), body = document.getElementById('metric-info-body'), closeBtn = document.getElementById('metric-info-close-btn');
    if (!modal || !title || !body)
        return;
    const content = {
        bmi: { es: ['IMC / BMI', 'El Índice de Masa Corporal relaciona tu peso con tu altura (kg/m²). Sirve como herramienta de orientación poblacional y de seguimiento, pero no distingue grasa de músculo ni diagnostica por sí solo.'], en: ['BMI', 'Body Mass Index relates weight to height (kg/m²). It is a population screening and tracking tool, but it does not distinguish fat from muscle and is not diagnostic by itself.'] },
        bmr: { es: ['TMB / BMR', 'La Tasa Metabólica Basal estima cuántas calorías usaría tu cuerpo en reposo para mantener funciones vitales. La app usa Mifflin–St Jeor con tu peso, altura, edad y sexo registrados.'], en: ['BMR', 'Basal Metabolic Rate estimates the calories your body would use at rest to maintain vital functions. The app uses Mifflin–St Jeor with your logged weight, height, age, and sex.'] },
        tdee: { es: ['TDEE sugerido', 'El Gasto Energético Total Diario estima cuántas calorías utilizas en un día completo. Se calcula a partir de tu TMB multiplicada por el nivel de actividad que registraste. Es una estimación ajustable, no una prescripción.'], en: ['Suggested TDEE', 'Total Daily Energy Expenditure estimates how many calories you use in a full day. It is calculated from BMR multiplied by your selected activity level. It is an adjustable estimate, not a prescription.'] },
        whtr: { es: ['Relación cintura/altura', 'Compara la circunferencia de tu cintura con tu altura. Se usa como indicador sencillo de adiposidad central y riesgo cardiometabólico. La app utiliza tu medida de cintura más reciente y tu altura registrada.'], en: ['Waist-to-height ratio', 'Compares waist circumference with height. It is a simple screening indicator of central adiposity and cardiometabolic risk. The app uses your latest waist measurement and logged height.'] },
        bodyfat: { es: ['Grasa corporal estimada', 'Estimación mediante la fórmula de la Marina de EE. UU. usando sexo, altura, cuello, cintura y, cuando corresponde, cadera. No es una medición BIA, DEXA ni un porcentaje de grasa medido directamente.'], en: ['Estimated body fat', 'Estimated with the U.S. Navy formula using sex, height, neck, waist, and when applicable hips. It is not a BIA or DEXA measurement and is not directly measured body fat.'] },
        composition: { es: ['Masa grasa / masa magra', 'La masa grasa se estima multiplicando tu peso por el porcentaje de grasa estimado. La masa magra es el peso restante. Ambas dependen de la estimación de grasa corporal y no equivalen a una medición clínica de músculo o composición corporal.'], en: ['Fat mass / lean mass', 'Fat mass is estimated by multiplying weight by the estimated body-fat percentage. Lean mass is the remaining weight. Both depend on the body-fat estimate and are not equivalent to a clinical muscle or body-composition measurement.'] },
        hydration: { es: ['Hidratación sugerida', 'La app usa una guía simple de aproximadamente 30 mL por kg de peso al día. Es una referencia ajustable; necesidades reales pueden cambiar por clima, ejercicio, enfermedad, riñón, corazón o indicaciones médicas.'], en: ['Suggested hydration', 'The app uses a simple guide of about 30 mL per kg of body weight per day. It is an adjustable reference; actual needs can change with climate, exercise, illness, kidney or heart conditions, or medical guidance.'] }
    };
    const item = content[key];
    if (!item)
        return;
    const pair = isEnglish() ? item.en : item.es;
    title.textContent = pair[0];
    body.innerHTML = `<p>${escapeHtml(pair[1])}</p><p class="text-[10px] text-slate-500 mt-3">${uiText('Toca fuera o usa Cerrar para volver a tus métricas.', 'Tap outside or use Close to return to your metrics.')}</p>`;
    if (closeBtn)
        closeBtn.textContent = uiText('Cerrar', 'Close');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
}
function closeMetricInfo() {
    const modal = document.getElementById('modal-metric-info');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
function bodyMetricBmiClassification(bmi, lang = isEnglish() ? 'en' : 'es') {
    if (!Number.isFinite(Number(bmi)))
        return { key: 'none', label: '--', color: '#94a3b8' };
    const b = Number(bmi), en = lang === 'en';
    if (b < 18.5)
        return { key: 'under', label: en ? 'Underweight' : 'Bajo peso', color: '#3b82f6' };
    if (b < 25)
        return { key: 'normal', label: en ? 'Healthy range' : 'Rango saludable', color: '#22c55e' };
    if (b < 30)
        return { key: 'over', label: en ? 'Overweight' : 'Sobrepeso', color: '#eab308' };
    if (b < 35)
        return { key: 'ob1', label: en ? 'Obesity class I' : 'Obesidad grado I', color: '#f97316' };
    if (b < 40)
        return { key: 'ob2', label: en ? 'Obesity class II' : 'Obesidad grado II', color: '#ef4444' };
    return { key: 'ob3', label: en ? 'Obesity class III' : 'Obesidad grado III', color: '#b91c1c' };
}
function getBodyMetricsInfographicData() {
    const lang = isEnglish() ? 'en' : 'es', en = lang === 'en', metrics = calculateSmartBodyMetrics(), h = sanitizeHealthProfile(state.healthProfile);
    const weights = (Array.isArray(state.weights) ? state.weights : []).filter((w) => w && Number.isFinite(Number(w.weight)) && isValidDateKey(String(w.date || ''))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const startLb = weights.length ? Number(weights[0].weight) : null, currentLb = weights.length ? Number(weights[weights.length - 1].weight) : null;
    const goalLb = Number.isFinite(Number(state.settings?.goalWeight)) ? Number(state.settings.goalWeight) : null;
    const age = calculateAgeFromDob(h.dob), latestM = latestMeasurement();
    let progress = null;
    if (startLb !== null && currentLb !== null && goalLb !== null && Math.abs(startLb - goalLb) > .01) {
        progress = startLb > goalLb ? (startLb - currentLb) / (startLb - goalLb) : (currentLb - startLb) / (goalLb - startLb);
        progress = Math.max(0, Math.min(1, progress));
    }
    const userName = (currentUser && ((currentUser.displayName && String(currentUser.displayName).trim()) || currentUser.email)) || (en ? 'Active user' : 'Usuario activo');
    const sexLabel = h.sex === 'male' ? (en ? 'Male' : 'Masculino') : h.sex === 'female' ? (en ? 'Female' : 'Femenino') : '--';
    const cls = bodyMetricBmiClassification(metrics.bmi, lang);
    return { lang, en, metrics, h, weights, startLb, currentLb, goalLb, age, latestM, progress, userName, sexLabel, classification: cls, generatedAt: new Date() };
}
function roundedCanvasRect(ctx, x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}
function canvasText(ctx, text, x, y, size = 28, color = '#0f172a', weight = '400', align = 'left', font = 'Arial') { ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(text ?? ''), x, y); }
function canvasWrap(ctx, text, x, y, maxWidth, lineHeight, size = 24, color = '#475569', weight = '400', maxLines = 5) {
    ctx.font = `${weight} ${size}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const words = String(text || '').split(/\s+/);
    let line = '';
    let lines = [];
    for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        }
        else
            line = test;
    }
    if (line)
        lines.push(line);
    if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        let last = lines[maxLines - 1];
        while (ctx.measureText(last + '…').width > maxWidth && last.length > 1)
            last = last.slice(0, -1);
        lines[maxLines - 1] = last + '…';
    }
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
    return lines.length * lineHeight;
}
function infographicPanel(ctx, x, y, w, h, title, accent = '#1d4ed8') {
    roundedCanvasRect(ctx, x, y, w, h, 22, '#ffffff', '#dbe7f4', 2);
    ctx.fillStyle = '#f2f7fc';
    ctx.fillRect(x + 2, y + 2, w - 4, 58);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 2, y + 2, 8, 58);
    canvasText(ctx, title, x + 26, y + 40, 28, '#12345b', '700');
}
function infographicMetric(ctx, x, y, label, value, accent = '#2563eb', sub = '') {
    roundedCanvasRect(ctx, x, y, 238, 120, 18, '#f8fbff', '#dbe7f4', 2);
    canvasText(ctx, label, x + 18, y + 30, 20, '#64748b', '700');
    canvasText(ctx, value, x + 18, y + 72, 34, accent, '800');
    if (sub)
        canvasText(ctx, sub, x + 18, y + 101, 18, '#64748b', '400');
}
function drawBodyWeightChart(ctx, data, x, y, w, h) {
    const weights = data.weights;
    if (!weights.length) {
        canvasText(ctx, data.en ? 'No weight history yet' : 'Aún no hay historial de peso', x + w / 2, y + h / 2, 24, '#94a3b8', '600', 'center');
        return;
    }
    const vals = weights.map((v) => Number(v.weight));
    if (data.goalLb !== null)
        vals.push(data.goalLb);
    let min = Math.min(...vals), max = Math.max(...vals);
    const pad = Math.max(2, (max - min) * .18);
    min -= pad;
    max += pad;
    if (max - min < 1) {
        min -= 1;
        max += 1;
    }
    ctx.strokeStyle = '#dbe7f4';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
        const yy = y + (h * i / 4);
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + w, yy);
        ctx.stroke();
    }
    const px = (i) => weights.length === 1 ? x + w / 2 : x + (w * i / (weights.length - 1));
    const py = (v) => y + h - ((v - min) / (max - min)) * h;
    if (data.goalLb !== null) {
        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 9]);
        ctx.beginPath();
        ctx.moveTo(x, py(data.goalLb));
        ctx.lineTo(x + w, py(data.goalLb));
        ctx.stroke();
        ctx.restore();
    }
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    weights.forEach((v, i) => { const xx = px(i), yy = py(Number(v.weight)); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); });
    ctx.stroke();
    weights.forEach((v, i) => { ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(px(i), py(Number(v.weight)), 7, 0, Math.PI * 2); ctx.fill(); });
    const n = weights.length;
    const indices = n <= 6 ? [...Array(n).keys()] : [0, Math.floor((n - 1) * .25), Math.floor((n - 1) * .5), Math.floor((n - 1) * .75), n - 1];
    indices.forEach((i) => { const d = new Date(weights[i].date + 'T12:00:00'); const lab = d.toLocaleDateString(data.en ? 'en-US' : 'es-US', { month: 'short', year: n > 12 ? '2-digit' : undefined }); canvasText(ctx, lab, px(i), y + h + 28, 17, '#64748b', '500', 'center'); });
}
function drawEnergyDonut(ctx, data, cx, cy, r) {
    const bmr = Number(data.metrics.bmr), tdee = Number(data.metrics.tdee);
    if (!Number.isFinite(bmr) || !Number.isFinite(tdee) || tdee <= 0) {
        canvasText(ctx, '--', cx, cy + 10, 42, '#94a3b8', '800', 'center');
        return null;
    }
    const p = Math.max(0, Math.min(1, bmr / tdee));
    ctx.lineWidth = 34;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2 + Math.PI * 2 * p, -Math.PI / 2 + Math.PI * 2);
    ctx.stroke();
    canvasText(ctx, Math.round(tdee).toLocaleString(), cx, cy + 6, 34, '#12345b', '800', 'center');
    canvasText(ctx, 'kcal/day', cx, cy + 34, 17, '#64748b', '600', 'center');
    return { bmrPct: Math.round(p * 100), otherPct: 100 - Math.round(p * 100) };
}
function infographicIcon(ctx, type, cx, cy, size, color = '#1d4ed8') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, size * .08);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = size;
    if (type === 'person') {
        ctx.beginPath();
        ctx.arc(0, -s * .25, s * .16, 0, Math.PI * 2);
        ctx.fill();
        roundedCanvasRect(ctx, -s * .18, -s * .02, s * .36, s * .45, s * .12, color);
        ctx.beginPath();
        ctx.moveTo(-s * .12, s * .22);
        ctx.lineTo(-s * .22, s * .48);
        ctx.moveTo(s * .12, s * .22);
        ctx.lineTo(s * .22, s * .48);
        ctx.stroke();
    }
    else if (type === 'scale') {
        ctx.beginPath();
        ctx.roundRect(-s * .36, -s * .28, s * .72, s * .56, s * .12);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -s * .05, s * .16, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -s * .05);
        ctx.lineTo(s * .08, -s * .14);
        ctx.stroke();
    }
    else if (type === 'target') {
        [0.34, 0.22, 0.1].forEach((r) => { ctx.beginPath(); ctx.arc(0, 0, s * r, 0, Math.PI * 2); ctx.stroke(); });
        ctx.beginPath();
        ctx.moveTo(s * .05, -s * .05);
        ctx.lineTo(s * .42, -s * .42);
        ctx.moveTo(s * .42, -s * .42);
        ctx.lineTo(s * .30, -s * .40);
        ctx.moveTo(s * .42, -s * .42);
        ctx.lineTo(s * .40, -s * .30);
        ctx.stroke();
    }
    else if (type === 'ruler') {
        ctx.save();
        ctx.rotate(-Math.PI / 4);
        ctx.strokeRect(-s * .34, -s * .10, s * .68, s * .20);
        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(i * s * .085, -s * .10);
            ctx.lineTo(i * s * .085, -s * (i % 2 === 0 ? .02 : .05));
            ctx.stroke();
        }
        ctx.restore();
    }
    else if (type === 'calendar') {
        ctx.strokeRect(-s * .30, -s * .24, s * .60, s * .50);
        ctx.beginPath();
        ctx.moveTo(-s * .30, -s * .08);
        ctx.lineTo(s * .30, -s * .08);
        ctx.moveTo(-s * .17, -s * .34);
        ctx.lineTo(-s * .17, -s * .19);
        ctx.moveTo(s * .17, -s * .34);
        ctx.lineTo(s * .17, -s * .19);
        ctx.stroke();
    }
    else if (type === 'flame') {
        ctx.beginPath();
        ctx.moveTo(0, -s * .44);
        ctx.bezierCurveTo(s * .36, -s * .10, s * .26, s * .28, 0, s * .42);
        ctx.bezierCurveTo(-s * .28, s * .18, -s * .32, -s * .10, 0, -s * .44);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(0, -s * .10);
        ctx.bezierCurveTo(s * .13, s * .05, s * .10, s * .22, 0, s * .28);
        ctx.bezierCurveTo(-s * .11, s * .17, -s * .12, s * .04, 0, -s * .10);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    else if (type === 'runner') {
        ctx.beginPath();
        ctx.arc(s * .05, -s * .30, s * .09, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -s * .18);
        ctx.lineTo(-s * .08, s * .04);
        ctx.lineTo(s * .16, s * .18);
        ctx.moveTo(-s * .04, -s * .08);
        ctx.lineTo(-s * .28, s * .02);
        ctx.moveTo(-s * .02, s * .03);
        ctx.lineTo(-s * .24, s * .30);
        ctx.moveTo(s * .12, s * .16);
        ctx.lineTo(s * .31, s * .34);
        ctx.stroke();
    }
    else if (type === 'drop') {
        ctx.beginPath();
        ctx.moveTo(0, -s * .42);
        ctx.bezierCurveTo(s * .28, -s * .05, s * .32, s * .18, 0, s * .42);
        ctx.bezierCurveTo(-s * .32, s * .18, -s * .28, -s * .05, 0, -s * .42);
        ctx.fill();
    }
    else if (type === 'body') {
        ctx.beginPath();
        ctx.arc(0, -s * .34, s * .09, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -s * .23);
        ctx.bezierCurveTo(-s * .18, -s * .15, -s * .16, s * .05, -s * .11, s * .12);
        ctx.lineTo(-s * .18, s * .40);
        ctx.moveTo(0, -s * .23);
        ctx.bezierCurveTo(s * .18, -s * .15, s * .16, s * .05, s * .11, s * .12);
        ctx.lineTo(s * .18, s * .40);
        ctx.moveTo(-s * .12, -s * .10);
        ctx.lineTo(-s * .30, s * .12);
        ctx.moveTo(s * .12, -s * .10);
        ctx.lineTo(s * .30, s * .12);
        ctx.stroke();
    }
    else if (type === 'muscle') {
        ctx.beginPath();
        ctx.moveTo(-s * .30, s * .18);
        ctx.bezierCurveTo(-s * .10, -s * .10, -s * .18, -s * .34, s * .05, -s * .26);
        ctx.bezierCurveTo(s * .02, -s * .05, s * .22, -s * .13, s * .31, s * .05);
        ctx.bezierCurveTo(s * .38, s * .26, s * .10, s * .38, -s * .12, s * .33);
        ctx.closePath();
        ctx.stroke();
    }
    else if (type === 'dots') {
        [[-.22, -.18], [0, -.24], [.22, -.12], [-.15, .04], [.10, .02], [.28, .15], [-.25, .23], [0, .25]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * s, y * s, s * .055, 0, Math.PI * 2); ctx.fill(); });
    }
    else if (type === 'tape') {
        ctx.beginPath();
        ctx.ellipse(0, 0, s * .34, s * .22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, s * .20, s * .10, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(i * s * .10, -s * .18);
            ctx.lineTo(i * s * .10, -s * .08);
            ctx.stroke();
        }
    }
    else if (type === 'info') {
        ctx.beginPath();
        ctx.arc(0, 0, s * .35, 0, Math.PI * 2);
        ctx.stroke();
        canvasText(ctx, 'i', 0, s * .16, s * .48, color, '800', 'center', 'Arial');
    }
    ctx.restore();
}
function infographicSoftPanel(ctx, x, y, w, h, title, iconType = null, accent = '#1d4ed8') {
    ctx.save();
    ctx.shadowColor = 'rgba(15,52,91,0.08)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    roundedCanvasRect(ctx, x, y, w, h, 22, '#ffffff', '#d9e5f2', 2);
    ctx.restore();
    roundedCanvasRect(ctx, x + 2, y + 2, w - 4, 58, 20, '#f3f8fd');
    ctx.fillStyle = accent;
    ctx.fillRect(x + 2, y + 2, 7, 58);
    if (iconType) {
        infographicIcon(ctx, iconType, x + 34, y + 31, 32, accent);
        canvasText(ctx, title, x + 61, y + 40, 27, '#12345b', '800');
    }
    else
        canvasText(ctx, title, x + 25, y + 40, 27, '#12345b', '800');
}
function infographicInfoLine(ctx, iconType, label, value, x, y, color = '#12345b', sub = '') {
    infographicIcon(ctx, iconType, x + 22, y + 18, 35, '#244f78');
    canvasText(ctx, label, x + 55, y + 10, 16, '#64748b', '700');
    canvasText(ctx, value, x + 55, y + 39, 24, color, '800');
    if (sub)
        canvasText(ctx, sub, x + 55, y + 61, 15, '#64748b', '500');
}
function infographicCompositionCard(ctx, x, y, w, h, iconType, label, value, color = '#2563eb', sub = '') {
    roundedCanvasRect(ctx, x, y, w, h, 18, '#f9fbfe', '#dce8f4', 2);
    infographicIcon(ctx, iconType, x + 48, y + h / 2, 58, color);
    canvasText(ctx, label, x + 88, y + 34, 17, '#334155', '700');
    canvasText(ctx, value, x + 88, y + 72, 29, '#12345b', '800');
    if (sub) {
        roundedCanvasRect(ctx, x + 88, y + h - 34, 132, 24, 12, '#eaf8ef');
        canvasText(ctx, sub, x + 154, y + h - 17, 14, '#15803d', '700', 'center');
    }
}
function drawEditorialWeightChart(ctx, data, x, y, w, h) {
    const weights = data.weights;
    if (!weights.length) {
        canvasText(ctx, data.en ? 'No weight history yet' : 'Aún no hay historial de peso', x + w / 2, y + h / 2, 22, '#94a3b8', '600', 'center');
        return;
    }
    const vals = weights.map((v) => Number(v.weight));
    if (data.goalLb !== null)
        vals.push(data.goalLb);
    let min = Math.min(...vals), max = Math.max(...vals);
    const raw = max - min;
    const pad = Math.max(4, raw * .25);
    min = Math.floor((min - pad) / 5) * 5;
    max = Math.ceil((max + pad) / 5) * 5;
    if (max - min < 10)
        max = min + 10;
    const px = (i) => weights.length === 1 ? x + w * .14 : x + (w * i / (weights.length - 1));
    const py = (v) => y + h - ((v - min) / (max - min)) * h;
    ctx.strokeStyle = '#e4edf6';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#64748b';
    ctx.font = '600 15px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const yy = y + h * i / 4;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + w, yy);
        ctx.stroke();
        const val = max - (max - min) * i / 4;
        ctx.fillText(`${Math.round(displayWeight(val))}`, x - 12, yy + 5);
    }
    if (data.goalLb !== null) {
        ctx.save();
        ctx.setLineDash([10, 8]);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, py(data.goalLb));
        ctx.lineTo(x + w, py(data.goalLb));
        ctx.stroke();
        ctx.restore();
    }
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(37,99,235,.18)');
    grad.addColorStop(1, 'rgba(37,99,235,0)');
    ctx.beginPath();
    weights.forEach((v, i) => { const xx = px(i), yy = py(Number(v.weight)); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); });
    ctx.lineTo(px(weights.length - 1), y + h);
    ctx.lineTo(px(0), y + h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    weights.forEach((v, i) => { const xx = px(i), yy = py(Number(v.weight)); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); });
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    weights.forEach((v, i) => { ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(px(i), py(Number(v.weight)), 6, 0, Math.PI * 2); ctx.fill(); });
    const n = weights.length, indices = n <= 7 ? [...Array(n).keys()] : [0, Math.floor((n - 1) * .2), Math.floor((n - 1) * .4), Math.floor((n - 1) * .6), Math.floor((n - 1) * .8), n - 1];
    ctx.textAlign = 'center';
    indices.forEach((i) => { const dt = new Date(weights[i].date + 'T12:00:00'); canvasText(ctx, dt.toLocaleDateString(data.en ? 'en-US' : 'es-US', { month: 'short' }), px(i), y + h + 26, 14, '#64748b', '600', 'center'); });
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x + 20, y + h + 54, 6, 0, Math.PI * 2);
    ctx.fill();
    canvasText(ctx, data.en ? 'Weight' : 'Peso', x + 34, y + h + 59, 15, '#475569', '600');
    if (data.goalLb !== null) {
        ctx.save();
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 130, y + h + 54);
        ctx.lineTo(x + 175, y + h + 54);
        ctx.stroke();
        ctx.restore();
        canvasText(ctx, data.en ? 'Goal' : 'Meta', x + 186, y + h + 59, 15, '#475569', '600');
    }
}
function drawEditorialEnergyDonut(ctx, data, cx, cy, r) {
    const bmr = Number(data.metrics.bmr), tdee = Number(data.metrics.tdee);
    if (!Number.isFinite(bmr) || !Number.isFinite(tdee) || tdee <= 0) {
        canvasText(ctx, '--', cx, cy + 10, 38, '#94a3b8', '800', 'center');
        return null;
    }
    const bp = Math.max(0, Math.min(1, bmr / tdee)), other = 1 - bp;
    ctx.lineWidth = 38;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bp);
    ctx.stroke();
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2 + Math.PI * 2 * bp, -Math.PI / 2 + Math.PI * 2);
    ctx.stroke();
    canvasText(ctx, Math.round(tdee).toLocaleString(), cx, cy + 3, 32, '#12345b', '800', 'center');
    canvasText(ctx, 'kcal/day', cx, cy + 31, 15, '#64748b', '600', 'center');
    return { bmrPct: Math.round(bp * 100), otherPct: Math.round(other * 100), bmr: Math.round(bmr), other: Math.max(0, Math.round(tdee - bmr)) };
}
function renderBodyMetricsInfographicCanvas() {
    const canvas = document.getElementById('body-infographic-canvas');
    if (!canvas)
        return null;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    const d = getBodyMetricsInfographicData(), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    // Header inspired by the approved editorial concept.
    ctx.fillStyle = '#f7fbff';
    ctx.fillRect(0, 0, W, 175);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, 10, 175);
    // Brand mark: person + leaf, intentionally distinct from the app icon while matching the approved report style.
    ctx.save();
    ctx.translate(92, 78);
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(0, -28, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 38);
    ctx.moveTo(0, 3);
    ctx.lineTo(-34, -12);
    ctx.moveTo(0, 3);
    ctx.lineTo(34, -12);
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(-33, 42);
    ctx.bezierCurveTo(-62, 12, -54, -21, -17, -40);
    ctx.bezierCurveTo(-23, -6, -10, 18, 0, 39);
    ctx.bezierCurveTo(-9, 54, -21, 60, -33, 42);
    ctx.fill();
    ctx.restore();
    canvasText(ctx, 'GLP-1', 150, 67, 42, '#12345b', '900');
    canvasText(ctx, 'COMPANION', 150, 104, 22, '#1d4ed8', '800');
    canvasText(ctx, d.en ? 'TRACK TODAY. A HEALTHIER TOMORROW.' : 'REGISTRA HOY. UN MAÑANA MÁS SALUDABLE.', 150, 132, 12, '#42698e', '700');
    canvasText(ctx, d.en ? 'BODY METRICS SUMMARY' : 'RESUMEN DE MÉTRICAS CORPORALES', W / 2, 58, 52, '#12345b', '900', 'center');
    canvasText(ctx, d.en ? 'Your Health Journey at a Glance' : 'Tu progreso de salud de un vistazo', W / 2, 96, 27, '#1d4ed8', '600', 'center');
    canvasText(ctx, d.en ? '“Small steps. Big results.”' : '“Pequeños pasos. Grandes resultados.”', W / 2, 137, 27, '#315c87', '400', 'center', 'Georgia');
    roundedCanvasRect(ctx, W - 410, 24, 360, 122, 18, '#eef6fd', '#d7e6f4', 2);
    canvasText(ctx, d.en ? 'Report Date' : 'Fecha del reporte', W - 382, 55, 18, '#475569', '700');
    canvasText(ctx, d.generatedAt.toLocaleDateString(d.en ? 'en-US' : 'es-US', { month: 'short', day: 'numeric', year: 'numeric' }), W - 382, 84, 25, '#12345b', '800');
    const lastDate = d.weights.length ? d.weights[d.weights.length - 1].date : null;
    if (lastDate) {
        canvasText(ctx, d.en ? 'Data through' : 'Datos hasta', W - 382, 111, 16, '#64748b', '600');
        canvasText(ctx, new Date(lastDate + 'T12:00:00').toLocaleDateString(d.en ? 'en-US' : 'es-US', { month: 'short', day: 'numeric', year: 'numeric' }), W - 270, 111, 16, '#12345b', '700');
    }
    canvasText(ctx, APP_VERSION, W - 382, 136, 14, '#1d4ed8', '700');
    const topY = 195, gap = 18;
    let x = 24;
    const p1 = 600, p2 = 500, p3 = 380, p4 = 654;
    infographicSoftPanel(ctx, x, topY, p1, 365, d.en ? 'PERSONAL INFORMATION' : 'INFORMACIÓN PERSONAL', null, '#1d4ed8');
    infographicInfoLine(ctx, 'person', d.en ? 'Name' : 'Nombre', d.userName, x + 18, topY + 92);
    infographicInfoLine(ctx, 'calendar', d.en ? 'Age' : 'Edad', d.age === null ? '--' : `${d.age} ${d.en ? 'years' : 'años'}`, x + 18, topY + 190);
    infographicInfoLine(ctx, 'ruler', d.en ? 'Height' : 'Altura', d.h.heightIn ? `${(d.h.heightIn * 2.54 / 100).toFixed(2)} m · ${d.h.heightIn.toFixed(1)} in` : '--', x + 18, topY + 286);
    infographicInfoLine(ctx, 'scale', d.en ? 'Current Weight' : 'Peso actual', d.currentLb !== null ? `${(d.currentLb * LB_TO_KG).toFixed(1)} kg · ${d.currentLb.toFixed(1)} lb` : '--', x + 310, topY + 92);
    infographicInfoLine(ctx, 'target', d.en ? 'Goal Weight' : 'Peso meta', d.goalLb !== null ? `${(d.goalLb * LB_TO_KG).toFixed(1)} kg · ${d.goalLb.toFixed(1)} lb` : '--', x + 310, topY + 190);
    infographicInfoLine(ctx, 'person', d.en ? 'Sex' : 'Sexo', d.sexLabel, x + 310, topY + 286);
    x += p1 + gap;
    infographicSoftPanel(ctx, x, topY, p2, 365, d.en ? 'WHAT IS BMI?' : '¿QUÉ ES EL IMC?', null, '#1d4ed8');
    canvasWrap(ctx, d.en ? 'BMI (Body Mass Index) is a screening tool that relates your weight to your height. It can help identify weight ranges, but it does not directly measure body fat or distinguish muscle from fat.' : 'El IMC (Índice de Masa Corporal) es una herramienta de orientación que relaciona tu peso con tu estatura. Ayuda a identificar rangos de peso, pero no mide directamente la grasa corporal ni distingue músculo de grasa.', x + 26, topY + 98, p2 - 52, 29, 20, '#334155', '400', 6);
    roundedCanvasRect(ctx, x + 26, topY + 255, p2 - 52, 84, 16, '#eef5fb', '#d6e4f2', 2);
    canvasText(ctx, 'BMI =', x + 62, topY + 308, 30, '#12345b', '800');
    canvasText(ctx, d.en ? 'Weight (kg)' : 'Peso (kg)', x + 200, topY + 287, 20, '#1d4ed8', '700', 'center');
    ctx.strokeStyle = '#12345b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 130, topY + 300);
    ctx.lineTo(x + 355, topY + 300);
    ctx.stroke();
    canvasText(ctx, d.en ? 'Height (m)²' : 'Estatura (m)²', x + 200, topY + 326, 20, '#12345b', '700', 'center');
    x += p2 + gap;
    infographicSoftPanel(ctx, x, topY, p3, 365, d.en ? 'YOUR BMI RESULT' : 'TU RESULTADO IMC', null, d.classification.color);
    canvasText(ctx, d.metrics.bmi !== null ? d.metrics.bmi.toFixed(1) : '--', x + p3 / 2, topY + 188, 84, d.classification.color, '900', 'center');
    roundedCanvasRect(ctx, x + 45, topY + 225, p3 - 90, 92, 18, d.classification.key === 'normal' ? '#dcfce7' : d.classification.key === 'over' ? '#fff7d6' : '#fff0e8');
    canvasText(ctx, d.classification.label, x + p3 / 2, topY + 268, 28, d.classification.color, '800', 'center');
    canvasWrap(ctx, d.en ? (d.classification.key === 'normal' ? 'Your BMI falls in the healthy screening range.' : 'This is your current BMI screening category.') : (d.classification.key === 'normal' ? 'Tu IMC cae en el rango saludable de orientación.' : 'Esta es tu categoría actual de orientación por IMC.'), x + 64, topY + 295, p3 - 128, 24, 16, '#475569', '500', 2);
    x += p3 + gap;
    infographicSoftPanel(ctx, x, topY, p4, 365, d.en ? 'BMI CLASSIFICATION' : 'CLASIFICACIÓN DEL IMC', null, '#1d4ed8');
    const rows = d.en ? [['Underweight', '< 18.5', 'Below range'], ['Healthy range', '18.5–24.9', 'Healthy'], ['Overweight', '25.0–29.9', 'Above range'], ['Obesity class I', '30.0–34.9', 'Elevated'], ['Obesity class II', '35.0–39.9', 'High'], ['Obesity class III', '≥ 40.0', 'Very high']] : [['Bajo peso', '< 18.5', 'Bajo rango'], ['Rango saludable', '18.5–24.9', 'Saludable'], ['Sobrepeso', '25.0–29.9', 'Sobre rango'], ['Obesidad grado I', '30.0–34.9', 'Elevado'], ['Obesidad grado II', '35.0–39.9', 'Alto'], ['Obesidad grado III', '≥ 40.0', 'Muy alto']];
    const keys = ['under', 'normal', 'over', 'ob1', 'ob2', 'ob3'], fills = ['#e8f2ff', '#e4f8ea', '#fff6cf', '#ffead8', '#ffe0d9', '#ffd8dc'];
    const ry = topY + 86;
    ctx.fillStyle = '#376b98';
    ctx.fillRect(x + 14, ry - 25, p4 - 28, 31);
    canvasText(ctx, d.en ? 'Category' : 'Categoría', x + 28, ry - 4, 16, '#ffffff', '700');
    canvasText(ctx, d.en ? 'BMI Range' : 'Rango IMC', x + 400, ry - 4, 16, '#ffffff', '700', 'center');
    canvasText(ctx, d.en ? 'Screening' : 'Orientación', x + 575, ry - 4, 16, '#ffffff', '700', 'center');
    rows.forEach((r, i) => { const yy = ry + 10 + i * 40; roundedCanvasRect(ctx, x + 14, yy, p4 - 28, 35, 4, fills[i], d.classification.key === keys[i] ? d.classification.color : '#e6edf5', d.classification.key === keys[i] ? 3 : 1); canvasText(ctx, r[0], x + 28, yy + 24, 16, d.classification.key === keys[i] ? '#12345b' : '#334155', d.classification.key === keys[i] ? '800' : '600'); canvasText(ctx, r[1], x + 400, yy + 24, 16, '#334155', d.classification.key === keys[i] ? '800' : '600', 'center'); canvasText(ctx, r[2], x + 575, yy + 24, 15, '#334155', '600', 'center'); });
    const midY = 585;
    infographicSoftPanel(ctx, 24, midY, 770, 500, d.en ? 'WEIGHT PROGRESS' : 'PROGRESO DE PESO', null, '#1d4ed8');
    drawEditorialWeightChart(ctx, d, 92, midY + 105, 560, 265);
    const lost = (d.startLb !== null && d.currentLb !== null) ? d.startLb - d.currentLb : null;
    roundedCanvasRect(ctx, 625, midY + 82, 135, 105, 18, '#dff7e7', '#c8edd5', 1);
    canvasText(ctx, lost === null ? '--' : `${Math.abs(displayWeight(lost)).toFixed(1)} ${weightUnit()}`, 692, midY + 124, 28, '#166534', '800', 'center');
    canvasText(ctx, lost !== null && lost >= 0 ? (d.en ? 'Lost' : 'Perdidos') : (d.en ? 'Change' : 'Cambio'), 692, midY + 152, 16, '#166534', '700', 'center');
    infographicSoftPanel(ctx, 814, midY, 650, 500, d.en ? 'KEY METRICS' : 'MÉTRICAS CLAVE', null, '#1d4ed8');
    const kx = 844, ky = midY + 100;
    infographicIcon(ctx, 'flame', kx + 30, ky + 18, 48, '#f97316');
    canvasText(ctx, d.en ? 'BMR (Basal Metabolic Rate)' : 'TMB / BMR (Metabolismo basal)', kx + 74, ky + 4, 17, '#334155', '700');
    canvasText(ctx, d.metrics.bmr !== null ? `${Math.round(d.metrics.bmr).toLocaleString()} kcal/day` : '--', kx + 74, ky + 38, 29, '#12345b', '800');
    canvasText(ctx, d.en ? 'Estimated calories your body uses at rest.' : 'Calorías estimadas que tu cuerpo usa en reposo.', kx + 74, ky + 63, 16, '#64748b', '500');
    ctx.strokeStyle = '#e1eaf3';
    ctx.beginPath();
    ctx.moveTo(kx, ky + 90);
    ctx.lineTo(kx + 580, ky + 90);
    ctx.stroke();
    infographicIcon(ctx, 'runner', kx + 30, ky + 138, 48, '#244f78');
    canvasText(ctx, 'TDEE', kx + 74, ky + 122, 17, '#334155', '700');
    canvasText(ctx, d.metrics.tdee !== null ? `${Math.round(d.metrics.tdee).toLocaleString()} kcal/day` : '--', kx + 74, ky + 156, 29, '#12345b', '800');
    canvasText(ctx, d.en ? 'Estimated daily maintenance energy.' : 'Energía diaria estimada de mantenimiento.', kx + 74, ky + 181, 16, '#64748b', '500');
    ctx.beginPath();
    ctx.moveTo(kx, ky + 208);
    ctx.lineTo(kx + 580, ky + 208);
    ctx.stroke();
    infographicIcon(ctx, 'drop', kx + 30, ky + 258, 48, '#0ea5e9');
    canvasText(ctx, d.en ? 'Hydration Goal' : 'Meta de hidratación', kx + 74, ky + 242, 17, '#334155', '700');
    canvasText(ctx, d.metrics.hydrationOz !== null ? `${Math.round(displayWater(d.metrics.hydrationOz))} ${waterUnit()}/day` : '--', kx + 74, ky + 276, 29, '#12345b', '800');
    canvasText(ctx, d.en ? 'Suggested daily water intake.' : 'Ingesta diaria sugerida de agua.', kx + 74, ky + 301, 16, '#64748b', '500');
    infographicSoftPanel(ctx, 1484, midY, 692, 500, d.en ? 'BODY COMPOSITION (Estimated)' : 'COMPOSICIÓN CORPORAL (Estimada)', null, '#1d4ed8');
    infographicCompositionCard(ctx, 1510, midY + 88, 315, 145, 'body', d.en ? 'Body Fat %' : 'Grasa corporal %', d.metrics.bodyFat !== null ? `${d.metrics.bodyFat.toFixed(1)}%` : '--', '#2563eb', d.metrics.bodyFat !== null ? (d.en ? 'Estimated' : 'Estimado') : '');
    infographicCompositionCard(ctx, 1838, midY + 88, 315, 145, 'muscle', d.en ? 'Lean Mass' : 'Masa magra', d.metrics.leanMassLb !== null ? formatWeight(d.metrics.leanMassLb, 1) : '--', '#244f78', '');
    infographicCompositionCard(ctx, 1510, midY + 250, 315, 145, 'dots', d.en ? 'Fat Mass' : 'Masa grasa', d.metrics.fatMassLb !== null ? formatWeight(d.metrics.fatMassLb, 1) : '--', '#1d4ed8', '');
    infographicCompositionCard(ctx, 1838, midY + 250, 315, 145, 'tape', d.en ? 'Waist-to-Height' : 'Cintura/altura', d.metrics.whtr !== null ? d.metrics.whtr.toFixed(2) : '--', '#244f78', d.metrics.whtr !== null && d.metrics.whtr < .5 ? (d.en ? 'Below 0.50' : 'Menor de 0.50') : '');
    const botY = 1110;
    infographicSoftPanel(ctx, 24, botY, 740, 480, d.en ? 'PROGRESS TOWARD GOAL' : 'PROGRESO HACIA LA META', null, '#1d4ed8');
    infographicIcon(ctx, 'target', 70, botY + 105, 58, '#244f78');
    const prog = d.progress === null ? 0 : d.progress;
    roundedCanvasRect(ctx, 120, botY + 84, 530, 38, 19, '#dfe7ef');
    roundedCanvasRect(ctx, 120, botY + 84, 530 * prog, 38, 19, '#22c55e');
    canvasText(ctx, d.progress === null ? '--' : `${Math.round(prog * 100)}%`, 680, botY + 114, 30, '#12345b', '800', 'right');
    const cdata = [['Start', 'Inicio', d.startLb], ['Current', 'Actual', d.currentLb], ['Goal', 'Meta', d.goalLb]];
    cdata.forEach((c, i) => { const cx = 145 + i * 230; canvasText(ctx, d.en ? c[0] : c[1], cx, botY + 215, 16, '#64748b', '700', 'center'); canvasText(ctx, c[2] !== null ? formatWeight(c[2], 1) : '--', cx, botY + 255, 27, '#12345b', '800', 'center'); });
    canvasWrap(ctx, d.en ? 'Progress is calculated from your first logged weight toward your configured goal.' : 'El progreso se calcula desde tu primer peso registrado hacia la meta configurada.', 86, botY + 340, 600, 26, 17, '#64748b', '400', 3);
    infographicSoftPanel(ctx, 784, botY, 680, 480, d.en ? 'HOW YOUR DAILY CALORIES ARE USED' : 'CÓMO SE USA TU ENERGÍA DIARIA', null, '#1d4ed8');
    const energy = drawEditorialEnergyDonut(ctx, d, 980, botY + 280, 105);
    if (energy) {
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(1135, botY + 150, 8, 0, Math.PI * 2);
        ctx.fill();
        canvasText(ctx, `${energy.bmrPct}% BMR`, 1155, botY + 157, 19, '#12345b', '700');
        canvasText(ctx, `${energy.bmr.toLocaleString()} kcal`, 1308, botY + 157, 17, '#475569', '600');
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(1135, botY + 202, 8, 0, Math.PI * 2);
        ctx.fill();
        canvasText(ctx, `${energy.otherPct}% ${d.en ? 'Activity + other' : 'Actividad + otros'}`, 1155, botY + 209, 19, '#12345b', '700');
        canvasText(ctx, `${energy.other.toLocaleString()} kcal`, 1340, botY + 235, 17, '#475569', '600', 'right');
    }
    canvasWrap(ctx, d.en ? 'BMR is the estimated resting component. The remainder reflects activity and other daily energy needs; this is not a measured calorie burn.' : 'La TMB es el componente estimado en reposo. El resto refleja actividad y otras necesidades diarias; no es una medición directa de calorías quemadas.', 1130, botY + 300, 285, 26, 16, '#64748b', '400', 6);
    infographicSoftPanel(ctx, 1484, botY, 692, 480, d.en ? 'IMPORTANT NOTES' : 'NOTAS IMPORTANTES', 'info', '#1d4ed8');
    const notes = d.en ? ['BMI is a screening tool and does not distinguish muscle from fat.', 'Body composition is estimated from your recorded measurements.', 'BMR, TDEE and hydration are formula-based estimates.', 'This report is informational and does not replace professional medical guidance.'] : ['El IMC es una herramienta de orientación y no distingue músculo de grasa.', 'La composición corporal se estima con tus medidas registradas.', 'TMB, TDEE e hidratación son estimaciones basadas en fórmulas.', 'Este reporte es informativo y no reemplaza orientación médica profesional.'];
    let ny = botY + 110;
    notes.forEach((n) => { ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(1520, ny - 6, 5, 0, Math.PI * 2); ctx.fill(); ny += canvasWrap(ctx, n, 1540, ny, 585, 25, 16, '#334155', '400', 3) + 14; });
    canvasText(ctx, d.en ? 'Health today. A brighter tomorrow.' : 'Salud hoy. Un mañana más brillante.', 1830, botY + 418, 23, '#315c87', '400', 'center', 'Georgia');
    // Footer + authorship credit.
    ctx.strokeStyle = '#dce8f3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, H - 72);
    ctx.lineTo(W - 24, H - 72);
    ctx.stroke();
    canvasText(ctx, 'GLP-1 Companion', 34, H - 38, 17, '#12345b', '800');
    canvasText(ctx, `Designed & Developed by ${DEVELOPER_NAME} · ${DEVELOPER_EMAIL}`, W / 2, H - 38, 15, '#64748b', '600', 'center');
    canvasText(ctx, APP_VERSION, W - 34, H - 38, 15, '#64748b', '700', 'right');
    return d;
}
function openBodyMetricsInfographic() {
    renderBodyMetricsInfographicCanvas();
    const modal = document.getElementById('modal-body-infographic');
    if (!modal)
        return;
    const title = document.getElementById('body-infographic-modal-title');
    if (title)
        title.textContent = uiText('Resumen visual de métricas corporales', 'Body Metrics Visual Summary');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
}
function closeBodyMetricsInfographic() {
    const modal = document.getElementById('modal-body-infographic');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.classList.remove('body-infographic-print-mode');
}
function dataUrlToBytes(dataUrl) {
    const base64 = String(dataUrl).split(',')[1] || '';
    const bin = atob(base64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
function buildJpegImagePdfBytes(jpegBytes, imgW, imgH) {
    const pageW = 792, pageH = 612, objects = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>';
    objects[4] = { dict: `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`, bytes: jpegBytes };
    const content = 'q\n792 0 0 612 0 0 cm\n/Im0 Do\nQ\n';
    objects[5] = { dict: `<< /Length ${cp1252Bytes(content).length} >>`, bytes: cp1252Bytes(content) };
    const parts = [], offsets = [0];
    const push = (b) => parts.push(b instanceof Uint8Array ? b : cp1252Bytes(b));
    push('%PDF-1.4\n%GLP1\n');
    let length = parts.reduce((n, b) => n + b.length, 0);
    for (let id = 1; id <= 5; id++) {
        offsets[id] = length;
        push(`${id} 0 obj\n`);
        length = parts.reduce((n, b) => n + b.length, 0);
        const o = objects[id];
        if (typeof o === 'string') {
            push(o + '\nendobj\n');
        }
        else {
            push(o.dict + '\nstream\n');
            push(o.bytes);
            push('\nendstream\nendobj\n');
        }
        length = parts.reduce((n, b) => n + b.length, 0);
    }
    const xrefOffset = length;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let id = 1; id <= 5; id++)
        xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
    xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    push(xref);
    const total = parts.reduce((n, b) => n + b.length, 0), out = new Uint8Array(total);
    let pos = 0;
    parts.forEach((b) => { out.set(b, pos); pos += b.length; });
    return out;
}
async function shareBodyMetricsInfographicPdf() {
    const canvas = document.getElementById('body-infographic-canvas');
    if (!canvas)
        return false;
    renderBodyMetricsInfographicCanvas();
    const jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.94));
    const pdf = buildJpegImagePdfBytes(jpeg, canvas.width, canvas.height);
    const blob = new Blob([pdf], { type: 'application/pdf' }), stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16), filename = `GLP1_Body_Metrics_${stamp}.pdf`;
    let file = null;
    try {
        file = new File([blob], filename, { type: 'application/pdf', lastModified: Date.now() });
    }
    catch (_) { }
    if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
            await navigator.share({ files: [file] });
            return true;
        }
        catch (err) {
            if (runtimeErrorName(err) === 'AbortError')
                return true;
            console.warn('Infographic share failed', err);
        }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    showToast(uiText('PDF creado. Ábrelo desde Archivos/Descargas.', 'PDF created. Open it from Files/Downloads.'));
    return true;
}
function printBodyMetricsInfographic() {
    const canvas = document.getElementById('body-infographic-canvas');
    if (!canvas)
        return;
    renderBodyMetricsInfographicCanvas();
    if (isIOSLikeDevice()) {
        shareBodyMetricsInfographicPdf();
        return;
    }
    const img = document.getElementById('body-infographic-print-img');
    if (img)
        img.src = canvas.toDataURL('image/png');
    document.body.classList.add('body-infographic-print-mode');
    if (typeof window.print === 'function') {
        window.print();
        setTimeout(() => document.body.classList.remove('body-infographic-print-mode'), 1000);
    }
    else {
        document.body.classList.remove('body-infographic-print-mode');
        shareBodyMetricsInfographicPdf();
    }
}
function renderToolsView() {
    renderMaintenanceMode();
    renderHealthProfile();
    renderSmartBodyMetrics();
    state.weights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const goalW = Number(state.settings.goalWeight || 180);
    document.getElementById('proj-goal-badge').innerText = `${uiText('Meta', 'Goal')}: ${formatWeight(goalW, 1)}`;
    if (state.weights.length > 0) {
        const startW = state.weights[0].weight;
        const curW = state.weights[state.weights.length - 1].weight;
        const totalLost = (startW - curW).toFixed(1);
        document.getElementById('prog-start-w').innerText = displayWeight(startW).toFixed(1);
        document.getElementById('prog-cur-w').innerText = displayWeight(curW).toFixed(1);
        document.getElementById('prog-lost-w').innerText = `${Number(totalLost) > 0 ? '-' : ''}${Math.abs(displayWeight(Number(totalLost))).toFixed(1)}`;
        document.getElementById('apple-health-weight-val').innerText = formatWeight(curW, 1);
        const remainingToGoal = curW - goalW;
        if (remainingToGoal <= 0) {
            document.getElementById('proj-summary-text').innerText = isEnglish() ? `Goal reached or exceeded! (${formatWeight(curW, 1)} vs ${formatWeight(goalW, 1)} goal)` : `¡Meta alcanzada o superada! (${formatWeight(curW, 1)} vs meta de ${formatWeight(goalW, 1)})`;
            document.getElementById('proj-subtext').innerText = uiText("Fase de consolidación y mantenimiento clínico.", "Maintenance phase.");
        }
        else if (state.weights.length >= 2) {
            const firstDate = new Date(state.weights[0].date + "T12:00:00");
            const latestDate = new Date(state.weights[state.weights.length - 1].date + "T12:00:00");
            const totalDays = Math.max(1, (latestDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
            const totalWeeks = totalDays / 7;
            const lossRatePerWeek = (startW - curW) / Math.max(1, totalWeeks);
            if (lossRatePerWeek > 0.1) {
                const weeksRemaining = remainingToGoal / lossRatePerWeek;
                const targetEstimatedDate = new Date(latestDate);
                targetEstimatedDate.setDate(targetEstimatedDate.getDate() + Math.round(weeksRemaining * 7));
                document.getElementById('proj-summary-text').innerText = isEnglish() ? `Estimated date: ${targetEstimatedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric', day: 'numeric' })} (~${Math.ceil(weeksRemaining)} weeks)` : `Fecha estimada: ${targetEstimatedDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric', day: 'numeric' })} (~${Math.ceil(weeksRemaining)} semanas)`;
                document.getElementById('proj-subtext').innerText = isEnglish() ? `Average trend: -${formatWeight(lossRatePerWeek, 1)}/week. ${formatWeight(remainingToGoal, 1)} remaining to reach ${formatWeight(goalW, 1)}.` : `Ritmo promedio: -${formatWeight(lossRatePerWeek, 1)}/semana. Faltan ${formatWeight(remainingToGoal, 1)} para alcanzar ${formatWeight(goalW, 1)}.`;
            }
            else {
                document.getElementById('proj-summary-text').innerText = isEnglish() ? `${formatWeight(remainingToGoal, 1)} remaining to reach your ${formatWeight(goalW, 1)} goal.` : `Faltan ${formatWeight(remainingToGoal, 1)} para alcanzar tu meta de ${formatWeight(goalW, 1)}.`;
                document.getElementById('proj-subtext').innerText = uiText("Registra más pesajes para calcular una proyección de ritmo estable.", "Log more weights to calculate a stable projection.");
            }
        }
        else {
            document.getElementById('proj-summary-text').innerText = isEnglish() ? `${formatWeight(remainingToGoal, 1)} remaining to reach your ${formatWeight(goalW, 1)} goal.` : `Faltan ${formatWeight(remainingToGoal, 1)} para alcanzar tu meta de ${formatWeight(goalW, 1)}.`;
            document.getElementById('proj-subtext').innerText = uiText("Anota al menos dos pesajes para estimar fecha y velocidad semanal.", "Log at least two weights to estimate a date and weekly trend.");
        }
    }
    else {
        document.getElementById('prog-start-w').innerText = "--";
        document.getElementById('prog-cur-w').innerText = "--";
        document.getElementById('prog-lost-w').innerText = "0.0";
        document.getElementById('apple-health-weight-val').innerText = `-- ${weightUnit()}`;
        document.getElementById('proj-summary-text').innerText = uiText("Anota tu primer peso para iniciar el cálculo.", "Log your first weight to begin the calculation.");
    }
    const wList = document.getElementById('weights-history-list');
    wList.innerHTML = '';
    if (state.weights.length === 0) {
        wList.innerHTML = `<p class="text-slate-500 italic">${uiText("No hay pesajes registrados aún.", "No weights recorded yet.")}</p>`;
    }
    else {
        [...state.weights].reverse().forEach((w) => {
            const row = document.createElement('div');
            row.className = "flex justify-between items-center p-2 rounded-xl bg-[#111a2e] border border-[#223455]";
            row.innerHTML = `
            <span class="text-slate-300 font-medium">${escapeHtml(w.date)}</span>
            <div class="flex items-center space-x-3">
              <strong class="text-cyan-400 font-black">${formatWeight(Number(w.weight), 1)}</strong>
              <button data-delete-weight="${escapeHtml(w.date)}" class="text-slate-500 hover:text-rose-400 p-1 transition-colors" title="Eliminar este pesaje">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          `;
            wList.appendChild(row);
        });
    }
    const mList = document.getElementById('measurements-history-list');
    mList.innerHTML = '';
    if (state.measurements.length === 0) {
        mList.innerHTML = `<p class="text-slate-500 italic">${uiText("No hay medidas registradas aún.", "No measurements recorded yet.")}</p>`;
    }
    else {
        [...state.measurements].reverse().forEach((m) => {
            const r = document.createElement('div');
            r.className = "flex justify-between items-center p-2 rounded-xl bg-[#111a2e] border border-[#223455]";
            r.innerHTML = `
            <span class="text-slate-300 font-medium">${escapeHtml(m.date)}</span>
            <div class="text-slate-400 space-x-2 text-[11px]">
              <span>${uiText("Cint", "Waist")}: <strong class="text-white">${escapeHtml(formatLength(m.waist, 1))}</strong></span>
              <span>${uiText("Pech", "Chest")}: <strong class="text-white">${escapeHtml(formatLength(m.chest, 1))}</strong></span>
              <span>${uiText("Cad", "Hips")}: <strong class="text-white">${escapeHtml(formatLength(m.hips, 1))}</strong></span>
              <span>${uiText("Cuell", "Neck")}: <strong class="text-white">${m.neck ? escapeHtml(formatLength(m.neck, 1)) : '--'}</strong></span>
            </div>
          `;
            mList.appendChild(r);
        });
    }
    renderChartJs();
    applyStaticTranslations();
    applyUnitLabels();
    lucide.createIcons();
}
function removeWeightEntry(targetDate) {
    if (!targetDate)
        return;
    if (!state.deletedRecords)
        state.deletedRecords = { meals: {}, weights: {}, injections: {}, measurements: {}, bowelMovements: {} };
    if (!state.deletedRecords.weights)
        state.deletedRecords.weights = {};
    const removed = state.weights.find((w) => w.date === targetDate);
    if (!removed)
        return;
    const removedCopy = JSON.parse(JSON.stringify(removed));
    state.deletedRecords.weights[targetDate] = mutationNow();
    state.weights = state.weights.filter((w) => w.date !== targetDate);
    persistState({ userMutation: true });
    renderToolsView();
    showUndoToast(isEnglish() ? `Weight entry for ${targetDate} deleted.` : `Pesaje del ${targetDate} eliminado.`, () => {
        removedCopy.updatedAt = mutationNow();
        state.weights.push(removedCopy);
        state.weights.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        if (state.deletedRecords?.weights)
            delete state.deletedRecords.weights[targetDate];
        persistState({ userMutation: true });
        renderToolsView();
    });
}
function renderChartJs() {
    const canvas = document.getElementById('weightChart');
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    const sortedW = [...state.weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const labels = sortedW.map((w) => {
        const p = w.date.split('-');
        return `${p[2]}/${p[1]}`;
    });
    const dataPoints = sortedW.map((w) => displayWeight(w.weight));
    const movingAvgPoints = sortedW.map((w) => {
        const currentDate = new Date(w.date + "T12:00:00");
        const windowWeights = sortedW.filter((item) => {
            const itemDate = new Date(item.date + "T12:00:00");
            const diffDays = (currentDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays < 7;
        });
        const avg = windowWeights.reduce((sum, item) => sum + Number(item.weight), 0) / windowWeights.length;
        return Number(displayWeight(avg).toFixed(1));
    });
    const actualLabel = `${uiText('Peso real', 'Actual weight')} (${weightUnit()})`;
    const avgLabel = `${uiText('Media móvil', 'Moving average')} (7d)`;
    const chartLabels = labels.length ? labels : [uiText('Inicio', 'Start')];
    const actualData = dataPoints.length ? dataPoints : [0];
    const avgData = movingAvgPoints.length ? movingAvgPoints : [0];
    if (weightChartInstance) {
        weightChartInstance.data.labels = chartLabels;
        weightChartInstance.data.datasets[0].label = actualLabel;
        weightChartInstance.data.datasets[0].data = actualData;
        weightChartInstance.data.datasets[1].label = avgLabel;
        weightChartInstance.data.datasets[1].data = avgData;
        weightChartInstance.update('none');
        return;
    }
    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                { label: actualLabel, data: actualData, borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 2, pointBackgroundColor: '#10b981', pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.25 },
                { label: avgLabel, data: avgData, borderColor: '#f59e0b', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.35 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            transitions: { active: { animation: { duration: 0 } }, resize: { animation: { duration: 0 } } },
            plugins: {
                legend: { display: true, labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} ${weightUnit()}` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', callback: (v) => `${v}` } }
            }
        }
    });
}
function openWeightModal() { const input = document.getElementById('weight-input-date'); input.max = getFormattedDate(new Date()); input.value = state.selectedDate > input.max ? input.max : state.selectedDate; document.getElementById('modal-weight').classList.remove('hidden'); document.getElementById('modal-weight').classList.add('flex'); }
function closeWeightModal() {
    document.getElementById('modal-weight').classList.add('hidden');
    document.getElementById('modal-weight').classList.remove('flex');
}
function saveWeightEntry() {
    const date = document.getElementById('weight-input-date').value || state.selectedDate;
    if (!isValidDateKey(date) || date > getFormattedDate(new Date())) {
        showToast(uiText('La fecha del peso no puede estar en el futuro.', 'Weight date cannot be in the future.'));
        return;
    }
    const shownWeight = parseFloat(document.getElementById('weight-input-val').value);
    const weight = storageWeight(shownWeight);
    if (weight === null || !Number.isFinite(weight) || weight < 50 || weight > 1000) {
        showToast(isMetric() ? uiText('Ingresa un peso válido entre 22 y 454 kg.', 'Enter a valid weight between 22 and 454 kg.') : uiText('Ingresa un peso válido entre 50 y 1000 lb.', 'Enter a valid weight between 50 and 1000 lb.'));
        return;
    }
    if (state.deletedRecords && state.deletedRecords.weights) {
        delete state.deletedRecords.weights[date];
    }
    const idx = state.weights.findIndex((w) => w.date === date);
    if (idx >= 0) {
        state.weights[idx].weight = weight;
        state.weights[idx].updatedAt = mutationNow();
    }
    else {
        state.weights.push({ date, weight, updatedAt: mutationNow() });
    }
    state.weights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    persistState({ userMutation: true });
    closeWeightModal();
    renderToolsView();
    showToast(isEnglish() ? `Weight saved: ${formatWeight(weight, 1)}` : `Peso guardado: ${formatWeight(weight, 1)}`);
}
function openMeasurementModal() { const input = document.getElementById('meas-date'); input.max = getFormattedDate(new Date()); input.value = state.selectedDate > input.max ? input.max : state.selectedDate; document.getElementById('modal-measurement').classList.remove('hidden'); document.getElementById('modal-measurement').classList.add('flex'); }
function closeMeasurementModal() {
    document.getElementById('modal-measurement').classList.add('hidden');
    document.getElementById('modal-measurement').classList.remove('flex');
}
function saveMeasurementEntry() {
    const date = document.getElementById('meas-date').value || state.selectedDate;
    if (!isValidDateKey(date) || date > getFormattedDate(new Date())) {
        showToast(uiText('La fecha de las medidas no puede estar en el futuro.', 'Measurement date cannot be in the future.'));
        return;
    }
    const raw = [document.getElementById('meas-waist').value, document.getElementById('meas-chest').value, document.getElementById('meas-hips').value, document.getElementById('meas-neck').value].map((v) => String(v).trim());
    const values = raw.map((v) => v === '' ? 0 : storageLength(Number(v)));
    if (values.some((v) => v === null || !Number.isFinite(v) || v < 0 || v > 100) || values.slice(0, 3).some((v) => v !== null && v > 0 && v < 5)) {
        showToast(uiText('Revisa las medidas: deben ser valores positivos y razonables.', 'Check the measurements: values must be positive and within a reasonable range.'));
        return;
    }
    const [waist, chest, hips, neck] = values;
    if (state.deletedRecords && state.deletedRecords.measurements) {
        delete state.deletedRecords.measurements[date];
    }
    const idx = state.measurements.findIndex((m) => m.date === date);
    if (idx >= 0) {
        state.measurements[idx] = { date, waist, chest, hips, neck, updatedAt: mutationNow() };
    }
    else {
        state.measurements.push({ date, waist, chest, hips, neck, updatedAt: mutationNow() });
    }
    state.measurements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    persistState({ userMutation: true });
    closeMeasurementModal();
    renderToolsView();
    showToast(uiText("Medidas corporales guardadas.", "Body measurements saved."));
}
function playGentleChime(freq = 587.33) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.4);
    }
    catch (e) {
        console.log("Audio awaiting user interaction");
    }
}
let pacingTargetEndTime = null;
function toggleMealPacingTimer() {
    const btn = document.getElementById('btn-start-pacing');
    if (pacingTimerInterval) {
        clearInterval(pacingTimerInterval);
        pacingTimerInterval = null;
        if (pacingTargetEndTime) {
            pacingSecondsLeft = Math.max(0, Math.round((pacingTargetEndTime - Date.now()) / 1000));
            pacingTargetEndTime = null;
        }
        btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> ${uiText("Reanudar", "Resume")}`;
        showToast(uiText("Cronómetro pausado.", "Timer paused."));
        lucide.createIcons();
        return;
    }
    if (pacingSecondsLeft <= 0) {
        pacingSecondsLeft = 20 * 60;
    }
    pacingTargetEndTime = Date.now() + (pacingSecondsLeft * 1000);
    playGentleChime(523.25);
    btn.innerHTML = `<i data-lucide="pause" class="w-3.5 h-3.5"></i> ${uiText("Pausar", "Pause")}`;
    showToast(pacingSecondsLeft === 20 * 60 ? uiText("Cronómetro de 20 min iniciado.", "20-minute timer started.") : uiText("Cronómetro reanudado.", "Timer resumed."));
    lucide.createIcons();
    pacingTimerInterval = setInterval(() => {
        if (!pacingTargetEndTime)
            return;
        pacingSecondsLeft = Math.max(0, Math.round((pacingTargetEndTime - Date.now()) / 1000));
        const m = Math.floor(pacingSecondsLeft / 60);
        const s = pacingSecondsLeft % 60;
        document.getElementById('pacing-timer-badge').innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (pacingSecondsLeft === 600) {
            playGentleChime(659.25);
            showToast(uiText("10 minutos transcurridos: Evalúa tu saciedad. ¿Sientes plenitud?", "10 minutes: check your fullness and pace."));
        }
        if (pacingSecondsLeft <= 0) {
            if (pacingTimerInterval !== null)
                clearInterval(pacingTimerInterval);
            pacingTimerInterval = null;
            pacingTargetEndTime = null;
            pacingSecondsLeft = 20 * 60;
            playGentleChime(783.99);
            showToast(uiText("¡20 minutos completados!", "20 minutes completed!"));
            btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> ${uiText("Iniciar al comer", "Start with meal")}`;
            lucide.createIcons();
        }
    }, 500);
}
function resetMealPacingTimer() {
    if (pacingTimerInterval) {
        clearInterval(pacingTimerInterval);
        pacingTimerInterval = null;
    }
    pacingTargetEndTime = null;
    pacingSecondsLeft = 20 * 60;
    document.getElementById('pacing-timer-badge').innerText = "20:00";
    const btn = document.getElementById('btn-start-pacing');
    btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> ${uiText("Iniciar al comer", "Start with meal")}`;
    lucide.createIcons();
}
let fastingTimerInterval = null;
function stopFastingTicker() {
    if (fastingTimerInterval) {
        clearInterval(fastingTimerInterval);
        fastingTimerInterval = null;
    }
}
function updateFastingDisplay() {
    const display = document.getElementById('fasting-timer-display');
    if (!display)
        return;
    if (state.settings.isFasting && state.settings.fastingStart) {
        const elapsedMs = Math.max(0, Date.now() - Number(state.settings.fastingStart));
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        display.innerText = `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    else {
        display.innerText = "00h 00m 00s";
    }
}
function startFastingTicker() {
    stopFastingTicker();
    updateFastingDisplay();
    if (state.settings.isFasting && state.settings.fastingStart) {
        fastingTimerInterval = setInterval(updateFastingDisplay, 1000);
    }
}
function toggleFastingTimer() {
    const btn = document.getElementById('btn-toggle-fasting');
    const pill = document.getElementById('fasting-status-pill');
    if (!state.settings.isFasting) {
        state.settings.isFasting = true;
        state.settings.fastingStart = Date.now();
        markSettingsChanged(['isFasting', 'fastingStart']);
        btn.innerText = uiText("Detener ayuno", "Stop fast");
        btn.className = "px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all";
        pill.innerText = uiText("Ayuno activo", "Fasting active");
        pill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
        persistState({ userMutation: true });
        startFastingTicker();
        showToast(uiText("Ventana de ayuno iniciada.", "Fasting window started."));
    }
    else {
        state.settings.isFasting = false;
        state.settings.fastingStart = null;
        markSettingsChanged(['isFasting', 'fastingStart']);
        stopFastingTicker();
        btn.innerText = uiText("Iniciar ayuno", "Start fast");
        btn.className = "px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl shadow transition-all";
        pill.innerText = uiText("Pausa / Comiendo", "Paused / Eating");
        pill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700";
        updateFastingDisplay();
        persistState({ userMutation: true });
        showToast(uiText("Ventana de ayuno finalizada.", "Fasting window ended."));
    }
}
function initFastingUI() {
    const btn = document.getElementById('btn-toggle-fasting');
    const pill = document.getElementById('fasting-status-pill');
    if (!btn || !pill)
        return;
    if (state.settings.isFasting && state.settings.fastingStart) {
        btn.innerText = uiText("Detener ayuno", "Stop fast");
        btn.className = "px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all";
        pill.innerText = uiText("Ayuno activo", "Fasting active");
        pill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
        startFastingTicker();
    }
    else {
        stopFastingTicker();
        btn.innerText = uiText("Iniciar ayuno", "Start fast");
        btn.className = "px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl shadow transition-all";
        pill.innerText = uiText("Pausa / Comiendo", "Paused / Eating");
        pill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700";
        updateFastingDisplay();
    }
}
function openSosModal() {
    const isEn = isEnglish();
    const titleEl = document.getElementById('sos-title');
    const subEl = document.getElementById('sos-subtitle');
    const bodyEl = document.getElementById('sos-body');
    const closeBtn = document.getElementById('sos-close-btn');
    if (titleEl)
        titleEl.innerText = isEn ? "Quick Relief Guide (SOS)" : "Guía rápida de alivio (SOS)";
    if (subEl)
        subEl.innerText = isEn ? "Immediate protocols for digestive side effects" : "Protocolos inmediatos para efectos secundarios digestivos";
    if (closeBtn)
        closeBtn.innerText = isEn ? "Close guide" : "Cerrar guía";
    if (bodyEl) {
        if (isEn) {
            bodyEl.innerHTML = `
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-rose-400 font-bold">
                <i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i>
                <span>Sudden Nausea</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>P6 Acupressure:</strong> Press firmly on the point three finger-widths below the wrist on the inside of the forearm.<br>
                &bull; <strong>Upright posture:</strong> Do not lie down right after eating; stay upright for at least 2 hours.<br>
                &bull; <strong>Cold liquids:</strong> Take tiny sips of ice water or unsweetened ginger infusion.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-amber-400 font-bold">
                <i data-lucide="flame" class="w-4 h-4 shrink-0"></i>
                <span>Nighttime Heartburn & Reflux</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Spacing:</strong> Finish dinner at least 3 hours before going to bed.<br>
                &bull; <strong>Elevate head:</strong> Sleep with your torso slightly elevated or sleep on your left side.<br>
                &bull; <strong>Avoid triggers:</strong> Zero deep-fried items, hot sauces, or late coffee.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-yellow-300 font-bold">
                <i data-lucide="wind" class="w-4 h-4 shrink-0"></i>
                <span>Sulfur Burps</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Cause:</strong> Gastric fermentation of heavy fats or proteins retained from delayed gastric emptying.<br>
                &bull; <strong>Relief:</strong> Temporarily reduce high-sulfur foods (overcooked eggs, raw broccoli, fatty meats) and sip peppermint or chamomile tea.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-cyan-400 font-bold">
                <i data-lucide="zap-off" class="w-4 h-4 shrink-0"></i>
                <span>Postural Dizziness or Fatigue</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Electrolytes:</strong> Dissolve a pinch of sea salt or a sugar-free electrolyte packet in water.<br>
                &bull; <strong>Slow movement:</strong> Sit on the edge of the bed for a minute before standing up.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-rose-500/40 rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-rose-300 font-bold">
                <i data-lucide="shield-alert" class="w-4 h-4 shrink-0"></i>
                <span>Constipation (>48 hours)</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Warm hydration:</strong> Drink two glasses of warm water first thing in the morning.<br>
                &bull; <strong>Support:</strong> Consider magnesium citrate or dietary fiber as advised by your healthcare provider.
              </p>
            </div>
          `;
        }
        else {
            bodyEl.innerHTML = `
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-rose-400 font-bold">
                <i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i>
                <span>Náuseas repentinas</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Acupresión P6:</strong> Presiona el punto ubicado tres dedos por debajo de la muñeca en la cara interna del antebrazo.<br>
                &bull; <strong>Postura erguida:</strong> No te acuestes inmediatamente después de comer; mantente erguido al menos 2 horas.<br>
                &bull; <strong>Líquidos fríos:</strong> Bebe sorbos diminutos de agua helada o infusión de jengibre sin azúcar.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-amber-400 font-bold">
                <i data-lucide="flame" class="w-4 h-4 shrink-0"></i>
                <span>Acidez y reflujo nocturno</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Espaciamiento:</strong> Realiza la cena al menos 3 horas antes de acostarte.<br>
                &bull; <strong>Eleva la cabecera:</strong> Duerme con el torso ligeramente inclinado o sobre tu costado izquierdo.<br>
                &bull; <strong>Evita desencadenantes:</strong> Cero frituras, salsas picantes o café tardío.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-yellow-300 font-bold">
                <i data-lucide="wind" class="w-4 h-4 shrink-0"></i>
                <span>Eructos con sabor a azufre (*sulfur burps*)</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Causa:</strong> Fermentación gástrica de grasas pesadas o proteínas retenidas por vaciamiento lento.<br>
                &bull; <strong>Solución:</strong> Reduce temporalmente alimentos ricos en sulfuro (huevos cocidos en exceso, brócoli crudo, carnes con grasa) y toma té de manzanilla o menta.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-[#223455] rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-cyan-400 font-bold">
                <i data-lucide="zap-off" class="w-4 h-4 shrink-0"></i>
                <span>Mareos al levantarte o fatiga</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Electrólitos:</strong> Disuelve una pizca de sal marina o un sobre de electrolitos sin azúcar en agua.<br>
                &bull; <strong>Movimiento lento:</strong> Siéntate en la orilla de la cama durante un minuto antes de ponerte de pie.
              </p>
            </div>
            <div class="p-3 bg-[#090d16] border border-rose-500/40 rounded-2xl space-y-1">
              <div class="flex items-center space-x-2 text-rose-300 font-bold">
                <i data-lucide="shield-alert" class="w-4 h-4 shrink-0"></i>
                <span>Estreñimiento prolongado (&gt;48 horas)</span>
              </div>
              <p class="text-slate-300 leading-relaxed text-[11px]">
                &bull; <strong>Hidratación tibia:</strong> Bebe dos tazas de agua tibia en ayunas.<br>
                &bull; <strong>Suplementación:</strong> Considera citrato de magnesio bajo indicación médica para estimular la motilidad intestinal.
              </p>
            </div>
          `;
        }
    }
    document.getElementById('modal-sos').classList.remove('hidden');
    document.getElementById('modal-sos').classList.add('flex');
    lucide.createIcons();
}
function closeSosModal() {
    document.getElementById('modal-sos').classList.add('hidden');
    document.getElementById('modal-sos').classList.remove('flex');
}
function getAppointmentDateBounds(rangeValue) {
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    let start = null;
    if (rangeValue !== 'all') {
        const days = Math.max(1, Number(rangeValue) || 30);
        start = new Date(end);
        start.setDate(end.getDate() - (days - 1));
    }
    return {
        startKey: start ? getFormattedDate(start) : null,
        endKey: getFormattedDate(end)
    };
}
function buildAppointmentSummary(rangeValue, reportLang = null) {
    const lang = reportLang || state.settings.language || 'es';
    const en = lang === 'en';
    const tx = (es, enText) => en ? enText : es;
    const bounds = getAppointmentDateBounds(rangeValue);
    const inRange = (dateKey) => Boolean(dateKey && (!bounds.startKey || dateKey >= bounds.startKey) && dateKey <= bounds.endKey);
    const medication = getMedicationLabel(getMedicationProfile(), true);
    const weights = (state.weights || []).filter((w) => w && inRange(w.date) && Number.isFinite(Number(w.weight))).sort((a, b) => a.date.localeCompare(b.date));
    const injections = getInjectionsForMedication().filter((i) => inRange(i.date)).sort((a, b) => a.date.localeCompare(b.date));
    const measurements = (state.measurements || []).filter((m) => m && inRange(m.date)).sort((a, b) => a.date.localeCompare(b.date));
    let trackedDays = 0, waterTotal = 0, waterDays = 0, proteinTotal = 0, proteinDays = 0, bowelTotal = 0;
    const symptomCounts = { nausea: 0, heartburn: 0, sulfur: 0, fatigue: 0 };
    const doctorNotes = [];
    Object.keys(state.daysData || {}).sort().forEach((dateKey) => {
        if (!inRange(dateKey))
            return;
        const day = state.daysData[dateKey];
        if (!day || typeof day !== 'object')
            return;
        if (dayHasMeaningfulTracking(day))
            trackedDays++;
        const water = Number(day.water || 0);
        if (water > 0) {
            waterTotal += water;
            waterDays++;
        }
        if (Array.isArray(day.meals) && day.meals.length) {
            proteinTotal += day.meals.reduce((s, m) => s + Number(m && m.protein || 0), 0);
            proteinDays++;
        }
        bowelTotal += Array.isArray(day.bowelMovements) ? day.bowelMovements.length : 0;
        const sy = day.symptoms || {};
        if (sy.nausea && sy.nausea !== 'none')
            symptomCounts.nausea++;
        if (sy.heartburn && sy.heartburn !== 'none')
            symptomCounts.heartburn++;
        if (sy.sulfur && sy.sulfur !== 'none')
            symptomCounts.sulfur++;
        if (sy.fatigue && sy.fatigue !== 'none')
            symptomCounts.fatigue++;
        if (String(sy.notes || '').trim())
            doctorNotes.push(`${dateKey}: ${String(sy.notes).trim()}`);
    });
    const patterns = calculateTolerancePatterns(rangeValue === 'all' ? 3650 : Number(rangeValue || 30));
    const bowelStats = getBowelStats();
    const rangeLabel = rangeValue === 'all' ? tx('Desde el inicio de los registros', 'Since the beginning of the records') : tx(`Últimos ${rangeValue} días`, `Last ${rangeValue} days`);
    const lines = [];
    lines.push(tx('GLP-1 COMPANION — RESUMEN PARA CITA', 'GLP-1 COMPANION — VISIT SUMMARY'));
    lines.push(`${tx('Generado', 'Generated')}: ${new Date().toLocaleString(en ? 'en-US' : 'es-US')}`);
    lines.push(`${tx('Periodo', 'Period')}: ${rangeLabel}`);
    lines.push(`${tx('Medicamento registrado', 'Medication')}: ${medication}`);
    lines.push('');
    lines.push(tx('CAMBIOS IMPORTANTES DEL PERIODO', 'IMPORTANT CHANGES DURING THIS PERIOD'));
    if (weights.length >= 2) {
        const delta = Number(weights.at(-1).weight) - Number(weights[0].weight);
        lines.push(`• ${tx('Cambio de peso', 'Weight change')}: ${delta > 0 ? '+' : delta < 0 ? '-' : ''}${formatWeight(Math.abs(delta), 1)}`);
    }
    else
        lines.push(`• ${tx('Cambio de peso', 'Weight change')}: --`);
    if (injections.length) {
        const doseValues = [...new Set(injections.map((i) => i.dose).filter(Boolean))];
        lines.push(`• ${tx('Dosis registradas', 'Recorded doses')}: ${doseValues.join(' → ') || '--'}`);
    }
    else
        lines.push(`• ${tx('Dosis registradas', 'Recorded doses')}: --`);
    lines.push(`• ${tx('Días con síntomas digestivos', 'Days with digestive symptoms')}: ${patterns.symptomDays}`);
    lines.push(`• ${tx('Evacuaciones registradas', 'Recorded bowel movements')}: ${bowelTotal}`);
    lines.push('');
    lines.push(tx('PESO Y MEDIDAS', 'WEIGHT AND MEASUREMENTS'));
    if (weights.length) {
        const first = weights[0], last = weights.at(-1);
        lines.push(`• ${tx('Primer peso del periodo', 'First weight in period')}: ${formatWeight(Number(first.weight), 1)} (${first.date})`);
        lines.push(`• ${tx('Peso más reciente', 'Most recent weight')}: ${formatWeight(Number(last.weight), 1)} (${last.date})`);
    }
    else
        lines.push(`• ${tx('Sin pesajes registrados en este periodo.', 'No weights recorded in this period.')}`);
    if (measurements.length) {
        const latest = measurements.at(-1);
        lines.push(`• ${tx('Últimas medidas', 'Latest measurements')} (${latest.date}): ${tx('cintura', 'waist')} ${formatLength(Number(latest.waist || 0), 1)} · ${tx('pecho', 'chest')} ${formatLength(Number(latest.chest || 0), 1)} · ${tx('cadera', 'hips')} ${formatLength(Number(latest.hips || 0), 1)} · ${tx('cuello', 'neck')} ${formatLength(Number(latest.neck || 0), 1)}`);
    }
    lines.push('');
    lines.push(tx('TRATAMIENTO Y RESPUESTA A DOSIS', 'TREATMENT AND DOSE RESPONSE'));
    lines.push(`• ${getMedicationProfile().route === 'oral' ? tx('Tomas registradas', 'Logged doses') : tx('Inyecciones registradas', 'Logged injections')}: ${injections.length}`);
    if (injections.length) {
        const last = injections.at(-1);
        lines.push(`• ${tx('Última dosis', 'Last dose')}: ${last.dose || '--'} · ${last.date}${last.site ? ` · ${en ? ({ 'Abdomen derecho': 'Right abdomen', 'Abdomen izquierdo': 'Left abdomen', 'Muslo derecho': 'Right thigh', 'Muslo izquierdo': 'Left thigh', 'Brazo derecho': 'Right upper arm', 'Brazo izquierdo': 'Left upper arm', 'Oral': 'Oral' }[String(last.site)] || last.site) : ({ 'Oral': 'Vía oral' }[String(last.site)] || last.site)}` : ''}`);
        const resp = getInjectionResponse(last, lang);
        resp.forEach((m, idx) => { const label = ['0–24 h', '24–48 h', '48–72 h'][idx]; const sx = m.symptoms.length ? m.symptoms.join(', ') : tx('sin síntomas digestivos registrados', 'no digestive symptoms recorded'); lines.push(`  ${label}: ${m.exists ? sx : tx('sin datos', 'no records')} · ${tx('agua', 'water')} ${Math.round(displayWater(m.water))} ${waterUnit()} · ${tx('proteína', 'protein')} ${Math.round(m.protein)} g`); });
    }
    lines.push('');
    lines.push(tx('NUTRICIÓN E HIDRATACIÓN', 'NUTRITION AND HYDRATION'));
    lines.push(`• ${tx('Días con seguimiento', 'Tracked days')}: ${trackedDays}`);
    lines.push(`• ${tx('Agua promedio', 'Average water')}: ${waterDays ? formatWater(waterTotal / waterDays) + '/' + tx('día', 'day') : '--'}`);
    lines.push(`• ${tx('Proteína promedio', 'Average protein')}: ${proteinDays ? Math.round(proteinTotal / proteinDays) + ' g/' + tx('día', 'day') : '--'}`);
    lines.push('');
    lines.push(tx('SÍNTOMAS Y TOLERANCIA', 'SYMPTOMS AND TOLERANCE'));
    lines.push(`• ${tx('Náuseas', 'Nausea')}: ${symptomCounts.nausea} ${tx('día(s)', 'day(s)')}`);
    lines.push(`• ${tx('Acidez / reflujo', 'Heartburn / reflux')}: ${symptomCounts.heartburn} ${tx('día(s)', 'day(s)')}`);
    lines.push(`• ${tx('Eructos de azufre', 'Sulfur burps')}: ${symptomCounts.sulfur} ${tx('día(s)', 'day(s)')}`);
    lines.push(`• ${tx('Fatiga', 'Fatigue')}: ${symptomCounts.fatigue} ${tx('día(s)', 'day(s)')}`);
    if (patterns.highFatDays >= 2)
        lines.push(`• ${tx('Comidas ≥20 g grasa + síntomas', 'Meals ≥20 g fat + symptoms')}: ${patterns.highFatSymptomDays}/${patterns.highFatDays}`);
    if (patterns.postDoseTracked >= 3)
        lines.push(`• ${tx('Síntomas digestivos dentro de 3 días de dosis', 'Digestive symptoms within 3 days after doses')}: ${patterns.postDoseSymptoms}/${patterns.postDoseTracked} ${tx('días con datos', 'tracked days')}`);
    if (bowelStats.avgHours !== null)
        lines.push(`• ${tx('Intervalo promedio entre evacuaciones (30 d)', 'Average bowel interval (30d)')}: ${Math.round(bowelStats.avgHours)} h`);
    lines.push('');
    lines.push(tx('NOTAS / PREGUNTAS PARA LA CONSULTA', 'NOTES / QUESTIONS FOR THE VISIT'));
    if (doctorNotes.length)
        doctorNotes.slice(-12).forEach((note) => lines.push(`• ${note}`));
    else
        lines.push(`• ${tx('Sin notas registradas en este periodo.', 'No notes recorded in this period.')}`);
    lines.push('');
    lines.push(tx('Nota: Este resumen organiza registros personales y no sustituye evaluación ni indicaciones médicas.', 'Note: This summary organizes personal records and does not replace medical evaluation or treatment guidance.'));
    return lines.join('\n');
}
function refreshAppointmentSummary() {
    const rangeEl = document.getElementById('appointment-range');
    const textEl = document.getElementById('appointment-summary-text');
    if (!rangeEl || !textEl)
        return;
    const langEl = document.getElementById('appointment-language');
    const selectedLang = (langEl ? langEl.value : state.settings.language) === 'en' ? 'en' : 'es';
    textEl.value = buildAppointmentSummary(rangeEl.value, selectedLang);
}
function openAppointmentPrepModal() {
    const modal = document.getElementById('modal-appointment-prep');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const reportLang = document.getElementById('appointment-language');
    if (reportLang)
        reportLang.value = state.settings.language || 'es';
    refreshAppointmentSummary();
    lucide.createIcons();
}
function closeAppointmentPrepModal() {
    const modal = document.getElementById('modal-appointment-prep');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('appointment-print-mode');
}
async function copyAppointmentSummary() {
    const textEl = document.getElementById('appointment-summary-text');
    if (!textEl)
        return;
    try {
        await navigator.clipboard.writeText(textEl.value);
        showToast(uiText('Resumen para la cita copiado.', 'Visit summary copied.'));
    }
    catch (_) {
        textEl.select();
        document.execCommand('copy');
        showToast(uiText('Resumen para la cita copiado.', 'Visit summary copied.'));
    }
}
function printAppointmentSummary() {
    const textEl = document.getElementById('appointment-summary-text');
    const sheet = document.getElementById('appointment-print-sheet');
    const title = document.getElementById('appointment-print-title');
    const content = document.getElementById('appointment-print-content');
    if (!textEl || !sheet || !title || !content)
        return;
    const reportLangEl = document.getElementById('appointment-language');
    const reportEnglish = reportLangEl ? reportLangEl.value === 'en' : isEnglish();
    const lang = reportEnglish ? 'en' : 'es';
    const reportTitle = reportEnglish ? 'GLP-1 Visit Summary' : 'Resumen para cita GLP-1';
    title.textContent = reportTitle;
    content.innerHTML = escapeHtml(textEl.value).replace(/\n/g, '<br>');
    document.body.classList.remove('appointment-print-mode');
    if (isIOSLikeDevice()) {
        presentPdfOnApple(reportTitle, textEl.value, lang, 'GLP1_Visit_Summary');
        return;
    }
    document.body.classList.add('appointment-print-mode');
    if (typeof window.print === 'function')
        window.print();
    else
        showToast(uiText('La impresión no está disponible en este navegador.', 'Printing is not available in this browser.'));
}
function openAppleHealthModal() {
    const valEl = document.getElementById('apple-health-weight-val');
    const btn = document.getElementById('btn-run-health-shortcut');
    if (state.weights.length) {
        const curW = state.weights[state.weights.length - 1].weight;
        if (valEl)
            valEl.innerText = formatWeight(curW, 1);
        if (btn) {
            btn.href = `shortcuts://run-shortcut?name=LogWeight&input=${encodeURIComponent(curW)}`;
            btn.classList.remove('opacity-40', 'pointer-events-none');
            btn.setAttribute('aria-disabled', 'false');
        }
    }
    else {
        if (valEl)
            valEl.innerText = `-- ${weightUnit()}`;
        if (btn) {
            btn.removeAttribute('href');
            btn.classList.add('opacity-40', 'pointer-events-none');
            btn.setAttribute('aria-disabled', 'true');
        }
    }
    document.getElementById('modal-apple-health').classList.remove('hidden');
    document.getElementById('modal-apple-health').classList.add('flex');
}
function closeAppleHealthModal() {
    document.getElementById('modal-apple-health').classList.add('hidden');
    document.getElementById('modal-apple-health').classList.remove('flex');
}
function copyDoctorSummary() {
    const report = buildAppointmentSummary('all', state.settings.language || 'es');
    copyToClipboardText(report);
    showToast(uiText("¡Reporte copiado! Listo para pegar en Apple Notes o consulta médica.", "Report copied! Ready for Notes or your medical visit."));
}
const AppPlatform = {
    isNative() {
        try {
            return Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
        }
        catch (_) {
            return false;
        }
    },
    async copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            }
            catch (_) { }
        }
        return false;
    },
    networkOnline() { return navigator.onLine !== false; },
    async shareText(title, text) {
        if (navigator.share) {
            try {
                await navigator.share({ title, text });
                return true;
            }
            catch (_) { }
        }
        return false;
    }
};
function copyToClipboardText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
    }
    catch (err) {
        console.error("ExecCommand error:", err);
    }
    document.body.removeChild(textarea);
}
function saveNutritionalSettings() {
    const shownGoal = Number(document.getElementById('setting-goal-weight').value);
    const goalWeight = storageWeight(shownGoal);
    const calGoal = Number(document.getElementById('setting-cal-goal').value);
    const tdee = Number(document.getElementById('setting-tdee').value);
    const proteinGoal = Number(document.getElementById('setting-protein-goal').value);
    const shownWater = Number(document.getElementById('setting-water-goal').value);
    const waterGoal = storageWater(shownWater);
    const errors = [];
    if (goalWeight === null || !Number.isFinite(goalWeight) || goalWeight < 50 || goalWeight > 1000)
        errors.push(uiText('peso objetivo', 'goal weight'));
    if (!Number.isFinite(calGoal) || calGoal < 500 || calGoal > 10000)
        errors.push(uiText('meta de calorías', 'calorie goal'));
    if (!Number.isFinite(tdee) || tdee < 500 || tdee > 10000)
        errors.push('TDEE');
    if (!Number.isFinite(proteinGoal) || proteinGoal < 10 || proteinGoal > 500)
        errors.push(uiText('meta de proteína', 'protein goal'));
    if (waterGoal === null || !Number.isFinite(waterGoal) || waterGoal < 8 || waterGoal > 305)
        errors.push(uiText('meta de agua', 'water goal'));
    if (errors.length) {
        showToast(`${uiText('Revisa estos valores', 'Check these values')}: ${errors.join(', ')}.`);
        return;
    }
    if (goalWeight === null || waterGoal === null)
        return;
    state.settings.goalWeight = goalWeight;
    state.settings.calGoal = calGoal;
    state.settings.tdee = tdee;
    state.settings.proteinGoal = proteinGoal;
    state.settings.waterGoal = waterGoal;
    const maintenanceInput = document.getElementById('maintenance-range-input');
    if (maintenanceInput) {
        const mr = storageWeight(Number(maintenanceInput.value));
        if (mr !== null && Number.isFinite(mr) && mr >= .5 && mr <= 15)
            state.settings.maintenanceRangeLb = mr;
    }
    markSettingsChanged(['goalWeight', 'calGoal', 'tdee', 'proteinGoal', 'waterGoal', 'maintenanceRangeLb']);
    persistState({ userMutation: true });
    updateDashboardView();
    renderToolsView();
    applyUnitLabels();
    showToast(uiText("Configuración guardada.", "Settings saved."));
}
function formatBackupFileStamp(date = new Date()) {
    const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0'), mm = String(date.getMinutes()).padStart(2, '0'), ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}_${hh}-${mm}-${ss}`;
}
function sanitizedBackupState(snapshot) {
    const copy = JSON.parse(JSON.stringify(snapshot || {}));
    if (copy.settings && typeof copy.settings === 'object' && !Array.isArray(copy.settings))
        delete copy.settings.apiKey;
    return copy;
}
function createCurrentBackupObject(snapshot = state) {
    const payload = sanitizedBackupState(snapshot);
    delete payload.backupMeta;
    return Object.assign({ backupMeta: { appId: 'GLP1-Companion', exportVersion: APP_VERSION, schemaVersion: CLIENT_SCHEMA_VERSION, exportedAt: new Date().toISOString() } }, payload);
}
async function deliverJsonBackup(exportObject, filename) {
    const json = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'application/json' }) : null;
    if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
            await navigator.share({ title: 'GLP-1 Companion Backup', text: uiText('Guarda preferiblemente en iCloud Drive → GLP-1 Companion.', 'Prefer saving to iCloud Drive → GLP-1 Companion.'), files: [file] });
            showToast(uiText('Backup preparado. En iPhone/iPad usa Save to Files → iCloud Drive → GLP-1 Companion.', 'Backup prepared. On iPhone/iPad use Save to Files → iCloud Drive → GLP-1 Companion.'), 5000);
            return;
        }
        catch (err) {
            if (runtimeErrorName(err) === 'AbortError')
                return;
            console.warn('Native share unavailable; using download fallback:', err);
        }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(uiText('Backup descargado. Ubicación recomendada: iCloud Drive → GLP-1 Companion.', 'Backup downloaded. Recommended location: iCloud Drive → GLP-1 Companion.'), 5000);
}
function downloadBackupSnapshot(snapshot, label = '') {
    const exportObject = createCurrentBackupObject(snapshot);
    const suffix = label ? `_${String(label).replace(/[^a-z0-9_-]+/gi, '_')}` : '';
    return deliverJsonBackup(exportObject, `glp1_backup_${formatBackupFileStamp()}${suffix}.json`);
}
function renderExportBackupModalLanguage() {
    const set = (id, es, en) => {
        const el = document.getElementById(id);
        if (el)
            el.textContent = uiText(es, en);
    };
    set('export-backup-modal-title', 'Exportar Backup', 'Export Backup');
    set('export-backup-modal-subtitle', 'Selecciona qué deseas guardar', 'Choose what you want to save');
    set('export-current-title', 'Datos actuales', 'Current Data');
    set('export-current-desc', 'Solo el estado actual', 'Current data only');
    set('export-local-title', 'Actual + Backups locales', 'Current + Local Backups');
    set('export-local-desc', 'Incluye hasta 3 snapshots locales rotativos', 'Includes up to 3 rotating local snapshots');
    set('export-server-title', 'Actual + Backups del servidor', 'Current + Server Backups');
    set('export-server-desc', 'Incluye las copias Server Safety disponibles', 'Includes available Server Safety backups');
    set('export-complete-title', 'Backup completo — Recomendado', 'Complete Backup — Recommended');
    set('export-complete-desc', 'Datos actuales + backups locales + backups del servidor', 'Current data + local backups + server backups');
    const ios = document.getElementById('export-backup-ios-instructions');
    if (ios)
        ios.innerHTML = isEnglish() ? 'iPhone/iPad: choose <b>Save to Files</b> and preferably save to <b>iCloud Drive → GLP-1 Companion</b>.' : 'iPhone/iPad: selecciona <b>Save to Files</b> y guarda preferiblemente en <b>iCloud Drive → GLP-1 Companion</b>.';
}
function openExportBackupOptions() {
    renderExportBackupModalLanguage();
    const modal = document.getElementById('modal-export-backup');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }
}
function closeExportBackupOptions() {
    const modal = document.getElementById('modal-export-backup');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
function firestoreTimestampToMillis(value) {
    if (!value)
        return 0;
    if (typeof value === 'object' && !Array.isArray(value)) {
        const record = value;
        if (typeof record.toMillis === 'function')
            return Number(record.toMillis()) || 0;
        if (typeof record.toDate === 'function') {
            const d = record.toDate();
            return d instanceof Date ? d.getTime() : 0;
        }
        if (Number.isFinite(Number(record.seconds)))
            return Number(record.seconds) * 1000 + Math.floor((Number(record.nanoseconds) || 0) / 1e6);
    }
    if (Number.isFinite(Number(value)))
        return Number(value);
    return 0;
}
let serverSafetyBackupsCache = [];
async function fetchServerSafetyBackups() {
    if (!currentUser)
        throw new Error('AUTH_REQUIRED');
    if (navigator.onLine === false)
        throw new Error('OFFLINE');
    const snap = await firebasePlatform.getSafetyDocs(currentUser.uid);
    const items = [];
    snap.forEach((doc) => {
        const raw = doc.data();
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return;
        const d = raw;
        if (!d.snapshot || typeof d.snapshot !== 'object' || Array.isArray(d.snapshot))
            return;
        items.push({
            slot: doc.id,
            revision: Number(d.revision) || 0,
            savedAt: firestoreTimestampToMillis(d.savedAt),
            snapshot: d.snapshot
        });
    });
    items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    serverSafetyBackupsCache = items.slice(0, 3);
    return serverSafetyBackupsCache;
}
function backupSummary(snapshot) {
    const validation = validateBackupStructure(snapshot);
    if (validation.ok)
        return validation.counts;
    const source = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
    let meals = 0, days = 0;
    const daysData = source.daysData && typeof source.daysData === 'object' && !Array.isArray(source.daysData) ? source.daysData : {};
    Object.values(daysData).forEach((day) => {
        if (!day || typeof day !== 'object' || Array.isArray(day))
            return;
        const record = day;
        days++;
        if (Array.isArray(record.meals))
            meals += record.meals.length;
    });
    return {
        weights: Array.isArray(source.weights) ? source.weights.length : 0,
        injections: Array.isArray(source.injections) ? source.injections.length : 0,
        measurements: Array.isArray(source.measurements) ? source.measurements.length : 0,
        meals,
        days,
        health: source.healthProfile && typeof source.healthProfile === 'object' ? 1 : 0
    };
}
async function openServerSafetyBackups() {
    const modal = document.getElementById('modal-server-backups'), list = document.getElementById('server-backups-list');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    if (list)
        list.innerHTML = `<p class="text-xs text-slate-500">${escapeHtml(uiText('Cargando copias de Firebase…', 'Loading Firebase backups…'))}</p>`;
    try {
        const items = await fetchServerSafetyBackups();
        if (!list)
            return;
        if (!items.length) {
            list.innerHTML = `<p class="text-xs text-slate-500">${escapeHtml(uiText('Todavía no hay copias Server Safety disponibles. Se crean al sincronizar cambios posteriores.', 'No Server Safety backups are available yet. They are created as later changes sync.'))}</p>`;
            return;
        }
        list.innerHTML = items.map((item, idx) => { const c = backupSummary(item.snapshot), stamp = item.savedAt ? new Date(item.savedAt).toLocaleString(isEnglish() ? 'en-US' : 'es-US') : '--'; return `<div class="server-backup-item space-y-2.5"><div class="flex items-start justify-between gap-2"><div><p class="text-xs font-black text-white">${escapeHtml(uiText('Copia de servidor', 'Server backup'))} ${idx + 1}</p><p class="text-[9px] text-slate-500">${escapeHtml(stamp)} · rev ${item.revision}</p></div><span class="text-[9px] px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-cyan-300 font-bold">${c.weights} ${escapeHtml(uiText('pesajes', 'weights'))} · ${c.injections} ${escapeHtml(uiText('dosis', 'doses'))}</span></div><div class="grid grid-cols-2 gap-2"><button onclick="viewServerSafetyBackup('${escapeHtml(item.slot)}')" class="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1.5"><i data-lucide="eye" class="w-3.5 h-3.5"></i>${escapeHtml(uiText('Ver', 'View'))}</button><button onclick="restoreServerSafetyBackup('${escapeHtml(item.slot)}')" class="py-2 rounded-xl bg-amber-500/12 hover:bg-amber-500/18 border border-amber-500/25 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1.5"><i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>${escapeHtml(uiText('Restaurar', 'Restore'))}</button></div></div>`; }).join('');
        lucide.createIcons();
    }
    catch (err) {
        console.error('Server safety backup read failed:', err);
        if (list)
            list.innerHTML = `<p class="text-xs text-rose-300">${escapeHtml(runtimeErrorMessage(err) === 'OFFLINE' ? uiText('Sin conexión. Conéctate para consultar Server Safety Backups.', 'Offline. Connect to view Server Safety Backups.') : runtimeErrorMessage(err) === 'AUTH_REQUIRED' ? uiText('Inicia sesión para consultar Server Safety Backups.', 'Sign in to view Server Safety Backups.') : uiText('No se pudieron leer las copias del servidor. Revisa conexión/permisos de Firebase.', 'Server backups could not be read. Check Firebase connection/permissions.'))}</p>`;
    }
}
function closeServerSafetyBackups() {
    const m = document.getElementById('modal-server-backups');
    if (m) {
        m.classList.add('hidden');
        m.classList.remove('flex');
    }
}
function closeBackupView() {
    const m = document.getElementById('modal-backup-view');
    if (m) {
        m.classList.add('hidden');
        m.classList.remove('flex');
    }
}
function viewServerSafetyBackup(slot) {
    const item = serverSafetyBackupsCache.find((x) => x.slot === slot);
    if (!item)
        return;
    const c = backupSummary(item.snapshot), content = document.getElementById('backup-view-content'), modal = document.getElementById('modal-backup-view');
    const stamp = item.savedAt ? new Date(item.savedAt).toLocaleString(isEnglish() ? 'en-US' : 'es-US') : '--';
    if (content)
        content.innerHTML = `<p><b>${escapeHtml(uiText('Fecha/hora', 'Date/time'))}:</b> ${escapeHtml(stamp)}</p><p><b>Revision:</b> ${item.revision}</p><div class="grid grid-cols-2 gap-2 mt-2">${[[uiText('Pesajes', 'Weights'), c.weights], [uiText('Dosis', 'Doses'), c.injections], [uiText('Comidas', 'Meals'), c.meals], [uiText('Medidas', 'Measurements'), c.measurements], [uiText('Días', 'Days'), c.days], [uiText('Health Profile', 'Health Profile'), c.health ? uiText('Sí', 'Yes') : uiText('No', 'No')]].map(([l, v]) => `<div class="backup-view-tile"><span class="text-[9px] text-slate-500">${escapeHtml(String(l))}</span><p class="font-black text-white">${escapeHtml(String(v))}</p></div>`).join('')}</div>`;
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}
function restoreServerSafetyBackup(slot) {
    const item = serverSafetyBackupsCache.find((x) => x.slot === slot);
    if (!item)
        return;
    const validation = validateBackupStructure(item.snapshot);
    if (!validation.ok) {
        showToast(uiText('Esta copia del servidor no tiene una estructura restaurable.', 'This server backup is not restorable.'));
        return;
    }
    closeServerSafetyBackups();
    showImportPreview(item.snapshot, Object.assign({}, validation, { version: `${validation.version} · Server Safety` }));
}
async function exportBackupPackage(mode = 'current') {
    try {
        if (mode === 'local' || mode === 'complete')
            await localBackupInitPromise;
        const current = createCurrentBackupObject(state), stamp = formatBackupFileStamp();
        let output = current, descriptor = 'current';
        if (mode !== 'current') {
            const packageMeta = { appId: 'GLP1-Companion', packageVersion: '1', exportVersion: APP_VERSION, exportedAt: new Date().toISOString(), type: mode, recommendedLocation: 'iCloud Drive/GLP-1 Companion' };
            output = { backupPackage: packageMeta, currentData: current };
            if (mode === 'local' || mode === 'complete')
                output.localBackups = getLocalSafetyBackups().map((x) => ({ savedAt: x.savedAt, appVersion: x.appVersion || '', snapshot: sanitizedBackupState(x.snapshot) }));
            if (mode === 'server' || mode === 'complete') {
                const server = await fetchServerSafetyBackups();
                output.serverBackups = server.map((x) => ({ slot: x.slot, revision: x.revision, savedAt: x.savedAt, snapshot: sanitizedBackupState(x.snapshot) }));
            }
            descriptor = mode === 'complete' ? 'complete' : mode;
        }
        await deliverJsonBackup(output, `glp1_backup_${stamp}_${descriptor}_${APP_VERSION}.json`);
        closeExportBackupOptions();
    }
    catch (err) {
        console.error('Backup export failed:', err);
        showToast(runtimeErrorMessage(err) === 'OFFLINE' ? uiText('Necesitas conexión para incluir Server Backups. Puedes exportar Current o Local sin conexión.', 'You need a connection to include Server Backups. Current or Local can be exported offline.') : runtimeErrorMessage(err) === 'AUTH_REQUIRED' ? uiText('Inicia sesión para incluir Server Backups.', 'Sign in to include Server Backups.') : uiText('No se pudo completar la exportación solicitada.', 'The requested export could not be completed.'), 5000);
    }
}
function exportDataJSON() { openExportBackupOptions(); }
function isUnknownRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function normalizeBackupEnvelope(raw) {
    if (isUnknownRecord(raw) && raw.backupPackage) {
        const meta = isUnknownRecord(raw.backupPackage) ? raw.backupPackage : null;
        if (!meta || meta.appId !== 'GLP1-Companion' || !isUnknownRecord(raw.currentData))
            return { data: raw, packageInfo: null };
        const localBackups = Array.isArray(raw.localBackups) ? raw.localBackups.slice(0, LOCAL_SAFETY_BACKUP_SLOTS) : [];
        const serverBackups = Array.isArray(raw.serverBackups) ? raw.serverBackups.slice(0, SERVER_SAFETY_BACKUP_SLOTS) : [];
        return {
            data: raw.currentData,
            packageInfo: {
                type: String(meta.type || 'package'),
                localCount: localBackups.length,
                serverCount: serverBackups.length,
                localBackups,
                serverBackups,
                serverBackupsArchivalOnly: true
            }
        };
    }
    return { data: raw, packageInfo: null };
}
function normalizeImportedTimestamp(value) {
    const n = Number(value);
    // Missing legacy timestamps stay deliberately old; an explicit restore gets
    // authority from its new dataEpoch, not from pretending old records are new.
    return Number.isFinite(n) && n > 0 ? n : 1;
}
let pendingImportCandidate = null;
let pendingImportPackageInfo = null;
function validateBackupStructure(imported) {
    if (!isUnknownRecord(imported))
        return { ok: false, reason: 'root' };
    const objectFields = ['settings', 'daysData', 'deletedRecords', 'meta', 'healthProfile', 'aiTelemetry'];
    for (const key of objectFields) {
        if (key in imported && !isUnknownRecord(imported[key]))
            return { ok: false, reason: key };
    }
    for (const key of ['injections', 'weights', 'measurements']) {
        if (key in imported && !Array.isArray(imported[key]))
            return { ok: false, reason: key };
    }
    const recognized = ['daysData', 'injections', 'weights', 'measurements'].filter((k) => k in imported);
    if (!isUnknownRecord(imported.settings) || recognized.length < 1)
        return { ok: false, reason: 'app_structure' };
    let legacy = false;
    let backupMeta = null;
    if (imported.backupMeta !== undefined) {
        if (!isUnknownRecord(imported.backupMeta) || imported.backupMeta.appId !== 'GLP1-Companion')
            return { ok: false, reason: 'identity' };
        backupMeta = imported.backupMeta;
        const schema = Number(backupMeta.schemaVersion);
        if (!Number.isFinite(schema) || schema < 1 || schema > CLIENT_SCHEMA_VERSION)
            return { ok: false, reason: 'schema' };
    }
    else {
        legacy = true;
        if (recognized.length < 2)
            return { ok: false, reason: 'legacy_identity' };
    }
    const healthProfile = isUnknownRecord(imported.healthProfile) ? imported.healthProfile : {};
    const counts = {
        weights: Array.isArray(imported.weights) ? imported.weights.length : 0,
        injections: Array.isArray(imported.injections) ? imported.injections.length : 0,
        measurements: Array.isArray(imported.measurements) ? imported.measurements.length : 0,
        meals: 0,
        days: 0,
        health: Object.keys(healthProfile).length ? 1 : 0
    };
    if (isUnknownRecord(imported.daysData)) {
        Object.values(imported.daysData).forEach((day) => {
            if (!isUnknownRecord(day))
                return;
            counts.days++;
            if (Array.isArray(day.meals))
                counts.meals += day.meals.length;
        });
    }
    const meta = isUnknownRecord(imported.meta) ? imported.meta : {};
    return {
        ok: true,
        legacy,
        counts,
        version: String(backupMeta?.exportVersion || meta.clientVersion || uiText('Backup anterior', 'Older backup'))
    };
}
function showImportPreview(imported, validation) {
    pendingImportCandidate = imported;
    pendingImportPackageInfo = validation.packageInfo || null;
    const modal = document.getElementById('modal-import-preview'), grid = document.getElementById('import-preview-grid'), version = document.getElementById('import-preview-version');
    if (version) {
        const pkg = validation.packageInfo ? ` · ${validation.packageInfo.type} (${validation.packageInfo.localCount} local / ${validation.packageInfo.serverCount} server)` : '';
        const archival = validation.packageInfo && validation.packageInfo.serverCount ? uiText(' · Server Safety: archivo/referencia', ' · Server Safety: archive/reference') : '';
        version.innerText = isEnglish() ? `Detected: ${validation.version}${validation.legacy ? ' · compatible legacy format' : ''}${pkg}${archival}` : `Detectado: ${validation.version}${validation.legacy ? ' · formato anterior compatible' : ''}${pkg}${archival}`;
    }
    if (grid) {
        const c = validation.counts;
        const tiles = [
            ['scale', uiText('Pesajes', 'Weights'), c.weights],
            ['pill', uiText('Dosis', 'Doses'), c.injections],
            ['utensils', uiText('Comidas', 'Meals'), c.meals],
            ['ruler', uiText('Medidas', 'Measurements'), c.measurements],
            ['calendar', uiText('Días', 'Days'), c.days],
            ['user-round', uiText('Health Profile', 'Health Profile'), c.health ? uiText('Sí', 'Yes') : uiText('No', 'No')]
        ];
        grid.innerHTML = tiles.map(([icon, label, val]) => `<div class="p-2 rounded-xl bg-[#111a2e] border border-[#223455]"><i data-lucide="${icon}" class="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1"></i><p class="text-sm font-black text-white">${escapeHtml(String(val))}</p><span class="text-[8px] text-slate-500">${escapeHtml(label)}</span></div>`).join('');
    }
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    lucide.createIcons();
}
function cancelImportPreview() {
    pendingImportCandidate = null;
    pendingImportPackageInfo = null;
    const modal = document.getElementById('modal-import-preview');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
async function confirmImportPreview() {
    if (!pendingImportCandidate)
        return;
    const imported = pendingImportCandidate, packageInfo = pendingImportPackageInfo;
    pendingImportCandidate = null;
    pendingImportPackageInfo = null;
    const modal = document.getElementById('modal-import-preview');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    try {
        await applyImportedBackup(imported, packageInfo);
    }
    catch (err) {
        console.error('Error applying backup:', err);
        showToast(uiText('Error: no se pudo aplicar el backup de forma segura.', 'Error: backup could not be applied safely.'));
    }
}
async function applyImportedBackup(imported, packageInfo = null) {
    // Preserve the current state before an authoritative restore. The rotating
    // snapshot lives in IndexedDB, so a full localStorage quota cannot block it.
    try {
        rotateLocalSafetySnapshot();
    }
    catch (_) { }
    try {
        localStorage.setItem(PRE_IMPORT_BACKUP_KEY, JSON.stringify(state));
    }
    catch (err) {
        if (!isQuotaExceededError(err))
            console.warn('Pre-import backup skipped:', err);
    }
    const localLanguage = state.settings.language === 'en' ? 'en' : 'es';
    const fallbackUnits = state.settings.units === 'metric' ? 'metric' : 'imperial';
    const next = createDefaultState({ language: localLanguage, units: fallbackUnits });
    if (isUnknownRecord(imported.settings)) {
        const incoming = Object.assign({}, imported.settings);
        delete incoming.apiKey;
        delete incoming.language;
        delete incoming.units;
        next.settings = Object.assign(next.settings, incoming, { language: localLanguage, units: fallbackUnits });
    }
    if (!MEDICATION_PROFILES[next.settings.medication])
        next.settings.medication = 'mounjaro';
    if (typeof next.settings.maintenanceEnabled !== 'boolean')
        next.settings.maintenanceEnabled = false;
    const importedRange = Number(next.settings.maintenanceRangeLb);
    next.settings.maintenanceRangeLb = Number.isFinite(importedRange) && importedRange >= 1 && importedRange <= 15 ? importedRange : 3;
    const todayKey = getFormattedDate(new Date());
    if (isUnknownRecord(imported.daysData)) {
        Object.keys(imported.daysData).forEach((dateKey) => {
            if (!isValidDateKey(dateKey))
                return;
            const rawValue = imported.daysData && isUnknownRecord(imported.daysData) ? imported.daysData[dateKey] : undefined;
            if (!isUnknownRecord(rawValue))
                return;
            const raw = rawValue;
            const meals = [];
            if (Array.isArray(raw.meals)) {
                raw.meals.forEach((mealValue, idx) => {
                    if (!isUnknownRecord(mealValue))
                        return;
                    const meal = mealValue;
                    const cal = parseFloat(String(meal.calories ?? ''));
                    const pr = parseFloat(String(meal.protein ?? ''));
                    const ca = parseFloat(String(meal.carbs ?? ''));
                    const fa = parseFloat(String(meal.fat ?? ''));
                    const name = String(meal.name || meal.nameEs || meal.nameEn || uiText('Comida', 'Meal'));
                    const tip = typeof meal.tip === 'string' ? meal.tip : (typeof meal.tipEs === 'string' ? meal.tipEs : (typeof meal.tipEn === 'string' ? meal.tipEn : ''));
                    meals.push({
                        id: typeof meal.id === 'string' && meal.id.trim() ? meal.id.trim() : `meal_import_${dateKey}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
                        name,
                        nameEs: typeof meal.nameEs === 'string' ? meal.nameEs : '',
                        nameEn: typeof meal.nameEn === 'string' ? meal.nameEn : '',
                        slot: typeof meal.slot === 'string' ? meal.slot : 'Comida',
                        calories: Number.isFinite(cal) && cal >= 0 ? cal : 0,
                        protein: Number.isFinite(pr) && pr >= 0 ? pr : 0,
                        carbs: Number.isFinite(ca) && ca >= 0 ? ca : 0,
                        fat: Number.isFinite(fa) && fa >= 0 ? fa : 0,
                        tip,
                        tipEs: typeof meal.tipEs === 'string' ? meal.tipEs : '',
                        tipEn: typeof meal.tipEn === 'string' ? meal.tipEn : '',
                        aiGenerated: Boolean(meal.aiGenerated),
                        analysisLanguage: typeof meal.analysisLanguage === 'string' ? meal.analysisLanguage : '',
                        analysisSource: typeof meal.analysisSource === 'string' ? meal.analysisSource : '',
                        time: typeof meal.time === 'string' ? meal.time : '',
                        updatedAt: normalizeImportedTimestamp(meal.updatedAt)
                    });
                });
            }
            const waterEvents = Array.isArray(raw.waterEvents) ? raw.waterEvents.flatMap((entry) => {
                if (!isUnknownRecord(entry) || typeof entry.id !== 'string')
                    return [];
                return [{ id: entry.id, delta: Number(entry.delta) || 0, updatedAt: normalizeImportedTimestamp(entry.updatedAt) }];
            }) : [];
            const bowelMovements = Array.isArray(raw.bowelMovements) ? raw.bowelMovements.filter((value) => typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) : [];
            const bowelMovementRecords = Array.isArray(raw.bowelMovementRecords) ? raw.bowelMovementRecords.flatMap((entry) => {
                if (!isUnknownRecord(entry) || typeof entry.id !== 'string' || typeof entry.at !== 'string' || Number.isNaN(new Date(entry.at).getTime()))
                    return [];
                return [{ id: entry.id, at: entry.at, updatedAt: normalizeImportedTimestamp(entry.updatedAt) }];
            }) : [];
            const defaultSymptoms = { hunger: 3, nausea: 'none', heartburn: 'none', sulfur: 'none', fatigue: 'none', notes: '' };
            const symptoms = isUnknownRecord(raw.symptoms) ? raw.symptoms : defaultSymptoms;
            const electrolytes = isUnknownRecord(raw.electrolytes) ? raw.electrolytes : {};
            const water = parseFloat(String(raw.water ?? ''));
            const day = {
                water: Number.isFinite(water) && water >= 0 ? water : 0,
                waterUpdatedAt: normalizeImportedTimestamp(raw.waterUpdatedAt),
                waterEvents,
                meals,
                bowelMovements,
                bowelMovementRecords,
                bowelMovementsUpdatedAt: normalizeImportedTimestamp(raw.bowelMovementsUpdatedAt),
                symptoms,
                symptomsUpdatedAt: Number(raw.symptomsUpdatedAt) > 0 ? normalizeImportedTimestamp(raw.symptomsUpdatedAt) : 0,
                electrolytes,
                electrolytesUpdatedAt: normalizeImportedTimestamp(raw.electrolytesUpdatedAt)
            };
            next.daysData[dateKey] = day;
            ensureGranularDayData(dateKey, next.daysData[dateKey]);
        });
    }
    next.inventoryEvents = sanitizeInventoryEvents(imported.inventoryEvents);
    if (Array.isArray(imported.weights)) {
        imported.weights.forEach((weightValue) => {
            if (!isUnknownRecord(weightValue))
                return;
            const date = normalizeDateKey(weightValue.date);
            const num = parseFloat(String(weightValue.weight ?? ''));
            if (date && date <= todayKey && Number.isFinite(num) && num > 0)
                next.weights.push({ date, weight: num, updatedAt: normalizeImportedTimestamp(weightValue.updatedAt) });
        });
    }
    if (Array.isArray(imported.injections)) {
        imported.injections.forEach((injectionValue) => {
            if (!isUnknownRecord(injectionValue))
                return;
            const date = normalizeDateKey(injectionValue.date);
            if (!date || typeof injectionValue.dose !== 'string')
                return;
            const medicationKey = typeof injectionValue.medication === 'string' ? injectionValue.medication : '';
            const med = MEDICATION_PROFILES[medicationKey] ? medicationKey : next.settings.medication;
            const time = typeof injectionValue.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(injectionValue.time) ? injectionValue.time : '';
            next.injections.push({
                id: typeof injectionValue.id === 'string' && injectionValue.id.trim() ? injectionValue.id.trim() : `inj_import_${Math.random().toString(36).slice(2, 10)}`,
                date,
                time,
                dose: injectionValue.dose,
                medication: med,
                presentation: typeof injectionValue.presentation === 'string' ? injectionValue.presentation : '',
                productKey: typeof injectionValue.productKey === 'string' ? injectionValue.productKey : '',
                inventoryConsumed: Boolean(injectionValue.inventoryConsumed),
                site: typeof injectionValue.site === 'string' ? injectionValue.site : 'Abdomen derecho',
                notes: typeof injectionValue.notes === 'string' ? injectionValue.notes : '',
                updatedAt: normalizeImportedTimestamp(injectionValue.updatedAt)
            });
        });
    }
    if (Array.isArray(imported.measurements)) {
        imported.measurements.forEach((measurementValue) => {
            if (!isUnknownRecord(measurementValue))
                return;
            const date = normalizeDateKey(measurementValue.date);
            if (!date || date > todayKey)
                return;
            const waist = parseFloat(String(measurementValue.waist ?? ''));
            const chest = parseFloat(String(measurementValue.chest ?? ''));
            const hips = parseFloat(String(measurementValue.hips ?? ''));
            const neck = parseFloat(String(measurementValue.neck ?? ''));
            next.measurements.push({
                date,
                waist: Number.isFinite(waist) && waist >= 0 ? waist : 0,
                chest: Number.isFinite(chest) && chest >= 0 ? chest : 0,
                hips: Number.isFinite(hips) && hips >= 0 ? hips : 0,
                neck: Number.isFinite(neck) && neck >= 0 ? neck : 0,
                updatedAt: normalizeImportedTimestamp(measurementValue.updatedAt)
            });
        });
    }
    // Restore creates a fresh authoritative dataEpoch. Imported records are already
    // materialized, so old tombstones are intentionally compacted here; carrying
    // tombstones across generations would only grow the document indefinitely.
    next.deletedRecords = { meals: {}, weights: {}, injections: {}, measurements: {}, bowelMovements: {} };
    next.healthProfile = sanitizeHealthProfile(imported.healthProfile);
    next.aiTelemetry = sanitizeAiTelemetry(imported.aiTelemetry);
    const restoreTime = mutationNow();
    if (next.healthProfile.sex || next.healthProfile.dob || next.healthProfile.heightIn || next.healthProfile.activity)
        next.healthProfile.updatedAt = restoreTime;
    const settingsFieldUpdatedAt = {};
    Object.keys(next.settings || {}).forEach((k) => {
        if (!['language', 'units', 'apiKey', 'pensInStock', 'roomTempTrackingEnabled', 'roomTempPenStart', 'inventoryByProduct', 'inventoryBaseByProduct', 'roomTempTrackers'].includes(k))
            settingsFieldUpdatedAt[k] = restoreTime;
    });
    Object.keys(next.settings.inventoryByProduct || {}).forEach((k) => settingsFieldUpdatedAt[`inventoryByProduct.${k}`] = restoreTime);
    Object.keys(next.settings.inventoryBaseByProduct || {}).forEach((k) => settingsFieldUpdatedAt[`inventoryBaseByProduct.${k}`] = restoreTime);
    Object.keys(next.settings.roomTempTrackers || {}).forEach((k) => settingsFieldUpdatedAt[`roomTempTrackers.${k}`] = restoreTime);
    next.meta = { schemaVersion: CLIENT_SCHEMA_VERSION, ownerUid: currentUser ? currentUser.uid : (state.meta && state.meta.ownerUid) || null, dataEpoch: generateDataEpoch('restore'), resetAt: restoreTime, settingsUpdatedAt: restoreTime, settingsFieldUpdatedAt, clientVersion: APP_VERSION, lastMutationAt: restoreTime };
    next.selectedDate = todayKey;
    state = next;
    ensureV4State();
    persistState({ userMutation: true, immediateCloud: true });
    let localHistoryRestored = false;
    if (packageInfo && packageInfo.localBackups.length)
        localHistoryRestored = await replaceLocalSafetyBackups(packageInfo.localBackups);
    applyMedicationTheme();
    renderCurrentDay();
    renderAiStatus();
    if (activeTab === 'tools')
        renderToolsView();
    let msg = uiText('Backup restaurado de forma segura. Se creó una copia del estado anterior.', 'Backup restored safely. A copy of the previous state was created.');
    if (localHistoryRestored)
        msg += uiText(' También se restauraron los backups locales incluidos.', ' Included local backup history was also restored.');
    if (packageInfo && packageInfo.serverCount)
        msg += uiText(' Los Server Safety incluidos permanecen como archivo de referencia y no reemplazaron los snapshots reales de Firebase.', ' Included Server Safety snapshots remain archival/reference and did not overwrite Firebase safety slots.');
    showToast(msg, 8000);
}
function importDataJSON(e) {
    const input = e.target;
    const file = input?.files && input.files[0];
    if (!input || !file)
        return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const raw = JSON.parse(String(evt.target?.result || ''));
            const envelope = normalizeBackupEnvelope(raw);
            const imported = envelope.data;
            const validation = validateBackupStructure(imported);
            if (!validation.ok)
                throw new Error(`Invalid backup: ${validation.reason}`);
            if (!isUnknownRecord(imported))
                throw new Error('Invalid backup root');
            validation.packageInfo = envelope.packageInfo;
            showImportPreview(imported, validation);
        }
        catch (err) {
            console.error('Backup validation failed:', err);
            showToast(uiText('Error: el archivo no es un backup GLP-1 Companion compatible.', 'Error: the file is not a compatible GLP-1 Companion backup.'), 5000);
        }
        finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
}
function openResetModal() {
    document.getElementById('modal-reset').classList.remove('hidden');
    document.getElementById('modal-reset').classList.add('flex');
}
function closeResetModal() {
    document.getElementById('modal-reset').classList.add('hidden');
    document.getElementById('modal-reset').classList.remove('flex');
}
function executeFactoryReset() {
    const language = state.settings && state.settings.language === 'en' ? 'en' : 'es';
    const units = state.settings && state.settings.units === 'metric' ? 'metric' : 'imperial';
    const ownerUid = currentUser ? currentUser.uid : (state.meta && state.meta.ownerUid) || null;
    const resetTime = mutationNow();
    // Clean up legacy Gemini key from versions before Firebase AI Logic.
    localStorage.removeItem("gemini_api_key_vault");
    state = createDefaultState({ language, units });
    state.meta = {
        schemaVersion: CLIENT_SCHEMA_VERSION,
        ownerUid,
        dataEpoch: generateDataEpoch('reset'),
        resetAt: resetTime,
        settingsUpdatedAt: resetTime,
        settingsFieldUpdatedAt: {},
        clientVersion: APP_VERSION,
        lastMutationAt: resetTime
    };
    state.selectedDate = getFormattedDate(new Date());
    persistState({ userMutation: true, immediateCloud: true });
    closeResetModal();
    applyMedicationTheme();
    renderCurrentDay();
    if (activeTab === 'tools')
        renderToolsView();
    showToast(uiText('Todos los datos fueron borrados. Los dispositivos antiguos descartarán sus copias al sincronizar.', 'All data was deleted. Older devices will discard their copies when they sync.'), 5000);
}
let toastTimer = null;
function showToast(msg, duration = 3500, preserveUndo = false) {
    const toast = document.getElementById('toast');
    const undoBtn = document.getElementById('toast-undo-btn');
    document.getElementById('toast-msg').innerText = msg;
    if (undoBtn && !preserveUndo) {
        undoBtn.classList.add('hidden');
        pendingUndoAction = null;
    }
    toast.classList.remove('opacity-0', 'translate-y-12', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');
    if (toastTimer)
        clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-12', 'pointer-events-none');
        if (undoBtn)
            undoBtn.classList.add('hidden');
    }, duration);
}
let lastObservedTodayKey = getFormattedDate(new Date());
function handleDayRollover(forceToday = false) {
    const realToday = getFormattedDate(new Date());
    const changed = realToday !== lastObservedTodayKey;
    if (changed)
        lastObservedTodayKey = realToday;
    if (changed || forceToday) {
        if (state.selectedDate !== realToday)
            state.selectedDate = realToday;
        // getSelectedDay creates today's empty symptom form with symptomsUpdatedAt=0;
        // it never copies yesterday's symptom values.
        getSelectedDay();
        persistState({ localOnly: true });
        updateDateBadge();
        renderCurrentDay();
    }
    return changed;
}
function handleAppResume() {
    handleDayRollover(true);
    updateFastingDisplay();
    if (state.settings.isFasting && state.settings.fastingStart && !fastingTimerInterval)
        startFastingTicker();
}
// If the PWA remains visible through midnight, switch to the new Today automatically.
setInterval(() => {
    if (document.visibilityState === 'visible')
        handleDayRollover(false);
}, 30000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
        handleAppResume();
});
window.addEventListener('pageshow', () => { handleAppResume(); });
