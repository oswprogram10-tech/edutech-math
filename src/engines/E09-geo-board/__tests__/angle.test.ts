/** angle 모드 단위 테스트(T102): 정수 도 경계·맞춤·판정. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GeoAction, GeoConfig } from '../types';

function stateOf(config: GeoConfig, actions: readonly GeoAction[] = []) {
  return actions.reduce((state, action) => reduce(state, action), createInitialState(config));
}

function predicate(
  name: string,
): (observation: ReturnType<typeof observe>, args?: unknown) => boolean {
  const found = predicates[name];
  if (!found) throw new Error(`predicate ${name} 없음`);
  return (observation, args) => found(observation, args as never);
}

function placed(config: GeoConfig, rotation: number, on = 'a1') {
  let state = createInitialState(config);
  state = reduce(state, { type: 'place-protractor', on });
  state = reduce(state, { type: 'rotate-protractor', rotation });
  return state;
}

describe('angle 종류 경계', () => {
  it('89·90·91·179·180도를 예각·직각·둔각·둔각·평각으로 나눈다', () => {
    const config: GeoConfig = {
      mode: 'angle',
      angles: [
        { degrees: 89 },
        { degrees: 90 },
        { degrees: 91 },
        { degrees: 179 },
        { degrees: 180 },
      ],
    };
    const kinds = (observe(createInitialState(config)).angles as { kind: string }[]).map(
      (angle) => angle.kind,
    );
    expect(kinds).toEqual(['acute', 'right', 'obtuse', 'obtuse', 'straight']);
  });
});

describe('angle 각도기 맞춤', () => {
  const config: GeoConfig = { mode: 'angle', angles: [{ degrees: 180, base: 30 }] };

  it('첫 변이 0° 선과 같으면 바깥 트랙, 반대쪽이면 안쪽 트랙', () => {
    const outer = observe(placed(config, 30));
    expect(outer.protractorAligned).toBe(true);
    expect(outer.activeScale).toBe('outer');

    const inner = observe(placed(config, 210));
    expect(inner.protractorAligned).toBe(true);
    expect(inner.activeScale).toBe('inner');
  });

  it('다른 변이 판이 덮는 반쪽 밖이면 맞춤이 아니다', () => {
    const config180: GeoConfig = { mode: 'angle', angles: [{ degrees: 100, base: 30 }] };
    expect(observe(placed(config180, 130)).protractorAligned).toBe(false);
  });
});

describe('angle 어림 먼저', () => {
  it('어림 전에는 읽기를 거절하고, 어림 뒤에는 받는다', () => {
    const config: GeoConfig = {
      mode: 'angle',
      angles: [{ degrees: 60, base: 0 }],
      estimateFirst: true,
    };
    const start = placed(config, 0);
    const rejected = reduce(start, { type: 'set-reading', angle: 'a1', value: 60 });
    expect(rejected).toBe(start);

    const estimated = reduce(start, { type: 'set-estimate', angle: 'a1', value: 50 });
    const read = reduce(estimated, { type: 'set-reading', angle: 'a1', value: 60 });
    const observation = observe(read);
    expect(predicate('estimatesWithin')(observation, { tolerance: 30 })).toBe(true);
    expect(predicate('readingsWithin')(observation, { tolerance: 1 })).toBe(true);
    expect(predicate('estimatedBeforeReading')(observation)).toBe(true);
    assertSerializable(read);
  });
});

describe('angle 읽기 오류', () => {
  const config: GeoConfig = { mode: 'angle', angles: [{ degrees: 60, base: 0 }] };

  it('60도 각을 120으로 읽으면 flipped다', () => {
    const state = stateOf(config, [{ type: 'set-reading', angle: 'a1', value: 120 }]);
    const observation = observe(state);
    expect((observation.angles as { flipped: boolean }[])[0]?.flipped).toBe(true);
    expect(predicate('readingFlipped')(observation)).toBe(true);
  });

  it('맞추지 않고 읽으면 readWithoutAlign이다', () => {
    const state = stateOf(config, [{ type: 'set-reading', angle: 'a1', value: 60 }]);
    const observation = observe(state);
    expect(predicate('readWithoutAlign')(observation)).toBe(true);
    expect(predicate('readingsWithin')(observation, { tolerance: 1 })).toBe(true);
  });
});

describe('angle 레이저 퍼즐', () => {
  const config: GeoConfig = {
    mode: 'angle',
    puzzle: { type: 'laser-mirror', targetAngle: 135 },
  };

  it('135도는 맞고 134도는 빗나간다', () => {
    const hit = stateOf(config, [{ type: 'fire', angle: 135 }]);
    expect(observe(hit).puzzle).toMatchObject({ targetAngle: 135, hit: true });
    expect(predicate('laserHit')(observe(hit))).toBe(true);

    const miss = stateOf(config, [{ type: 'fire', angle: 134 }]);
    expect(observe(miss).puzzle).toMatchObject({ targetAngle: 135, hit: false });
    expect(predicate('laserHit')(observe(miss))).toBe(false);
    assertSerializable(hit);
  });
});
