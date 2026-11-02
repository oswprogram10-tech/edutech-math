/**
 * 내보내기·가져오기.
 *
 * 1단계에는 서버가 없으므로 교사가 기기별 기록을 JSON 파일이나 QR로 모은다.
 * 파일에는 settings(교사 PIN 포함)를 넣지 않는다. 학습자 번호·관심사·이벤트·
 * 숙달도·과제 진행만 담는다.
 */
import qrcode from 'qrcode-generator';
import { compressToEncodedURIComponent } from 'lz-string';
import { assertSafeEventData, UnsafeEventDataError } from './event';
import { storageStrings } from './strings.ko';
import type { ImportFailureReason } from './strings.ko';
import type {
  ExportFile,
  Interest,
  JsonObject,
  Learner,
  LearningEvent,
  LearningVerb,
  MasteryRecord,
  Storage,
  TaskProgress,
} from './types';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  INTERESTS,
  LEARNING_VERBS,
  masteryId,
  taskProgressId,
} from './types';

/** QR로 담을 수 있는 압축 코드의 최대 길이(문자 수). */
export const QR_MAX_LENGTH = 2000;

export interface CreateExportOptions {
  /** 테스트에서 시각을 고정할 때 쓴다. */
  readonly now?: number;
  readonly deviceId?: string;
}

/** 저장소의 모든 기록을 내보내기 파일 객체로 만든다. */
export async function createExport(
  storage: Storage,
  options: CreateExportOptions = {},
): Promise<ExportFile> {
  const [learners, events, mastery, taskProgress, deviceId] = await Promise.all([
    storage.listLearners(),
    storage.listEvents(),
    storage.listMastery(),
    storage.listTaskProgress(),
    options.deviceId ?? storage.getDeviceId(),
  ]);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    deviceId,
    exportedAt: options.now ?? Date.now(),
    learners,
    events,
    mastery,
    taskProgress,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `mathexplorer-<번호들>-<YYYY-MM-DD>.json`. 번호는 숫자 순서로 정렬한다. */
export function exportFileName(learners: readonly Learner[], now = Date.now()): string {
  const numbers = learners
    .map((learner) => learner.number)
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const date = new Date(now);
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const who = numbers.length > 0 ? numbers.join('-') : 'all';
  return `mathexplorer-${who}-${day}.json`;
}

/** 브라우저에서 JSON 파일을 내려받는다. 파일 이름은 exportFileName()을 쓴다. */
export function downloadJson(fileName: string, data: unknown, doc: Document = document): string {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Safari는 클릭 직후 revoke하면 다운로드가 취소될 수 있어 다음 작업으로 미룬다.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return url;
}

/** 내보내기 파일을 만들어 바로 다운로드한다. */
export async function downloadExport(
  storage: Storage,
  options: CreateExportOptions = {},
): Promise<ExportFile> {
  const file = await createExport(storage, options);
  downloadJson(exportFileName(file.learners, options.now), file);
  return file;
}

export type ExportQrResult =
  | {
      readonly ok: true;
      readonly code: string;
      readonly length: number;
      /** 화면에 넣을 수 있는 SVG 문자열. */
      readonly svg: string;
    }
  | {
      readonly ok: false;
      readonly error: 'TOO_LARGE';
      readonly length: number;
      readonly message: string;
    };

/**
 * 내보내기 JSON을 압축해 QR SVG로 만든다.
 * 2,000자를 넘으면 QR을 만들지 않고 파일 내보내기를 안내한다.
 */
export function createExportQr(file: ExportFile): ExportQrResult {
  const code = compressToEncodedURIComponent(JSON.stringify(file));
  if (code.length > QR_MAX_LENGTH) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      length: code.length,
      message: storageStrings.qrTooLarge,
    };
  }

  // typeNumber 0 = 데이터 양에 맞춰 자동 선택. 오류 정정 M은 화면·인쇄 모두 무난하다.
  const qr = qrcode(0, 'M');
  qr.addData(code);
  qr.make();
  return {
    ok: true,
    code,
    length: code.length,
    svg: qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }),
  };
}

export type ParseExportResult =
  | { readonly ok: true; readonly file: ExportFile }
  | { readonly ok: false; readonly reason: ImportFailureReason; readonly message: string };

class ShapeError extends Error {}

function fail(reason: ImportFailureReason): ParseExportResult {
  return { ok: false, reason, message: storageStrings.importReasons[reason] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseLearner(value: unknown): Learner {
  if (!isRecord(value)) throw new ShapeError('learner');
  if (typeof value['number'] !== 'string' || value['number'].length === 0) {
    throw new ShapeError('learner.number');
  }
  if (!isStringArray(value['interests'])) throw new ShapeError('learner.interests');
  const interests = value['interests'].filter((item): item is Interest =>
    (INTERESTS as readonly string[]).includes(item),
  );
  if (!isFiniteNumber(value['updatedAt'])) throw new ShapeError('learner.updatedAt');
  return { number: value['number'], interests, updatedAt: value['updatedAt'] };
}

function parseEvent(value: unknown): LearningEvent {
  if (!isRecord(value)) throw new ShapeError('event');
  if (typeof value['id'] !== 'string' || value['id'].length === 0) {
    throw new ShapeError('event.id');
  }
  if (!isFiniteNumber(value['t'])) throw new ShapeError('event.t');
  if (typeof value['learner'] !== 'string') throw new ShapeError('event.learner');
  if (typeof value['unit'] !== 'string') throw new ShapeError('event.unit');
  if (typeof value['task'] !== 'string') throw new ShapeError('event.task');
  if (typeof value['engine'] !== 'string') throw new ShapeError('event.engine');
  if (
    typeof value['verb'] !== 'string' ||
    !(LEARNING_VERBS as readonly string[]).includes(value['verb'])
  ) {
    throw new ShapeError('event.verb');
  }

  const data = value['data'];
  if (data !== undefined && !isRecord(data)) throw new ShapeError('event.data');
  if (data !== undefined) {
    // 저장 전 이벤트와 같은 규칙으로 화면 좌표 키를 거부한다.
    assertSafeEventData(data as JsonObject);
  }

  return {
    id: value['id'],
    t: value['t'],
    learner: value['learner'],
    unit: value['unit'],
    task: value['task'],
    engine: value['engine'] as LearningEvent['engine'],
    verb: value['verb'] as LearningVerb,
    ...(data === undefined ? {} : { data: data as JsonObject }),
  };
}

function parseMastery(value: unknown): MasteryRecord {
  if (!isRecord(value)) throw new ShapeError('mastery');
  if (typeof value['learner'] !== 'string' || value['learner'].length === 0) {
    throw new ShapeError('mastery.learner');
  }
  if (typeof value['conceptId'] !== 'string' || value['conceptId'].length === 0) {
    throw new ShapeError('mastery.conceptId');
  }
  if (!isFiniteNumber(value['p']) || value['p'] < 0 || value['p'] > 1) {
    throw new ShapeError('mastery.p');
  }
  if (!isFiniteNumber(value['updatedAt'])) throw new ShapeError('mastery.updatedAt');
  // 파일에 id가 있어도 learner·conceptId로 다시 만든다. 키가 어긋나면 합치기가 틀어진다.
  return {
    id: masteryId(value['learner'], value['conceptId']),
    learner: value['learner'],
    conceptId: value['conceptId'],
    p: value['p'],
    updatedAt: value['updatedAt'],
  };
}

function parseTaskProgress(value: unknown): TaskProgress {
  if (!isRecord(value)) throw new ShapeError('taskProgress');
  if (typeof value['learner'] !== 'string') throw new ShapeError('taskProgress.learner');
  if (typeof value['taskId'] !== 'string' || value['taskId'].length === 0) {
    throw new ShapeError('taskProgress.taskId');
  }
  if (typeof value['unit'] !== 'string') throw new ShapeError('taskProgress.unit');
  if (value['status'] !== 'in-progress' && value['status'] !== 'completed') {
    throw new ShapeError('taskProgress.status');
  }
  if (!isFiniteNumber(value['updatedAt'])) throw new ShapeError('taskProgress.updatedAt');
  const id =
    typeof value['id'] === 'string' && value['id'].length > 0
      ? value['id']
      : taskProgressId(value['learner'], value['taskId']);
  return {
    id,
    learner: value['learner'],
    taskId: value['taskId'],
    unit: value['unit'],
    status: value['status'],
    updatedAt: value['updatedAt'],
  };
}

function parseArray<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new ShapeError('array');
  return value.map(parse);
}

/**
 * 파일 하나를 검사한다. 문자열이면 JSON.parse부터 한다.
 * 형식·버전이 다르거나 모양이 깨졌으면 이유를 돌려준다(던지지 않음).
 */
export function parseExportFile(input: unknown): ParseExportResult {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      return fail('invalid-json');
    }
  }

  if (!isRecord(value) || value['format'] !== EXPORT_FORMAT) {
    return fail('wrong-format');
  }
  if (value['version'] !== EXPORT_VERSION) {
    return fail('wrong-version');
  }
  if (typeof value['deviceId'] !== 'string' || !isFiniteNumber(value['exportedAt'])) {
    return fail('invalid-shape');
  }

  try {
    const file: ExportFile = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      deviceId: value['deviceId'],
      exportedAt: value['exportedAt'],
      learners: parseArray(value['learners'], parseLearner),
      events: parseArray(value['events'], parseEvent),
      mastery: parseArray(value['mastery'], parseMastery),
      taskProgress: parseArray(value['taskProgress'], parseTaskProgress),
    };
    return { ok: true, file };
  } catch (error) {
    if (error instanceof UnsafeEventDataError) return fail('unsafe-data');
    return fail('invalid-shape');
  }
}

export interface ImportSkip {
  /** importExportFiles()에 넘긴 배열에서의 위치(0부터). */
  readonly index: number;
  readonly reason: ImportFailureReason;
  readonly message: string;
}

export interface ImportSummary {
  readonly files: number;
  readonly imported: number;
  readonly skipped: readonly ImportSkip[];
  /** 이번 가져오기로 새로 더해진 수. */
  readonly added: {
    readonly learners: number;
    readonly events: number;
    readonly mastery: number;
    readonly taskProgress: number;
  };
}

function mergeLearner(existing: Learner | undefined, incoming: Learner): Learner {
  if (!existing) return incoming;
  const interests = [...existing.interests];
  for (const interest of incoming.interests) {
    if (!interests.includes(interest)) interests.push(interest);
  }
  return {
    number: existing.number,
    interests,
    updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
  };
}

function newer<T extends { readonly updatedAt: number }>(existing: T | undefined, incoming: T): T {
  if (!existing) return incoming;
  return incoming.updatedAt > existing.updatedAt ? incoming : existing;
}

/**
 * 교사 기기에서 여러 내보내기 파일을 합친다.
 * - 이벤트: id로 중복 제거
 * - 학습자: 번호로 합치고 관심사는 합집합
 * - 숙달도·과제 진행: updatedAt이 최신인 값이 이긴다
 * 깨진 파일은 그 파일만 건너뛰고 이유를 요약에 남긴다.
 */
export async function importExportFiles(
  storage: Storage,
  inputs: readonly unknown[],
): Promise<ImportSummary> {
  const skipped: ImportSkip[] = [];
  const files: ExportFile[] = [];

  inputs.forEach((input, index) => {
    const parsed = parseExportFile(input);
    if (parsed.ok) {
      files.push(parsed.file);
    } else {
      skipped.push({ index, reason: parsed.reason, message: parsed.message });
    }
  });

  const existingLearners = new Map<string, Learner>();
  for (const learner of await storage.listLearners()) {
    existingLearners.set(learner.number, learner);
  }

  const existingEvents = new Set((await storage.listEvents()).map((event) => event.id));
  const eventById = new Map<string, LearningEvent>();

  const existingMastery = new Map<string, MasteryRecord>();
  for (const record of await storage.listMastery()) {
    existingMastery.set(record.id, record);
  }

  const existingTaskProgress = new Map<string, TaskProgress>();
  for (const record of await storage.listTaskProgress()) {
    existingTaskProgress.set(record.id, record);
  }

  const learnerCountBefore = existingLearners.size;
  const masteryCountBefore = existingMastery.size;
  const taskProgressCountBefore = existingTaskProgress.size;

  for (const file of files) {
    for (const learner of file.learners) {
      existingLearners.set(
        learner.number,
        mergeLearner(existingLearners.get(learner.number), learner),
      );
    }
    for (const event of file.events) {
      const current = eventById.get(event.id);
      if (!current || event.t > current.t) eventById.set(event.id, event);
    }
    for (const record of file.mastery) {
      existingMastery.set(record.id, newer(existingMastery.get(record.id), record));
    }
    for (const record of file.taskProgress) {
      existingTaskProgress.set(record.id, newer(existingTaskProgress.get(record.id), record));
    }
  }

  const newEvents = [...eventById.values()].filter((event) => !existingEvents.has(event.id));
  const mergedLearners = [...existingLearners.values()];
  const mergedMastery = [...existingMastery.values()];
  const mergedTaskProgress = [...existingTaskProgress.values()];

  // 파일에 하나도 없어도 기존 기록은 다시 쓰지 않는다.
  if (files.length > 0) {
    await storage.putLearners(mergedLearners);
    await storage.putEvents(newEvents);
    await storage.putMasteryRecords(mergedMastery);
    await storage.putTaskProgressRecords(mergedTaskProgress);
  }

  return {
    files: inputs.length,
    imported: files.length,
    skipped,
    added: {
      learners: existingLearners.size - learnerCountBefore,
      events: newEvents.length,
      mastery: existingMastery.size - masteryCountBefore,
      taskProgress: existingTaskProgress.size - taskProgressCountBefore,
    },
  };
}
