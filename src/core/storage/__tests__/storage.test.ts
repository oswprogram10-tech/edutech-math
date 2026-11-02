import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../backend';
import { openStorage } from '../storage';
import type { Learner, LearningEvent, MasteryRecord, Storage, TaskProgress } from '../types';
import { masteryId } from '../types';

let sequence = 0;

function dexieName(): string {
  sequence += 1;
  return `mathexplorer-test-${sequence}-${Date.now()}`;
}

function learner(number: string, updatedAt = 1): Learner {
  return { number, interests: ['space'], updatedAt };
}

function event(id: string, t: number): LearningEvent {
  return {
    id,
    t,
    learner: '1',
    unit: 'g5s1u4',
    task: 'g5s1u4.A1',
    engine: 'E05',
    verb: 'acted',
    data: { type: 'move', id: 'c1', x: 10, y: 20 },
  };
}

function progress(id: string, updatedAt = 1): TaskProgress {
  return {
    id,
    learner: '1',
    taskId: id,
    unit: 'g5s1u4',
    status: 'in-progress',
    updatedAt,
  };
}

function mastery(learner: string, conceptId: string, p: number, updatedAt = 1): MasteryRecord {
  return { id: masteryId(learner, conceptId), learner, conceptId, p, updatedAt };
}

const backends = [
  {
    name: 'DexieStorage(IndexedDB)',
    backend: 'indexeddb' as const,
    create: () => openStorage({ name: dexieName(), requestPersist: false }),
  },
  {
    name: 'MemoryStorage',
    backend: 'memory' as const,
    create: () => openStorage({ forceMemory: true }),
  },
];

describe.each(backends)('$name', ({ backend, create }) => {
  const opened: Storage[] = [];

  async function open(): Promise<Storage> {
    const storage = await create();
    opened.push(storage);
    // 대체 저장소로 조용히 떨어지면 계약 테스트가 의미가 없어진다.
    expect(storage.backend).toBe(backend);
    return storage;
  }

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((storage) => storage.close()));
  });

  it('학습자를 번호로 저장하고 숫자 순서로 나열한다', async () => {
    const storage = await open();
    await storage.putLearner(learner('10'));
    await storage.putLearner(learner('2'));
    await storage.putLearner(learner('1'));

    expect((await storage.listLearners()).map((item) => item.number)).toEqual(['1', '2', '10']);
    expect(await storage.getLearner('2')).toEqual(learner('2'));
    expect(await storage.getLearner('99')).toBeUndefined();
  });

  it('같은 번호의 학습자는 덮어쓴다', async () => {
    const storage = await open();
    await storage.putLearner(learner('4', 1));
    await storage.putLearner({ number: '4', interests: ['game'], updatedAt: 2 });

    expect(await storage.listLearners()).toEqual([
      { number: '4', interests: ['game'], updatedAt: 2 },
    ]);
  });

  it('이벤트를 시각 순서로 나열하고 id로 덮어쓴다', async () => {
    const storage = await open();
    await storage.putEvent(event('b', 20));
    await storage.putEvent(event('a', 10));
    await storage.putEvent({ ...event('a', 10), verb: 'passed' });

    const events = await storage.listEvents();
    expect(events.map((item) => item.id)).toEqual(['a', 'b']);
    expect(events[0]?.verb).toBe('passed');
  });

  it('숙달도와 과제 진행을 저장한다', async () => {
    const storage = await open();
    await storage.putMastery(mastery('1', 'g5s1u4.common-denominator', 0.5, 3));
    await storage.putMastery(mastery('1', 'g5s1u4.add', 0.25, 2));
    await storage.putTaskProgress(progress('g5s1u4.A1'));

    expect((await storage.listMastery()).map((item) => item.conceptId)).toEqual([
      'g5s1u4.add',
      'g5s1u4.common-denominator',
    ]);
    expect(await storage.listTaskProgress()).toEqual([progress('g5s1u4.A1')]);
  });

  it('같은 기기에서 학생 두 명의 같은 개념 숙달도를 따로 남긴다', async () => {
    const storage = await open();
    await storage.putMastery(mastery('1', 'g5s1u4.common-denominator', 0.2, 3));
    await storage.putMastery(mastery('2', 'g5s1u4.common-denominator', 0.8, 4));

    expect(await storage.listMastery()).toEqual([
      mastery('1', 'g5s1u4.common-denominator', 0.2, 3),
      mastery('2', 'g5s1u4.common-denominator', 0.8, 4),
    ]);

    // 같은 학생의 같은 개념은 덮어쓴다.
    await storage.putMastery(mastery('1', 'g5s1u4.common-denominator', 0.6, 5));
    expect(await storage.listMastery()).toEqual([
      mastery('1', 'g5s1u4.common-denominator', 0.6, 5),
      mastery('2', 'g5s1u4.common-denominator', 0.8, 4),
    ]);
  });

  it('설정 값을 JSON으로 저장하고 읽는다', async () => {
    const storage = await open();
    expect(await storage.getSetting('missing')).toBeUndefined();

    await storage.setSetting('enabledUnits', ['g5s1u4', 'g6s1u1']);
    expect(await storage.getSetting('enabledUnits')).toEqual(['g5s1u4', 'g6s1u1']);
  });

  it('기기 ID를 한 번만 만들고 유지한다', async () => {
    const storage = await open();
    const first = await storage.getDeviceId();
    const second = await storage.getDeviceId();

    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
    expect(await storage.getSetting('deviceId')).toBe(first);
  });

  it('상태에 backend와 persisted를 알려 준다', async () => {
    const storage = await open();
    expect(await storage.status()).toEqual({
      backend: storage.backend,
      persisted: false,
    });
  });
});

describe('openStorage', () => {
  it('강제 메모리 모드는 이유를 남긴다', async () => {
    const storage = await openStorage({ forceMemory: true });

    expect(storage.backend).toBe('memory');
    expect(storage).toBeInstanceOf(MemoryStorage);
    expect(storage.fallbackReason).toBe('forced-memory');
    expect(await storage.status()).toEqual({ backend: 'memory', persisted: false });
  });

  it('IndexedDB가 없으면 메모리 저장소로 대체한다', async () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      const storage = await openStorage();
      expect(storage.backend).toBe('memory');
      expect(storage.fallbackReason).toBe('indexeddb-unavailable');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('IndexedDB 열기가 실패하면 이유와 함께 메모리로 대체한다', async () => {
    const reasons: string[] = [];
    const brokenFactory = {
      open: () => {
        throw new Error('저장 공간이 차단되었습니다');
      },
    } as unknown as IDBFactory;

    const storage = await openStorage({
      indexedDB: brokenFactory,
      requestPersist: false,
      onFallback: (reason) => reasons.push(reason),
    });

    expect(storage.backend).toBe('memory');
    expect(storage.fallbackReason).toContain('차단');
    expect(reasons).toEqual([storage.fallbackReason]);
  });

  it('메모리 저장소는 열 때마다 빈 상태로 시작한다', async () => {
    const first = await openStorage({ forceMemory: true });
    await first.putLearner(learner('1'));

    const second = await openStorage({ forceMemory: true });
    expect(await second.listLearners()).toEqual([]);
  });
});
