/**
 * Typed compatibility declarations for the classic runtime chunks.
 * These declarations describe the stable v5/schema-13 runtime without using
 * untyped escape hatches.
 */

type Nullable<T> = T | null;
type StringMap<T> = Record<string, T>;
type UnknownRecord = Record<string, unknown>;

interface AppElement extends HTMLElement {
  value: string;
  checked: boolean;
  disabled: boolean;
  files: FileList | null;
  min: string;
  max: string;
  step: string;
  placeholder: string;
  src: string;
  href: string;
  download: string;
  width: number;
  height: number;
  selectedIndex: number;
  options: HTMLOptionsCollection;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
  toDataURL(type?: string, quality?: number): string;
  select(): void;
}


interface Document {
  getElementById(elementId: string): AppElement;
  querySelector(selectors: string): AppElement;
  querySelectorAll(selectors: string): NodeListOf<AppElement>;
}

interface LucideBridge {
  createIcons(): void;
}
declare const lucide: LucideBridge;

interface ChartDatasetLike {
  label?: string;
  data: unknown;
  [key: string]: unknown;
}
interface ChartDataLike {
  labels: unknown;
  datasets: ChartDatasetLike[];
}
interface ChartOptionsLike {
  scales?: { y?: { max?: number; [key: string]: unknown }; [key: string]: unknown };
  [key: string]: unknown;
}
interface ChartInstanceLike {
  data: ChartDataLike;
  options: ChartOptionsLike;
  destroy(): void;
  update(mode?: string): void;
}
interface ChartConstructorLike {
  new (context: CanvasRenderingContext2D | AppElement | null, config: UnknownRecord): ChartInstanceLike;
}
declare const Chart: ChartConstructorLike;

interface FirebaseUserLike {
  uid: string;
  email: string | null;
  displayName?: string | null;
}
interface FirestoreSnapshotMetadataLike {
  fromCache?: boolean;
  hasPendingWrites?: boolean;
}
interface FirestoreDocumentSnapshotLike {
  id?: string;
  metadata?: FirestoreSnapshotMetadataLike;
  exists(): boolean;
  data(): RuntimeCloudDocument;
}
interface FirestoreQueryDocumentSnapshotLike {
  id: string;
  data(): unknown;
}
interface FirestoreQuerySnapshotLike {
  docs?: FirestoreQueryDocumentSnapshotLike[];
  forEach(callback: (doc: FirestoreQueryDocumentSnapshotLike) => void): void;
}
interface FirestoreDocumentReferenceLike {
  readonly id?: string;
}
interface FirestoreTransactionLike {
  get(ref: FirestoreDocumentReferenceLike): Promise<FirestoreDocumentSnapshotLike>;
  set(ref: FirestoreDocumentReferenceLike, data: UnknownRecord): FirestoreTransactionLike;
  update(ref: FirestoreDocumentReferenceLike, data: UnknownRecord): FirestoreTransactionLike;
  delete(ref: FirestoreDocumentReferenceLike): FirestoreTransactionLike;
}
interface FirebasePlatformBridge {
  auth: unknown;
  firestore: unknown;
  googleProvider: unknown;
  trackerRef(uid: string): FirestoreDocumentReferenceLike;
  safetyRef(uid: string, slotId: string): FirestoreDocumentReferenceLike;
  onAuthStateChanged(callback: (user: FirebaseUserLike | null) => void): () => void;
  signOut(): Promise<void>;
  signInWithPopup(): Promise<unknown>;
  signInWithRedirect(): Promise<void>;
  getTracker(uid: string): Promise<FirestoreDocumentSnapshotLike>;
  listenTracker(uid: string, next: (snapshot: FirestoreDocumentSnapshotLike) => void, error?: (error: unknown) => void): () => void;
  getSafetyDocs(uid: string): Promise<FirestoreQuerySnapshotLike>;
  runTransaction<T>(updateFunction: (transaction: FirestoreTransactionLike) => Promise<T>): Promise<T>;
  serverTimestamp(): unknown;
}

interface Glp1PwaBridge {
  applyUpdateNow(): Promise<boolean> | boolean;
  setLanguage(isEnglish: boolean): void;
  showCompletedUpdateToast(args: { version: string; isEnglish: boolean; showToast?: (message: string, duration?: number) => void }): boolean;
  checkForUpdate(): Promise<void> | undefined;
  getRegistration(): ServiceWorkerRegistration | null;
}


interface AiFailureClassification {
  recoverable: boolean;
  reason: string;
}
interface PendingAiBilingualResult {
  foodNameEs: string;
  foodNameEn: string;
  tipEs: string;
  tipEn: string;
  sourceLabel: string;
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

interface AskMyDataAiRequest {
  question: string;
  contextJson: string;
  modelName?: string | null;
}

interface WeeklyCheckInAiRequest {
  contextJson: string;
  modelName?: string | null;
}

interface PatternFinderAiRequest {
  contextJson: string;
  modelName?: string | null;
}

interface PrepareVisitAiRequest {
  contextJson: string;
  modelName?: string | null;
}

interface Window {
  GLP1_APP_VERSION: string;
  GLP1_SCHEMA_VERSION: number;
  firebasePlatform: FirebasePlatformBridge;
  glp1Pwa?: Glp1PwaBridge;
  firebaseAiModels?: Readonly<{ primary: string; fallback: string }>;
  firebaseAiAnalyzeMeal?: (request: MealAiRequest) => Promise<Record<string, unknown>>;
  firebaseAiTranslateMeal?: (request: MealTranslationRequest) => Promise<Record<string, unknown>>;
  firebaseAiAskMyData?: (request: AskMyDataAiRequest) => Promise<Record<string, unknown>>;
  firebaseAiWeeklyCheckIn?: (request: WeeklyCheckInAiRequest) => Promise<Record<string, unknown>>;
  firebaseAiPatternFinder?: (request: PatternFinderAiRequest) => Promise<Record<string, unknown>>;
  firebaseAiPrepareVisit?: (request: PrepareVisitAiRequest) => Promise<Record<string, unknown>>;
  firebaseAiLogicReady?: boolean;
  firebaseAiLogicInitError?: string;
  lucide?: LucideBridge;
  webkitAudioContext?: typeof AudioContext;
  Capacitor?: { isNativePlatform?: () => boolean };
}

interface RuntimeHealthProfile {
  sex: '' | 'female' | 'male';
  dob: string;
  heightIn: number | null;
  activity: '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  updatedAt: number;
}

interface RuntimeRoomTempTracker {
  active: boolean;
  startedAt: number;
  accumulatedMs: number;
  firstUseAt: number;
  updatedAt: number;
}

interface RuntimeSettings {
  medication: string;
  presentation: string;
  inventoryByProduct: StringMap<number>;
  inventoryBaseByProduct: StringMap<number>;
  roomTempTrackers: StringMap<RuntimeRoomTempTracker>;
  goalWeight: number;
  calGoal: number;
  tdee: number;
  proteinGoal: number;
  waterGoal: number;
  pensInStock: number;
  roomTempTrackingEnabled: boolean;
  roomTempPenStart: number | null;
  fastingStart: number | null;
  isFasting: boolean;
  language: 'es' | 'en';
  units: 'imperial' | 'metric';
  maintenanceEnabled: boolean;
  maintenanceRangeLb: number;
}

interface RuntimeSymptoms {
  nausea?: number | string;
  fatigue?: number | string;
  heartburn?: number | string;
  sulfur?: number | string;
  hunger?: number | string;
  notes?: string;
}

interface RuntimeMeal {
  id?: string;
  slot?: string;
  time?: string;
  name?: string;
  nameEs?: string;
  nameEn?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  tip?: string;
  tipEs?: string;
  tipEn?: string;
  aiGenerated?: boolean;
  analysisLanguage?: string;
  analysisSource?: string;
  updatedAt?: number;
}

interface RuntimeWaterEvent {
  id: string;
  delta: number;
  updatedAt: number;
}

interface RuntimeBowelMovementRecord {
  id: string;
  at: string;
  updatedAt: number;
}

interface RuntimeDayData {
  water: number;
  waterUpdatedAt: number;
  waterEvents: RuntimeWaterEvent[];
  meals: RuntimeMeal[];
  symptoms: RuntimeSymptoms;
  symptomsUpdatedAt: number;
  electrolytes: Record<string, boolean>;
  electrolytesUpdatedAt: number;
  bowelMovements?: string[];
  bowelMovementRecords: RuntimeBowelMovementRecord[];
  bowelMovementsUpdatedAt: number;
}

interface RuntimeInjection {
  id: string;
  date: string;
  time?: string;
  dose: string;
  medication?: string;
  presentation?: string;
  productKey?: string;
  site?: string;
  notes?: string;
  inventoryConsumed?: boolean;
  updatedAt?: number;
}

interface RuntimeInventoryEvent {
  id: string;
  productKey: string;
  delta: number;
  reason: string;
  sourceId: string;
  updatedAt: number;
}

interface RuntimeWeight {
  id?: string;
  date: string;
  weight: number;
  updatedAt?: number;
}

interface RuntimeMeasurement {
  id?: string;
  date: string;
  waist?: number | null;
  chest?: number | null;
  hips?: number | null;
  neck?: number | null;
  updatedAt?: number;
}

interface RuntimeAiModelStats {
  modelName: string;
  attempts: number;
  successes: number;
  failures: number;
  lastSuccessAt: number;
  lastFailureAt: number;
  lastEventAt: number;
  lastResult: '' | 'success' | 'failure';
  consecutiveFailures: number;
  lastLatencyMs: number;
}
interface RuntimeAiDeviceStats {
  primary: RuntimeAiModelStats;
  fallback: RuntimeAiModelStats;
  failovers: number;
  translations: number;
  updatedAt: number;
}
interface RuntimeAiMonthStats {
  devices: StringMap<RuntimeAiDeviceStats>;
  updatedAt: number;
}

type RuntimeAiTelemetry = StringMap<RuntimeAiMonthStats>;

type RuntimeAiReportType = 'ask-data' | 'weekly-checkin' | 'pattern-finder' | 'visit-prep';
interface RuntimeAiHistoryRecord {
  id: string;
  type: RuntimeAiReportType;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  favorite: boolean;
  fingerprint: string;
  rangeDays: number;
  rangeStart: string;
  rangeEnd: string;
  requestText: string;
  result: StringMap<string>;
  snapshot: UnknownRecord;
  appVersion: string;
}
type RuntimeDeletedBucket = StringMap<number | UnknownRecord>;
interface RuntimeDeletedRecords {
  meals: RuntimeDeletedBucket;
  weights: RuntimeDeletedBucket;
  injections: RuntimeDeletedBucket;
  measurements: RuntimeDeletedBucket;
  bowelMovements: RuntimeDeletedBucket;
}

interface RuntimeMeta {
  schemaVersion: number;
  ownerUid: string | null;
  dataEpoch: string;
  resetAt: number;
  settingsUpdatedAt: number;
  settingsFieldUpdatedAt: StringMap<number>;
  clientVersion: string;
  lastMutationAt: number;
}

interface RuntimeSyncMeta {
  schemaVersion: number;
  clientVersion: string;
  minClientVersion: string;
  dataEpoch: string;
  revision: number;
  serverUpdatedAt?: unknown;
}

interface RuntimeState {
  selectedDate: string;
  settings: RuntimeSettings;
  daysData: StringMap<RuntimeDayData>;
  injections: RuntimeInjection[];
  inventoryEvents: RuntimeInventoryEvent[];
  weights: RuntimeWeight[];
  measurements: RuntimeMeasurement[];
  healthProfile: RuntimeHealthProfile;
  aiTelemetry: RuntimeAiTelemetry;
  aiHistory: RuntimeAiHistoryRecord[];
  deletedRecords: RuntimeDeletedRecords;
  meta: RuntimeMeta;
}

interface RuntimeCloudDocument extends RuntimeState {
  _sync?: RuntimeSyncMeta;
}

interface MedicationProfile {
  key: string;
  name: string;
  generic: string;
  route: 'injection' | 'oral';
  frequencyDays: number;
  halfLifeDays: number;
  pkTmaxHours: number;
  roomTempDays: number | null;
  roomTempMaxF?: number;
  roomTempMaxC?: number;
  inventoryUnitEs: string;
  inventoryUnitEn: string;
  doses: Array<[string, string, string]>;
}

interface MedicationPresentation {
  key: string;
  es: string;
  en: string;
  timerMode: string;
  inventoryMode: string;
  roomTempDays?: number | null;
  maxF?: number | null;
  maxC?: number | null;
  firstUseDays?: number;
  maxUnitDoses?: number;
  noReturnToFridge?: boolean;
}

interface PkRecord {
  inj: RuntimeInjection;
  ts: number;
  dose: number;
}
interface PkEstimate {
  active: number;
  pct: number | null;
  peakPct: number | null;
  expectedPeak: number;
  hoursSince: number;
  phase: 'rising' | 'peak' | 'elimination';
  latest: PkRecord;
  nextDoseTs: number;
  legacyTime: boolean;
  records: PkRecord[];
}




interface SmartBodyMetrics {
  bmi: number | null;
  bmr: number | null;
  tdee: number | null;
  whtr: number | null;
  bodyFat: number | null;
  fatMassLb: number | null;
  leanMassLb: number | null;
  hydrationOz: number | null;
}

interface ServerSafetyBackupEntry {
  slot: string;
  revision: number;
  savedAt: number;
  snapshot: RuntimeState | RuntimeCloudDocument;
}


interface BackupCountSummary {
  weights: number;
  injections: number;
  meals: number;
  measurements: number;
  days: number;
  health: number;
}
interface BackupPackageInfo {
  type: string;
  localCount: number;
  serverCount: number;
  localBackups: unknown[];
  serverBackups: unknown[];
  serverBackupsArchivalOnly: boolean;
}
interface BackupValidationSuccess {
  ok: true;
  legacy: boolean;
  counts: BackupCountSummary;
  version: string;
  packageInfo?: BackupPackageInfo | null;
}
interface BackupValidationFailure {
  ok: false;
  reason: string;
  packageInfo?: BackupPackageInfo | null;
}
type BackupStructureValidation = BackupValidationSuccess | BackupValidationFailure;

interface BackupEnvelope {
  data: unknown;
  packageInfo: BackupPackageInfo | null;
}

interface EmergencyStateEntry {
  key: string;
  savedAt: number;
  appVersion: string;
  snapshot: RuntimeState;
}

interface LocalSafetyBackupEntry {
  slot?: number;
  key?: string;
  savedAt: number;
  appVersion?: string;
  snapshot: RuntimeState | RuntimeCloudDocument;
}

interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    weights: number;
    injections: number;
    meals: number;
    measurements: number;
    days: number;
    health: boolean;
  };
  packageInfo?: UnknownRecord | null;
}
