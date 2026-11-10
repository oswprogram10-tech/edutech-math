/**
 * E09 classify 모드 테스트(T101).
 *
 * 고무줄 Action은 geoboard와 같은 `reduceBands`를 쓰고, 성질·이름 판정은
 * Observation과 predicates로만 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { squareFits } from '../modes/classify/observe';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { ClassifyState } from '../modes/classify/types';
import type { GeoAction, GeoConfig, GeoState } from '../types';

function apply(config: GeoConfig, actions: readonly GeoAction[]): GeoState {
  return actions.reduce<GeoState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function classify(config: GeoConfig, actions: readonly GeoAction[] = []): ClassifyState {
  const state = apply(config, actions);
  if (state.mode !== 'classify') throw new Error('classify 상태가 아니다');
  return state;
}

function shape(observation: Observation, index: number): Readonly<Record<string, unknown>> {
  const shapes = observation['shapes'];
  if (!Array.isArray(shapes)) return {};
  const item = shapes[index];
  return item !== null && typeof item === 'object' && !Array.isArray(item) ? item : {};
}

const RIGHT_TRIANGLE: GeoConfig = {
  mode: 'classify',
  grid: [6, 6],
  shapes: [
    [
      [0, 0],
      [3, 0],
      [0, 4],
    ],
  ],
};

describe('E09 classify observe', () => {
  it('닫힌 직각삼각형의 성질과 이름을 Observation에 담는다', () => {
    const state = classify(RIGHT_TRIANGLE);
    const observation = observe(state);
    expect(observation['closedShapes']).toBe(1);
    const first = shape(observation, 0);
    expect(first['vertices']).toBe(3);
    expect(first['rightAngles']).toBe(1);
    expect(first['names']).toContain('right-triangle');
    expect(first['congruenceKey']).toEqual(expect.any(String));
    assertSerializable(state);
  });

  it('단순하지 않은 고무줄은 성질 0·이름 빈 배열이다', () => {
    const state = classify({
      mode: 'classify',
      grid: [5, 5],
      shapes: [
        [
          [0, 0],
          [2, 0],
          [4, 0],
        ],
      ],
    });
    const first = shape(observe(state), 0);
    expect(first['simple']).toBe(false);
    expect(first['rightAngles']).toBe(0);
    expect(first['names']).toEqual([]);
  });
});

describe('E09 classify predicates', () => {
  it('shapeHas는 준 성질이 모두 같은 단순 도형을 찾는다', () => {
    const observation = observe(classify(RIGHT_TRIANGLE));
    expect(predicates['shapeHas']?.(observation, { vertices: 3, rightAngles: 1 })).toBe(true);
    expect(predicates['shapeHas']?.(observation, { vertices: 3, rightAngles: 2 })).toBe(false);
    expect(predicates['shapeNamed']?.(observation, { name: 'right-triangle' })).toBe(true);
  });

  it('shapesWith distinct는 서로 합동이 아닌 도형만 센다', () => {
    const congruent: GeoConfig = {
      mode: 'classify',
      grid: [8, 8],
      shapes: [
        [
          [0, 0],
          [2, 0],
          [2, 1],
          [0, 1],
        ],
        [
          [3, 0],
          [5, 0],
          [5, 1],
          [3, 1],
        ],
      ],
    };
    const observation = observe(classify(congruent));
    expect(
      predicates['shapesWith']?.(observation, {
        count: 2,
        distinct: true,
        vertices: 4,
        rightAngles: 4,
      }),
    ).toBe(false);
    expect(
      predicates['shapesWith']?.(observation, {
        count: 2,
        vertices: 4,
        rightAngles: 4,
      }),
    ).toBe(true);

    const different: GeoConfig = {
      mode: 'classify',
      grid: [10, 8],
      shapes: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
        [
          [3, 0],
          [7, 0],
          [7, 1],
          [3, 1],
        ],
      ],
    };
    expect(
      predicates['shapesWith']?.(observe(classify(different)), {
        count: 2,
        distinct: true,
        vertices: 4,
        rightAngles: 4,
      }),
    ).toBe(true);
  });
});

describe('E09 classify set-square', () => {
  it('place-square-at은 꼭짓점을 기억하고 squareFits를 판정한다', () => {
    const config: GeoConfig = { ...RIGHT_TRIANGLE, tools: ['set-square'] };
    let state = classify(config);
    state = reduce(state, { type: 'place-square-at', band: 'b1', index: 0 }) as ClassifyState;
    expect(state.squareOn).toEqual({ band: 'b1', index: 0 });
    expect(squareFits(state)).toBe(true);
    state = reduce(state, { type: 'place-square-at', band: 'b1', index: 0 }) as ClassifyState;
    expect(state.squareOn).toBeNull();
  });

  it('고무줄을 끌면 squareOn을 비운다', () => {
    const config: GeoConfig = { ...RIGHT_TRIANGLE, tools: ['set-square'] };
    let state = classify(config);
    state = reduce(state, { type: 'place-square-at', band: 'b1', index: 0 }) as ClassifyState;
    state = reduce(state, { type: 'move-peg', band: 'b1', index: 0, peg: [0, 1] }) as ClassifyState;
    expect(state.squareOn).toBeNull();
    expect(state.bands[0]?.pegs[0]).toEqual([0, 1]);
  });

  it('범위 밖 꼭짓점 번호는 무시한다', () => {
    const config: GeoConfig = { ...RIGHT_TRIANGLE, tools: ['set-square'] };
    const before = classify(config);
    const after = reduce(before, { type: 'place-square-at', band: 'b1', index: 5 });
    expect(after).toBe(before);
  });
});

describe('E09 classify event', () => {
  it('닫을 때 shape-closed payload에 이름을 더한다', () => {
    const config: GeoConfig = { mode: 'classify', grid: [6, 6] };
    const actions: GeoAction[] = [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [3, 0] },
      { type: 'add-peg', peg: [0, 4] },
    ];
    const open = apply(config, actions);
    const closed = reduce(open, { type: 'close-band' });
    const events = emit(open, closed);
    const event = events.find((item) => item.name === 'shape-closed');
    expect(event).toBeDefined();
    const payload = event?.payload as { names?: unknown } | undefined;
    expect(payload?.names).toContain('right-triangle');
  });
});
