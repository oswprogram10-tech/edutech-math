import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../backend';
import { assertSafeEventData, logEvent, UnsafeEventDataError } from '../event';
import type { JsonValue } from '../../engine-sdk';

function draft(data?: Record<string, JsonValue>) {
  return {
    learner: '7',
    unit: 'g5s1u4',
    task: 'g5s1u4.A1',
    engine: 'E05' as const,
    verb: 'acted' as const,
    ...(data === undefined ? {} : { data }),
  };
}

describe('logEvent', () => {
  it('id와 t를 붙여 저장한다', async () => {
    const storage = new MemoryStorage();
    const event = await logEvent(storage, draft({ n: 1 }), { id: 'e1', now: 1234 });

    expect(event).toMatchObject({
      id: 'e1',
      t: 1234,
      learner: '7',
      unit: 'g5s1u4',
      task: 'g5s1u4.A1',
      engine: 'E05',
      verb: 'acted',
      data: { n: 1 },
    });
    expect(await storage.listEvents()).toEqual([event]);
  });

  it('E00 Action의 논리 좌표 x·y는 그대로 기록한다', async () => {
    const storage = new MemoryStorage();
    // E00-demo의 DemoAction. 좌표는 화면 픽셀이 아니라 논리 좌표다.
    const action = { type: 'move', id: 'c1', x: 200, y: 400 } as const;
    const event = await logEvent(storage, {
      learner: '3',
      unit: 'g5s1u4',
      task: 'free',
      engine: 'E00',
      verb: 'acted',
      data: action,
    });

    expect(event.data).toEqual(action);
    expect(await storage.listEvents()).toEqual([event]);
  });

  it('화면 좌표 키를 런타임에서도 거부한다', async () => {
    const storage = new MemoryStorage();

    await expect(logEvent(storage, draft({ clientX: 10, clientY: 20 }))).rejects.toBeInstanceOf(
      UnsafeEventDataError,
    );
    expect(await storage.listEvents()).toEqual([]);
  });

  it('중첩 객체·배열 안의 금지 키도 거부한다', async () => {
    const storage = new MemoryStorage();

    await expect(logEvent(storage, draft({ path: [{ x: 1, trail: [1, 2, 3] }] }))).rejects.toThrow(
      /trail/,
    );
    expect(await storage.listEvents()).toEqual([]);
  });

  it('타입 수준에서 화면 좌표 키를 막는다', async () => {
    const storage = new MemoryStorage();

    await expect(
      logEvent(storage, {
        learner: '7',
        unit: 'g5s1u4',
        task: 'g5s1u4.A1',
        engine: 'E05',
        verb: 'acted',
        // @ts-expect-error clientX는 화면 좌표라 저장할 수 없다
        data: { clientX: 10, clientY: 20 },
      }),
    ).rejects.toBeInstanceOf(UnsafeEventDataError);
  });

  it('타입 수준에서 중첩된 금지 키도 막는다', async () => {
    const storage = new MemoryStorage();

    await expect(
      logEvent(storage, {
        learner: '7',
        unit: 'g5s1u4',
        task: 'g5s1u4.A1',
        engine: 'E05',
        verb: 'acted',
        // @ts-expect-error 중첩 배열 안의 pointerPath도 저장할 수 없다
        data: { gestures: [{ pointerPath: [1, 2] }] },
      }),
    ).rejects.toBeInstanceOf(UnsafeEventDataError);
  });
});

describe('assertSafeEventData', () => {
  it('허용 키는 통과시킨다', () => {
    expect(() =>
      assertSafeEventData({ type: 'move', x: 10, y: 20, nested: { ok: true } }),
    ).not.toThrow();
  });

  it('금지 키 이름을 오류에 남긴다', () => {
    try {
      assertSafeEventData({ a: { b: { screenY: 3 } } });
      expect.unreachable('오류가 나야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(UnsafeEventDataError);
      expect((error as UnsafeEventDataError).key).toBe('screenY');
      expect((error as UnsafeEventDataError).path).toBe('data.a.b.screenY');
    }
  });
});
