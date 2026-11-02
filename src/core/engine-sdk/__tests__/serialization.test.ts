import { describe, expect, it } from 'vitest';
import { assertSerializable, isSerializable, SerializationError } from '../serialization';

describe('assertSerializable', () => {
  it('JSON 값은 통과한다', () => {
    expect(() =>
      assertSerializable({
        counters: [{ id: 'c1', x: 10, y: 20 }],
        groups: [[1, 2]],
        name: '셈돌',
        ok: true,
        none: null,
      }),
    ).not.toThrow();
    expect(isSerializable([1, 'a', false, null])).toBe(true);
    expect(isSerializable('문자열')).toBe(true);
    expect(isSerializable(0)).toBe(true);
  });

  it('함수·BigInt·undefined를 거부한다', () => {
    expect(isSerializable({ run: () => 1 })).toBe(false);
    expect(isSerializable({ big: 1n })).toBe(false);
    expect(isSerializable({ missing: undefined })).toBe(false);
    expect(isSerializable(undefined)).toBe(false);
  });

  it('Map·Set·Date·클래스 인스턴스를 거부한다', () => {
    expect(isSerializable(new Map([['a', 1]]))).toBe(false);
    expect(isSerializable(new Set([1]))).toBe(false);
    expect(isSerializable(new Date(0))).toBe(false);

    class Box {
      constructor(readonly value: number) {}
    }
    expect(isSerializable(new Box(1))).toBe(false);
  });

  it('순환 참조와 NaN·Infinity를 거부한다', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isSerializable(cyclic)).toBe(false);
    expect(isSerializable({ value: Number.NaN })).toBe(false);
    expect(isSerializable({ value: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('어느 경로가 문제인지 알려 준다', () => {
    try {
      assertSerializable({ counters: [{ id: 'c1', bad: undefined }] });
      throw new Error('오류가 발생하지 않았습니다');
    } catch (error) {
      expect(error).toBeInstanceOf(SerializationError);
      expect((error as SerializationError).path).toBe('counters[0]');
    }
  });
});
