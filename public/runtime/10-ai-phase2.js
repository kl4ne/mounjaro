"use strict";
/**
 * GLP-1 Companion v5.4.0 — AI Intelligence Phase 2
 * AI Pattern Finder + Prepare My Visit.
 *
 * Phase 2 preserves the Phase 1 rule: the app calculates the evidence first,
 * then Firebase AI Logic explains only the supplied evidence. Associations are
 * never presented as causes, diagnoses, or medication recommendations.
 */
let lastPatternFinderResult = null;
let lastPatternFinderContext = null;
let lastVisitPrepResult = null;
let lastVisitPrepContext = null;
let lastProgressComparisonResult = null;
let lastProgressComparisonContext = null;
function phase2HasSymptoms(day) {
    return Object.keys(day.symptoms || {}).some((key) => key !== 'hunger');
}
function phase2Average(values) {
    const clean = values.filter((value) => value !== null && Number.isFinite(value));
    if (!clean.length)
        return null;
    return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
function phase2ShiftDate(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00`);
    date.setDate(date.getDate() + days);
    return getFormattedDate(date);
}
function phase2Pct(value) {
    return `${Math.round(value * 100)}%`;
}
function buildPhase2PatternContext(rangeDays) {
    const context = buildAiDataContext(rangeDays);
    const tracked = context.daily.filter((day) => day.tracked);
    const candidates = [];
    const doseWindowDates = new Set();
    context.daily.forEach((day) => {
        if (!day.doses.length)
            return;
        [0, 1, 2].forEach((offset) => doseWindowDates.add(phase2ShiftDate(day.date, offset)));
    });
    const doseWindowTracked = tracked.filter((day) => doseWindowDates.has(day.date));
    const otherTracked = tracked.filter((day) => !doseWindowDates.has(day.date));
    if (doseWindowTracked.length >= 2 && otherTracked.length >= 3) {
        const doseSymptomRate = doseWindowTracked.filter(phase2HasSymptoms).length / doseWindowTracked.length;
        const otherSymptomRate = otherTracked.filter(phase2HasSymptoms).length / otherTracked.length;
        const difference = doseSymptomRate - otherSymptomRate;
        if (Math.abs(difference) >= 0.15) {
            const directionEs = difference > 0 ? 'más frecuentes' : 'menos frecuentes';
            const directionEn = difference > 0 ? 'more frequent' : 'less frequent';
            candidates.push({
                key: 'dose-window-symptoms',
                titleEs: 'Ventana de dosis y síntomas',
                titleEn: 'Dose window and symptoms',
                detailEs: `En tus registros, los síntomas fueron ${directionEs} durante el día de la dosis y los 2 días siguientes.`,
                detailEn: `In your records, symptoms were ${directionEn} on the dose day and the following 2 days.`,
                evidenceEs: `${doseWindowTracked.filter(phase2HasSymptoms).length}/${doseWindowTracked.length} días en ventana de dosis vs ${otherTracked.filter(phase2HasSymptoms).length}/${otherTracked.length} otros días registrados (${phase2Pct(doseSymptomRate)} vs ${phase2Pct(otherSymptomRate)}).`,
                evidenceEn: `${doseWindowTracked.filter(phase2HasSymptoms).length}/${doseWindowTracked.length} dose-window days vs ${otherTracked.filter(phase2HasSymptoms).length}/${otherTracked.length} other tracked days (${phase2Pct(doseSymptomRate)} vs ${phase2Pct(otherSymptomRate)}).`,
                support: doseWindowTracked.length + otherTracked.length
            });
        }
    }
    const symptomDays = tracked.filter(phase2HasSymptoms);
    const symptomFreeDays = tracked.filter((day) => !phase2HasSymptoms(day));
    const symptomWater = phase2Average(symptomDays.map((day) => day.water));
    const symptomFreeWater = phase2Average(symptomFreeDays.map((day) => day.water));
    if (symptomDays.filter((day) => day.water !== null).length >= 2 && symptomFreeDays.filter((day) => day.water !== null).length >= 2 && symptomWater !== null && symptomFreeWater !== null && symptomFreeWater > 0) {
        const relative = (symptomWater - symptomFreeWater) / symptomFreeWater;
        if (Math.abs(relative) >= 0.1) {
            candidates.push({
                key: 'water-symptoms',
                titleEs: 'Hidratación registrada y síntomas',
                titleEn: 'Logged hydration and symptoms',
                detailEs: `El promedio de agua registrado fue ${relative < 0 ? 'menor' : 'mayor'} en los días con síntomas.`,
                detailEn: `Average logged water was ${relative < 0 ? 'lower' : 'higher'} on days with symptoms.`,
                evidenceEs: `${roundAiMetric(symptomWater, 0)} ${context.displayUnits.water} en días con síntomas vs ${roundAiMetric(symptomFreeWater, 0)} ${context.displayUnits.water} en días sin síntomas registrados.`,
                evidenceEn: `${roundAiMetric(symptomWater, 0)} ${context.displayUnits.water} on symptom days vs ${roundAiMetric(symptomFreeWater, 0)} ${context.displayUnits.water} on tracked symptom-free days.`,
                support: symptomDays.length + symptomFreeDays.length
            });
        }
    }
    const symptomProtein = phase2Average(symptomDays.map((day) => day.proteinG));
    const symptomFreeProtein = phase2Average(symptomFreeDays.map((day) => day.proteinG));
    if (symptomDays.filter((day) => day.proteinG !== null).length >= 2 && symptomFreeDays.filter((day) => day.proteinG !== null).length >= 2 && symptomProtein !== null && symptomFreeProtein !== null && symptomFreeProtein > 0) {
        const relative = (symptomProtein - symptomFreeProtein) / symptomFreeProtein;
        if (Math.abs(relative) >= 0.15) {
            candidates.push({
                key: 'protein-symptoms',
                titleEs: 'Proteína registrada y síntomas',
                titleEn: 'Logged protein and symptoms',
                detailEs: `El promedio de proteína registrado fue ${relative < 0 ? 'menor' : 'mayor'} en los días con síntomas.`,
                detailEn: `Average logged protein was ${relative < 0 ? 'lower' : 'higher'} on days with symptoms.`,
                evidenceEs: `${roundAiMetric(symptomProtein, 1)} g en días con síntomas vs ${roundAiMetric(symptomFreeProtein, 1)} g en días sin síntomas registrados.`,
                evidenceEn: `${roundAiMetric(symptomProtein, 1)} g on symptom days vs ${roundAiMetric(symptomFreeProtein, 1)} g on tracked symptom-free days.`,
                support: symptomDays.length + symptomFreeDays.length
            });
        }
    }
    if (context.weights.length >= 2 && context.summary.weightChange !== null) {
        const delta = context.summary.weightChange;
        candidates.push({
            key: 'weight-trend',
            titleEs: 'Tendencia de peso registrada',
            titleEn: 'Logged weight trend',
            detailEs: `El cambio entre el primer y último peso del periodo fue ${delta > 0 ? '+' : ''}${delta} ${context.displayUnits.weight}.`,
            detailEn: `The change between the first and last logged weight in the period was ${delta > 0 ? '+' : ''}${delta} ${context.displayUnits.weight}.`,
            evidenceEs: `${context.weights.length} registros de peso entre ${context.range.startDate} y ${context.range.endDate}.`,
            evidenceEn: `${context.weights.length} weight entries between ${context.range.startDate} and ${context.range.endDate}.`,
            support: context.weights.length
        });
    }
    candidates.sort((a, b) => b.support - a.support);
    return {
        generatedAt: context.generatedAt,
        range: context.range,
        displayUnits: context.displayUnits,
        activeMedication: context.activeMedication,
        coverage: context.coverage,
        summary: context.summary,
        candidates: candidates.slice(0, 5)
    };
}
function normalizePatternFinderResult(data) {
    return {
        headlineEs: String(data.headlineEs || '').trim(),
        headlineEn: String(data.headlineEn || '').trim(),
        summaryEs: String(data.summaryEs || '').trim(),
        summaryEn: String(data.summaryEn || '').trim(),
        patternsEs: String(data.patternsEs || '').trim(),
        patternsEn: String(data.patternsEn || '').trim(),
        cautionEs: String(data.cautionEs || '').trim(),
        cautionEn: String(data.cautionEn || '').trim(),
        coverageEs: String(data.coverageEs || '').trim(),
        coverageEn: String(data.coverageEn || '').trim()
    };
}
function normalizeVisitPrepResult(data) {
    return {
        summaryEs: String(data.summaryEs || '').trim(),
        summaryEn: String(data.summaryEn || '').trim(),
        highlightsEs: String(data.highlightsEs || '').trim(),
        highlightsEn: String(data.highlightsEn || '').trim(),
        discussionEs: String(data.discussionEs || '').trim(),
        discussionEn: String(data.discussionEn || '').trim(),
        gapsEs: String(data.gapsEs || '').trim(),
        gapsEn: String(data.gapsEn || '').trim(),
        coverageEs: String(data.coverageEs || '').trim(),
        coverageEn: String(data.coverageEn || '').trim()
    };
}
function renderPhase2BulletLines(targetId, value, icon, iconClass) {
    const target = document.getElementById(targetId);
    const lines = String(value || '')
        .split(/\n+/)
        .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 8);
    target.innerHTML = lines.length
        ? lines.map((line) => `<div class="flex gap-2 items-start"><i data-lucide="${icon}" class="w-3.5 h-3.5 ${iconClass} shrink-0 mt-0.5"></i><span>${escapeHtml(line)}</span></div>`).join('')
        : `<span class="text-slate-500">${escapeHtml(uiText('Sin elementos adicionales.', 'No additional items.'))}</span>`;
}
function renderPatternFinderResult() {
    const card = document.getElementById('pattern-ai-result-card');
    if (!lastPatternFinderResult) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');
    document.getElementById('pattern-ai-headline').innerText = isEnglish() ? lastPatternFinderResult.headlineEn : lastPatternFinderResult.headlineEs;
    document.getElementById('pattern-ai-summary').innerText = isEnglish() ? lastPatternFinderResult.summaryEn : lastPatternFinderResult.summaryEs;
    document.getElementById('pattern-ai-caution').innerText = isEnglish() ? lastPatternFinderResult.cautionEn : lastPatternFinderResult.cautionEs;
    document.getElementById('pattern-ai-coverage').innerText = isEnglish() ? lastPatternFinderResult.coverageEn : lastPatternFinderResult.coverageEs;
    renderPhase2BulletLines('pattern-ai-patterns', isEnglish() ? lastPatternFinderResult.patternsEn : lastPatternFinderResult.patternsEs, 'scan-search', 'text-emerald-300');
}
function renderPatternDeterministicPreview() {
    const range = Number(document.getElementById('pattern-ai-range').value || 30);
    const context = buildPhase2PatternContext(range);
    const preview = document.getElementById('pattern-ai-local-preview');
    preview.innerHTML = [
        `<div class="rounded-xl bg-[#111a2e] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(uiText('Candidatos locales', 'Local candidates'))}</span><p class="text-sm font-black text-emerald-300 mt-1">${context.candidates.length}</p></div>`,
        `<div class="rounded-xl bg-[#111a2e] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(uiText('Cobertura', 'Coverage'))}</span><p class="text-sm font-black text-cyan-300 mt-1">${context.coverage.trackedDays}/${context.range.days}</p></div>`
    ].join('');
}
function renderVisitDeterministicPreview() {
    const range = Number(document.getElementById('visit-ai-range').value || 30);
    const context = buildAiDataContext(range);
    const stats = document.getElementById('visit-ai-stats');
    const weight = context.summary.weightChange === null ? '--' : `${context.summary.weightChange > 0 ? '+' : ''}${context.summary.weightChange} ${context.displayUnits.weight}`;
    const water = context.summary.avgWater === null ? '--' : `${context.summary.avgWater} ${context.displayUnits.water}`;
    const protein = context.summary.avgProteinG === null ? '--' : `${context.summary.avgProteinG} g`;
    const items = [
        [uiText('Cambio peso', 'Weight change'), weight, 'text-cyan-300'],
        [uiText('Agua prom.', 'Avg. water'), water, 'text-cyan-300'],
        [uiText('Proteína prom.', 'Avg. protein'), protein, 'text-amber-300'],
        [uiText('Días síntomas', 'Symptom days'), String(context.summary.symptomDays), 'text-rose-300'],
        [uiText('Dosis', 'Doses'), String(context.summary.doseEntries), 'text-violet-300'],
        [uiText('Registrados', 'Tracked'), `${context.summary.trackedDays}/${context.range.days}`, 'text-emerald-300']
    ];
    stats.innerHTML = items.map(([label, value, color]) => `<div class="rounded-xl bg-[#111a2e] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(label)}</span><p class="text-xs font-black ${color} mt-1">${escapeHtml(value)}</p></div>`).join('');
}
function renderVisitPrepResult() {
    const card = document.getElementById('visit-ai-result-card');
    if (!lastVisitPrepResult) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');
    document.getElementById('visit-ai-summary').innerText = isEnglish() ? lastVisitPrepResult.summaryEn : lastVisitPrepResult.summaryEs;
    document.getElementById('visit-ai-coverage').innerText = isEnglish() ? lastVisitPrepResult.coverageEn : lastVisitPrepResult.coverageEs;
    renderPhase2BulletLines('visit-ai-highlights', isEnglish() ? lastVisitPrepResult.highlightsEn : lastVisitPrepResult.highlightsEs, 'database', 'text-cyan-300');
    renderPhase2BulletLines('visit-ai-discussion', isEnglish() ? lastVisitPrepResult.discussionEn : lastVisitPrepResult.discussionEs, 'messages-square', 'text-violet-300');
    renderPhase2BulletLines('visit-ai-gaps', isEnglish() ? lastVisitPrepResult.gapsEn : lastVisitPrepResult.gapsEs, 'info', 'text-amber-300');
}
function updateAiPhase2Language() {
    document.getElementById('pattern-ai-title').innerText = 'AI Pattern Finder';
    document.getElementById('pattern-ai-subtitle').innerText = uiText('Busca asociaciones repetidas en tus registros sin afirmar causa.', 'Looks for repeated associations in your records without claiming causation.');
    document.getElementById('pattern-ai-button-text').innerText = uiText('Buscar patrones', 'Find patterns');
    document.getElementById('pattern-ai-evidence-label').innerText = uiText('Asociaciones observadas', 'Observed associations');
    document.getElementById('visit-ai-title').innerText = uiText('Prepara tu visita', 'Prepare My Visit');
    document.getElementById('visit-ai-subtitle').innerText = uiText('Resume tus registros y organiza temas neutrales para conversar con tu profesional.', 'Summarizes your records and organizes neutral topics to discuss with your healthcare professional.');
    document.getElementById('visit-ai-button-text').innerText = uiText('Preparar resumen de visita', 'Prepare visit summary');
    document.getElementById('visit-ai-highlights-label').innerText = uiText('Datos destacados', 'Tracking highlights');
    document.getElementById('visit-ai-discussion-label').innerText = uiText('Temas para conversar', 'Topics to discuss');
    document.getElementById('visit-ai-gaps-label').innerText = uiText('Datos que faltan', 'Data gaps');
    document.getElementById('visit-ai-print-button-text').innerText = uiText('Imprimir reporte bilingüe', 'Print bilingual report');
    ['ai-data-range', 'pattern-ai-range', 'visit-ai-range'].forEach((id) => {
        const select = document.getElementById(id);
        Array.from(select.options).forEach((option) => {
            option.text = `${option.value} ${uiText('días', 'days')}`;
        });
    });
}
function renderAiPhase2View() {
    updateAiPhase2Language();
    renderPatternDeterministicPreview();
    renderVisitDeterministicPreview();
    renderPatternFinderResult();
    renderVisitPrepResult();
    lucide.createIcons();
    renderProgressTimelineView();
    renderProgressComparisonResult();
}
async function findAiPatterns() {
    if (typeof window.firebaseAiPatternFinder !== 'function') {
        showToast(uiText('AI Pattern Finder aún no está disponible.', 'AI Pattern Finder is not available yet.'));
        return;
    }
    const range = Number(document.getElementById('pattern-ai-range').value || 30);
    const context = buildPhase2PatternContext(range);
    if (context.coverage.trackedDays < 4 && context.coverage.weightEntries < 2 && context.coverage.doseEntries < 2) {
        showToast(uiText('No hay suficientes registros para buscar patrones todavía.', 'There are not enough records to look for patterns yet.'));
        return;
    }
    const historyFingerprint = createAiHistoryFingerprint({ type: 'pattern-finder', context });
    if (tryUseAiHistoryCache('pattern-finder', historyFingerprint))
        return;
    document.getElementById('pattern-ai-result-card').classList.add('hidden');
    try {
        const output = await runAiIntelligenceRequest((modelName) => window.firebaseAiPatternFinder({ contextJson: JSON.stringify(context), modelName }), 'pattern-ai-button-text');
        lastPatternFinderContext = context;
        lastPatternFinderResult = normalizePatternFinderResult(output);
        saveAiHistoryReport({
            type: 'pattern-finder',
            fingerprint: historyFingerprint,
            rangeDays: range,
            result: lastPatternFinderResult,
            context
        });
        renderPatternFinderResult();
        lucide.createIcons();
    }
    catch (error) {
        console.warn('AI Pattern Finder failed:', error);
        showAiIntelligenceError(error);
    }
}
async function prepareMyVisit() {
    if (typeof window.firebaseAiPrepareVisit !== 'function') {
        showToast(uiText('Prepare My Visit aún no está disponible.', 'Prepare My Visit is not available yet.'));
        return;
    }
    const range = Number(document.getElementById('visit-ai-range').value || 30);
    const context = buildAiDataContext(range);
    if (context.coverage.trackedDays === 0 && context.coverage.weightEntries === 0 && context.coverage.doseEntries === 0) {
        showToast(uiText('No hay suficientes registros para preparar la visita.', 'There are not enough records to prepare a visit summary.'));
        return;
    }
    const visitContext = {
        generatedAt: context.generatedAt,
        range: context.range,
        displayUnits: context.displayUnits,
        activeMedication: context.activeMedication,
        goals: context.goals,
        summary: context.summary,
        coverage: context.coverage,
        weights: context.weights,
        recentDaily: context.daily.slice(-Math.min(context.range.days, 30)),
        localPatternCandidates: buildPhase2PatternContext(range).candidates
    };
    const historyFingerprint = createAiHistoryFingerprint({ type: 'visit-prep', context: visitContext });
    if (tryUseAiHistoryCache('visit-prep', historyFingerprint))
        return;
    document.getElementById('visit-ai-result-card').classList.add('hidden');
    try {
        const output = await runAiIntelligenceRequest((modelName) => window.firebaseAiPrepareVisit({ contextJson: JSON.stringify(visitContext), modelName }), 'visit-ai-button-text');
        lastVisitPrepContext = context;
        lastVisitPrepResult = normalizeVisitPrepResult(output);
        saveAiHistoryReport({
            type: 'visit-prep',
            fingerprint: historyFingerprint,
            rangeDays: range,
            result: lastVisitPrepResult,
            context
        });
        renderVisitPrepResult();
        lucide.createIcons();
    }
    catch (error) {
        console.warn('Prepare My Visit failed:', error);
        showAiIntelligenceError(error);
    }
}
function phase2ReportList(value) {
    const lines = String(value || '').split(/\n+/).map((line) => line.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean).slice(0, 10);
    if (!lines.length)
        return '<p class="muted">—</p>';
    return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
}
function printVisitPrepReport() {
    if (!lastVisitPrepResult || !lastVisitPrepContext) {
        showToast(uiText('Genera primero el resumen de visita.', 'Generate the visit summary first.'));
        return;
    }
    const context = lastVisitPrepContext;
    const result = lastVisitPrepResult;
    const popup = window.open('', '_blank');
    if (!popup) {
        showToast(uiText('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo nuevamente.', 'The browser blocked the print window. Allow pop-ups and try again.'), 5200);
        return;
    }
    const generated = new Date(context.generatedAt).toLocaleString();
    const metric = (label, value) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    const weight = context.summary.weightChange === null ? '—' : `${context.summary.weightChange > 0 ? '+' : ''}${context.summary.weightChange} ${context.displayUnits.weight}`;
    const water = context.summary.avgWater === null ? '—' : `${context.summary.avgWater} ${context.displayUnits.water}`;
    const protein = context.summary.avgProteinG === null ? '—' : `${context.summary.avgProteinG} g`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GLP-1 Companion · Visit Prep</title><style>
    @page{size:Letter;margin:.45in}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:10.5pt;line-height:1.35}.sheet{max-width:8in;margin:0 auto}.header{border-bottom:3px solid #0ea5e9;padding-bottom:12px;margin-bottom:14px}.eyebrow{font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0369a1}.header h1{font-size:20pt;margin:3px 0}.meta{font-size:8.5pt;color:#64748b}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.metric{border:1px solid #cbd5e1;border-radius:8px;padding:8px}.metric span{display:block;font-size:7.5pt;text-transform:uppercase;color:#64748b}.metric strong{font-size:11pt}.section{margin:13px 0;break-inside:avoid}.section h2{font-size:11pt;margin:0 0 5px;color:#0f172a}.section h3{font-size:9pt;margin:8px 0 4px;color:#334155}.section p{margin:0}.section ul{margin:4px 0 0 18px;padding:0}.section li{margin:3px 0}.lang{border-left:3px solid #cbd5e1;padding-left:10px;margin:9px 0}.coverage{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px}.notice{font-size:8pt;color:#64748b;border-top:1px solid #e2e8f0;padding-top:9px;margin-top:16px}.muted{color:#94a3b8}@media print{button{display:none}}
  </style></head><body><div class="sheet"><div class="header"><div class="eyebrow">GLP-1 Companion · Prepare My Visit</div><h1>Reporte bilingüe / Bilingual Visit Report</h1><div class="meta">${escapeHtml(context.range.startDate)} → ${escapeHtml(context.range.endDate)} · ${escapeHtml(generated)} · ${escapeHtml(context.activeMedication.name)}</div></div>
  <div class="metrics">${metric('Weight change / Cambio peso', weight)}${metric('Avg. water / Agua prom.', water)}${metric('Avg. protein / Proteína prom.', protein)}${metric('Symptom days / Días síntomas', String(context.summary.symptomDays))}${metric('Doses / Dosis', String(context.summary.doseEntries))}${metric('Tracked / Registrados', `${context.summary.trackedDays}/${context.range.days}`)}</div>
  <div class="section"><h2>Resumen / Summary</h2><div class="lang"><h3>Español</h3><p>${escapeHtml(result.summaryEs)}</p></div><div class="lang"><h3>English</h3><p>${escapeHtml(result.summaryEn)}</p></div></div>
  <div class="section"><h2>Datos destacados / Tracking highlights</h2><div class="lang"><h3>Español</h3>${phase2ReportList(result.highlightsEs)}</div><div class="lang"><h3>English</h3>${phase2ReportList(result.highlightsEn)}</div></div>
  <div class="section"><h2>Temas para conversar / Topics to discuss</h2><div class="lang"><h3>Español</h3>${phase2ReportList(result.discussionEs)}</div><div class="lang"><h3>English</h3>${phase2ReportList(result.discussionEn)}</div></div>
  <div class="section"><h2>Datos que faltan / Data gaps</h2><div class="lang"><h3>Español</h3>${phase2ReportList(result.gapsEs)}</div><div class="lang"><h3>English</h3>${phase2ReportList(result.gapsEn)}</div></div>
  <div class="coverage"><strong>Cobertura / Coverage</strong><div class="lang"><p>${escapeHtml(result.coverageEs)}</p></div><div class="lang"><p>${escapeHtml(result.coverageEn)}</p></div></div>
  <div class="notice">Este reporte organiza registros personales y temas para conversación. No constituye diagnóstico, recomendación de tratamiento ni instrucción para cambiar una dosis. / This report organizes personal tracking records and discussion topics. It is not a diagnosis, treatment recommendation, or instruction to change a medication dose.</div>
  </div><script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),150)});<\/script></body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
}
const AI_HISTORY_CACHE_VERSION = 'v5.3.0-cache1';
const AI_HISTORY_FORCE_ONCE = new Set();
function aiHistoryCloneRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    return JSON.parse(JSON.stringify(value));
}
function aiHistoryComparable(value, key = '') {
    if (key === 'generatedAt')
        return undefined;
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => aiHistoryComparable(item)).filter((item) => item !== undefined);
    }
    const source = value;
    const out = {};
    Object.keys(source).sort().forEach((childKey) => {
        const normalized = aiHistoryComparable(source[childKey], childKey);
        if (normalized !== undefined)
            out[childKey] = normalized;
    });
    return out;
}
function aiHistoryHashText(input) {
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        a ^= code;
        a = Math.imul(a, 0x01000193) >>> 0;
        b ^= code + ((b << 6) >>> 0) + (b >>> 2);
        b = Math.imul(b, 0x85ebca6b) >>> 0;
    }
    return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
function createAiHistoryFingerprint(input) {
    const comparable = aiHistoryComparable(input);
    const serialized = `${AI_HISTORY_CACHE_VERSION}|${stableStringify(comparable)}`;
    return `aih_${aiHistoryHashText(serialized)}_${serialized.length}`;
}
function buildAiHistorySnapshot(context) {
    const source = aiHistoryCloneRecord(context);
    const snapshot = {};
    const keep = [
        'generatedAt', 'range', 'displayUnits', 'activeMedication', 'goals',
        'summary', 'coverage', 'currentWeek', 'previousWeek', 'candidates', 'comparison'
    ];
    keep.forEach((key) => {
        if (source[key] !== undefined)
            snapshot[key] = JSON.parse(JSON.stringify(source[key]));
    });
    return snapshot;
}
function aiHistoryResultObject(result) {
    const out = {};
    if (!result || typeof result !== 'object' || Array.isArray(result))
        return out;
    Object.entries(result).forEach(([key, value]) => {
        if (value === undefined || value === null)
            return;
        out[key] = String(value);
    });
    return out;
}
function aiHistoryRangeFromContext(context, rangeDays) {
    const source = aiHistoryCloneRecord(context);
    const range = source.range && typeof source.range === 'object' && !Array.isArray(source.range)
        ? source.range
        : {};
    const end = String(range.endDate || getFormattedDate(new Date()));
    let start = String(range.startDate || '');
    if (!start && rangeDays > 0) {
        const d = new Date(`${end}T12:00:00`);
        d.setDate(d.getDate() - Math.max(0, rangeDays - 1));
        start = getFormattedDate(d);
    }
    return { start, end };
}
function newAiHistoryId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return `air_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
    }
    return `air_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
function findAiHistoryCache(type, fingerprint) {
    ensureV4State();
    return state.aiHistory
        .filter((record) => record.type === type && !record.deletedAt && record.fingerprint === fingerprint)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}
function consumeAiHistoryForce(type) {
    if (!AI_HISTORY_FORCE_ONCE.has(type))
        return false;
    AI_HISTORY_FORCE_ONCE.delete(type);
    return true;
}
function tryUseAiHistoryCache(type, fingerprint) {
    if (consumeAiHistoryForce(type))
        return false;
    const cached = findAiHistoryCache(type, fingerprint);
    if (!cached)
        return false;
    applyAiHistoryRecord(cached, false);
    showToast(uiText('Se abrió un reporte idéntico del historial. No se usaron tokens de IA.', 'An identical report was opened from history. No AI tokens were used.'), 4600);
    return true;
}
function saveAiHistoryReport(input) {
    ensureV4State();
    const now = mutationNow();
    const range = aiHistoryRangeFromContext(input.context, input.rangeDays);
    const record = {
        id: newAiHistoryId(),
        type: input.type,
        createdAt: now,
        updatedAt: now,
        deletedAt: 0,
        favorite: false,
        fingerprint: input.fingerprint,
        rangeDays: Math.max(0, Math.floor(Number(input.rangeDays) || 0)),
        rangeStart: range.start,
        rangeEnd: range.end,
        requestText: String(input.requestText || '').trim().slice(0, 1200),
        result: aiHistoryResultObject(input.result),
        snapshot: buildAiHistorySnapshot(input.context),
        appVersion: APP_VERSION
    };
    state.aiHistory = [record, ...state.aiHistory];
    persistState({ userMutation: true, skipLocalSafetyBackup: true });
    renderAiHistoryView();
    renderProgressTimelineView();
    return record;
}
function aiHistoryTypeLabel(type) {
    if (type === 'ask-data')
        return uiText('Pregúntale a tus datos', 'Ask My Data');
    if (type === 'weekly-checkin')
        return 'Weekly AI Check-In';
    if (type === 'pattern-finder')
        return 'AI Pattern Finder';
    if (type === 'visit-prep')
        return uiText('Prepara tu visita', 'Prepare My Visit');
    return uiText('Comparación de progreso', 'Progress Comparison');
}
function aiHistoryTypeIcon(type) {
    if (type === 'ask-data')
        return 'messages-square';
    if (type === 'weekly-checkin')
        return 'calendar-heart';
    if (type === 'pattern-finder')
        return 'scan-search';
    if (type === 'visit-prep')
        return 'clipboard-plus';
    return 'arrow-left-right';
}
function aiHistoryPreview(record) {
    const r = record.result;
    if (record.type === 'ask-data')
        return isEnglish() ? String(r.answerEn || '') : String(r.answerEs || '');
    if (record.type === 'weekly-checkin')
        return isEnglish() ? String(r.summaryEn || r.headlineEn || '') : String(r.summaryEs || r.headlineEs || '');
    if (record.type === 'pattern-finder')
        return isEnglish() ? String(r.summaryEn || r.headlineEn || '') : String(r.summaryEs || r.headlineEs || '');
    return isEnglish() ? String(r.summaryEn || '') : String(r.summaryEs || '');
}
function aiHistoryLocalDateKey(timestamp) {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function aiHistoryDateLabel(timestamp) {
    return new Date(timestamp).toLocaleString(isEnglish() ? 'en-US' : 'es-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}
function renderAiHistoryView() {
    const list = document.getElementById('ai-history-list');
    if (!list)
        return;
    ensureV4State();
    const title = document.getElementById('ai-history-title');
    const subtitle = document.getElementById('ai-history-subtitle');
    const count = document.getElementById('ai-history-count');
    const syncNote = document.getElementById('ai-history-sync-note');
    const filter = document.getElementById('ai-history-filter');
    const dateFilter = document.getElementById('ai-history-date');
    const favorites = document.getElementById('ai-history-favorites');
    const favoritesLabel = document.getElementById('ai-history-favorites-label');
    const clearDate = document.getElementById('ai-history-clear-date-text');
    ['ask-data-history-text', 'weekly-ai-history-text', 'pattern-ai-history-text', 'visit-ai-history-text', 'progress-ai-history-text'].forEach((id) => {
        const el = document.getElementById(id);
        if (el)
            el.innerText = uiText('Ver historial', 'View history');
    });
    ['ask-data-regenerate-text', 'weekly-ai-regenerate-text', 'pattern-ai-regenerate-text', 'visit-ai-regenerate-text', 'progress-ai-regenerate-text'].forEach((id) => {
        const el = document.getElementById(id);
        if (el)
            el.innerText = uiText('Generar nuevo', 'Generate new');
    });
    if (title)
        title.innerText = uiText('Historial de IA', 'AI History');
    if (subtitle)
        subtitle.innerText = uiText('Reabre reportes bilingües sin volver a gastar tokens.', 'Reopen bilingual reports without spending AI tokens again.');
    if (syncNote)
        syncNote.innerText = uiText('Se guarda con los datos de la app y se sincroniza entre dispositivos cuando Firebase está disponible.', 'Saved with your app data and synced across devices when Firebase is available.');
    if (favoritesLabel)
        favoritesLabel.innerText = uiText('Solo favoritos', 'Favorites only');
    if (clearDate)
        clearDate.innerText = uiText('Quitar fecha', 'Clear date');
    if (filter) {
        const labels = {
            all: uiText('Todos los reportes', 'All reports'),
            'ask-data': uiText('Pregúntale a tus datos', 'Ask My Data'),
            'weekly-checkin': 'Weekly AI Check-In',
            'pattern-finder': 'AI Pattern Finder',
            'visit-prep': uiText('Prepara tu visita', 'Prepare My Visit'),
            'progress-comparison': uiText('Comparación de progreso', 'Progress Comparison')
        };
        Array.from(filter.options).forEach((option) => { option.text = labels[option.value] || option.text; });
    }
    const active = state.aiHistory.filter((record) => !record.deletedAt);
    let records = active.slice();
    const selectedType = filter?.value || 'all';
    const selectedDate = dateFilter?.value || '';
    if (selectedType !== 'all')
        records = records.filter((record) => record.type === selectedType);
    if (selectedDate)
        records = records.filter((record) => aiHistoryLocalDateKey(record.createdAt) === selectedDate);
    if (favorites?.checked)
        records = records.filter((record) => record.favorite);
    records.sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.createdAt - a.createdAt));
    if (count)
        count.innerText = `${active.length}`;
    if (!records.length) {
        list.innerHTML = `<div class="rounded-2xl border border-dashed border-[#2a3c5f] p-4 text-center text-[10px] text-slate-500">${escapeHtml(uiText('Todavía no hay reportes que coincidan con este filtro.', 'No saved reports match this filter yet.'))}</div>`;
        lucide.createIcons();
        return;
    }
    list.innerHTML = records.map((record) => {
        const preview = aiHistoryPreview(record).slice(0, 230);
        const request = record.requestText ? `<p class="text-[9px] text-slate-500 mt-1 line-clamp-2">${escapeHtml(record.requestText)}</p>` : '';
        const range = record.rangeDays ? `${record.rangeDays} ${uiText('días', 'days')}` : '';
        const favoriteIcon = record.favorite ? 'star' : 'star';
        const favoriteClass = record.favorite ? 'text-amber-300 border-amber-500/35 bg-amber-500/10' : 'text-slate-400 border-[#2a3c5f]';
        return `<div class="rounded-2xl bg-[#111a2e] border border-[#223455] p-3">
          <div class="flex items-start gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center shrink-0"><i data-lucide="${aiHistoryTypeIcon(record.type)}" class="w-3.5 h-3.5"></i></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2"><div><p class="text-[10px] font-black text-white">${escapeHtml(aiHistoryTypeLabel(record.type))}</p><p class="text-[8px] text-slate-500 mt-0.5">${escapeHtml(aiHistoryDateLabel(record.createdAt))}${range ? ` · ${escapeHtml(range)}` : ''} · ${escapeHtml(record.appVersion || '')}</p></div></div>
              ${request}
              <p class="text-[10px] text-slate-300 leading-relaxed mt-2">${escapeHtml(preview || uiText('Reporte guardado', 'Saved report'))}</p>
            </div>
          </div>
          <div class="flex gap-1.5 mt-3">
            <button type="button" onclick="openAiHistoryRecord('${record.id}')" class="flex-1 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/25 text-[9px] font-black text-violet-200">${escapeHtml(uiText('Abrir reporte', 'Open report'))}</button>
            <button type="button" onclick="toggleAiHistoryFavorite('${record.id}')" class="w-9 py-1.5 rounded-lg border ${favoriteClass} flex items-center justify-center" aria-label="favorite"><i data-lucide="${favoriteIcon}" class="w-3.5 h-3.5${record.favorite ? ' fill-current' : ''}"></i></button>
            <button type="button" onclick="deleteAiHistoryRecord('${record.id}')" class="w-9 py-1.5 rounded-lg border border-rose-500/25 text-rose-300 flex items-center justify-center" aria-label="delete"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}
function progressHistorySources() {
    ensureV4State();
    return state.aiHistory
        .filter((record) => !record.deletedAt && record.type !== 'progress-comparison')
        .sort((a, b) => b.createdAt - a.createdAt);
}
function progressSummaryForRecord(record) {
    const snapshot = record.snapshot || {};
    if (snapshot.summary && typeof snapshot.summary === 'object' && !Array.isArray(snapshot.summary)) {
        return snapshot.summary;
    }
    if (snapshot.currentWeek && typeof snapshot.currentWeek === 'object' && !Array.isArray(snapshot.currentWeek)) {
        const week = snapshot.currentWeek;
        return {
            avgWater: week.avgWater,
            avgProteinG: week.avgProteinG,
            weightChange: week.weightChange,
            symptomDays: week.symptomDays,
            trackedDays: week.trackedDays,
            doseEntries: week.doseCount
        };
    }
    return {};
}
function progressNumber(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function progressMetricDeltas(older, newer) {
    const oldSummary = progressSummaryForRecord(older);
    const newSummary = progressSummaryForRecord(newer);
    const units = newer.snapshot?.displayUnits && typeof newer.snapshot.displayUnits === 'object' && !Array.isArray(newer.snapshot.displayUnits)
        ? newer.snapshot.displayUnits : {};
    const defs = [
        ['weightChange', 'Cambio de peso', 'Weight change', String(units.weight || '')],
        ['avgWater', 'Agua promedio', 'Average water', String(units.water || '')],
        ['avgProteinG', 'Proteína promedio', 'Average protein', 'g'],
        ['symptomDays', 'Días con síntomas', 'Symptom days', ''],
        ['trackedDays', 'Días registrados', 'Tracked days', ''],
        ['doseEntries', 'Dosis registradas', 'Logged doses', '']
    ];
    return defs.map(([key, labelEs, labelEn, unit]) => {
        const oldValue = progressNumber(oldSummary[key]);
        const newValue = progressNumber(newSummary[key]);
        return {
            key, labelEs, labelEn, older: oldValue, newer: newValue,
            delta: oldValue === null || newValue === null ? null : roundAiMetric(newValue - oldValue, 1),
            unit
        };
    });
}
function buildProgressComparisonContext(older, newer) {
    const sameRange = older.rangeDays === newer.rangeDays;
    return {
        generatedAt: new Date().toISOString(),
        range: { startDate: newer.rangeStart, endDate: newer.rangeEnd, days: newer.rangeDays },
        older: { id: older.id, type: older.type, createdAt: older.createdAt, rangeStart: older.rangeStart, rangeEnd: older.rangeEnd, rangeDays: older.rangeDays },
        newer: { id: newer.id, type: newer.type, createdAt: newer.createdAt, rangeStart: newer.rangeStart, rangeEnd: newer.rangeEnd, rangeDays: newer.rangeDays },
        metrics: progressMetricDeltas(older, newer),
        coverageNoteEs: sameRange
            ? `Comparación entre dos reportes guardados de ${newer.rangeDays} días. Los cambios reflejan únicamente los datos registrados en cada periodo.`
            : 'Los periodos tienen duraciones diferentes; evita interpretar las diferencias como equivalentes.',
        coverageNoteEn: sameRange
            ? `Comparison between two saved ${newer.rangeDays}-day reports. Changes reflect only the data logged in each period.`
            : 'The periods have different lengths; avoid treating their differences as directly equivalent.'
    };
}
function progressRecordOption(record) {
    const range = record.rangeDays ? ` · ${record.rangeDays}${uiText('d', 'd')}` : '';
    return `${aiHistoryDateLabel(record.createdAt)} · ${aiHistoryTypeLabel(record.type)}${range}`;
}
function populateProgressComparisonSelectors() {
    const newerSelect = document.getElementById('progress-compare-newer');
    const olderSelect = document.getElementById('progress-compare-older');
    if (!newerSelect || !olderSelect)
        return;
    const records = progressHistorySources();
    const oldNewer = newerSelect.value;
    const oldOlder = olderSelect.value;
    newerSelect.innerHTML = records.map((record) => `<option value="${record.id}">${escapeHtml(progressRecordOption(record))}</option>`).join('');
    if (oldNewer && records.some((record) => record.id === oldNewer))
        newerSelect.value = oldNewer;
    const newer = records.find((record) => record.id === newerSelect.value) || records[0] || null;
    const olderCandidates = newer
        ? records.filter((record) => record.id !== newer.id && record.createdAt < newer.createdAt && record.rangeDays === newer.rangeDays)
        : [];
    olderSelect.innerHTML = olderCandidates.map((record) => `<option value="${record.id}">${escapeHtml(progressRecordOption(record))}</option>`).join('');
    if (oldOlder && olderCandidates.some((record) => record.id === oldOlder))
        olderSelect.value = oldOlder;
}
function renderProgressTimelineView() {
    const list = document.getElementById('progress-timeline-list');
    const empty = document.getElementById('progress-timeline-empty');
    if (!list)
        return;
    const subtitle = document.getElementById('progress-timeline-subtitle');
    const checkinTitle = document.getElementById('progress-last-checkin-title');
    const newerLabel = document.getElementById('progress-newer-label');
    const olderLabel = document.getElementById('progress-older-label');
    const buttonText = document.getElementById('progress-ai-button-text');
    const printText = document.getElementById('progress-print-text');
    const changesLabel = document.getElementById('progress-changes-label');
    const watchLabel = document.getElementById('progress-watch-label');
    const recentLabel = document.getElementById('progress-recent-label');
    const recentCount = document.getElementById('progress-recent-count-label');
    if (subtitle)
        subtitle.innerText = uiText('Compara reportes guardados y mira qué cambió sin volver a calcular tus datos.', 'Compare saved reports and see what changed without recalculating your data.');
    if (checkinTitle)
        checkinTitle.innerText = uiText('¿Qué cambió desde mi último check-in?', 'What Changed Since My Last Check-In?');
    if (newerLabel)
        newerLabel.innerText = uiText('Reporte más nuevo', 'Newer report');
    if (olderLabel)
        olderLabel.innerText = uiText('Reporte anterior comparable', 'Comparable older report');
    if (buttonText)
        buttonText.innerText = uiText('Explicar cambios con IA', 'Explain changes with AI');
    if (printText)
        printText.innerText = uiText('Imprimir', 'Print');
    if (changesLabel)
        changesLabel.innerText = uiText('Cambios observados', 'Observed changes');
    if (watchLabel)
        watchLabel.innerText = uiText('Para observar', 'What to watch');
    if (recentLabel)
        recentLabel.innerText = uiText('Timeline reciente', 'Recent timeline');
    if (recentCount)
        recentCount.innerText = uiText('últimos 12 reportes', 'latest 12 reports');
    if (empty)
        empty.innerText = uiText('Genera reportes de IA para construir tu timeline.', 'Generate AI reports to build your timeline.');
    const records = progressHistorySources().slice(0, 12);
    populateProgressComparisonSelectors();
    if (empty)
        empty.classList.toggle('hidden', records.length > 0);
    list.innerHTML = records.map((record, index) => {
        const active = index === 0 ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-[#223455] bg-[#111a2e]';
        return `<button type="button" onclick="openAiHistoryRecord('${record.id}')" class="w-full text-left rounded-xl border ${active} p-2.5 flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center shrink-0"><i data-lucide="${aiHistoryTypeIcon(record.type)}" class="w-3.5 h-3.5"></i></span>
          <span class="min-w-0 flex-1"><strong class="block text-[10px] text-slate-100 truncate">${escapeHtml(aiHistoryTypeLabel(record.type))}</strong><small class="block text-[8px] text-slate-500 mt-0.5">${escapeHtml(aiHistoryDateLabel(record.createdAt))} · ${record.rangeDays || 0} ${escapeHtml(uiText('días', 'days'))}</small></span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-600"></i>
        </button>`;
    }).join('');
    renderProgressComparisonPreview();
    renderLatestWeeklyChange();
    lucide.createIcons();
}
function onProgressNewerChanged() {
    const olderSelect = document.getElementById('progress-compare-older');
    if (olderSelect)
        olderSelect.value = '';
    populateProgressComparisonSelectors();
    renderProgressComparisonPreview();
}
function renderProgressComparisonPreview() {
    const card = document.getElementById('progress-compare-preview');
    const metricsEl = document.getElementById('progress-compare-metrics');
    const note = document.getElementById('progress-compare-note');
    const button = document.getElementById('progress-ai-button');
    if (!card || !metricsEl || !note)
        return;
    const newerId = document.getElementById('progress-compare-newer')?.value || '';
    const olderId = document.getElementById('progress-compare-older')?.value || '';
    const records = progressHistorySources();
    const newer = records.find((record) => record.id === newerId);
    const older = records.find((record) => record.id === olderId);
    if (!newer || !older) {
        card.classList.add('hidden');
        if (button)
            button.disabled = true;
        return;
    }
    if (button)
        button.disabled = false;
    card.classList.remove('hidden');
    const context = buildProgressComparisonContext(older, newer);
    lastProgressComparisonContext = context;
    metricsEl.innerHTML = context.metrics.map((metric) => {
        const label = isEnglish() ? metric.labelEn : metric.labelEs;
        const delta = metric.delta === null ? '--' : `${metric.delta > 0 ? '+' : ''}${metric.delta}${metric.unit ? ` ${metric.unit}` : ''}`;
        const newerValue = metric.newer === null ? '--' : `${metric.newer}${metric.unit ? ` ${metric.unit}` : ''}`;
        return `<div class="rounded-xl bg-[#090d16] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(label)}</span><p class="text-xs font-black text-cyan-300 mt-1">${escapeHtml(delta)}</p><p class="text-[8px] text-slate-500 mt-0.5">${escapeHtml(uiText('Nuevo', 'New'))}: ${escapeHtml(newerValue)}</p></div>`;
    }).join('');
    note.innerText = isEnglish() ? context.coverageNoteEn : context.coverageNoteEs;
}
function renderLatestWeeklyChange() {
    const target = document.getElementById('progress-last-checkin');
    if (!target)
        return;
    const weekly = progressHistorySources().filter((record) => record.type === 'weekly-checkin').slice(0, 2);
    if (weekly.length < 2) {
        target.innerText = uiText('Genera al menos dos Weekly AI Check-In para ver cambios automáticos entre semanas.', 'Generate at least two Weekly AI Check-Ins to see automatic week-to-week changes.');
        return;
    }
    const metrics = progressMetricDeltas(weekly[1], weekly[0]).filter((metric) => metric.delta !== null);
    target.innerHTML = metrics.slice(0, 4).map((metric) => {
        const label = isEnglish() ? metric.labelEn : metric.labelEs;
        const delta = metric.delta;
        return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#111a2e] border border-[#223455] text-[9px] text-slate-300"><strong>${escapeHtml(label)}</strong> ${escapeHtml(`${delta > 0 ? '+' : ''}${delta}${metric.unit ? ` ${metric.unit}` : ''}`)}</span>`;
    }).join(' ');
}
function normalizeProgressComparisonResult(data) {
    return {
        summaryEs: String(data.summaryEs || '').trim(), summaryEn: String(data.summaryEn || '').trim(),
        changesEs: String(data.changesEs || '').trim(), changesEn: String(data.changesEn || '').trim(),
        watchEs: String(data.watchEs || '').trim(), watchEn: String(data.watchEn || '').trim(),
        coverageEs: String(data.coverageEs || '').trim(), coverageEn: String(data.coverageEn || '').trim()
    };
}
function renderProgressComparisonResult() {
    const card = document.getElementById('progress-ai-result-card');
    if (!card)
        return;
    if (!lastProgressComparisonResult) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');
    const r = lastProgressComparisonResult;
    document.getElementById('progress-ai-summary').innerText = isEnglish() ? r.summaryEn : r.summaryEs;
    renderAiEvidenceLines('progress-ai-changes', isEnglish() ? r.changesEn : r.changesEs);
    renderAiEvidenceLines('progress-ai-watch', isEnglish() ? r.watchEn : r.watchEs);
    document.getElementById('progress-ai-coverage').innerText = isEnglish() ? r.coverageEn : r.coverageEs;
}
async function explainProgressComparison() {
    if (typeof window.firebaseAiProgressComparison !== 'function') {
        showToast(uiText('La explicación de progreso aún no está disponible.', 'Progress explanation is not available yet.'));
        return;
    }
    renderProgressComparisonPreview();
    const context = lastProgressComparisonContext;
    if (!context) {
        showToast(uiText('Selecciona dos reportes comparables primero.', 'Select two comparable reports first.'));
        return;
    }
    const fingerprint = createAiHistoryFingerprint({ type: 'progress-comparison', comparison: context });
    if (tryUseAiHistoryCache('progress-comparison', fingerprint))
        return;
    document.getElementById('progress-ai-result-card')?.classList.add('hidden');
    try {
        const output = await runAiIntelligenceRequest((modelName) => window.firebaseAiProgressComparison({ contextJson: JSON.stringify(context), modelName }), 'progress-ai-button-text');
        lastProgressComparisonResult = normalizeProgressComparisonResult(output);
        saveAiHistoryReport({
            type: 'progress-comparison', fingerprint, rangeDays: context.range.days,
            requestText: `${aiHistoryTypeLabel(context.older.type)} → ${aiHistoryTypeLabel(context.newer.type)}`,
            result: lastProgressComparisonResult,
            context: { generatedAt: context.generatedAt, range: context.range, comparison: context }
        });
        renderProgressComparisonResult();
        renderProgressTimelineView();
        lucide.createIcons();
    }
    catch (error) {
        console.warn('Progress comparison AI failed:', error);
        showAiIntelligenceError(error);
    }
}
function printProgressComparison() {
    if (!lastProgressComparisonContext) {
        showToast(uiText('Selecciona primero dos reportes para comparar.', 'Select two reports to compare first.'));
        return;
    }
    const popup = window.open('', '_blank');
    if (!popup) {
        showToast(uiText('El navegador bloqueó la ventana de impresión.', 'The browser blocked the print window.'));
        return;
    }
    const c = lastProgressComparisonContext;
    const result = lastProgressComparisonResult;
    const metricRows = c.metrics.map((m) => `<tr><td>${escapeHtml(isEnglish() ? m.labelEn : m.labelEs)}</td><td>${escapeHtml(m.older === null ? '—' : String(m.older))}</td><td>${escapeHtml(m.newer === null ? '—' : String(m.newer))}</td><td>${escapeHtml(m.delta === null ? '—' : `${m.delta > 0 ? '+' : ''}${m.delta} ${m.unit}`.trim())}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>GLP-1 Companion · Progress Comparison</title><style>@page{size:Letter;margin:.55in}body{font-family:Arial,sans-serif;color:#172033;font-size:10.5pt}h1{font-size:18pt}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #d9e0ea;padding:7px;text-align:left}.box{border:1px solid #d9e0ea;border-radius:10px;padding:12px;margin:10px 0;white-space:pre-line}.muted{color:#5b6778;font-size:9pt}</style></head><body><h1>GLP-1 Companion · ${escapeHtml(uiText('Comparación de progreso', 'Progress Comparison'))}</h1><p class="muted">${escapeHtml(aiHistoryDateLabel(c.older.createdAt))} → ${escapeHtml(aiHistoryDateLabel(c.newer.createdAt))}</p><table><thead><tr><th>${escapeHtml(uiText('Métrica', 'Metric'))}</th><th>${escapeHtml(uiText('Anterior', 'Older'))}</th><th>${escapeHtml(uiText('Nuevo', 'Newer'))}</th><th>${escapeHtml(uiText('Cambio', 'Change'))}</th></tr></thead><tbody>${metricRows}</tbody></table>${result ? `<div class="box"><strong>${escapeHtml(uiText('Explicación de IA', 'AI explanation'))}</strong><p>${escapeHtml(isEnglish() ? result.summaryEn : result.summaryEs)}</p></div>` : ''}<div class="box">${escapeHtml(isEnglish() ? c.coverageNoteEn : c.coverageNoteEs)}</div></body></html>`);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 250);
}
function renderVisitHistorySnapshotStats(record) {
    const stats = document.getElementById('visit-ai-stats');
    if (!stats)
        return;
    const snapshot = record.snapshot || {};
    const summary = snapshot.summary && typeof snapshot.summary === 'object' && !Array.isArray(snapshot.summary) ? snapshot.summary : {};
    const displayUnits = snapshot.displayUnits && typeof snapshot.displayUnits === 'object' && !Array.isArray(snapshot.displayUnits) ? snapshot.displayUnits : {};
    const range = snapshot.range && typeof snapshot.range === 'object' && !Array.isArray(snapshot.range) ? snapshot.range : {};
    const weightRaw = Number(summary.weightChange);
    const waterRaw = Number(summary.avgWater);
    const proteinRaw = Number(summary.avgProteinG);
    const weight = Number.isFinite(weightRaw) ? `${weightRaw > 0 ? '+' : ''}${weightRaw} ${String(displayUnits.weight || '')}`.trim() : '--';
    const water = Number.isFinite(waterRaw) ? `${waterRaw} ${String(displayUnits.water || '')}`.trim() : '--';
    const protein = Number.isFinite(proteinRaw) ? `${proteinRaw} g` : '--';
    const rangeDays = Number(range.days) || record.rangeDays;
    const items = [
        [uiText('Cambio peso', 'Weight change'), weight, 'text-cyan-300'],
        [uiText('Agua prom.', 'Avg. water'), water, 'text-cyan-300'],
        [uiText('Proteína prom.', 'Avg. protein'), protein, 'text-amber-300'],
        [uiText('Días síntomas', 'Symptom days'), String(Number(summary.symptomDays) || 0), 'text-rose-300'],
        [uiText('Dosis', 'Doses'), String(Number(summary.doseEntries) || 0), 'text-violet-300'],
        [uiText('Registrados', 'Tracked'), `${Number(summary.trackedDays) || 0}/${rangeDays || 0}`, 'text-emerald-300']
    ];
    stats.innerHTML = items.map(([label, value, color]) => `<div class="rounded-xl bg-[#111a2e] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(label)}</span><p class="text-xs font-black ${color} mt-1">${escapeHtml(value)}</p></div>`).join('');
}
function applyAiHistoryRecord(record, scroll = true) {
    if (record.deletedAt)
        return;
    if (record.type === 'ask-data') {
        lastAskMyDataResult = normalizeAskMyDataResult(record.result);
        const q = document.getElementById('ai-data-question');
        const range = document.getElementById('ai-data-range');
        if (q && record.requestText)
            q.value = record.requestText;
        if (range && record.rangeDays)
            range.value = String(record.rangeDays);
        renderAskMyDataResult();
    }
    else if (record.type === 'weekly-checkin') {
        lastWeeklyAiResult = normalizeWeeklyAiResult(record.result);
        renderWeeklyAiResult();
    }
    else if (record.type === 'pattern-finder') {
        lastPatternFinderResult = normalizePatternFinderResult(record.result);
        lastPatternFinderContext = record.snapshot;
        const range = document.getElementById('pattern-ai-range');
        if (range && record.rangeDays)
            range.value = String(record.rangeDays);
        renderPatternFinderResult();
    }
    else if (record.type === 'visit-prep') {
        lastVisitPrepResult = normalizeVisitPrepResult(record.result);
        lastVisitPrepContext = record.snapshot;
        const range = document.getElementById('visit-ai-range');
        if (range && record.rangeDays)
            range.value = String(record.rangeDays);
        renderVisitHistorySnapshotStats(record);
        renderVisitPrepResult();
    }
    else {
        lastProgressComparisonResult = normalizeProgressComparisonResult(record.result);
        const comparison = record.snapshot?.comparison;
        if (comparison && typeof comparison === 'object' && !Array.isArray(comparison)) {
            lastProgressComparisonContext = comparison;
            renderProgressTimelineView();
            const newer = document.getElementById('progress-compare-newer');
            const older = document.getElementById('progress-compare-older');
            const c = lastProgressComparisonContext;
            if (newer && c && Array.from(newer.options).some((option) => option.value === c.newer.id)) {
                newer.value = c.newer.id;
                populateProgressComparisonSelectors();
            }
            if (older && c && Array.from(older.options).some((option) => option.value === c.older.id))
                older.value = c.older.id;
            renderProgressComparisonPreview();
        }
        renderProgressComparisonResult();
    }
    lucide.createIcons();
    if (scroll) {
        const targetId = {
            'ask-data': 'ai-data-answer-card',
            'weekly-checkin': 'weekly-ai-result-card',
            'pattern-finder': 'pattern-ai-result-card',
            'visit-prep': 'visit-ai-result-card',
            'progress-comparison': 'progress-ai-result-card'
        };
        requestAnimationFrame(() => document.getElementById(targetId[record.type])?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
}
function openAiHistoryRecord(id, scroll = true) {
    ensureV4State();
    const record = state.aiHistory.find((item) => item.id === id && !item.deletedAt);
    if (!record) {
        showToast(uiText('Ese reporte ya no está disponible.', 'That report is no longer available.'));
        return;
    }
    if (activeTab !== 'intelligence')
        switchTab('intelligence');
    applyAiHistoryRecord(record, scroll);
}
function toggleAiHistoryFavorite(id) {
    ensureV4State();
    const record = state.aiHistory.find((item) => item.id === id && !item.deletedAt);
    if (!record)
        return;
    record.favorite = !record.favorite;
    record.updatedAt = mutationNow();
    persistState({ userMutation: true, skipLocalSafetyBackup: true });
    renderAiHistoryView();
    renderProgressTimelineView();
}
function deleteAiHistoryRecord(id) {
    ensureV4State();
    const record = state.aiHistory.find((item) => item.id === id && !item.deletedAt);
    if (!record)
        return;
    const ok = window.confirm(uiText('¿Eliminar este reporte del historial en todos tus dispositivos sincronizados?', 'Delete this report from history on all synced devices?'));
    if (!ok)
        return;
    const now = mutationNow();
    record.deletedAt = now;
    record.updatedAt = now;
    record.favorite = false;
    // Keep a compact tombstone so an older offline device cannot resurrect the report.
    record.requestText = '';
    record.result = {};
    record.snapshot = {};
    persistState({ userMutation: true, skipLocalSafetyBackup: true });
    renderAiHistoryView();
    renderProgressTimelineView();
}
function forceRegenerateAiReport(type) {
    AI_HISTORY_FORCE_ONCE.add(type);
    if (type === 'ask-data')
        void askMyData();
    else if (type === 'weekly-checkin')
        void generateWeeklyAiCheckIn();
    else if (type === 'pattern-finder')
        void findAiPatterns();
    else if (type === 'visit-prep')
        void prepareMyVisit();
    else
        void explainProgressComparison();
}
function scrollToAiHistory() {
    document.getElementById('ai-history-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function clearAiHistoryDateFilter() {
    const input = document.getElementById('ai-history-date');
    if (input)
        input.value = '';
    renderAiHistoryView();
}
