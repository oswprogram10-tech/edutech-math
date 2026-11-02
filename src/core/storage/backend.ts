/**
 * 저장소 구현 두 가지.
 *
 * - DexieStorage: IndexedDB. 1단계의 기본 저장소.
 * - MemoryStorage: IndexedDB를 열 수 없을 때의 대체. 같은 API를 지킨다.
 *
 * 두 구현은 `__tests__/storage.test.ts`의 같은 계약 테스트를 통과한다.
 */
import Dexie, { type Table } from 'dexie';
import { getOrCreateDeviceId } from './settings';
import type { JsonValue } from '../engine-sdk';
import type {
  JsonObject,
  Learner,
  LearningEvent,
  MasteryRecord,
  SettingRow,
  Storage,
  StorageStatus,
  TaskProgress,
} from './types';

const DATABASE_NAME = 'mathexplorer';
const DATABASE_VERSION = 1;

function byNumber(a: Learner, b: Learner): number {
  const diff = Number(a.number) - Number(b.number);
  return diff !== 0 ? diff : a.number.localeCompare(b.number);
}

function byEventTime(a: LearningEvent, b: LearningEvent): number {
  return a.t !== b.t ? a.t - b.t : a.id.localeCompare(b.id);
}

class MathExplorerDatabase extends Dexie {
  learners!: Table<Learner, string>;
  events!: Table<LearningEvent, string>;
  mastery!: Table<MasteryRecord, string>;
  taskProgress!: Table<TaskProgress, string>;
  settings!: Table<SettingRow, string>;

  constructor(name: string, options: DexieOptions) {
    super(name, options);
    this.version(DATABASE_VERSION).stores({
      learners: '&number, updatedAt',
      events: '&id, t, learner, unit, task, engine, verb',
      mastery: '&conceptId, updatedAt',
      taskProgress: '&id, learner, taskId, unit, updatedAt',
      settings: '&key',
    });
  }
}

export interface DexieOptions {
  readonly indexedDB?: IDBFactory;
  readonly IDBKeyRange?: typeof IDBKeyRange;
}

export class DexieStorage implements Storage {
  readonly backend = 'indexeddb' as const;
  private readonly db: MathExplorerDatabase;
  private persisted = false;

  constructor(name = DATABASE_NAME, options: DexieOptions = {}) {
    this.db = new MathExplorerDatabase(name, options);
  }

  /** 실제로 DB를 연다. 실패하면 openStorage가 메모리 구현으로 바꾼다. */
  async open(): Promise<void> {
    await this.db.open();
  }

  setPersisted(value: boolean): void {
    this.persisted = value;
  }

  async status(): Promise<StorageStatus> {
    return { backend: 'indexeddb', persisted: this.persisted };
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async putLearner(learner: Learner): Promise<void> {
    await this.db.learners.put(learner);
  }

  async putLearners(learners: readonly Learner[]): Promise<void> {
    if (learners.length === 0) return;
    await this.db.learners.bulkPut([...learners]);
  }

  async getLearner(number: string): Promise<Learner | undefined> {
    return this.db.learners.get(number);
  }

  async listLearners(): Promise<Learner[]> {
    const learners = await this.db.learners.toArray();
    return learners.sort(byNumber);
  }

  async putEvent(event: LearningEvent): Promise<void> {
    await this.db.events.put(event);
  }

  async putEvents(events: readonly LearningEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.db.events.bulkPut([...events]);
  }

  async listEvents(): Promise<LearningEvent[]> {
    const events = await this.db.events.toArray();
    return events.sort(byEventTime);
  }

  async putMastery(record: MasteryRecord): Promise<void> {
    await this.db.mastery.put(record);
  }

  async putMasteryRecords(records: readonly MasteryRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.db.mastery.bulkPut([...records]);
  }

  async listMastery(): Promise<MasteryRecord[]> {
    const records = await this.db.mastery.toArray();
    return records.sort((a, b) => a.conceptId.localeCompare(b.conceptId));
  }

  async putTaskProgress(progress: TaskProgress): Promise<void> {
    await this.db.taskProgress.put(progress);
  }

  async putTaskProgressRecords(records: readonly TaskProgress[]): Promise<void> {
    if (records.length === 0) return;
    await this.db.taskProgress.bulkPut([...records]);
  }

  async listTaskProgress(): Promise<TaskProgress[]> {
    const records = await this.db.taskProgress.toArray();
    return records.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getSetting<T extends JsonValue>(key: string): Promise<T | undefined> {
    const row = await this.db.settings.get(key);
    return row?.value as T | undefined;
  }

  async setSetting(key: string, value: JsonValue): Promise<void> {
    await this.db.settings.put({ key, value });
  }

  async getDeviceId(): Promise<string> {
    return getOrCreateDeviceId(this);
  }
}

export class MemoryStorage implements Storage {
  readonly backend = 'memory' as const;
  private readonly learners = new Map<string, Learner>();
  private readonly events = new Map<string, LearningEvent>();
  private readonly mastery = new Map<string, MasteryRecord>();
  private readonly taskProgress = new Map<string, TaskProgress>();
  private readonly settings = new Map<string, JsonValue>();

  constructor(readonly fallbackReason?: string) {}

  async status(): Promise<StorageStatus> {
    return { backend: 'memory', persisted: false };
  }

  async close(): Promise<void> {
    // 메모리 구현은 정리할 자원이 없다. 새로 열면 빈 상태로 시작한다.
  }

  async putLearner(learner: Learner): Promise<void> {
    this.learners.set(learner.number, learner);
  }

  async putLearners(learners: readonly Learner[]): Promise<void> {
    for (const learner of learners) this.learners.set(learner.number, learner);
  }

  async getLearner(number: string): Promise<Learner | undefined> {
    return this.learners.get(number);
  }

  async listLearners(): Promise<Learner[]> {
    return [...this.learners.values()].sort(byNumber);
  }

  async putEvent(event: LearningEvent): Promise<void> {
    this.events.set(event.id, event);
  }

  async putEvents(events: readonly LearningEvent[]): Promise<void> {
    for (const event of events) this.events.set(event.id, event);
  }

  async listEvents(): Promise<LearningEvent[]> {
    return [...this.events.values()].sort(byEventTime);
  }

  async putMastery(record: MasteryRecord): Promise<void> {
    this.mastery.set(record.conceptId, record);
  }

  async putMasteryRecords(records: readonly MasteryRecord[]): Promise<void> {
    for (const record of records) this.mastery.set(record.conceptId, record);
  }

  async listMastery(): Promise<MasteryRecord[]> {
    return [...this.mastery.values()].sort((a, b) => a.conceptId.localeCompare(b.conceptId));
  }

  async putTaskProgress(progress: TaskProgress): Promise<void> {
    this.taskProgress.set(progress.id, progress);
  }

  async putTaskProgressRecords(records: readonly TaskProgress[]): Promise<void> {
    for (const record of records) this.taskProgress.set(record.id, record);
  }

  async listTaskProgress(): Promise<TaskProgress[]> {
    return [...this.taskProgress.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  async getSetting<T extends JsonValue>(key: string): Promise<T | undefined> {
    return this.settings.get(key) as T | undefined;
  }

  async setSetting(key: string, value: JsonValue): Promise<void> {
    this.settings.set(key, value);
  }

  async getDeviceId(): Promise<string> {
    return getOrCreateDeviceId(this);
  }

  /** 테스트·계약 확인용. 공개 API에서는 쓰지 않는다. */
  snapshotSettings(): JsonObject {
    return Object.fromEntries(this.settings);
  }
}
