/**
 * GLP-1 Companion v5.0.1 PWA update manager.
 *
 * Goals:
 * - A waiting update discovered during a fresh app launch installs automatically.
 * - No "update now / later" prompt is shown during normal startup.
 * - If an update arrives while the user is actively editing, reload is deferred.
 * - Once editing is no longer at risk, the waiting worker activates automatically.
 * - A short confirmation toast is shown after the update reload completes.
 */
const UPDATE_RELOAD_KEY = 'glp1_pwa_update_reload_v5';
const LEGACY_UPDATE_RELOAD_KEY = 'glp1_pwa_update_reload';
const VERSION_SEEN_KEY = 'glp1_pwa_version_seen_v5';
const LEGACY_VERSION_SEEN_KEY = 'glp1_pwa_version_seen';
const STARTUP_AUTO_WINDOW_MS = 20000;
const SAFE_RETRY_MS = 1250;
const SAFE_RETRY_LIMIT_MS = 10 * 60000;
let registration = null;
let reloadRequested = false;
let reloadInProgress = false;
let retryTimer = null;
let started = false;
let firstInteractionAt = 0;
let restoredFromBfcache = false;
let languageIsEnglish = false;
const startedAt = Date.now();
function markInteraction() {
    if (!firstInteractionAt)
        firstInteractionAt = Date.now();
}
function installInteractionTracking() {
    const options = { capture: true, passive: true };
    window.addEventListener('pointerdown', markInteraction, options);
    window.addEventListener('touchstart', markInteraction, options);
    window.addEventListener('keydown', markInteraction, { capture: true });
    window.addEventListener('pageshow', (event) => {
        if (event.persisted)
            restoredFromBfcache = true;
    });
}
function isElementVisible(element) {
    if (!element || element.classList.contains('hidden'))
        return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}
function hasUnsafeEditingState() {
    // Any visible app modal may contain unsaved input. Never force a reload there.
    const openModal = Array.from(document.querySelectorAll('[id^="modal-"]')).some(isElementVisible);
    if (openModal)
        return true;
    // Outside a modal, protect a field only after the user has actually interacted
    // during this page session. Browser-restored focus alone must not block startup.
    if (firstInteractionAt) {
        const active = document.activeElement;
        if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))
            return true;
        if (active instanceof HTMLElement && active.isContentEditable)
            return true;
    }
    return false;
}
function isFreshLaunchWindow() {
    return !restoredFromBfcache
        && !firstInteractionAt
        && (Date.now() - startedAt) <= STARTUP_AUTO_WINDOW_MS;
}
function canActivateAutomatically() {
    if (document.visibilityState !== 'visible')
        return false;
    if (isFreshLaunchWindow())
        return true;
    return !hasUnsafeEditingState();
}
function getBanner() {
    return document.getElementById('pwa-update-banner');
}
function refreshBannerLanguage() {
    const title = document.getElementById('pwa-update-title');
    const text = document.getElementById('pwa-update-text');
    const button = document.getElementById('pwa-update-btn');
    if (title)
        title.textContent = languageIsEnglish ? 'Update paused' : 'Actualización en espera';
    if (text) {
        text.textContent = languageIsEnglish
            ? 'The update is paused to protect unsaved input. It will install automatically when it is safe.'
            : 'La actualización está en pausa para proteger cambios sin guardar. Se instalará automáticamente cuando sea seguro.';
    }
    if (button)
        button.textContent = languageIsEnglish ? 'Update now' : 'Actualizar ahora';
}
function showDeferredBanner() {
    const banner = getBanner();
    if (!banner)
        return;
    refreshBannerLanguage();
    banner.classList.remove('hidden');
    try {
        window.lucide?.createIcons?.();
    }
    catch (_) { }
}
function hideDeferredBanner() {
    getBanner()?.classList.add('hidden');
}
function clearRetryTimer() {
    if (!retryTimer)
        return;
    clearInterval(retryTimer);
    retryTimer = null;
}
async function getWorkerBuildInfo(worker) {
    if (!worker)
        return null;
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve(null), 600);
        channel.port1.onmessage = (event) => {
            clearTimeout(timeout);
            resolve(event.data && typeof event.data === 'object' ? event.data : null);
        };
        try {
            worker.postMessage({ type: 'GET_BUILD_INFO' }, [channel.port2]);
        }
        catch (_) {
            clearTimeout(timeout);
            resolve(null);
        }
    });
}
async function activateWaitingWorker({ automatic = true, reason = 'safe' } = {}) {
    const waiting = registration?.waiting;
    if (!waiting) {
        hideDeferredBanner();
        clearRetryTimer();
        return false;
    }
    const buildInfo = await getWorkerBuildInfo(waiting);
    let fromVersion = '';
    try {
        fromVersion = localStorage.getItem(VERSION_SEEN_KEY) || localStorage.getItem(LEGACY_VERSION_SEEN_KEY) || '';
    }
    catch (_) { }
    try {
        localStorage.setItem(UPDATE_RELOAD_KEY, JSON.stringify({
            fromVersion,
            targetBuildId: buildInfo?.buildId || '',
            automatic: Boolean(automatic),
            reason,
            requestedAt: Date.now()
        }));
    }
    catch (_) { }
    reloadRequested = true;
    hideDeferredBanner();
    clearRetryTimer();
    waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    return true;
}
function scheduleSafeRetry() {
    clearRetryTimer();
    const retryStartedAt = Date.now();
    retryTimer = setInterval(() => {
        if (!registration?.waiting) {
            hideDeferredBanner();
            clearRetryTimer();
            return;
        }
        if (canActivateAutomatically()) {
            activateWaitingWorker({ automatic: true, reason: 'became-safe' });
            return;
        }
        if (Date.now() - retryStartedAt > SAFE_RETRY_LIMIT_MS)
            clearRetryTimer();
    }, SAFE_RETRY_MS);
}
function deferUntilVisible(callback) {
    if (document.visibilityState === 'visible') {
        callback();
        return;
    }
    const onVisible = () => {
        if (document.visibilityState !== 'visible')
            return;
        document.removeEventListener('visibilitychange', onVisible);
        callback();
    };
    document.addEventListener('visibilitychange', onVisible);
}
function handleWaitingWorker(nextRegistration) {
    if (nextRegistration)
        registration = nextRegistration;
    if (!registration?.waiting)
        return;
    // Critical startup behavior: a normal fresh launch never asks the user.
    if (isFreshLaunchWindow()) {
        hideDeferredBanner();
        deferUntilVisible(() => {
            setTimeout(() => {
                if (registration?.waiting) {
                    activateWaitingWorker({ automatic: true, reason: 'fresh-launch' });
                }
            }, 250);
        });
        return;
    }
    // During an active session, still update automatically whenever no input is at risk.
    if (canActivateAutomatically()) {
        hideDeferredBanner();
        setTimeout(() => {
            if (registration?.waiting && canActivateAutomatically()) {
                activateWaitingWorker({ automatic: true, reason: 'safe-session' });
            }
        }, 350);
        return;
    }
    // Only an actively unsafe editing state gets a visible deferred-update notice.
    showDeferredBanner();
    scheduleSafeRetry();
}
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator))
        return null;
    try {
        const nextRegistration = await navigator.serviceWorker.register('./sw.js', {
            scope: './',
            updateViaCache: 'none'
        });
        registration = nextRegistration;
        if (nextRegistration.waiting && navigator.serviceWorker.controller) {
            handleWaitingWorker(nextRegistration);
        }
        nextRegistration.addEventListener('updatefound', () => {
            const worker = nextRegistration.installing;
            if (!worker)
                return;
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    handleWaitingWorker(nextRegistration);
                }
            });
        });
        // Force a startup check without relying on the browser's HTTP cache.
        nextRegistration.update().catch(() => { });
        return nextRegistration;
    }
    catch (error) {
        console.warn('PWA service worker registration failed:', error);
        return null;
    }
}
function installControllerChangeHandler() {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloadRequested || reloadInProgress)
            return;
        reloadInProgress = true;
        window.location.reload();
    });
}
export function startPwaUpdateManager() {
    if (started || !('serviceWorker' in navigator))
        return;
    started = true;
    installInteractionTracking();
    installControllerChangeHandler();
    if (document.readyState === 'complete') {
        registerServiceWorker();
    }
    else {
        window.addEventListener('load', registerServiceWorker, { once: true });
    }
    window.addEventListener('online', () => registration?.update?.().catch(() => { }));
    // Public bridge used by the legacy-compatible runtime while v5 is migrated.
    window.glp1Pwa = {
        applyUpdateNow: () => activateWaitingWorker({ automatic: false, reason: 'user-request' }),
        setLanguage: (isEnglish) => {
            languageIsEnglish = Boolean(isEnglish);
            refreshBannerLanguage();
        },
        showCompletedUpdateToast: ({ version, isEnglish, showToast }) => {
            let pending = null;
            try {
                pending = JSON.parse(localStorage.getItem(UPDATE_RELOAD_KEY) || localStorage.getItem(LEGACY_UPDATE_RELOAD_KEY) || 'null');
            }
            catch (_) { }
            try {
                localStorage.setItem(VERSION_SEEN_KEY, String(version || ''));
            }
            catch (_) { }
            if (!pending)
                return false;
            try {
                localStorage.removeItem(UPDATE_RELOAD_KEY);
                localStorage.removeItem(LEGACY_UPDATE_RELOAD_KEY);
            }
            catch (_) { }
            if (typeof showToast === 'function') {
                setTimeout(() => {
                    showToast(isEnglish
                        ? `App updated successfully to ${version}.`
                        : `App actualizada correctamente a ${version}.`, 4200);
                }, 650);
            }
            return true;
        },
        checkForUpdate: () => registration?.update?.(),
        getRegistration: () => registration
    };
}
