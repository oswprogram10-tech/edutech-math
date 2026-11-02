import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../backend';
import {
  createExport,
  createExportQr,
  exportFileName,
  importExportFiles,
  parseExportFile,
  QR_MAX_LENGTH,
} from '../export';
import { saveTeacherPin } from '../settings';
import type { ExportFile, Learner, LearningEvent, MasteryRecord, TaskProgress } from '../types';
import { EXPORT_FORMAT, EXPORT_VERSION, masteryId, taskProgressId } from '../types';

function learner(number: string, interests: Learner['interests'], updatedAt = 1): Learner {
  return { number, interests, updatedAt };
}

function event(id: string, t: number, extra: Partial<LearningEvent> = {}): LearningEvent {
  return {
    id,
    t,
    learner: '1',
    unit: 'g5s1u4',
    task: 'g5s1u4.A1',
    engine: 'E05',
    verb: 'acted',
    data: { type: 'move', id: 'c1', x: 10, y: 20 },
    ...extra,
  };
}

function mastery(learner: string, conceptId: string, p: number, updatedAt = 1): MasteryRecord {
  return { id: masteryId(learner, conceptId), learner, conceptId, p, updatedAt };
}

function file(overrides: Partial<ExportFile> = {}): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    deviceId: 'device-1',
    exportedAt: 1_700_000_000_000,
    learners: [learner('1', ['space'])],
    events: [event('e1', 10)],
    mastery: [mastery('1', 'c1', 0.2, 2)],
    taskProgress: [],
    ...overrides,
  };
}

describe('createExport', () => {
  it('설정과 PIN을 빼고 모든 기록을 담는다', async () => {
    const storage = new MemoryStorage();
    await storage.putLearner(learner('1', ['space'], 5));
    await storage.putEvent(event('e1', 10));
    await storage.putMastery(mastery('1', 'c1', 0.3, 2));
    await storage.putTaskProgress({
      id: taskProgressId('1', 'g5s1u4.A1'),
      learner: '1',
      taskId: 'g5s1u4.A1',
      unit: 'g5s1u4',
      status: 'in-progress',
      updatedAt: 2,
    });
    await saveTeacherPin(storage, '1234');

    const exported = await createExport(storage, { now: 999, deviceId: 'fixed-device' });

    expect(exported).toMatchObject({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      deviceId: 'fixed-device',
      exportedAt: 999,
    });
    expect(exported.learners).toHaveLength(1);
    expect(exported.events).toHaveLength(1);
    expect(exported.mastery).toHaveLength(1);
    expect(exported.taskProgress).toHaveLength(1);
    expect('settings' in exported).toBe(false);
    expect(JSON.stringify(exported)).not.toContain('1234');
  });

  it('deviceId를 생략하면 저장된 기기 ID를 쓴다', async () => {
    const storage = new MemoryStorage();
    const deviceId = await storage.getDeviceId();

    expect((await createExport(storage)).deviceId).toBe(deviceId);
  });
});

describe('exportFileName', () => {
  it('번호를 숫자 순서로 정렬하고 날짜를 붙인다', () => {
    const now = new Date(2026, 10, 2, 12).getTime();
    expect(exportFileName([learner('10', []), learner('2', [])], now)).toBe(
      'mathexplorer-2-10-2026-11-02.json',
    );
  });

  it('학습자가 없으면 all을 쓴다', () => {
    const now = new Date(2026, 0, 5, 12).getTime();
    expect(exportFileName([], now)).toBe('mathexplorer-all-2026-01-05.json');
  });
});

describe('createExportQr', () => {
  it('작은 내보내기는 압축 QR SVG로 만든다', () => {
    const result = createExportQr(file());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.length).toBeLessThanOrEqual(QR_MAX_LENGTH);
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('<path');
  });

  it('2,000자를 넘으면 파일 내보내기를 안내한다', () => {
    const events = Array.from({ length: 400 }, (_, index) =>
      event(`e-${index}-${crypto.randomUUID()}`, index, {
        data: { type: 'move', id: crypto.randomUUID(), x: index, y: index * 2 },
      }),
    );
    const result = createExportQr(file({ events }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('TOO_LARGE');
    expect(result.length).toBeGreaterThan(QR_MAX_LENGTH);
    expect(result.message).toContain('파일로 내보내기');
  });
});

describe('parseExportFile', () => {
  it('올바른 파일을 읽고 문자열 JSON도 받는다', () => {
    const source = file();
    const fromObject = parseExportFile(source);
    const fromString = parseExportFile(JSON.stringify(source));

    expect(fromObject).toEqual({ ok: true, file: source });
    expect(fromString).toEqual({ ok: true, file: source });
  });

  it('JSON이 깨졌으면 invalid-json', () => {
    expect(parseExportFile('{oops')).toMatchObject({ ok: false, reason: 'invalid-json' });
  });

  it('다른 앱의 JSON이면 wrong-format', () => {
    expect(parseExportFile({ ...file(), format: 'something-else' })).toMatchObject({
      ok: false,
      reason: 'wrong-format',
    });
  });

  it('모르는 버전이면 wrong-version', () => {
    expect(parseExportFile({ ...file(), version: 2 })).toMatchObject({
      ok: false,
      reason: 'wrong-version',
    });
  });

  it('모양이 깨졌으면 invalid-shape', () => {
    expect(parseExportFile({ ...file(), learners: [{ number: '' }] })).toMatchObject({
      ok: false,
      reason: 'invalid-shape',
    });
    expect(
      parseExportFile({
        ...file(),
        mastery: [{ learner: '1', conceptId: 'c1', p: 1.5, updatedAt: 1 }],
      }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid-shape',
    });
    // 학생 구분이 없는 예전 숙달도 기록은 어느 학생 것인지 알 수 없어 건너뛴다.
    expect(parseExportFile({ ...file(), mastery: [{ conceptId: 'c1', p: 0.5 }] })).toMatchObject({
      ok: false,
      reason: 'invalid-shape',
    });
    expect(parseExportFile({ ...file(), events: [{ id: 'e1' }] })).toMatchObject({
      ok: false,
      reason: 'invalid-shape',
    });
  });

  it('화면 좌표가 들어 있으면 unsafe-data', () => {
    const unsafe = file({
      events: [{ ...event('e1', 10), data: { trail: [{ x: 1, y: 2 }] } }],
    });

    expect(parseExportFile(unsafe)).toMatchObject({ ok: false, reason: 'unsafe-data' });
  });
});

describe('importExportFiles', () => {
  async function seededStorage(): Promise<MemoryStorage> {
    const storage = new MemoryStorage();
    await storage.putLearner(learner('1', ['space'], 5));
    await storage.putEvent(event('e1', 10, { verb: 'started' }));
    await storage.putMastery(mastery('1', 'c1', 0.4, 10));
    await storage.putTaskProgress({
      id: taskProgressId('1', 't1'),
      learner: '1',
      taskId: 't1',
      unit: 'g5s1u4',
      status: 'in-progress',
      updatedAt: 5,
    });
    return storage;
  }

  it('여러 파일을 합치고 깨진 파일은 이유와 함께 건너뛴다', async () => {
    const storage = await seededStorage();
    const incoming = file({
      learners: [learner('1', ['game'], 10), learner('2', ['cooking'], 1)],
      events: [event('e1', 10), event('e2', 20)],
      mastery: [mastery('1', 'c1', 0.2, 5), mastery('1', 'c2', 0.3, 1)],
      taskProgress: [
        {
          id: taskProgressId('1', 't1'),
          learner: '1',
          taskId: 't1',
          unit: 'g5s1u4',
          status: 'completed',
          updatedAt: 3,
        },
        {
          id: taskProgressId('1', 't2'),
          learner: '1',
          taskId: 't2',
          unit: 'g5s1u4',
          status: 'in-progress',
          updatedAt: 2,
        },
      ],
    });
    const wrongVersion = { ...file(), version: 9 };

    const summary = await importExportFiles(storage, [
      incoming,
      JSON.stringify(wrongVersion),
      'not json',
    ]);

    expect(summary.files).toBe(3);
    expect(summary.imported).toBe(1);
    expect(summary.skipped).toEqual([
      expect.objectContaining({ index: 1, reason: 'wrong-version' }),
      expect.objectContaining({ index: 2, reason: 'invalid-json' }),
    ]);
    expect(summary.added).toEqual({ learners: 1, events: 1, mastery: 1, taskProgress: 1 });

    expect(await storage.listLearners()).toEqual([
      { number: '1', interests: ['space', 'game'], updatedAt: 10 },
      { number: '2', interests: ['cooking'], updatedAt: 1 },
    ]);
    const events = await storage.listEvents();
    expect(events.map((item) => item.id)).toEqual(['e1', 'e2']);
    // 같은 id의 기존 이벤트는 그대로 둔다.
    expect(events[0]?.verb).toBe('started');
    expect(await storage.listMastery()).toEqual([
      mastery('1', 'c1', 0.4, 10),
      mastery('1', 'c2', 0.3, 1),
    ]);
    const progress = await storage.listTaskProgress();
    expect(progress).toEqual([
      {
        id: taskProgressId('1', 't1'),
        learner: '1',
        taskId: 't1',
        unit: 'g5s1u4',
        status: 'in-progress',
        updatedAt: 5,
      },
      {
        id: taskProgressId('1', 't2'),
        learner: '1',
        taskId: 't2',
        unit: 'g5s1u4',
        status: 'in-progress',
        updatedAt: 2,
      },
    ]);
  });

  it('더 최신 기록이 이긴다', async () => {
    const storage = await seededStorage();
    const newer: MasteryRecord = mastery('1', 'c1', 0.6, 20);
    const newerProgress: TaskProgress = {
      id: taskProgressId('1', 't1'),
      learner: '1',
      taskId: 't1',
      unit: 'g5s1u4',
      status: 'completed',
      updatedAt: 30,
    };

    const summary = await importExportFiles(storage, [
      file({ mastery: [newer], taskProgress: [newerProgress] }),
    ]);

    expect(summary.added.mastery).toBe(0);
    expect(await storage.listMastery()).toEqual([newer]);
    expect(await storage.listTaskProgress()).toEqual([newerProgress]);
  });

  it('학생 두 명의 내보내기 파일을 합치면 두 학생 숙달도가 모두 남는다', async () => {
    const storage = new MemoryStorage();
    const conceptId = 'g5s1u4.common-denominator';
    const fromStudent1 = file({
      learners: [learner('1', ['space'])],
      events: [],
      mastery: [mastery('1', conceptId, 0.2, 5)],
    });
    const fromStudent2 = file({
      learners: [learner('2', ['game'])],
      events: [],
      mastery: [mastery('2', conceptId, 0.8, 6)],
    });

    const summary = await importExportFiles(storage, [fromStudent1, JSON.stringify(fromStudent2)]);

    expect(summary.imported).toBe(2);
    expect(summary.skipped).toEqual([]);
    expect(summary.added.mastery).toBe(2);
    expect(await storage.listMastery()).toEqual([
      mastery('1', conceptId, 0.2, 5),
      mastery('2', conceptId, 0.8, 6),
    ]);
  });

  it('같은 파일 안의 같은 이벤트 id는 더 늦은 t를 남긴다', async () => {
    const storage = new MemoryStorage();
    const older = event('dup', 10, { verb: 'started' });
    const latest = event('dup', 30, { verb: 'completed' });

    const summary = await importExportFiles(storage, [file({ events: [latest, older] })]);

    expect(summary.added.events).toBe(1);
    expect(await storage.listEvents()).toEqual([latest]);
  });

  it('빈 목록은 아무것도 바꾸지 않는다', async () => {
    const storage = await seededStorage();
    const summary = await importExportFiles(storage, []);

    expect(summary).toEqual({
      files: 0,
      imported: 0,
      skipped: [],
      added: { learners: 0, events: 0, mastery: 0, taskProgress: 0 },
    });
    expect(await storage.listLearners()).toEqual([learner('1', ['space'], 5)]);
  });
});
