/** circle 모드 단위 테스트(T102): 정확한 경계·판정을 확인한다. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GeoConfig } from '../types';

function predicate(
  name: string,
): (observation: ReturnType<typeof observe>, args?: unknown) => boolean {
  const found = predicates[name];
  if (!found) throw new Error(`predicate ${name} 없음`);
  return (observation, args) => found(observation, args as never);
}

describe('circle 커버리지', () => {
  it('95% 경계: 68칸은 거짓, 69칸은 참', () => {
    const config: GeoConfig = { mode: 'circle', ropeLength: 4 };
    let state = createInitialState(config);
    for (let sector = 0; sector < 68; sector += 1) {
      state = reduce(state, { type: 'trace', sector });
    }
    expect(predicate('coverageAtLeast')(observe(state), { percent: 95 })).toBe(false);
    state = reduce(state, { type: 'trace', sector: 68 });
    expect(predicate('coverageAtLeast')(observe(state), { percent: 95 })).toBe(true);
    expect(observe(state).coverage).toEqual({ '4': 95 });
  });

  it('같은 부채꼴을 두 번 보내면 한 번만 센다', () => {
    const config: GeoConfig = { mode: 'circle', ropeLength: 4 };
    let state = createInitialState(config);
    state = reduce(state, { type: 'trace', sector: 10 });
    state = reduce(state, { type: 'trace', sector: 10 });
    expect(observe(state).traces).toEqual({ '4': [10] });
    expect(observe(state).coverage).toEqual({ '4': 1 });
  });
});

describe('circle 반지름', () => {
  it('서로 다른 pos 3개를 그으면 길이²가 모두 r²다', () => {
    const config: GeoConfig = { mode: 'circle', ropeLength: 4, measureTool: true };
    let state = createInitialState(config);
    for (const pos of [0, 6, 12]) state = reduce(state, { type: 'add-radius', pos });
    const observation = observe(state);
    expect(observation.distinctRadii).toBe(3);
    expect(observation.radii).toEqual([
      { pos: 0, length2: '16' },
      { pos: 6, length2: '16' },
      { pos: 12, length2: '16' },
    ]);
    expect(observation.measuredCount).toBe(0);
    state = reduce(state, { type: 'measure-radius', pos: 6 });
    expect(observe(state).measuredCount).toBe(1);
    expect(predicate('measuredRadii')(observe(state), { count: 1 })).toBe(true);
    assertSerializable(state);
  });
});

describe('circle 현', () => {
  it('반대 자리 두 점은 중심을 지나고, 한 칸 어긋나면 지나지 않는다', () => {
    const config: GeoConfig = { mode: 'circle', radius: 3, chordExplorer: true };
    let through = createInitialState(config);
    through = reduce(through, { type: 'set-chord', end: 0, pos: 3 });
    through = reduce(through, { type: 'set-chord', end: 1, pos: 27 });
    expect(observe(through).chord).toEqual({ length2: '36', throughCenter: true });
    expect(predicate('chordThroughCenter')(observe(through))).toBe(true);

    let near = createInitialState(config);
    near = reduce(near, { type: 'set-chord', end: 0, pos: 3 });
    near = reduce(near, { type: 'set-chord', end: 1, pos: 26 });
    const chord = observe(near).chord as { readonly throughCenter?: boolean } | null;
    expect(chord?.throughCenter).toBe(false);
    expect(predicate('chordThroughCenter')(observe(near))).toBe(false);
  });
});

describe('circle 컴퍼스', () => {
  it('반 칸 컴퍼스로 반지름 3/2 원을 그린다', () => {
    const config: GeoConfig = {
      mode: 'circle',
      compass: { enabled: true, gridSnap: 0.5 },
    };
    let state = createInitialState(config);
    state = reduce(state, { type: 'set-compass', center: [13, 12], width: 3 });
    state = reduce(state, { type: 'draw-circle' });
    const observation = observe(state);
    expect(observation.circles).toEqual([{ id: 'c1', center: ['13/2', '6'], radius: '3/2' }]);
    expect(predicate('hasCircle')(observation, { center: [6.5, 6], radius: 1.5 })).toBe(true);
    assertSerializable(state);
  });

  it('무늬 three-circles-in-row를 세 개 그리면 모두 맞는다', () => {
    const config: GeoConfig = {
      mode: 'circle',
      radius: 3,
      targetPattern: 'three-circles-in-row',
      compass: { enabled: true },
    };
    let state = createInitialState(config);
    for (const center of [
      [6, 12],
      [12, 12],
      [18, 12],
    ] as const) {
      state = reduce(state, { type: 'set-compass', center: [...center], width: 6 });
      state = reduce(state, { type: 'draw-circle' });
    }
    const observation = observe(state);
    expect(observation.patternTotal).toBe(3);
    expect(observation.patternMatched).toEqual([1, 2, 3]);
    expect(predicate('patternMatched')(observation)).toBe(true);
    expect(predicate('patternMatched')(observation, { count: 2 })).toBe(true);
    assertSerializable(state);
  });
});
