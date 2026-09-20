/**
 * GLP-1 Companion v5.2.0 — AI Intelligence Phase 2
 * AI Pattern Finder + Prepare My Visit.
 *
 * Phase 2 preserves the Phase 1 rule: the app calculates the evidence first,
 * then Firebase AI Logic explains only the supplied evidence. Associations are
 * never presented as causes, diagnoses, or medication recommendations.
 */

interface Phase2PatternCandidate {
  key: string;
  titleEs: string;
  titleEn: string;
  detailEs: string;
  detailEn: string;
  evidenceEs: string;
  evidenceEn: string;
  support: number;
}

interface Phase2PatternContext {
  generatedAt: string;
  range: AiDataContext['range'];
  displayUnits: AiDataContext['displayUnits'];
  activeMedication: AiDataContext['activeMedication'];
  coverage: AiDataCoverage;
  summary: AiDataContext['summary'];
  candidates: Phase2PatternCandidate[];
}

interface PatternFinderResult {
  headlineEs: string;
  headlineEn: string;
  summaryEs: string;
  summaryEn: string;
  patternsEs: string;
  patternsEn: string;
  cautionEs: string;
  cautionEn: string;
  coverageEs: string;
  coverageEn: string;
}

interface VisitPrepResult {
  summaryEs: string;
  summaryEn: string;
  highlightsEs: string;
  highlightsEn: string;
  discussionEs: string;
  discussionEn: string;
  gapsEs: string;
  gapsEn: string;
  coverageEs: string;
  coverageEn: string;
}

let lastPatternFinderResult: PatternFinderResult | null = null;
let lastPatternFinderContext: Phase2PatternContext | null = null;
let lastVisitPrepResult: VisitPrepResult | null = null;
let lastVisitPrepContext: AiDataContext | null = null;

function phase2HasSymptoms(day: AiDataDailySnapshot): boolean {
  return Object.keys(day.symptoms || {}).some((key) => key !== 'hunger');
}

function phase2Average(values: Array<number | null>): number | null {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function phase2ShiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getFormattedDate(date);
}

function phase2Pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildPhase2PatternContext(rangeDays: number): Phase2PatternContext {
  const context = buildAiDataContext(rangeDays);
  const tracked = context.daily.filter((day) => day.tracked);
  const candidates: Phase2PatternCandidate[] = [];

  const doseWindowDates = new Set<string>();
  context.daily.forEach((day) => {
    if (!day.doses.length) return;
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

function normalizePatternFinderResult(data: Record<string, unknown>): PatternFinderResult {
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

function normalizeVisitPrepResult(data: Record<string, unknown>): VisitPrepResult {
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

function renderPhase2BulletLines(targetId: string, value: string, icon: string, iconClass: string): void {
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

function renderPatternFinderResult(): void {
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

function renderPatternDeterministicPreview(): void {
  const range = Number(document.getElementById('pattern-ai-range').value || 30);
  const context = buildPhase2PatternContext(range);
  const preview = document.getElementById('pattern-ai-local-preview');
  preview.innerHTML = [
    `<div class="rounded-xl bg-[#111a2e] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(uiText('Candidatos locales', 'Local candidates'))}</span><p class="text-sm font-black text-emerald-300 mt-1">${context.candidates.length}</p></div>`,
    `<div class="rounded-xl bg-[#111a2e] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(uiText('Cobertura', 'Coverage'))}</span><p class="text-sm font-black text-cyan-300 mt-1">${context.coverage.trackedDays}/${context.range.days}</p></div>`
  ].join('');
}

function renderVisitDeterministicPreview(): void {
  const range = Number(document.getElementById('visit-ai-range').value || 30);
  const context = buildAiDataContext(range);
  const stats = document.getElementById('visit-ai-stats');
  const weight = context.summary.weightChange === null ? '--' : `${context.summary.weightChange > 0 ? '+' : ''}${context.summary.weightChange} ${context.displayUnits.weight}`;
  const water = context.summary.avgWater === null ? '--' : `${context.summary.avgWater} ${context.displayUnits.water}`;
  const protein = context.summary.avgProteinG === null ? '--' : `${context.summary.avgProteinG} g`;
  const items: Array<[string, string, string]> = [
    [uiText('Cambio peso', 'Weight change'), weight, 'text-cyan-300'],
    [uiText('Agua prom.', 'Avg. water'), water, 'text-cyan-300'],
    [uiText('Proteína prom.', 'Avg. protein'), protein, 'text-amber-300'],
    [uiText('Días síntomas', 'Symptom days'), String(context.summary.symptomDays), 'text-rose-300'],
    [uiText('Dosis', 'Doses'), String(context.summary.doseEntries), 'text-violet-300'],
    [uiText('Registrados', 'Tracked'), `${context.summary.trackedDays}/${context.range.days}`, 'text-emerald-300']
  ];
  stats.innerHTML = items.map(([label, value, color]) => `<div class="rounded-xl bg-[#111a2e] border border-[#223455] p-2.5"><span class="text-[8px] uppercase font-bold text-slate-500">${escapeHtml(label)}</span><p class="text-xs font-black ${color} mt-1">${escapeHtml(value)}</p></div>`).join('');
}

function renderVisitPrepResult(): void {
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

function updateAiPhase2Language(): void {
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

function renderAiPhase2View(): void {
  updateAiPhase2Language();
  renderPatternDeterministicPreview();
  renderVisitDeterministicPreview();
  renderPatternFinderResult();
  renderVisitPrepResult();
  lucide.createIcons();
}

async function findAiPatterns(): Promise<void> {
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

  document.getElementById('pattern-ai-result-card').classList.add('hidden');
  try {
    const output = await runAiIntelligenceRequest(
      (modelName) => window.firebaseAiPatternFinder!({ contextJson: JSON.stringify(context), modelName }),
      'pattern-ai-button-text'
    );
    lastPatternFinderContext = context;
    lastPatternFinderResult = normalizePatternFinderResult(output);
    renderPatternFinderResult();
    lucide.createIcons();
  } catch (error) {
    console.warn('AI Pattern Finder failed:', error);
    showAiIntelligenceError(error);
  }
}

async function prepareMyVisit(): Promise<void> {
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

  document.getElementById('visit-ai-result-card').classList.add('hidden');
  try {
    const output = await runAiIntelligenceRequest(
      (modelName) => window.firebaseAiPrepareVisit!({ contextJson: JSON.stringify(visitContext), modelName }),
      'visit-ai-button-text'
    );
    lastVisitPrepContext = context;
    lastVisitPrepResult = normalizeVisitPrepResult(output);
    renderVisitPrepResult();
    lucide.createIcons();
  } catch (error) {
    console.warn('Prepare My Visit failed:', error);
    showAiIntelligenceError(error);
  }
}

function phase2ReportList(value: string): string {
  const lines = String(value || '').split(/\n+/).map((line) => line.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean).slice(0, 10);
  if (!lines.length) return '<p class="muted">—</p>';
  return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
}

function printVisitPrepReport(): void {
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
  const metric = (label: string, value: string) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
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
