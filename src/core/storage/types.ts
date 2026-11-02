/**
 * T004 데이터 계층의 공개 타입.
 *
 * 1단계에는 서버가 없으므로 모든 기록은 학생 기기 안에만 둔다.
 * 학습자 ID는 이름이 아니라 학급 번호 문자열("1"~"30")이다.
 * 화면 좌표는 저장하지 않는다. 엔진 Action의 논리 좌표 x·y는 허용한다.
 */
import type { EngineId, JsonValue, UnitId } from '../engine-sdk';

/** 학급 번호 문자열. 1단계에서는 "1"~"30"만 쓴다. */
export type LearnerId = string;

/** docs/05-learning-engine.md §6의 문장제 스킨 키. */
export type Interest = 'baseball' | 'cooking' | 'space' | 'game' | 'animals' | 'music';

export const INTERESTS: readonly Interest[] = [
  'baseball',
  'cooking',
  'space',
  'game',
  'animals',
  'music',
];

export interface Learner {
  readonly number: LearnerId;
  readonly interests: readonly Interest[];
  /** 마지막으로 관심사를 고친 시각. 내보내기 합치기에 쓴다. */
  readonly updatedAt: number;
}

export const LEARNING_VERBS = [
  'started',
  'acted',
  'submitted',
  'passed',
  'failed',
  'hinted',
  'backtracked',
  'self-corrected',
  'completed',
] as const;

export type LearningVerb = (typeof LEARNING_VERBS)[number];

/** JSON 객체. LearningEvent.data는 이 값만 담을 수 있다. */
export type JsonObject = { readonly [key: string]: JsonValue };

/** 저장 금지: 화면 좌표·궤적 키. 중첩 객체와 배열 안까지 검사한다. */
export const SCREEN_COORDINATE_KEYS = [
  'clientX',
  'clientY',
  'pageX',
  'pageY',
  'screenX',
  'screenY',
  'offsetX',
  'offsetY',
  'movementX',
  'movementY',
  'trail',
  'trajectory',
  'pointerPath',
] as const;

export type ScreenCoordinateKey = (typeof SCREEN_COORDINATE_KEYS)[number];

/**
 * 타입 수준에서 화면 좌표 키를 막는다.
 * 금지 키의 속성 타입이 never가 되므로 객체 리터럴을 넘길 때 컴파일 오류가 난다.
 */
export type NoScreenCoordinates<T> = T extends readonly (infer U)[]
  ? readonly NoScreenCoordinates<U>[]
  : T extends object
    ? {
        readonly [K in keyof T]: K extends ScreenCoordinateKey ? never : NoScreenCoordinates<T[K]>;
      }
    : T;

export interface LearningEventBase {
  /** 기기 로컬 학습자 ID 또는 "학급코드-번호". 실명 금지. */
  readonly learner: LearnerId;
  readonly unit: UnitId;
  readonly task: string;
  readonly engine: EngineId;
  readonly verb: LearningVerb;
}

/** logEvent()에 넘기는 값. id와 t는 저장할 때 붙는다. */
export type LearningEventDraft<D extends JsonObject = JsonObject> = LearningEventBase & {
  // D로 타입을 추론하게 두고, NoScreenCoordinates<D>로 금지 키를 검사한다.
  readonly data?: D & NoScreenCoordinates<D>;
};

/** 저장된 이벤트. docs/02-architecture.md §3의 LearningEvent에 id를 더했다. */
export interface LearningEvent extends LearningEventBase {
  readonly id: string;
  /** epoch ms */
  readonly t: number;
  readonly data?: JsonObject;
}

/**
 * 개념 숙달도. 같은 개념이라도 학생마다 따로 저장한다.
 * id는 `${learner}:${conceptId}`로 만든다. 합치기에서 이 id를 기준으로 최신 값을 고른다.
 */
export interface MasteryRecord {
  readonly id: string;
  readonly learner: LearnerId;
  readonly conceptId: string;
  /** 숙달 확률 0~1 */
  readonly p: number;
  readonly updatedAt: number;
}

export function masteryId(learner: LearnerId, conceptId: string): string {
  return `${learner}:${conceptId}`;
}

export type TaskStatus = 'in-progress' | 'completed';

/**
 * 과제 진행 기록.
 * id는 `${learner}:${taskId}`로 만든다. 합치기에서 이 id를 기준으로 최신 값을 고른다.
 */
export interface TaskProgress {
  readonly id: string;
  readonly learner: LearnerId;
  readonly taskId: string;
  readonly unit: UnitId;
  readonly status: TaskStatus;
  readonly updatedAt: number;
}

export function taskProgressId(learner: LearnerId, taskId: string): string {
  return `${learner}:${taskId}`;
}

/** 교사 PIN은 원문을 저장하지 않고 SHA-256(salt + PIN)만 저장한다. */
export type TeacherPinRecord = {
  readonly algorithm: 'SHA-256';
  readonly salt: string;
  readonly hash: string;
};

export type UnitDisplayNames = { readonly [unitId: string]: string };

export const SETTINGS_KEYS = {
  deviceId: 'deviceId',
  teacherPin: 'teacherPin',
  enabledUnits: 'enabledUnits',
  unitDisplayNames: 'unitDisplayNames',
} as const;

export interface SettingRow {
  readonly key: string;
  readonly value: JsonValue;
}

export type StorageBackendKind = 'indexeddb' | 'memory';

export interface StorageStatus {
  readonly backend: StorageBackendKind;
  /** navigator.storage.persist() 결과. 아이패드 Safari는 7일 미사용 시 지울 수 있다. */
  readonly persisted: boolean;
}

/** 저장소 구현이 제공하는 공통 API. IndexedDB와 메모리 구현이 같은 계약을 지킨다. */
export interface Storage {
  readonly backend: StorageBackendKind;
  /** 메모리로 대체된 이유. IndexedDB를 쓴 경우 undefined. */
  readonly fallbackReason?: string;

  status(): Promise<StorageStatus>;
  close(): Promise<void>;

  putLearner(learner: Learner): Promise<void>;
  putLearners(learners: readonly Learner[]): Promise<void>;
  getLearner(number: LearnerId): Promise<Learner | undefined>;
  listLearners(): Promise<Learner[]>;

  putEvent(event: LearningEvent): Promise<void>;
  putEvents(events: readonly LearningEvent[]): Promise<void>;
  listEvents(): Promise<LearningEvent[]>;

  putMastery(record: MasteryRecord): Promise<void>;
  putMasteryRecords(records: readonly MasteryRecord[]): Promise<void>;
  listMastery(): Promise<MasteryRecord[]>;

  putTaskProgress(progress: TaskProgress): Promise<void>;
  putTaskProgressRecords(records: readonly TaskProgress[]): Promise<void>;
  listTaskProgress(): Promise<TaskProgress[]>;

  getSetting<T extends JsonValue>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: JsonValue): Promise<void>;

  /** 처음 호출할 때 UUID를 만들어 settings에 저장한다. */
  getDeviceId(): Promise<string>;
}

/** logEvent()가 필요로 하는 최소 저장소 표면. 테스트에서 가짜 저장소를 쓰기 쉽게 한다. */
export interface EventSink {
  putEvent(event: LearningEvent): Promise<void>;
}

export interface SettingsStore {
  getSetting<T extends JsonValue>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: JsonValue): Promise<void>;
}

export interface ExportFile {
  readonly format: 'mathexplorer-export';
  readonly version: 1;
  readonly deviceId: string;
  readonly exportedAt: number;
  readonly learners: readonly Learner[];
  readonly events: readonly LearningEvent[];
  readonly mastery: readonly MasteryRecord[];
  readonly taskProgress: readonly TaskProgress[];
}

export const EXPORT_FORMAT = 'mathexplorer-export';
export const EXPORT_VERSION = 1;
