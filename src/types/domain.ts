/**
 * GLP-1 Companion v5.3.0 — initial TypeScript domain contracts.
 *
 * These interfaces intentionally describe the stable schema without changing
 * runtime serialization. They are a migration aid: JavaScript runtime modules
 * continue to read/write the exact same schema 13 data.
 */

export type AppLanguage = 'es' | 'en';
export type UnitSystem = 'imperial' | 'metric';
export type Sex = '' | 'female' | 'male';
export type ActivityLevel = '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface AppMeta {
  schemaVersion: number;
  ownerUid: string | null;
  dataEpoch: string;
  resetAt: number;
  settingsUpdatedAt: number;
  settingsFieldUpdatedAt: Record<string, number>;
  clientVersion: string;
  lastMutationAt: number;
}

export interface RoomTemperatureTracker {
  active: boolean;
  startedAt: number;
  accumulatedMs: number;
  firstUseAt: number;
  updatedAt: number;
}

export interface AppSettings {
  medication: string;
  presentation: string;
  inventoryByProduct: Record<string, number>;
  inventoryBaseByProduct: Record<string, number>;
  roomTempTrackers: Record<string, RoomTemperatureTracker>;
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
  language: AppLanguage;
  units: UnitSystem;
  maintenanceEnabled: boolean;
  maintenanceRangeLb: number;
  [key: string]: unknown;
}

export interface HealthProfile {
  sex: Sex;
  dob: string;
  heightIn: number | null;
  activity: ActivityLevel;
  updatedAt: number;
}

export interface InventoryEvent {
  id: string;
  productKey: string;
  delta: number;
  updatedAt: number;
  createdAt?: number;
  reason?: string;
  injectionId?: string;
  deletedAt?: number;
  [key: string]: unknown;
}

export interface InjectionRecord {
  id?: string;
  date?: string;
  timestamp?: number;
  medication?: string;
  presentation?: string;
  productKey?: string;
  dose?: number;
  doseMg?: number;
  inventoryConsumed?: boolean;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface WeightRecord {
  id?: string;
  date: string;
  weight: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface MeasurementRecord {
  id?: string;
  date: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface MealRecord {
  id?: string;
  name?: string;
  nameEs?: string;
  nameEn?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  tipEs?: string;
  tipEn?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface WaterEvent {
  id: string;
  delta: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface DayData {
  water?: number;
  waterUpdatedAt?: number;
  waterEvents?: WaterEvent[];
  meals?: MealRecord[];
  [key: string]: unknown;
}

export interface DeletedRecordMaps {
  meals: Record<string, number | Record<string, unknown>>;
  weights: Record<string, number | Record<string, unknown>>;
  injections: Record<string, number | Record<string, unknown>>;
  measurements: Record<string, number | Record<string, unknown>>;
  bowelMovements: Record<string, number | Record<string, unknown>>;
  [key: string]: Record<string, number | Record<string, unknown>>;
}

export type AiReportType = 'ask-data' | 'weekly-checkin' | 'pattern-finder' | 'visit-prep';
export interface AiHistoryRecord {
  id: string;
  type: AiReportType;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  favorite: boolean;
  fingerprint: string;
  rangeDays: number;
  rangeStart: string;
  rangeEnd: string;
  requestText: string;
  result: Record<string, string>;
  snapshot: Record<string, unknown>;
  appVersion: string;
}

export interface AppState {
  selectedDate: string;
  settings: AppSettings;
  daysData: Record<string, DayData>;
  injections: InjectionRecord[];
  inventoryEvents: InventoryEvent[];
  weights: WeightRecord[];
  measurements: MeasurementRecord[];
  healthProfile: HealthProfile;
  aiTelemetry: Record<string, unknown>;
  aiHistory: AiHistoryRecord[];
  deletedRecords: DeletedRecordMaps;
  meta: AppMeta;
  [key: string]: unknown;
}

export interface CloudSyncMeta {
  schemaVersion: number;
  clientVersion: string;
  minClientVersion: string;
  dataEpoch: string;
  revision: number;
  serverUpdatedAt?: unknown;
  [key: string]: unknown;
}

export interface CloudTrackerDocument extends AppState {
  _sync?: CloudSyncMeta;
}
