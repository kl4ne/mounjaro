"use strict";
/**
 * GLP-1 Companion v5 Phase 3 compatibility module
 * Pull-to-refresh, app refresh and DOMContentLoaded bootstrap.
 *
 * Loaded as an ordered classic script on purpose: this preserves the existing
 * shared global lexical environment and inline-handler contract while the v5
 * architecture is modularized without behavior changes.
 */
/* ==========================================================================
   GESTO PULL-TO-REFRESH PARA IPHONE / NAVEGADOR
   ========================================================================== */
let touchStartY = 0;
let isPulling = false;
function setupPullToRefresh() {
    const pullContainer = document.getElementById('pull-refresh-container');
    const pullIcon = document.getElementById('pull-refresh-icon');
    const pullText = document.getElementById('pull-refresh-text');
    const mainEl = document.querySelector('main');
    if (!pullContainer || !pullIcon || !pullText || !mainEl)
        return;
    window.addEventListener('touchstart', (e) => {
        if (mainEl.scrollTop <= 0) {
            touchStartY = e.touches[0].clientY;
            isPulling = true;
        }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (!isPulling)
            return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY;
        if (diff > 0 && mainEl.scrollTop <= 0) {
            const pullHeight = Math.min(50, diff * 0.4);
            pullContainer.style.height = `${pullHeight}px`;
            pullContainer.style.opacity = `${Math.min(1, pullHeight / 35)}`;
            if (pullHeight >= 40) {
                pullText.innerText = uiText("Suelta para actualizar", "Release to refresh");
                pullIcon.style.transform = "rotate(180deg)";
            }
            else {
                pullText.innerText = uiText("Desliza para actualizar", "Pull to refresh");
                pullIcon.style.transform = `rotate(${pullHeight * 4.5}deg)`;
            }
        }
    }, { passive: true });
    window.addEventListener('touchend', async () => {
        if (!isPulling)
            return;
        isPulling = false;
        const currentHeight = parseFloat(pullContainer.style.height || "0");
        if (currentHeight >= 40) {
            pullText.innerText = uiText("Actualizando...", "Refreshing...");
            pullIcon.classList.add('animate-spin');
            await triggerAppRefresh();
            setTimeout(() => {
                pullContainer.style.height = "0px";
                pullContainer.style.opacity = "0";
                pullIcon.classList.remove('animate-spin');
                pullIcon.style.transform = "rotate(0deg)";
            }, 500);
        }
        else {
            pullContainer.style.height = "0px";
            pullContainer.style.opacity = "0";
            pullIcon.style.transform = "rotate(0deg)";
        }
    });
}
async function triggerAppRefresh() {
    state.selectedDate = getFormattedDate(new Date());
    if (currentUser) {
        try {
            const docSnap = await firebasePlatform.getTracker(currentUser.uid);
            if (docSnap.metadata && docSnap.metadata.fromCache) {
                setSyncStatus('waiting');
                showToast(uiText('Sin conexión confirmada al servidor; se conservan los datos locales.', 'No confirmed server connection; local data was preserved.'));
            }
            else if (docSnap.exists()) {
                const cloud = docSnap.data();
                updateServerClockAnchor(cloud);
                if (pendingExplicitMutation || cloudSyncInFlight) {
                    applyCloudDataMerge(cloud, { skipCloudWrite: true, preferCloudOnTie: true });
                    setSyncStatus('waiting');
                }
                else {
                    replaceStateFromCloudCanonical(cloud);
                    setSyncStatus('synced');
                }
            }
        }
        catch (err) {
            console.error("Error al sincronizar con Firestore:", err);
        }
    }
    updateDateBadge();
    renderCurrentDay();
    if (activeTab === 'tools')
        renderToolsView();
    showToast(uiText("App actualizada al día de hoy.", "App refreshed to today."));
}
function startGlp1Application() {
    initData();
    localBackupInitPromise = initLocalSafetyBackups().then(async () => { await recoverEmergencyStateIfNewer(); });
    setupFirebaseAuthListener();
    initFastingUI();
    applyMedicationTheme();
    setupPullToRefresh();
    document.getElementById('hub-injections-list').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-inj]');
        if (btn) {
            e.stopPropagation();
            removeInjection(btn.dataset.deleteInj || '');
            return;
        }
        const row = e.target.closest('[data-open-inj]');
        if (row)
            openInjectionDetailModal(row.dataset.openInj || '');
    });
    document.getElementById('weights-history-list').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-weight]');
        if (btn) {
            removeWeightEntry(btn.dataset.deleteWeight || '');
        }
    });
    document.getElementById('daily-meals-container').addEventListener('click', (e) => {
        const translateBtn = e.target.closest('[data-translate-meal]');
        if (translateBtn) {
            translateSavedMeal(parseInt(translateBtn.dataset.translateMeal || '0', 10));
            return;
        }
        const btn = e.target.closest('[data-delete-meal]');
        if (btn)
            removeMealItem(parseInt(btn.dataset.deleteMeal || '0', 10));
    });
    document.getElementById('setting-goal-weight').value = displayWeight(state.settings.goalWeight || 180).toFixed(1);
    document.getElementById('setting-cal-goal').value = String(state.settings.calGoal || 1400);
    document.getElementById('setting-tdee').value = String(state.settings.tdee || 2000);
    document.getElementById('setting-protein-goal').value = String(state.settings.proteinGoal || 110);
    document.getElementById('setting-water-goal').value = String(Math.round(displayWater(state.settings.waterGoal || 96)));
    const languageSelector = document.getElementById('setting-language');
    if (languageSelector)
        languageSelector.value = state.settings.language || 'es';
    const unitSelector = document.getElementById('setting-units');
    if (unitSelector)
        unitSelector.value = state.settings.units || 'imperial';
    applyUnitLabels();
    updateLocalBackupStatus();
    document.getElementById('btn-prev-day').addEventListener('click', () => changeDate(-1));
    document.getElementById('btn-next-day').addEventListener('click', () => changeDate(1));
    updateDateBadge();
    renderAiStatus();
    applyStaticTranslations();
    const versionBadge = document.getElementById('app-version-badge');
    if (versionBadge)
        versionBadge.textContent = APP_VERSION;
    const aboutVersion = document.getElementById('about-app-version');
    if (aboutVersion)
        aboutVersion.textContent = `${APP_VERSION} · Progressive Web App`;
    lucide.createIcons();
    showCompletedPwaUpdateToastIfNeeded();
}
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startGlp1Application, { once: true });
}
else {
    startGlp1Application();
}
