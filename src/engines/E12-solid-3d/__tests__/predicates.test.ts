/**
 * E12 GoalSpec predicates 단위 테스트.
 */
import { describe, expect, it } from 'vitest';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { SolidAction, SolidConfig } from '../types';

function makeObs(config: SolidConfig, actions: readonly SolidAction[]) {
  const state = actions.reduce(reduce, createInitialState(config));
  return observe(state);
}

describe('E12 predicates', () => {
  it('countIs: 개수 일치·불일치를 판정한다', () => {
    const obs = makeObs({}, [
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 1, y: 0 },
    ]);
    expect(predicates['countIs']?.(obs, { count: 2 })).toBe(true);
    expect(predicates['countIs']?.(obs, { count: 3 })).toBe(false);
    expect(predicates['countIs']?.(obs, { count: 'two' })).toBe(false);
  });

  it('sameShape: 평행이동 허용, 회전 옵션, 거울상 불일치를 판정한다', () => {
    const obs = makeObs({ grid: [4, 4] }, [
      { type: 'add', x: 1, y: 1 },
      { type: 'add', x: 1, y: 2 },
      { type: 'add', x: 1, y: 3 },
      { type: 'add', x: 2, y: 1 },
    ]);

    // 평행이동된 L자
    const shifted = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [1, 0, 0],
    ];
    expect(predicates['sameShape']?.(obs, { cubes: shifted })).toBe(true);

    // 90° 회전된 L자
    const rotated90 = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [2, 1, 0],
    ];
    expect(predicates['sameShape']?.(obs, { cubes: rotated90, rotate: false })).toBe(false);
    expect(predicates['sameShape']?.(obs, { cubes: rotated90, rotate: true })).toBe(true);

    // 거울상 L자
    const mirrored = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [1, 2, 0],
    ];
    expect(predicates['sameShape']?.(obs, { cubes: mirrored, rotate: true })).toBe(false);
  });

  it('projectionMatches & projectionsMatch: 투영 일치 및 시프트 옵션을 판정한다', () => {
    const obs = makeObs({ grid: [3, 3], maxHeight: 3 }, [
      { type: 'add', x: 1, y: 1 },
      { type: 'add', x: 1, y: 1 },
      { type: 'add', x: 2, y: 1 },
    ]);

    expect(
      predicates['projectionMatches']?.(obs, {
        view: 'front',
        cells: [
          [1, 0],
          [1, 1],
        ],
      }),
    ).toBe(true);
    expect(
      predicates['projectionMatches']?.(obs, {
        view: 'front',
        cells: [
          [1, 0],
          [1, 1],
        ],
        shift: false,
      }),
    ).toBe(false);

    expect(
      predicates['projectionsMatch']?.(obs, {
        top: [[1, 1]],
        front: [
          [1, 0],
          [1, 1],
        ],
        side: [[1], [1]],
      }),
    ).toBe(true);
    expect(
      predicates['projectionsMatch']?.(obs, {
        top: [[1, 1]],
        side: [[1], [0]],
      }),
    ).toBe(false);
  });

  it('heightsMatch & isConnected: 높이 행렬과 연결 여부를 판정한다', () => {
    const obs = makeObs({ grid: [3, 3], maxHeight: 3 }, [
      { type: 'add', x: 1, y: 1 },
      { type: 'add', x: 1, y: 1 },
      { type: 'add', x: 2, y: 1 },
    ]);

    expect(predicates['heightsMatch']?.(obs, { heights: [[2, 1]] })).toBe(true);
    expect(predicates['heightsMatch']?.(obs, { heights: [[2, 2]] })).toBe(false);
    expect(predicates['heightsMatch']?.(obs, { heights: [[2, 1]], shift: false })).toBe(false);
    expect(predicates['isConnected']?.(obs, {})).toBe(true);

    const splitObs = makeObs({ grid: [3, 3] }, [
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 2, y: 0 },
    ]);
    expect(predicates['isConnected']?.(splitObs, {})).toBe(false);
  });

  it('잘못된 인자에서는 throw하지 않고 false를 돌려준다', () => {
    const obs = makeObs({}, [{ type: 'add', x: 0, y: 0 }]);

    expect(() => predicates['countIs']?.(obs, undefined)).not.toThrow();
    expect(predicates['countIs']?.(obs, null)).toBe(false);
    expect(predicates['sameShape']?.(obs, { cubes: 'bad' })).toBe(false);
    expect(predicates['sameShape']?.(obs, { cubes: [[1, 2]] })).toBe(false);
    expect(predicates['projectionMatches']?.(obs, { view: 'back', cells: [[1]] })).toBe(false);
    expect(predicates['projectionMatches']?.(obs, { view: 'top', cells: [[1], [1, 2]] })).toBe(
      false,
    );
    expect(predicates['projectionsMatch']?.(obs, {})).toBe(false);
    expect(predicates['heightsMatch']?.(obs, { heights: 'not-a-matrix' })).toBe(false);
    expect(predicates['heightsMatch']?.(obs, { heights: [[-1]] })).toBe(false);
  });
});
