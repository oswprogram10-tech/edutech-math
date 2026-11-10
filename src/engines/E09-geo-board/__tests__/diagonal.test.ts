/** diagonal 모드 단위 테스트(T103): 꼭짓점 번호 쌍·거절·정확한 개수를 확인한다. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { DiagonalState } from '../modes/diagonal/types';
import type { GeoAction, GeoConfig, GeoState } from '../types';

function predicate(
  name: string,
): (observation: ReturnType<typeof observe>, args?: unknown) => boolean {
  const found = predicates[name];
  if (!found) throw new Error(`predicate ${name} 없음`);
  return (observation, args) => found(observation, args as never);
}

function diagonalState(state: GeoState): DiagonalState {
  if (state.mode !== 'diagonal') throw new Error('diagonal 상태가 아님');
  return state;
}

function apply(state: GeoState, actions: readonly GeoAction[]): GeoState {
  return actions.reduce<GeoState>((value, action) => reduce(value, action), state);
}

function drawPairs(state: GeoState, pairs: readonly (readonly [number, number])[]): GeoState {
  return apply(
    state,
    pairs.flatMap(([a, b]): GeoAction[] => [
      { type: 'pick-vertex', vertex: a },
      { type: 'pick-vertex', vertex: b },
    ]),
  );
}

function pentagonDiagonals(): readonly (readonly [number, number])[] {
  return [
    [0, 2],
    [0, 3],
    [1, 3],
    [1, 4],
    [2, 4],
  ];
}

describe('diagonal 중복·이웃 거절', () => {
  it('같은 쌍을 반대로 다시 그으면 중복으로 세고 개수는 그대로다', () => {
    let state: GeoState = createInitialState({ mode: 'diagonal', polygons: [5] });
    state = drawPairs(state, [[0, 2]]);
    expect(observe(state).pairs).toEqual({ '5': [[0, 2]] });

    state = drawPairs(state, [[2, 0]]);
    const observation = observe(state);
    expect(observation.duplicateAttempts).toBe(1);
    expect(observation.adjacentAttempts).toBe(0);
    expect((observation.pairs as Record<string, unknown[]>)['5']).toHaveLength(1);
    expect(predicate('duplicateAttempts')(observation, { min: 1 })).toBe(true);
  });

  it('이웃한 꼭짓점은 긋지 않고 두 번이면 adjacentAttempts가 2다', () => {
    let state: GeoState = createInitialState({ mode: 'diagonal', polygons: [5] });
    state = drawPairs(state, [
      [0, 1],
      [4, 0],
    ]);
    const observation = observe(state);
    expect(observation.adjacentAttempts).toBe(2);
    expect(observation.pairs).toEqual({ '5': [] });
    expect(predicate('adjacentAttempts')(observation, { min: 2 })).toBe(true);
  });

  it('rejectAdjacent가 false면 이웃 쌍은 sides에 들어가고 drawn은 그대로다', () => {
    let state: GeoState = createInitialState({
      mode: 'diagonal',
      polygons: [5],
      rejectAdjacent: false,
    });
    state = drawPairs(state, [
      [0, 1],
      [0, 2],
    ]);
    const diagonal = diagonalState(state);
    expect(diagonal.sides['5']).toEqual([[0, 1]]);
    expect(diagonal.drawn['5']).toEqual([[0, 2]]);
    expect(observe(state).sidesDrawn).toBe(1);
    expect(observe(state).adjacentAttempts).toBe(0);
  });
});

describe('diagonal 완성 판정', () => {
  it('오각형 대각선 5개를 그으면 complete, 4개면 아니다', () => {
    const config: GeoConfig = { mode: 'diagonal', polygons: [5] };
    const four: GeoState = drawPairs(createInitialState(config), pentagonDiagonals().slice(0, 4));
    expect(predicate('diagonalsComplete')(observe(four), { n: 5 })).toBe(false);

    const five: GeoState = drawPairs(four, pentagonDiagonals().slice(4));
    expect(predicate('diagonalsComplete')(observe(five), { n: 5 })).toBe(true);
    expect(predicate('diagonalCount')(observe(five), { n: 5, count: 5 })).toBe(true);
    assertSerializable(five);
  });

  it('삼각형에서는 어떤 쌍도 대각선이 아니다', () => {
    let state: GeoState = createInitialState({ mode: 'diagonal', polygons: [3] });
    state = drawPairs(state, [
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
    const observation = observe(state);
    expect(observation.pairs).toEqual({ '3': [] });
    expect(observation.adjacentAttempts).toBe(3);
    expect((observation.polygons as { drawn: number }[])[0]?.drawn).toBe(0);
  });

  it('십각형 대각선은 정확히 35개다', () => {
    const pairs: (readonly [number, number])[] = [];
    for (let i = 0; i < 10; i += 1) {
      for (let j = i + 2; j < 10; j += 1) {
        if (j - i === 9) continue;
        pairs.push([i, j]);
      }
    }
    expect(pairs).toHaveLength(35);
    const state = drawPairs(createInitialState({ mode: 'diagonal', polygons: [10] }), pairs);
    const observation = observe(state);
    expect(observation.polygons).toEqual([{ n: 10, drawn: 35, complete: true }]);
    expect(predicate('diagonalsComplete')(observation, { n: 10 })).toBe(true);
    assertSerializable(state);
  });
});

describe('diagonal 상태 규칙', () => {
  it('같은 꼭짓점을 두 번 고르면 pending이 취소된다', () => {
    let state: GeoState = createInitialState({ mode: 'diagonal', polygons: [5] });
    state = apply(state, [{ type: 'pick-vertex', vertex: 2 }]);
    expect(diagonalState(state).pending).toBe(2);
    state = apply(state, [{ type: 'pick-vertex', vertex: 2 }]);
    expect(diagonalState(state).pending).toBeNull();
    expect(diagonalState(state).drawn).toEqual({});
  });

  it('polygons 범위 밖(2, 11)은 버리고 3~10만 남긴다', () => {
    const state = diagonalState(
      createInitialState({ mode: 'diagonal', polygons: [2, 3, 11, 5, 5] }),
    );
    expect(state.settings.polygons).toEqual([3, 5]);
  });

  it('undo·clear는 현재 다각형의 대각선만 지운다', () => {
    let state: GeoState = createInitialState({
      mode: 'diagonal',
      polygons: [4, 5],
    });
    state = drawPairs(state, [
      [0, 2],
      [1, 3],
    ]);
    state = apply(state, [{ type: 'select-polygon', index: 1 }]);
    state = drawPairs(state, [[0, 2]]);
    state = apply(state, [{ type: 'undo-diagonal' }]);
    expect(observe(state).pairs).toEqual({
      '4': [
        [0, 2],
        [1, 3],
      ],
      '5': [],
    });
    state = apply(state, [{ type: 'clear-diagonals' }]);
    expect(observe(state).pairs).toEqual({
      '4': [
        [0, 2],
        [1, 3],
      ],
      '5': [],
    });
  });
});
