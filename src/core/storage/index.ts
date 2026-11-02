/**
 * T004 저장소 공개 API.
 *
 * 앱·엔진·테스트는 이 파일만 import한다. 내부 구현(backend, settings 등)은
 * 바뀔 수 있다.
 */
export type {
  EventSink,
  ExportFile,
  Interest,
  JsonObject,
  Learner,
  LearnerId,
  LearningEvent,
  LearningEventDraft,
  LearningVerb,
  MasteryRecord,
  NoScreenCoordinates,
  ScreenCoordinateKey,
  SettingRow,
  SettingsStore,
  Storage,
  StorageBackendKind,
  StorageStatus,
  TaskProgress,
  TaskStatus,
  TeacherPinRecord,
  UnitDisplayNames,
} from './types';
export {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  INTERESTS,
  LEARNING_VERBS,
  SCREEN_COORDINATE_KEYS,
  SETTINGS_KEYS,
  taskProgressId,
} from './types';

export { assertSafeEventData, logEvent, UnsafeEventDataError } from './event';
export type { LogEventOptions } from './event';

export { DexieStorage, MemoryStorage } from './backend';
export type { DexieOptions } from './backend';

export { getStorage, getStorageStatus, openStorage } from './storage';
export type { OpenStorageOptions } from './storage';

export {
  getEnabledUnits,
  getOrCreateDeviceId,
  getUnitDisplayNames,
  isTeacherPinRecord,
  saveTeacherPin,
  setEnabledUnits,
  setUnitDisplayNames,
  verifyTeacherPin,
} from './settings';

export { hashPin, isValidPin, PinFormatError, verifyPin } from './pin';

export {
  decodeShareCode,
  encodeShareCode,
  readShareCodeFromHash,
  SHARE_CODE_MAX_LENGTH,
  SHARE_HASH_PREFIX,
  shareHash,
} from './share-code';
export type { DecodeShareCodeResult, ShareCodeError, ShareCodeResult } from './share-code';

export {
  createExport,
  createExportQr,
  downloadExport,
  downloadJson,
  exportFileName,
  importExportFiles,
  parseExportFile,
  QR_MAX_LENGTH,
} from './export';
export type {
  CreateExportOptions,
  ExportQrResult,
  ImportSkip,
  ImportSummary,
  ParseExportResult,
} from './export';

export { storageStrings } from './strings.ko';
export type { ImportFailureReason } from './strings.ko';
