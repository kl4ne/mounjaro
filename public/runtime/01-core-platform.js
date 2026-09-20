"use strict";
/**
 * GLP-1 Companion v5.0 compatibility runtime
 * Versioning, translations, units and core platform helpers.
 *
 * PWA registration/update orchestration now lives in src/pwa/update-manager.js.
 * This classic runtime remains ordered to preserve the proven inline-handler
 * and shared-global contract during the v5 migration.
 */
/* ==========================================================================
   VERSION CONTROL, FIREBASE SYNC & SERVICE WORKER
   ========================================================================== */
const APP_VERSION = "v5.4.0";
const CLIENT_SCHEMA_VERSION = 14;
const MIN_SUPPORTED_CLIENT_VERSION = "v5.4.0";
const DEVELOPER_NAME = "Roberto S. Macfie";
const DEVELOPER_EMAIL = "rmacfie@hotmail.com";
window.GLP1_APP_VERSION = APP_VERSION;
window.GLP1_SCHEMA_VERSION = CLIENT_SCHEMA_VERSION;
const LAST_SYNC_KEY = "glp1_last_sync_at_v3_8";
const PRE_IMPORT_BACKUP_KEY = "glp1_pre_import_safety_backup_v3_8";
const CLOUD_SIZE_BACKUP_KEY = "glp1_cloud_size_safety_backup_v3_8";
const SERVER_CLOCK_KEY = "glp1_server_clock_anchor_v3_8";
const PRIVACY_LOCK_KEY = "glp1_privacy_lock_v412";
const MAX_FUTURE_MUTATION_SKEW_MS = 6 * 60 * 60 * 1000;
const PENDING_MUTATION_KEY = "glp1_pending_explicit_mutation_v3_8";
const PRE_CLOUD_REPLACE_BACKUP_KEY = "glp1_pre_cloud_replace_backup_v3_8";
const PRE_CLOUD_WRITE_BACKUP_KEY = "glp1_pre_cloud_write_backup_v3_8";
const CLOUD_SIZE_WARN_BYTES = 600 * 1024;
const CLOUD_SIZE_HARD_LIMIT_BYTES = 750 * 1024;
const LOCAL_SAFETY_BACKUP_PREFIX = "glp1_local_safety_v401_slot_";
const LOCAL_SAFETY_BACKUP_SLOTS = 3;
const SERVER_SAFETY_BACKUP_SLOTS = 3;
const LOCAL_SAFETY_BACKUP_CURSOR_KEY = "glp1_local_safety_v401_cursor";
const LOCAL_BACKUP_DB_NAME = "glp1_companion_safety_v406";
const LOCAL_BACKUP_DB_VERSION = 1;
function formatSyncTime(timestamp) {
    if (!timestamp)
        return "";
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    catch (_) {
        return "";
    }
}
function setSyncStatus(mode, timestamp = null) {
    const syncDot = document.getElementById('sync-dot');
    const syncText = document.getElementById('sync-text');
    if (!syncDot || !syncText)
        return;
    if (mode === 'syncing') {
        syncDot.className = "w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse";
        syncText.innerText = uiText("Sincronizando…", "Syncing…");
        return;
    }
    if (mode === 'waiting') {
        syncDot.className = "w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse";
        syncText.innerText = uiText("Esperando al servidor…", "Waiting for server…");
        return;
    }
    if (mode === 'update-required') {
        syncDot.className = "w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse";
        syncText.innerText = uiText("Actualización requerida", "Update required");
        return;
    }
    if (mode === 'error') {
        syncDot.className = "w-1.5 h-1.5 rounded-full bg-rose-400";
        syncText.innerText = uiText("Error de sincronización", "Sync error");
        return;
    }
    if (mode === 'synced') {
        const ts = timestamp || Date.now();
        localStorage.setItem(LAST_SYNC_KEY, String(ts));
        syncDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]";
        syncText.innerText = `${uiText("Sincronizado", "Synced")} · ${formatSyncTime(ts)}`;
        if (currentUser && currentUser.email)
            syncText.title = currentUser.email;
        return;
    }
    syncDot.className = "w-1.5 h-1.5 rounded-full bg-slate-500";
    syncText.innerText = uiText("Solo local", "Local only");
    syncText.removeAttribute('title');
}
// v5 Phase 4: Firebase is initialized by src/firebase/platform.js using
// the modern modular SDK before these compatibility runtime chunks load.
const firebasePlatform = window.firebasePlatform;
if (!firebasePlatform) {
    throw new Error('FIREBASE_MODULAR_PLATFORM_NOT_READY');
}
let currentUser = null;
let unsubscribeFirestore = null;
// v3.9 integrity safeguards (inherits v3.8 cloud-write protections).
// Reading/opening the app can NEVER create a cloud write. Only an explicit
// user mutation is allowed to create a pending Firestore write.
let hadLocalStateAtBoot = false;
let localDirtySinceBoot = false;
let pendingExplicitMutation = false;
let pendingMutationFromThisSession = false;
let cloudInitialReadComplete = false;
let cloudSyncDeferredUntilBootstrap = false;
let cloudWriteBlockedByVersion = false;
let serverClockAnchorMs = null;
let serverClockPerfAnchor = null;
let localMutationRevision = 0;
function hasPendingExplicitMutation() {
    return Boolean(pendingExplicitMutation || pendingMutationFromThisSession || (typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(PENDING_MUTATION_KEY))));
}
function loadPendingMutationFlag() {
    const stored = localStorage.getItem(PENDING_MUTATION_KEY);
    pendingExplicitMutation = Boolean(stored);
    localDirtySinceBoot = pendingExplicitMutation;
    pendingMutationFromThisSession = pendingExplicitMutation;
    localMutationRevision = Number(stored) || (pendingExplicitMutation ? 1 : 0);
}
function markExplicitMutationPending() {
    localMutationRevision++;
    pendingExplicitMutation = true;
    pendingMutationFromThisSession = true;
    localDirtySinceBoot = true;
    try {
        localStorage.setItem(PENDING_MUTATION_KEY, String(localMutationRevision));
    }
    catch (_) { }
}
function clearExplicitMutationPending(completedRevision) {
    if (typeof completedRevision === 'number' && localMutationRevision > completedRevision) {
        console.info(`Sync completed revision ${completedRevision}, but local mutation is ${localMutationRevision}. Retaining mutation pending.`);
        return;
    }
    pendingExplicitMutation = false;
    pendingMutationFromThisSession = false;
    localDirtySinceBoot = false;
    cloudSyncDeferredUntilBootstrap = false;
    try {
        localStorage.removeItem(PENDING_MUTATION_KEY);
    }
    catch (_) { }
}
function parseSemVer(v) {
    const parts = String(v || '').replace(/^[^\d]*/, '').split('.').map((n) => parseInt(n, 10) || 0);
    while (parts.length < 3)
        parts.push(0);
    return parts;
}
function compareSemVer(v1, v2) {
    const p1 = parseSemVer(v1);
    const p2 = parseSemVer(v2);
    for (let i = 0; i < 3; i++) {
        if (p1[i] > p2[i])
            return 1;
        if (p1[i] < p2[i])
            return -1;
    }
    return 0;
}
function versionNumber(value) {
    const p = parseSemVer(value);
    return p[0] * 10000 + p[1] * 100 + p[2];
}
function repairFutureMutationTimestamps(serverMs) {
    if (!state || !Number.isFinite(Number(serverMs)) || serverMs <= 0)
        return false;
    const ceiling = Number(serverMs) + MAX_FUTURE_MUTATION_SKEW_MS;
    let seq = 0, changed = false;
    const fix = (v) => {
        const n = Number(v) || 0;
        if (n > ceiling) {
            changed = true;
            seq += 1;
            return Number(serverMs) + seq;
        }
        return n;
    };
    ensureStateMetadata();
    state.meta.lastMutationAt = fix(state.meta.lastMutationAt);
    state.meta.resetAt = fix(state.meta.resetAt);
    state.meta.settingsUpdatedAt = fix(state.meta.settingsUpdatedAt);
    Object.keys(state.meta.settingsFieldUpdatedAt || {}).forEach((k) => { state.meta.settingsFieldUpdatedAt[k] = fix(state.meta.settingsFieldUpdatedAt[k]); });
    if (state.healthProfile)
        state.healthProfile.updatedAt = fix(state.healthProfile.updatedAt);
    Object.values(state.daysData || {}).forEach((day) => {
        if (!day || typeof day !== 'object')
            return;
        day.waterUpdatedAt = fix(day.waterUpdatedAt);
        day.symptomsUpdatedAt = fix(day.symptomsUpdatedAt);
        day.electrolytesUpdatedAt = fix(day.electrolytesUpdatedAt);
        day.bowelMovementsUpdatedAt = fix(day.bowelMovementsUpdatedAt);
        (day.meals || []).forEach((x) => {
            if (x)
                x.updatedAt = fix(x.updatedAt);
        });
        (day.waterEvents || []).forEach((x) => {
            if (x)
                x.updatedAt = fix(x.updatedAt);
        });
        (day.bowelMovementRecords || []).forEach((x) => {
            if (x)
                x.updatedAt = fix(x.updatedAt);
        });
    });
    (state.injections || []).forEach((x) => {
        if (x)
            x.updatedAt = fix(x.updatedAt);
    });
    (state.inventoryEvents || []).forEach((x) => {
        if (x)
            x.updatedAt = fix(x.updatedAt);
    });
    (state.weights || []).forEach((x) => {
        if (x)
            x.updatedAt = fix(x.updatedAt);
    });
    (state.measurements || []).forEach((x) => {
        if (x)
            x.updatedAt = fix(x.updatedAt);
    });
    Object.values(state.deletedRecords || {}).forEach((bucket) => {
        if (!bucket || typeof bucket !== 'object')
            return;
        Object.keys(bucket).forEach((k) => { bucket[k] = fix(bucket[k]); });
    });
    Object.values(state.settings?.roomTempTrackers || {}).forEach((t) => {
        if (t && typeof t === 'object')
            t.updatedAt = fix(t.updatedAt);
    });
    state.aiTelemetry = sanitizeAiTelemetry(state.aiTelemetry);
    Object.values(state.aiTelemetry || {}).forEach((month) => {
        month.updatedAt = fix(month.updatedAt);
        Object.values(month.devices || {}).forEach((device) => {
            device.updatedAt = fix(device.updatedAt);
            ['primary', 'fallback'].forEach((role) => {
                const st = device[role];
                if (!st)
                    return;
                st.lastSuccessAt = fix(st.lastSuccessAt);
                st.lastFailureAt = fix(st.lastFailureAt);
                st.lastEventAt = fix(st.lastEventAt);
            });
        });
    });
    if (changed) {
        ensureInventoryLedgerState();
        console.warn('Future mutation timestamps were normalized against the confirmed Firestore server clock.');
    }
    return changed;
}
function updateServerClockAnchor(cloud) {
    try {
        const ts = cloud && cloud._sync && cloud._sync.serverUpdatedAt;
        const tsRecord = ts && typeof ts === 'object' ? ts : null;
        const ms = tsRecord && typeof tsRecord.toMillis === 'function' ? tsRecord.toMillis() : (tsRecord && tsRecord.seconds ? Number(tsRecord.seconds) * 1000 : 0);
        if (Number.isFinite(ms) && ms > 0) {
            serverClockAnchorMs = ms;
            serverClockPerfAnchor = typeof performance !== 'undefined' ? performance.now() : null;
            localStorage.setItem(SERVER_CLOCK_KEY, JSON.stringify({ serverMs: ms, wallMs: Date.now() }));
            repairFutureMutationTimestamps(ms);
        }
    }
    catch (_) { }
}
function mutationNow() {
    let estimate = null;
    if (Number.isFinite(serverClockAnchorMs) && serverClockPerfAnchor !== null && typeof performance !== 'undefined') {
        estimate = Number(serverClockAnchorMs) + Math.max(0, performance.now() - Number(serverClockPerfAnchor));
    }
    else {
        try {
            const saved = JSON.parse(localStorage.getItem(SERVER_CLOCK_KEY) || 'null');
            if (saved && Number.isFinite(Number(saved.serverMs)) && Number.isFinite(Number(saved.wallMs))) {
                estimate = Number(saved.serverMs) + (Date.now() - Number(saved.wallMs));
            }
        }
        catch (_) { }
    }
    if (!Number.isFinite(estimate))
        estimate = Date.now();
    ensureStateMetadata();
    const previous = Number(state.meta.lastMutationAt) || 0;
    const next = Math.max(Math.round(Number(estimate)), previous + 1);
    state.meta.lastMutationAt = next;
    return next;
}
function generateDataEpoch(prefix = 'epoch') {
    try {
        if (crypto && typeof crypto.randomUUID === 'function')
            return `${prefix}_${crypto.randomUUID()}`;
    }
    catch (_) { }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
function estimateUtf8Bytes(value) {
    try {
        return new TextEncoder().encode(JSON.stringify(value)).length;
    }
    catch (_) {
        return JSON.stringify(value).length * 2;
    }
}
function renderHardeningUiLanguage() {
    const en = isEnglish();
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el)
            el.textContent = text;
    };
    if (window.glp1Pwa && typeof window.glp1Pwa.setLanguage === 'function') {
        window.glp1Pwa.setLanguage(en);
    }
    set('privacy-lock-title', en ? 'Data protected' : 'Datos protegidos');
    set('privacy-lock-text', en ? 'You signed out. Your local data is still saved on this device, but it is hidden to protect your privacy.' : 'Cerraste sesión. Tus datos locales siguen guardados en este dispositivo, pero están ocultos para proteger tu privacidad.');
    set('privacy-lock-signin', en ? 'Sign in to unlock' : 'Iniciar sesión para desbloquear');
}
function applyWaitingServiceWorker() {
    if (window.glp1Pwa && typeof window.glp1Pwa.applyUpdateNow === 'function') {
        return window.glp1Pwa.applyUpdateNow();
    }
    return false;
}
function showCompletedPwaUpdateToastIfNeeded() {
    if (window.glp1Pwa && typeof window.glp1Pwa.showCompletedUpdateToast === 'function') {
        return window.glp1Pwa.showCompletedUpdateToast({
            version: APP_VERSION,
            isEnglish: isEnglish(),
            showToast
        });
    }
    return false;
}
function setPrivacyLock(uid) {
    try {
        localStorage.setItem(PRIVACY_LOCK_KEY, JSON.stringify({ ownerUid: String(uid || ''), lockedAt: Date.now() }));
    }
    catch (_) { }
}
function getPrivacyLock() {
    try {
        const v = JSON.parse(localStorage.getItem(PRIVACY_LOCK_KEY) || 'null');
        return v && typeof v === 'object' ? v : null;
    }
    catch (_) {
        return null;
    }
}
function clearPrivacyLock() {
    try {
        localStorage.removeItem(PRIVACY_LOCK_KEY);
    }
    catch (_) { }
}
function renderPrivacyLock() {
    // v4.1.3+ behavior: Sign Out leaves the app usable in local-only mode.
    clearPrivacyLock();
    const overlay = document.getElementById('privacy-lock-overlay');
    if (!overlay)
        return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
}
function runtimeErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (error && typeof error === 'object' && !Array.isArray(error)) {
        const value = error.message;
        if (typeof value === 'string')
            return value;
    }
    return String(error ?? '');
}
function runtimeErrorCode(error) {
    if (error && typeof error === 'object' && !Array.isArray(error)) {
        const value = error.code;
        return typeof value === 'string' ? value : '';
    }
    return '';
}
function runtimeErrorName(error) {
    if (error instanceof Error)
        return error.name;
    if (error && typeof error === 'object' && !Array.isArray(error)) {
        const value = error.name;
        return typeof value === 'string' ? value : '';
    }
    return '';
}
function escapeHtml(str) {
    if (str === null || str === undefined)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
const STATIC_TRANSLATIONS = {
    "Salud metabólica": "Metabolic health",
    "Reporte clínico de evolución GLP-1": "GLP-1 clinical progress report",
    "Registro consolidado para consulta médica": "Consolidated record for medical visit",
    "Fecha: --": "Date: --",
    "Local storage": "Local storage",
    "Sign in": "Sign in",
    "Hoy": "Today",
    "Alerta preventiva de evacuación (>48h)": "Preventive bowel movement alert (>48h)",
    "Han pasado más de 48 h desde el último registro. Revisa hidratación, movimiento y tu plan de cuidado habitual.": "Slow bowel transit detected. Review hydration and your usual care plan.",
    "Evacuó hoy": "Bowel movement today",
    "Desliza para actualizar": "Pull to refresh",
    "Próxima inyección": "Next injection",
    "Calculando...": "Calculating...",
    "Rotación sugerida: Abdomen derecho": "Suggested rotation: Right abdomen",
    "Recordatorio": "Reminder",
    "Calculando titulación...": "Calculating titration...",
    "Nivel estimado del medicamento:": "Estimated medication level:",
    "Balance diario": "Daily balance",
    "Calorías y déficit neto": "Calories and net deficit",
    "Déficit óptimo": "Optimal deficit",
    "Consumidas": "Consumed",
    "Meta": "Goal",
    "Déficit TDEE": "TDEE deficit",
    "Progreso de ingesta calórica": "Calorie intake progress",
    "Proteína diaria (Crítica)": "Daily protein (Priority)",
    "Preserva masa muscular magra y previene flacidez": "Supports lean muscle preservation",
    "Carbohidratos:": "Carbohydrates:",
    "Grasas totales:": "Total fat:",
    "Hidratación (Agua pura)": "Hydration (Plain water)",
    "Previene náuseas, dolor de cabeza y sequedad": "Supports hydration during GLP-1 treatment",
    "Guía visual de hidratación (color de orina):": "Visual hydration guide (urine color):",
    "Ver escala": "View scale",
    "Pálido / Casi transparente:": "Pale / Almost clear:",
    "Generalmente compatible con buena hidratación.": "Generally consistent with good hydration.",
    "Amarillo oscuro / Ámbar:": "Dark yellow / Amber:",
    "Puede ser una señal para prestar más atención a la hidratación.": "May indicate a need to pay attention to hydration.",
    "Resumen semanal": "Weekly summary",
    "Tus últimos 7 días": "Your last 7 days",
    "Peso 7d": "7d weight",
    "Agua prom.": "Avg. water",
    "Proteína prom.": "Avg. protein",
    "Días registrados": "Tracked days",
    "Con síntomas": "With symptoms",
    "Dosis": "Doses",
    "Se actualiza automáticamente con tus registros.": "Updates automatically from your records.",
    "Esta semana vs. semana anterior": "This week vs. previous week",
    "Comparación automática": "Automatic comparison",
    "Registro de alimentos": "Food log",
    "Analizador visual con IA o entrada manual": "AI visual analyzer or manual entry",
    "+ Manual": "+ Manual",
    "Analizar plato": "Analyze meal",
    "Control de inyecciones": "Injection tracking",
    "Seguimiento de tratamiento": "Treatment tracking",
    "Medicamento y salud": "Medication & health",
    "Seguimiento de dosis, nivel estimado, almacenamiento e inventario.": "Dose tracking, estimated level, storage and inventory.",
    "Configuración": "Settings",
    "Preferencias de la app": "App preferences",
    "Medicamento y presentación": "Medication and presentation",
    "Metas diarias": "Daily goals",
    "Progreso corporal": "Body progress",
    "Peso y métricas corporales": "Weight & body metrics",
    "Tendencias, composición, medidas y metas en un solo lugar.": "Trends, composition, measurements and goals in one place.",
    "Ciclo semanal y rotación de sitios": "Weekly cycle and injection-site rotation",
    "+ Registrar dosis": "+ Log dose",
    "Última dosis administrada:": "Last administered dose:",
    "Fecha de aplicación:": "Injection date:",
    "Sitio utilizado:": "Site used:",
    "Zonas de aplicación recomendadas": "Common injection areas",
    "Abdomen": "Abdomen",
    "Muslo": "Thigh",
    "Brazo": "Arm",
    "Zona frontal/alta": "Front/upper area",
    "Tríceps posterior": "Back of upper arm",
    "Pluma en uso": "Pen in use",
    "Días restantes:": "Days remaining:",
    "Iniciar hoy": "Start today",
    "Inventario de plumas": "Pen inventory",
    "Pedir resurtido": "Refill soon",
    "Plumas de repuesto guardadas en refrigeración.": "Spare pens stored refrigerated.",
    "Tránsito intestinal (Seguridad gástrica)": "Bowel transit tracking",
    "Monitoreo obligatorio para evitar impacto intestinal": "Track bowel movements alongside your other GLP-1 records",
    "Promedio 30 días": "30-day average",
    "Evacuaciones 7 días": "Bowel movements 7d",
    "Estadística descriptiva basada únicamente en tus registros.": "Descriptive statistics based only on your records.",
    "Síntomas y tolerancia digestiva": "Symptoms and digestive tolerance",
    "Monitorea efectos secundarios para tu consulta médica": "Track symptoms for your medical visit",
    "Guardar": "Save",
    "Correlación clínica detectada": "Recorded pattern detected",
    "Náuseas:": "Nausea:",
    "Ninguna": "None",
    "Leve (tolerable)": "Mild (tolerable)",
    "Fuerte": "Severe",
    "Acidez / Reflujo:": "Heartburn / Reflux:",
    "Leve": "Mild",
    "Eructos de azufre (*sulfur*):": "Sulfur burps:",
    "Ninguno": "None",
    "Leves ocasionales": "Occasional mild",
    "Frecuentes (revisar grasa)": "Frequent (review high-fat meals)",
    "Fatiga / Nivel de energía:": "Fatigue / Energy level:",
    "Normal": "Normal",
    "Cansancio leve": "Mild tiredness",
    "Fatiga notable": "Noticeable fatigue",
    "Mucha debilidad": "Significant weakness",
    "Notas o preguntas para el médico:": "Notes or questions for your clinician:",
    "Respuesta a la dosis": "Dose response",
    "Ventanas aproximadas de 0–24 h, 24–48 h y 48–72 h según tus registros diarios": "Approximate 0–24h, 24–48h and 48–72h windows from your daily records",
    "La hora exacta se usa para el cálculo PK. Estas ventanas de tolerancia agrupan registros por el día de la dosis y los dos días siguientes; son aproximadas y no representan un diagnóstico.": "Exact time is used for the PK calculation. These tolerance windows group records by dose day and the following two days; they are approximate and are not a diagnosis.",
    "Patrones de tolerancia": "Tolerance patterns",
    "Asociaciones observadas en tus últimos 30 días de alimentos, hidratación, dosis y síntomas": "Associations observed in your last 30 days of food, hydration, dose and symptom records",
    "La app identifica coincidencias en tus registros; no determina causa ni diagnóstico.": "The app identifies coincidences in your records; it does not determine cause or diagnosis.",
    "Historial de inyecciones": "Injection history",
    "Inicial": "Start",
    "Actual": "Current",
    "Total perdido": "Total lost",
    "Proyección de peso meta": "Goal-weight projection",
    "Calculando proyección metabólica...": "Calculating projection...",
    "Basado en el ritmo promedio de pérdida de peso de las últimas semanas.": "Based on the average weight trend from recent weeks.",
    "Control y curva de peso (lbs)": "Weight tracking and trend (lbs)",
    "Incluye media móvil (7 días) para filtrar retención de agua": "Includes a 7-day moving average",
    "+ Anotar peso": "+ Log weight",
    "Historial de pesajes registrados:": "Weight history:",
    "Medidas corporales (*Non-Scale Victories*)": "Body measurements (Non-Scale Victories)",
    "Pérdida de grasa visceral en pulgadas (cintura, pecho, cadera, cuello)": "Measurements in inches (waist, chest, hips, neck)",
    "+ Medidas": "+ Measurements",
    "Cronómetro de ritmo (20 min)": "Meal pacing timer (20 min)",
    "Campanillas a los 10 y 20 min para pausar y evaluar saciedad": "Cues at 10 and 20 minutes to pause and check fullness",
    "Iniciar al comer": "Start when eating",
    "Reiniciar": "Reset",
    "Ventana de ayuno matutino": "Fasting window",
    "Ideal si saltas el desayuno y comes en almuerzo y cena": "Optional timer for your personal fasting schedule",
    "En ayuno": "Fasting",
    "Tiempo acumulado de ayuno": "Elapsed fasting time",
    "Iniciar ayuno": "Start fast",
    "Reporte clínico médico": "Medical visit report",
    "Reportes y consulta": "Reports & visits",
    "Resumen en texto para pegar en Notes": "Text summary ready to paste into Notes",
    "Reporte listo para imprimir o guardar": "Report ready to print or save",
    "Enviar peso actual mediante tu atajo": "Send current weight through your shortcut",
    "Resumen configurable para tu próxima cita": "Configurable summary for your next visit",
    "Formatos para consulta médica, Apple Notes o impresión directa en PDF": "Formats for medical visits, Notes, or PDF printing",
    "Copiar para Notes": "Copy for Notes",
    "Imprimir / PDF": "Print / PDF",
    "Preparar mi cita": "Prepare my visit",
    "Metas y cálculo metabólico": "Goals and metabolic settings",
    "Idioma de la aplicación:": "App language:",
    "La interfaz puede usarse en español o inglés. El reporte para la cita puede elegirse por separado.": "Use the app in Spanish or English. Visit reports can use a separate language.",
    "Medicamento activo:": "Active medication:",
    "Presentación:": "Presentation:",
    "La presentación determina las reglas correctas de almacenamiento e inventario.": "Presentation determines the correct storage and inventory rules.",
    "Peso objetivo / Meta (lbs):": "Goal weight (lbs):",
    "Meta calorías (kcal):": "Calorie goal (kcal):",
    "Gasto total (TDEE):": "Total expenditure (TDEE):",
    "Meta proteína (g):": "Protein goal (g):",
    "Meta agua (oz):": "Water goal (oz):",
    "Guardar configuración": "Save settings",
    "Clave de API Gemini": "Gemini API key",
    "Almacenamiento local en este dispositivo — no se sincroniza ni se incluye en backups.": "Stored locally on this device — not synced or included in backups.",
    "Copia de seguridad local (Backup)": "Local backup",
    "Descarga un archivo `.json` con todos tus pesajes, dosis e historial, o impórtalo en otro teléfono.": "Download a `.json` file with your records or import it on another device.",
    "Exportar JSON": "Export JSON",
    "Importar JSON": "Import JSON",
    "Reiniciar todos los datos": "Reset all data",
    "Panel y diario": "Dashboard & daily log",
    "Resumen de hoy": "Today’s overview",
    "Tu salud, de un vistazo": "Your health at a glance",
    "Medicación, nutrición, hidratación y tendencias en un solo panel.": "Medication, nutrition, hydration, and trends in one dashboard.",
    "Bilingüe": "Bilingual",
    "Mounjaro y salud": "Medication & health",
    "Progreso y herramientas": "Progress & tools",
    "Analizador de comidas con IA": "AI meal analyzer",
    "Tomar foto o subir imagen del plato": "Take or upload a meal photo",
    "Calcula porción, calorías, grasa y tolerancia digestiva": "Estimate portion, calories, macros and digestive tolerance",
    "Descripción o detalles del plato (opcional):": "Meal description or details (optional):",
    "Asignar a:": "Assign to:",
    "Almuerzo": "Lunch",
    "Cena": "Dinner",
    "Merienda": "Snack",
    "Desayuno": "Breakfast",
    "Analizar nutrientes y tolerancia gástrica": "Analyze nutrition and tolerance",
    "Análisis listo (Ajustable)": "Analysis ready (Editable)",
    "Verifica antes de guardar": "Review before saving",
    "Nombre del plato:": "Meal name:",
    "Calorías": "Calories",
    "Proteína": "Protein",
    "Carbos": "Carbs",
    "Grasas": "Fat",
    "Advertencia digestiva:": "Digestive note:",
    "Guardar en mi registro del día": "Save to today's log",
    "Añadir comida manual": "Add meal manually",
    "Nombre o descripción:": "Name or description:",
    "Momento:": "Meal time:",
    "Calorías (kcal):": "Calories (kcal):",
    "Proteína (g):": "Protein (g):",
    "Carbos (g):": "Carbs (g):",
    "Grasas (g):": "Fat (g):",
    "Guardar comida": "Save meal",
    "Registrar dosis": "Log dose",
    "Fecha de inyección:": "Injection date:",
    "Dosis aplicada:": "Dose:",
    "Sitio anatómico de inyección:": "Injection site:",
    "Abdomen derecho": "Right abdomen",
    "Abdomen izquierdo": "Left abdomen",
    "Muslo frontal derecho": "Right front thigh",
    "Muslo frontal izquierdo": "Left front thigh",
    "Brazo derecho (tríceps)": "Right upper arm",
    "Brazo izquierdo (tríceps)": "Left upper arm",
    "Observaciones:": "Notes:",
    "Confirmar aplicación": "Confirm injection",
    "Registrar peso en libras": "Log weight in pounds",
    "Fecha:": "Date:",
    "Peso en libras (lbs):": "Weight in pounds (lbs):",
    "Guardar pesaje": "Save weight",
    "Anotar medidas corporales (Pulgadas)": "Log body measurements (inches)",
    "Cintura (in):": "Waist (in):",
    "Pecho (in):": "Chest (in):",
    "Cadera (in):": "Hips (in):",
    "Cuello (in):": "Neck (in):",
    "Guardar medidas": "Save measurements",
    "Guía rápida de alivio (SOS)": "Quick support guide (SOS)",
    "Protocolos inmediatos para efectos secundarios digestivos": "General self-care reminders for digestive symptoms",
    "Cerrar guía": "Close guide",
    "Detalle de dosis y tolerancia": "Dose and tolerance details",
    "Resumen de tus registros para conversar con tu profesional de salud": "Summary of your records for your healthcare visit",
    "Periodo del resumen": "Summary period",
    "Últimos 30 días": "Last 30 days",
    "Últimos 90 días": "Last 90 days",
    "Desde el inicio": "Since the beginning",
    "Idioma del reporte": "Report language",
    "Este resumen organiza los datos que registraste. No diagnostica ni modifica tu tratamiento.": "This summary organizes your recorded data. It does not diagnose or change treatment.",
    "Copiar": "Copy",
    "Apple Health Shortcuts": "Apple Health Shortcuts",
    "Ejecuta un atajo de iOS para registrar tu peso actual en Apple Health con un solo toque.": "Run an iOS Shortcut to log your current weight in Apple Health.",
    "Peso actual para exportar:": "Current weight to export:",
    "Abrir atajo en iOS": "Open iOS Shortcut",
    "¿Reiniciar todos los datos?": "Reset all data?",
    "Se eliminarán definitivamente los registros de comidas, inyecciones, agua y pesajes tanto de este dispositivo como de Firestore.": "Food, injection, water and weight records will be permanently removed from this device and Firestore.",
    "Cancelar": "Cancel",
    "Sí, borrar todo": "Yes, delete everything",
    "Notificación": "Notification",
    "4 unidades": "4 units",
    "GLP-1 Companion • Salud metabólica": "GLP-1 Companion • Metabolic health",
    "Versión: v5.4.0": "Version: v5.4.0",
    "Acerca de GLP-1 Companion": "About GLP-1 Companion",
    "© 2026 Roberto S. Macfie. Todos los derechos reservados.": "© 2026 Roberto S. Macfie. All rights reserved.",
    "Gemini mediante Firebase AI Logic": "Gemini through Firebase AI Logic",
    "Gemini 3.5 Flash se conecta mediante Firebase AI Logic y App Check. No necesitas guardar una API key de Gemini en este dispositivo.": "Gemini 3.5 Flash connects through Firebase AI Logic and App Check. You do not need to store a Gemini API key on this device.",
    "AI Status · Firebase AI Logic": "AI Status · Firebase AI Logic",
    "Estadísticas del mes actual": "Current-month statistics",
    "IA principal · Gemini 3.5 Flash": "Primary AI · Gemini 3.5 Flash",
    "IA respaldo · Gemini 3.5 Flash Lite": "Fallback AI · Gemini 3.5 Flash Lite",
    "Usos": "Uses",
    "Éxitos": "Successes",
    "Fallos": "Failures",
    "Éxito": "Success rate",
    "Último uso: --": "Last use: --",
    "Sin comprobar": "Unchecked",
    "El estado refleja solicitudes reales; la app no hace llamadas automáticas solo para comprobar disponibilidad. El respaldo se usa únicamente ante errores recuperables de la IA principal; si el problema es conexión, App Check, autenticación o permisos, pasa directo a captura manual.": "Status reflects real requests; the app does not make automatic calls just to check availability. Fallback is used only for recoverable primary-AI errors; connection, App Check, authentication, or permission problems go directly to manual entry.",
    "Nivel estimado de medicamento (PK)": "Estimated medication level (PK)",
    "Activo estimado": "Estimated active",
    "Relativo estable": "Steady-state relative",
    "Desde última dosis": "Since last dose",
    "Estimación educativa de dosis-equivalente activa; no representa una concentración sanguínea medida.": "Educational active dose-equivalent estimate; it is not a measured blood concentration.",
    "Perfil para métricas corporales": "Profile for body metrics",
    "Sexo para fórmulas:": "Sex for formulas:",
    "Seleccionar": "Select",
    "Femenino": "Female",
    "Masculino": "Male",
    "Fecha de nacimiento:": "Date of birth:",
    "Edad: --": "Age: --",
    "Altura (in):": "Height (in):",
    "Actividad:": "Activity:",
    "Sedentaria": "Sedentary",
    "Ligera": "Light",
    "Moderada": "Moderate",
    "Activa": "Active",
    "Muy activa": "Very active",
    "Guardar Health Profile": "Save Health Profile",
    "Ver infografía de métricas": "View body metrics infographic",
    "Resumen visual de métricas corporales": "Body Metrics Visual Summary",
    "Cerrar": "Close",
    "Incompleto": "Incomplete",
    "La app no inventa sexo, edad, altura ni medidas faltantes. Las métricas dependientes muestran “--” hasta tener los datos necesarios.": "The app does not invent sex, age, height, or missing measurements. Dependent metrics show “--” until the required data is available.",
    "Métricas calculadas con tus registros": "Metrics calculated from your records",
    "TDEE sugerido": "Suggested TDEE",
    "IMC / BMI · ⓘ": "BMI · ⓘ",
    "TMB / BMR · ⓘ": "BMR · ⓘ",
    "TDEE sugerido · ⓘ": "Suggested TDEE · ⓘ",
    "Cintura/altura · ⓘ": "Waist/height · ⓘ",
    "Grasa estimada · ⓘ": "Estimated body fat · ⓘ",
    "Masa grasa / magra · ⓘ": "Fat mass / lean mass · ⓘ",
    "Hidratación sugerida · ⓘ": "Suggested hydration · ⓘ",
    "Cintura/altura": "Waist/height",
    "Grasa estimada": "Estimated body fat",
    "Masa grasa / magra": "Fat / lean mass",
    "Hidratación sugerida": "Suggested hydration",
    "Estimaciones orientativas basadas en fórmulas poblacionales y tus datos registrados; no sustituyen mediciones clínicas.": "Informational estimates based on population formulas and your recorded data; they do not replace clinical measurements.",
    "Hora de administración:": "Administration time:",
    "Vista previa": "Preview",
    "Importar backup": "Import backup",
    "Nada se reemplazará hasta que confirmes. Se guardará una copia automática del estado actual antes de restaurar.": "Nothing will be replaced until you confirm. An automatic copy of the current state will be saved before restoring.",
    "Confirmar importación": "Confirm import",
    "Meta sugerida: --": "Suggested goal: --",
    "Basada en 30 mL/kg usando tu peso más reciente. Es una guía ajustable, no una indicación médica.": "Based on 30 mL/kg using your latest weight. This is an adjustable guide, not medical advice.",
    "Usar sugerencia": "Use suggestion",
    "Semana 1/4": "Week 1/4",
    "21 días máx.": "21 days max.",
    "21 días": "21 days",
    "Última evacuación registrada: Hoy": "Last bowel movement: Today",
    "Sistema de unidades:": "Unit system:",
    "Métrico — kg, mL, cm": "Metric — kg, mL, cm",
    "Nivel de apetito (\"Ruido mental de comida\"):": "Appetite level (food noise):",
    "Acidez y reflujo nocturno": "Heartburn and nighttime reflux",
    "Eleva la cabecera:": "Elevate your upper body:",
    "Duerme con el torso ligeramente inclinado o sobre tu costado izquierdo.": "Sleep with your upper body slightly elevated or on your left side.",
    "Mareos al levantarte o fatiga": "Dizziness when standing or fatigue",
    "Retira la piel tostada para reducir grasa concentrada y evitar reflujo o eructos de azufre.": "If a food seems to worsen symptoms, consider a lower-fat preparation and keep tracking your response.",
    "Tus datos se conservan internamente en un formato estable y solo se convierten para entrada, visualización y reportes.": "Your data stays internally in a stable format and is converted only for input, display, and reports.",
    "Tendencia de síntomas": "Symptom trend",
    "Intensidad registrada durante los últimos 30 días": "Recorded intensity over the last 30 days",
    "La gráfica organiza tus registros personales; no representa un diagnóstico ni determina causa.": "The chart organizes your personal records; it does not represent a diagnosis or determine cause.",
    "Meta: -- lbs": "Goal: -- lbs",
    "Mounjaro (tirzepatide • vida media 5 días • 21 días temp. ambiente)": "Mounjaro (tirzepatide)",
    "Ozempic (semaglutide • vida media 7 días • 56 días temp. ambiente)": "Ozempic Injection (semaglutide)",
    "Náuseas repentinas": "Sudden nausea",
    "Acupresión P6:": "P6 acupressure:",
    "Presiona el punto ubicado tres dedos por debajo de la muñeca en la cara interna del antebrazo.": "Press the point about three finger-widths below the wrist on the inner forearm.",
    "No te acuestes inmediatamente después de comer; mantente erguido al menos 2 horas.": "Avoid lying down right after eating; remain upright for at least 2 hours.",
    "Líquidos fríos:": "Cool fluids:",
    "Bebe sorbos diminutos de agua helada o infusión de jengibre sin azúcar.": "Take small sips of cool water or unsweetened ginger tea.",
    "Realiza la cena al menos 3 horas antes de acostarte.": "Have dinner at least 3 hours before bedtime.",
    "Cero frituras, salsas picantes o café tardío.": "Avoid fried foods, spicy sauces, or late caffeine if they worsen your symptoms.",
    "Fermentación gástrica de grasas pesadas o proteínas retenidas por vaciamiento lento.": "Digestive discomfort can sometimes follow heavier meals during slowed gastric emptying.",
    "Solución:": "General support:",
    "Reduce temporalmente alimentos ricos en sulfuro (huevos cocidos en exceso, brócoli crudo, carnes con grasa) y toma té de manzanilla o menta.": "Consider simplifying meals and noting which foods seem associated with symptoms.",
    "Electrólitos:": "Electrolytes:",
    "Disuelve una pizca de sal marina o un sobre de electrolitos sin azúcar en agua.": "Use an electrolyte product according to its label if appropriate for you.",
    "Siéntate en la orilla de la cama durante un minuto antes de ponerte de pie.": "Sit at the edge of the bed briefly before standing if you feel lightheaded.",
    "Estreñimiento prolongado (>48 horas)": "Prolonged constipation (>48 hours)",
    "Hidratación tibia:": "Warm hydration:",
    "Bebe dos tazas de agua tibia en ayunas.": "Consider warm fluids and regular hydration.",
    "Suplementación:": "Supplements:",
    "Considera citrato de magnesio bajo indicación médica para estimular la motilidad intestinal.": "Discuss any laxative or magnesium product with a healthcare professional before use.",
    "Insights personales": "Personal insights",
    "Lo que muestran tus últimos 30 días": "What your last 30 days show",
    "Descriptivo, no diagnóstico": "Descriptive, not diagnostic",
    "Las asociaciones se calculan únicamente con tus propios registros y no prueban causa ni sustituyen una evaluación médica.": "Associations use only your own logs and do not prove cause or replace medical evaluation.",
    "Modo mantenimiento": "Maintenance mode",
    "Mantener el peso dentro de tu rango": "Keep weight within your range",
    "Inactivo": "Inactive",
    "Activo": "Active",
    "Rango meta": "Goal range",
    "Peso actual": "Current weight",
    "Variación 30d": "30d variation",
    "Margen ±": "Margin ±",
    "Activar": "Enable",
    "Desactivar": "Disable",
    "Este modo monitorea estabilidad de peso y hábitos. No recomienda cambios de dosis ni tratamiento.": "This mode tracks weight stability and habits. It does not recommend dose or treatment changes.",
    "Inventario de medicamento": "Medication inventory",
    "Unidades disponibles para seguimiento.": "Units available for tracking.",
    "La app adapta frecuencia, vida media y registro según el medicamento seleccionado. No modifica ni recomienda tratamiento.": "The app adapts frequency, half-life and logging to the selected medication. It does not change or recommend treatment.",
    "Fecha de dosis:": "Dose date:",
    "Confirmar dosis": "Confirm dose",
    "Régimen diario": "Daily regimen",
    "Sin datos": "No data",
    "Tabla oral · una vez al día": "Oral tablet · once daily",
    "Español": "Spanish",
    "Mounjaro puede permanecer hasta 21 días a temperatura ambiente (<86°F/30°C).": "Mounjaro room-temperature tracking window: up to 21 days. Follow the product label for storage conditions.",
    "Actívalo cuando tú y tu profesional de salud decidan que entraste en una fase de mantenimiento.": "Enable it when you and your healthcare professional decide you have entered a maintenance phase.",
    "2\" del ombligo": "2 in from the navel",
    "Tabletas disponibles para seguimiento.": "Tablets available for tracking.",
    "Vida media aproximada": "Approx. half-life",
    "La app no modifica ni recomienda tratamiento.": "The app does not change or recommend treatment.",
    "Inyección · una vez al día": "Injection · once daily",
    "Inyección · una vez por semana": "Injection · once weekly",
    "Tableta oral · una vez al día": "Oral tablet · once daily",
    "No hay dosis guardadas aún.": "No doses recorded yet.",
    "Conteo de temperatura ambiente iniciado para el medicamento en uso.": "Room-temperature countdown started for the medication in use.",
    "Comida": "Meal",
    "Vs pico esperado": "Vs expected peak",
    "Próxima dosis estimada": "Estimated next dose",
    "Curva estimada hasta la próxima dosis": "Estimated curve until next dose",
    "No es concentración sanguínea": "Not a blood concentration",
    "Sistema de backups": "Backup system",
    "Protección de datos": "Data protection",
    "Guarda una copia fuera de la app": "Save a copy outside the app",
    "Revisa antes de restaurar tus datos": "Review before restoring your data",
    "Revisa las 3 copias rotativas de Firebase": "Review the 3 rotating Firebase copies",
    "Zona de riesgo": "Risk zone",
    "Backups locales rotativos: --/3": "Rotating local backups: --/3",
    "Exporta tu información o restaura copias de seguridad. En iPhone/iPad, usa Save to Files y guarda preferiblemente en iCloud Drive → GLP-1 Companion.": "Export your information or restore backups. On iPhone/iPad, use Save to Files and preferably save to iCloud Drive → GLP-1 Companion.",
    "Exportar Backup": "Export Backup",
    "Importar Backup": "Import Backup",
    "Selecciona qué deseas guardar": "Choose what you want to save",
    "Solo el estado actual": "Current data only",
    "Incluye hasta 3 snapshots locales rotativos": "Includes up to 3 rotating local snapshots",
    "Incluye las copias Server Safety disponibles": "Includes available Server Safety backups",
    "iPhone/iPad: selecciona Save to Files y guarda preferiblemente en iCloud Drive → GLP-1 Companion.": "iPhone/iPad: choose Save to Files and preferably save to iCloud Drive → GLP-1 Companion.",
    "Las 3 copias rotativas conservadas por Firebase": "The 3 rotating copies preserved by Firebase",
    "Backup Summary": "Backup Summary",
    "Hoy: no registrado": "Today: not logged",
    "IA e insights": "AI & insights",
    "Inteligencia personal": "Personal intelligence",
    "Entiende tus propios datos": "Understand your own data",
    "La app calcula primero; la IA explica después.": "The app calculates first; AI explains second.",
    "Pregúntale a tus datos": "Ask My Data",
    "Haz preguntas sobre tus registros de peso, agua, comida, síntomas y dosis.": "Ask questions about your weight, water, meals, symptoms and dose records.",
    "Privacidad: este contexto no incluye tu nombre, email ni Firebase UID, a menos que tú los escribas en la pregunta.": "Privacy: this context does not include your name, email or Firebase UID unless you type them in your question.",
    "La IA resume tus registros. No diagnostica ni recomienda cambios de dosis o tratamiento.": "AI summarizes your records. It does not diagnose or recommend dose or treatment changes.",
    "Preguntar a mis datos": "Ask my data",
    "Semana vs anterior": "Week vs previous",
    "Dosis y síntomas": "Dose & symptoms",
    "Peso + hábitos": "Weight + habits",
    "7 días": "7 days",
    "30 días": "30 days",
    "90 días": "90 days",
    "Evidencia usada": "Evidence used",
    "Resumen de 7 días con comparación contra la semana anterior.": "7-day summary compared with the previous week.",
    "Generar check-in semanal": "Generate weekly check-in",
    "Registrados": "Tracked",
    "Síntomas": "Symptoms",
    "Lo que cambió": "What changed",
    "Para observar": "To watch",
    "Explicación de IA": "AI explanation",
    "Inteligencia semanal": "Weekly intelligence"
};
const STATIC_ATTRIBUTE_TRANSLATIONS = {
    "Ej: 180": "e.g. 180",
    "Ej: Mareo breve al levantarme, tomé agua con sal...": "e.g. brief dizziness when standing...",
    "Ej: Buena tolerancia, sin molestias...": "e.g. good tolerance, no concerns...",
    "Guía rápida de alivio": "Quick support guide",
    "Día anterior": "Previous day",
    "Día siguiente": "Next day",
    "1. Hidratación óptima (claro)": "1. Good hydration (pale)",
    "2. Hidratación buena (amarillo pálido)": "2. Good hydration (light yellow)",
    "3. Precaución: Beber más agua": "3. Pay attention to hydration",
    "4. Deshidratación: Beber de inmediato": "4. Darker urine: review hydration",
    "Ej: 2 piernas de pollo asadas pequeñas y media taza de arroz moro con frijoles...": "e.g. two small roasted chicken legs and half a cup of rice and beans...",
    "Ej: Pechuga a la plancha con brócoli": "e.g. grilled chicken breast with broccoli",
    "Ej: ¿Cómo me fue esta semana comparado con la anterior?": "Example: How did I do this week compared with the previous week?",
    "Eliminar registro": "Delete record"
};
function isEnglish() {
    return (state.settings && state.settings.language) === 'en';
}
function uiText(es, en) {
    return isEnglish() ? en : es;
}
function translateSite(site) {
    if (!site)
        return uiText('Sin registro', 'No record');
    const sites = {
        'Abdomen derecho': ['Abdomen derecho', 'Right abdomen'],
        'Abdomen izquierdo': ['Abdomen izquierdo', 'Left abdomen'],
        'Muslo derecho': ['Muslo derecho', 'Right thigh'],
        'Muslo izquierdo': ['Muslo izquierdo', 'Left thigh'],
        'Brazo derecho': ['Brazo derecho', 'Right upper arm'],
        'Brazo izquierdo': ['Brazo izquierdo', 'Left upper arm'],
        'Oral': ['Vía oral', 'Oral']
    };
    const pair = sites[String(site)];
    return pair ? (isEnglish() ? pair[1] : pair[0]) : String(site);
}
function translateRuntimePhrase(text) {
    if (!text)
        return text;
    if (STATIC_TRANSLATIONS[text])
        return STATIC_TRANSLATIONS[text];
    const rules = [
        [/^Semana (\d+)\/4$/, 'Week $1/4'],
        [/^Rotación sugerida: (.+)$/, 'Suggested rotation: $1'],
        [/^Déficit severo \(riesgo masa muscular\)$/, 'Large deficit'],
        [/^Déficit óptimo$/, 'Optimal deficit'],
        [/^Déficit ligero$/, 'Light deficit'],
        [/^Superávit calórico$/, 'Calorie surplus'],
        [/^Sin dosis$/, 'No dose'],
        [/^Sin registro$/, 'No record'],
        [/^(\d+) plumas$/, '$1 pens'],
        [/^(\d+) días$/, '$1 days'],
        [/^Por vencer$/, 'Expiring soon'],
        [/^Vigente$/, 'Within window'],
        [/^Meta: (.+) lbs$/, 'Goal: $1 lbs'],
        [/^Faltan (.+) lbs para alcanzar tu meta de (.+) lbs\.$/, '$1 lbs remaining to reach your $2 lb goal.'],
        [/^Sin alimentos registrados en esta fecha$/, 'No meals recorded for this date'],
        [/^Usa 'Analizar plato' para fotografiar tu comida o añade manualmente\.$/, "Use 'Analyze meal' to add a photo or enter a meal manually."],
        [/^Sin registros recientes de evacuación\.$/, 'No recent bowel movement records.'],
        [/^Aún no hay registros suficientes en estos 7 días\.$/, 'There are not enough records in these 7 days yet.'],
        [/^Hay pocos días registrados; el resumen será más útil con mayor continuidad\.$/, 'Only a few days are recorded; the summary improves with more consistent tracking.'],
        [/^Resumen calculado con tus registros de los últimos 7 días\.$/, 'Summary calculated from your last 7 days of records.']
    ];
    for (const [rx, repl] of rules)
        if (rx.test(text))
            return text.replace(rx, repl);
    return text;
}
function applyStaticTranslations() {
    renderHardeningUiLanguage();
    const lang = state.settings && state.settings.language === 'en' ? 'en' : 'es';
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? 'GLP-1 Companion • Metabolic health' : 'GLP-1 Companion • Salud metabólica';
    const selector = document.getElementById('setting-language');
    if (selector)
        selector.value = lang;
    if (lang !== 'en')
        return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        if (!node.parentElement || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName))
            continue;
        const current = node.nodeValue || '';
        if (!current.trim())
            continue;
        const trimmed = current.trim();
        const translated = translateRuntimePhrase(trimmed);
        if (translated === trimmed)
            continue;
        const prefix = current.match(/^\s*/)?.[0] || '';
        const suffix = current.match(/\s*$/)?.[0] || '';
        node.nodeValue = prefix + translated + suffix;
    }
    document.querySelectorAll('[placeholder],[title]').forEach((el) => {
        ['placeholder', 'title'].forEach((attr) => {
            const current = el.getAttribute(attr);
            if (current === null || current === undefined)
                return;
            el.setAttribute(attr, STATIC_ATTRIBUTE_TRANSLATIONS[current] || STATIC_TRANSLATIONS[current] || current);
        });
    });
}
function setAppLanguage(lang, shouldPersist = true) {
    const normalized = lang === 'en' ? 'en' : 'es';
    state.settings.language = normalized;
    if (shouldPersist)
        persistState({ localOnly: true });
    // Language is a device-local preference and is intentionally excluded from Firestore.
    window.location.reload();
}
const LB_TO_KG = 0.45359237;
const OZ_TO_ML = 29.5735295625;
const IN_TO_CM = 2.54;
function isMetric() { return state?.settings?.units === 'metric'; }
function weightUnit() { return isMetric() ? 'kg' : 'lb'; }
function waterUnit() { return isMetric() ? 'mL' : 'oz'; }
function lengthUnit() { return isMetric() ? 'cm' : 'in'; }
function displayWeight(lb) { const n = Number(lb); return Number.isFinite(n) ? (isMetric() ? n * LB_TO_KG : n) : null; }
function storageWeight(displayValue) { const n = Number(displayValue); return Number.isFinite(n) ? (isMetric() ? n / LB_TO_KG : n) : null; }
function displayWater(oz) { const n = Number(oz); return Number.isFinite(n) ? (isMetric() ? n * OZ_TO_ML : n) : null; }
function storageWater(displayValue) { const n = Number(displayValue); return Number.isFinite(n) ? (isMetric() ? n / OZ_TO_ML : n) : null; }
function displayLength(inches) { const n = Number(inches); return Number.isFinite(n) ? (isMetric() ? n * IN_TO_CM : n) : null; }
function storageLength(displayValue) { const n = Number(displayValue); return Number.isFinite(n) ? (isMetric() ? n / IN_TO_CM : n) : null; }
function formatWeight(lb, decimals = 1) { const n = displayWeight(lb); return n === null ? '--' : `${n.toFixed(decimals)} ${weightUnit()}`; }
function formatWater(oz, decimals = null) {
    const n = displayWater(oz);
    if (n === null)
        return '--';
    const d = decimals === null ? (isMetric() ? 0 : 0) : decimals;
    return `${n.toFixed(d)} ${waterUnit()}`;
}
function formatLength(inches, decimals = 1) { const n = displayLength(inches); return n === null ? '--' : `${n.toFixed(decimals)} ${lengthUnit()}`; }
function setUnitSystem(value, shouldPersist = true) {
    state.settings.units = value === 'metric' ? 'metric' : 'imperial';
    if (shouldPersist)
        persistState({ localOnly: true });
    // Units are a device-local display preference, like language, and must
    // never advance the cloud settings timestamp.
    window.location.reload();
}
function applyUnitLabels() {
    const metric = isMetric();
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el)
            el.innerText = text;
    };
    set('setting-goal-weight-label', metric ? uiText('Peso objetivo / Meta (kg):', 'Goal weight (kg):') : uiText('Peso objetivo / Meta (lb):', 'Goal weight (lb):'));
    set('setting-water-goal-label', metric ? uiText('Meta agua (mL):', 'Water goal (mL):') : uiText('Meta agua (oz):', 'Water goal (oz):'));
    set('weight-modal-title', metric ? uiText('Registrar peso en kilogramos', 'Log weight in kilograms') : uiText('Registrar peso en libras', 'Log weight in pounds'));
    set('weight-input-label', metric ? uiText('Peso en kilogramos (kg):', 'Weight in kilograms (kg):') : uiText('Peso en libras (lb):', 'Weight in pounds (lb):'));
    set('measurement-modal-title', metric ? uiText('Anotar medidas corporales (cm)', 'Log body measurements (cm)') : uiText('Anotar medidas corporales (pulgadas)', 'Log body measurements (inches)'));
    set('meas-waist-label', `${uiText('Cintura', 'Waist')} (${lengthUnit()}):`);
    set('meas-chest-label', `${uiText('Pecho', 'Chest')} (${lengthUnit()}):`);
    set('meas-hips-label', `${uiText('Cadera', 'Hips')} (${lengthUnit()}):`);
    set('meas-neck-label', `${uiText('Cuello', 'Neck')} (${lengthUnit()}):`);
    set('weight-chart-title', metric ? uiText('Control y curva de peso (kg)', 'Weight tracking and trend (kg)') : uiText('Control y curva de peso (lb)', 'Weight tracking and trend (lb)'));
    set('measurements-subtitle', metric ? uiText('Medidas corporales en centímetros (cintura, pecho, cadera, cuello)', 'Body measurements in centimeters (waist, chest, hips, neck)') : uiText('Medidas corporales en pulgadas (cintura, pecho, cadera, cuello)', 'Body measurements in inches (waist, chest, hips, neck)'));
    ['prog-start-unit', 'prog-current-unit', 'prog-lost-unit'].forEach((id) => set(id, weightUnit()));
    set('maintenance-range-unit', weightUnit());
    const quick = metric ? ['-250 mL', '250 mL', '500 mL', '1 L'] : ['-8 oz', '8 oz', '16 oz', '32 oz'];
    ['water-btn-minus-text', 'water-btn-small-text', 'water-btn-medium-text', 'water-btn-large-text'].forEach((id, i) => set(id, quick[i]));
    const weightInput = document.getElementById('weight-input-val');
    if (weightInput) {
        weightInput.min = metric ? '22' : '50';
        weightInput.max = metric ? '454' : '1000';
        weightInput.step = metric ? '0.1' : '0.1';
        weightInput.placeholder = metric ? 'Ej: 97.4' : 'Ej: 214.8';
    }
    ['meas-waist', 'meas-chest', 'meas-hips', 'meas-neck'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.min = metric ? '13' : '5';
            el.max = metric ? '254' : '100';
            el.step = '0.1';
        }
    });
    const goal = document.getElementById('setting-goal-weight');
    if (goal) {
        goal.min = metric ? '22' : '50';
        goal.max = metric ? '454' : '1000';
        goal.step = '0.1';
    }
    const water = document.getElementById('setting-water-goal');
    if (water) {
        water.min = metric ? '250' : '8';
        water.max = metric ? '9000' : '300';
        water.step = metric ? '50' : '1';
    }
}
function getLatestLoggedWeightLb() {
    const valid = (state?.weights || [])
        .filter((w) => w && Number.isFinite(Number(w.weight)) && Number(w.weight) > 0 && w.date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return valid.length ? Number(valid[0].weight) : null;
}
