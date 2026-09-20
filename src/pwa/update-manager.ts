/**
 * GLP-1 Companion v5.3.0 PWA update manager.
 *
 * Goals:
 * - A waiting update discovered during a fresh app launch installs automatically.
 * - No "update now / later" prompt is shown during normal startup.
 * - If an update arrives while the user is actively editing, reload is deferred.
 * - Once editing is no longer at risk, the waiting worker activates automatically.
 * - A short confirmation toast is shown after the update reload completes.
 */

const UPDATE_RELOAD_KEY =
  'glp1_pwa_update_reload_v5';

const LEGACY_UPDATE_RELOAD_KEY =
  'glp1_pwa_update_reload';

const VERSION_SEEN_KEY =
  'glp1_pwa_version_seen_v5';

const LEGACY_VERSION_SEEN_KEY =
  'glp1_pwa_version_seen';

const STARTUP_AUTO_WINDOW_MS = 20_000;
const SAFE_RETRY_MS = 1_250;
const SAFE_RETRY_LIMIT_MS = 10 * 60_000;

let registration:
  ServiceWorkerRegistration | null = null;

let reloadRequested = false;
let reloadInProgress = false;

let retryTimer:
  number | null = null;

let started = false;
let firstInteractionAt = 0;
let restoredFromBfcache = false;
let languageIsEnglish = false;

const startedAt = Date.now();

function markInteraction(): void {
  if (!firstInteractionAt) {
    firstInteractionAt = Date.now();
  }
}

function installInteractionTracking(): void {
  const passiveCaptureOptions:
    AddEventListenerOptions = {
      capture: true,
      passive: true
    };

  window.addEventListener(
    'pointerdown',
    markInteraction,
    passiveCaptureOptions
  );

  window.addEventListener(
    'touchstart',
    markInteraction,
    passiveCaptureOptions
  );

  window.addEventListener(
    'keydown',
    markInteraction,
    {
      capture: true
    }
  );

  window.addEventListener(
    'pageshow',
    (event: PageTransitionEvent) => {
      if (event.persisted) {
        restoredFromBfcache = true;
      }
    }
  );
}

function isElementVisible(
  element: Element | null
): boolean {
  if (!element) {
    return false;
  }

  if (element.classList.contains('hidden')) {
    return false;
  }

  const style =
    window.getComputedStyle(element);

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden'
  );
}

function hasUnsafeEditingState(): boolean {
  const openModal = Array.from(
    document.querySelectorAll(
      '[id^="modal-"]'
    )
  ).some(isElementVisible);

  if (openModal) {
    return true;
  }

  if (firstInteractionAt) {
    const active =
      document.activeElement;

    if (
      active &&
      ['INPUT', 'TEXTAREA', 'SELECT']
        .includes(active.tagName)
    ) {
      return true;
    }

    if (
      active instanceof HTMLElement &&
      active.isContentEditable
    ) {
      return true;
    }
  }

  return false;
}

function isFreshLaunchWindow(): boolean {
  return (
    !restoredFromBfcache &&
    !firstInteractionAt &&
    (
      Date.now() - startedAt
    ) <= STARTUP_AUTO_WINDOW_MS
  );
}

function canActivateAutomatically():
  boolean {

  if (
    document.visibilityState !==
    'visible'
  ) {
    return false;
  }

  if (isFreshLaunchWindow()) {
    return true;
  }

  return !hasUnsafeEditingState();
}

function getBanner():
  HTMLElement | null {

  return document.getElementById(
    'pwa-update-banner'
  );
}

function refreshBannerLanguage(): void {
  const title =
    document.getElementById(
      'pwa-update-title'
    );

  const text =
    document.getElementById(
      'pwa-update-text'
    );

  const button =
    document.getElementById(
      'pwa-update-btn'
    );

  if (title) {
    title.textContent =
      languageIsEnglish
        ? 'Update paused'
        : 'Actualización en espera';
  }

  if (text) {
    text.textContent =
      languageIsEnglish
        ? 'The update is paused to protect unsaved input. It will install automatically when it is safe.'
        : 'La actualización está en pausa para proteger cambios sin guardar. Se instalará automáticamente cuando sea seguro.';
  }

  if (button) {
    button.textContent =
      languageIsEnglish
        ? 'Update now'
        : 'Actualizar ahora';
  }
}

function showDeferredBanner(): void {
  const banner = getBanner();

  if (!banner) {
    return;
  }

  refreshBannerLanguage();

  banner.classList.remove(
    'hidden'
  );

  try {
    window.lucide
      ?.createIcons
      ?.();
  } catch {
    // Non-critical visual refresh.
  }
}

function hideDeferredBanner(): void {
  getBanner()
    ?.classList
    .add('hidden');
}

function clearRetryTimer(): void {
  if (retryTimer === null) {
    return;
  }

  window.clearInterval(
    retryTimer
  );

  retryTimer = null;
}

interface WorkerBuildInfo {
  type?: string;
  buildId?: string;
}

async function getWorkerBuildInfo(
  worker: ServiceWorker | null
): Promise<WorkerBuildInfo | null> {

  if (!worker) {
    return null;
  }

  return new Promise<
    WorkerBuildInfo | null
  >((resolve) => {

    const channel =
      new MessageChannel();

    const timeout =
      window.setTimeout(
        () => {
          resolve(null);
        },
        600
      );

    channel.port1.onmessage =
      (
        event:
          MessageEvent<WorkerBuildInfo>
      ) => {

        window.clearTimeout(
          timeout
        );

        const data =
          event.data;

        resolve(
          data &&
          typeof data === 'object'
            ? data
            : null
        );
      };

    try {
      worker.postMessage(
        {
          type: 'GET_BUILD_INFO'
        },
        [channel.port2]
      );
    } catch {
      window.clearTimeout(
        timeout
      );

      resolve(null);
    }
  });
}

interface ActivateOptions {
  automatic?: boolean;
  reason?: string;
}

async function activateWaitingWorker(
  {
    automatic = true,
    reason = 'safe'
  }: ActivateOptions = {}
): Promise<boolean> {

  const waiting =
    registration?.waiting;

  if (!waiting) {
    hideDeferredBanner();
    clearRetryTimer();

    return false;
  }

  const buildInfo =
    await getWorkerBuildInfo(
      waiting
    );

  let fromVersion = '';

  try {
    fromVersion =
      localStorage.getItem(
        VERSION_SEEN_KEY
      ) ||
      localStorage.getItem(
        LEGACY_VERSION_SEEN_KEY
      ) ||
      '';
  } catch {
    fromVersion = '';
  }

  try {
    localStorage.setItem(
      UPDATE_RELOAD_KEY,
      JSON.stringify({
        fromVersion,
        targetBuildId:
          buildInfo?.buildId || '',
        automatic:
          Boolean(automatic),
        reason,
        requestedAt:
          Date.now()
      })
    );
  } catch {
    // Local storage failure must not block update.
  }

  reloadRequested = true;

  hideDeferredBanner();
  clearRetryTimer();

  waiting.postMessage({
    type: 'ACTIVATE_UPDATE'
  });

  return true;
}

function scheduleSafeRetry(): void {
  clearRetryTimer();

  const retryStartedAt =
    Date.now();

  retryTimer =
    window.setInterval(
      () => {
        if (
          !registration?.waiting
        ) {
          hideDeferredBanner();
          clearRetryTimer();

          return;
        }

        if (
          canActivateAutomatically()
        ) {
          void activateWaitingWorker({
            automatic: true,
            reason: 'became-safe'
          });

          return;
        }

        if (
          Date.now() -
          retryStartedAt >
          SAFE_RETRY_LIMIT_MS
        ) {
          clearRetryTimer();
        }
      },
      SAFE_RETRY_MS
    );
}

function deferUntilVisible(
  callback: () => void
): void {

  if (
    document.visibilityState ===
    'visible'
  ) {
    callback();

    return;
  }

  const onVisible = (): void => {
    if (
      document.visibilityState !==
      'visible'
    ) {
      return;
    }

    document.removeEventListener(
      'visibilitychange',
      onVisible
    );

    callback();
  };

  document.addEventListener(
    'visibilitychange',
    onVisible
  );
}

function handleWaitingWorker(
  nextRegistration?:
    ServiceWorkerRegistration | null
): void {

  if (nextRegistration) {
    registration =
      nextRegistration;
  }

  if (
    !registration?.waiting
  ) {
    return;
  }

  if (isFreshLaunchWindow()) {
    hideDeferredBanner();

    deferUntilVisible(
      () => {
        window.setTimeout(
          () => {
            if (
              registration?.waiting
            ) {
              void activateWaitingWorker({
                automatic: true,
                reason: 'fresh-launch'
              });
            }
          },
          250
        );
      }
    );

    return;
  }

  if (
    canActivateAutomatically()
  ) {
    hideDeferredBanner();

    window.setTimeout(
      () => {
        if (
          registration?.waiting &&
          canActivateAutomatically()
        ) {
          void activateWaitingWorker({
            automatic: true,
            reason: 'safe-session'
          });
        }
      },
      350
    );

    return;
  }

  showDeferredBanner();
  scheduleSafeRetry();
}

async function registerServiceWorker():
  Promise<
    ServiceWorkerRegistration | null
  > {

  if (
    !(
      'serviceWorker' in navigator
    )
  ) {
    return null;
  }

  try {
    const nextRegistration =
      await navigator
        .serviceWorker
        .register(
          './sw.js',
          {
            scope: './',
            updateViaCache:
              'none'
          }
        );

    registration =
      nextRegistration;

    if (
      nextRegistration.waiting &&
      navigator
        .serviceWorker
        .controller
    ) {
      handleWaitingWorker(
        nextRegistration
      );
    }

    nextRegistration.addEventListener(
      'updatefound',
      () => {
        const worker =
          nextRegistration
            .installing;

        if (!worker) {
          return;
        }

        worker.addEventListener(
          'statechange',
          () => {
            if (
              worker.state ===
                'installed' &&
              navigator
                .serviceWorker
                .controller
            ) {
              handleWaitingWorker(
                nextRegistration
              );
            }
          }
        );
      }
    );

    void nextRegistration
      .update()
      .catch(() => {
        // Non-fatal.
      });

    return nextRegistration;

  } catch (error: unknown) {
    console.warn(
      'PWA service worker registration failed:',
      error
    );

    return null;
  }
}

function installControllerChangeHandler():
  void {

  navigator
    .serviceWorker
    .addEventListener(
      'controllerchange',
      () => {
        if (
          !reloadRequested ||
          reloadInProgress
        ) {
          return;
        }

        reloadInProgress = true;

        window.location.reload();
      }
    );
}

export function startPwaUpdateManager():
  void {

  if (
    started ||
    !(
      'serviceWorker' in navigator
    )
  ) {
    return;
  }

  started = true;

  installInteractionTracking();
  installControllerChangeHandler();

  if (
    document.readyState ===
    'complete'
  ) {
    void registerServiceWorker();
  } else {
    window.addEventListener(
      'load',
      () => {
        void registerServiceWorker();
      },
      {
        once: true
      }
    );
  }

  window.addEventListener(
    'online',
    () => {
      void registration
        ?.update()
        .catch(() => {
          // Non-fatal.
        });
    }
  );

  window.glp1Pwa = {
    applyUpdateNow:
      () =>
        activateWaitingWorker({
          automatic: false,
          reason: 'user-request'
        }),

    setLanguage:
      (
        isEnglish:
          boolean
      ) => {
        languageIsEnglish =
          Boolean(isEnglish);

        refreshBannerLanguage();
      },

    showCompletedUpdateToast:
      ({
        version,
        isEnglish,
        showToast
      }: Glp1PwaUpdateToastArgs):
        boolean => {

        let pending:
          unknown = null;

        try {
          pending =
            JSON.parse(
              localStorage.getItem(
                UPDATE_RELOAD_KEY
              ) ||
              localStorage.getItem(
                LEGACY_UPDATE_RELOAD_KEY
              ) ||
              'null'
            );
        } catch {
          pending = null;
        }

        try {
          localStorage.setItem(
            VERSION_SEEN_KEY,
            String(
              version || ''
            )
          );
        } catch {
          // Non-fatal.
        }

        if (!pending) {
          return false;
        }

        try {
          localStorage.removeItem(
            UPDATE_RELOAD_KEY
          );

          localStorage.removeItem(
            LEGACY_UPDATE_RELOAD_KEY
          );
        } catch {
          // Non-fatal.
        }

        if (
          typeof showToast ===
          'function'
        ) {
          window.setTimeout(
            () => {
              showToast(
                isEnglish
                  ? `App updated successfully to ${version}.`
                  : `App actualizada correctamente a ${version}.`,
                4200
              );
            },
            650
          );
        }

        return true;
      },

    checkForUpdate:
      () =>
        registration
          ?.update(),

    getRegistration:
      () =>
        registration
  };
}
