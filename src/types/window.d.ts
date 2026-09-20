export {};

declare global {
  interface Glp1PwaUpdateToastArgs {
    version: string;
    isEnglish: boolean;
    showToast?: (message: string, duration?: number) => void;
  }

  interface Glp1PwaBridge {
    applyUpdateNow: () => Promise<boolean> | boolean;
    setLanguage: (isEnglish: boolean) => void;
    showCompletedUpdateToast: (args: Glp1PwaUpdateToastArgs) => boolean;
    checkForUpdate: () => Promise<void> | undefined;
    getRegistration: () => ServiceWorkerRegistration | null;
  }

  interface FirebasePlatformBridge {
    auth: unknown;
    firestore: unknown;
    googleProvider: unknown;
    trackerRef: (uid: string) => unknown;
    safetyRef: (uid: string, slotId: string) => unknown;
    onAuthStateChanged: (callback: (user: { uid: string; email: string | null } | null) => void) => () => void;
    signOut: () => Promise<void>;
    signInWithPopup: () => Promise<unknown>;
    signInWithRedirect: () => Promise<void>;
    getTracker: (uid: string) => Promise<unknown>;
    listenTracker: (uid: string, next: (snapshot: unknown) => void, error?: (error: unknown) => void) => () => void;
    getSafetyDocs: (uid: string) => Promise<unknown>;
    runTransaction: <T>(updateFunction: (transaction: unknown) => Promise<T>) => Promise<T>;
    serverTimestamp: () => unknown;
  }

  interface MealAiRequest {
    systemPrompt: string;
    prompt: string;
    imageBase64?: string | null;
    mimeType?: string | null;
    modelName?: string | null;
  }

  interface MealTranslationRequest {
    foodName: string;
    tip: string;
    modelName?: string | null;
  }

  interface Window {
    Chart?: unknown;
    lucide?: { createIcons?: () => void };
    glp1Pwa?: Glp1PwaBridge;
    glp1V5MigrationPhase?: number;
    glp1BootstrapError?: string;
    firebasePlatform?: FirebasePlatformBridge;
    firebaseAiModels?: Readonly<{ primary: string; fallback: string }>;
    firebaseAiAnalyzeMeal?: (request: MealAiRequest) => Promise<Record<string, unknown>>;
    firebaseAiTranslateMeal?: (request: MealTranslationRequest) => Promise<Record<string, unknown>>;
    firebaseAiLogicReady?: boolean;
    firebaseAiLogicInitError?: string;
    GLP1_APP_VERSION?: string;
    GLP1_SCHEMA_VERSION?: number;
    Capacitor?: { isNativePlatform?: () => boolean };
    webkitAudioContext?: typeof AudioContext;
  }
}

declare module '*.css';
