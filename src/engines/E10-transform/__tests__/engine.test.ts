/**
 * E10 reduce·observe 단위 테스트. 카드 T104의 고정값과 두 번 이동 여러 답,
 * predict 확인 전후 규칙을 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { orientCells } from '../orientation';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type {
  Cell,
  PredictConfig,
  SlideFlipTurnConfig,
  TransformAction,
  TransformState,
} from '../types';

function apply(
  config: SlideFlipTurnConfig | PredictConfig,
  actions: readonly TransformAction[],
): TransformState {
  return actions.reduce<TransformState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function observation(
  config: SlideFlipTurnConfig | PredictConfig,
  actions: readonly TransformAction[],
): Observation {
  return observe(apply(config, actions));
}

function cellsOf(result: Observation): string {
  const value = result['cells'];
  return Array.isArray(value) ? value.join(' ') : '';
}

const TARGET_CONFIG: SlideFlipTurnConfig = {
  mode: 'slide-flip-turn',
  at: [1, 1],
  target: { orientation: 'cw90', at: [2, 3] },
};

describe('E10 slide-flip-turn 고정값', () => {
  it('at [4,4]에서 점 ㄱ 중심 시계 90°', () => {
    const result = observation({ mode: 'slide-flip-turn', at: [4, 4] }, [
      { type: 'turn', direction: 'cw', angle: 90, center: [4, 4] },
    ]);
    expect(cellsOf(result)).toBe('0,4 1,4 2,4 3,4 2,5 3,5 3,6');
    expect(result['orientation']).toBe('cw90');
    expect(result['moveCount']).toBe(1);
  });

  it('at [4,4]에서 반시계 90°', () => {
    const result = observation({ mode: 'slide-flip-turn', at: [4, 4] }, [
      { type: 'turn', direction: 'ccw', angle: 90, center: [4, 4] },
    ]);
    expect(cellsOf(result)).toBe('4,1 4,2 5,2 4,3 5,3 6,3 7,3');
    expect(result['orientation']).toBe('ccw90');
  });

  it('at [4,4]에서 시계 180°', () => {
    const result = observation({ mode: 'slide-flip-turn', at: [4, 4] }, [
      { type: 'turn', direction: 'cw', angle: 180, center: [4, 4] },
    ]);
    expect(cellsOf(result)).toBe('3,0 3,1 2,2 3,2 1,3 2,3 3,3');
    expect(result['orientation']).toBe('r180');
  });

  it('at [1,1]에서 오른쪽으로 뒤집기', () => {
    const result = observation({ mode: 'slide-flip-turn', at: [1, 1] }, [
      { type: 'flip', side: 'right' },
    ]);
    expect(cellsOf(result)).toBe('4,1 5,1 6,1 5,2 6,2 6,3 6,4');
    expect(result['orientation']).toBe('flip-h');
  });

  it('방향키 5번은 밀기 한 번, 오른쪽 2 + 왼쪽 2는 0번이다', () => {
    const five = observation({ mode: 'slide-flip-turn', at: [1, 1] }, [
      { type: 'slide', dx: 1, dy: 0 },
      { type: 'slide', dx: 1, dy: 0 },
      { type: 'slide', dx: 1, dy: 0 },
      { type: 'slide', dx: 1, dy: 0 },
      { type: 'slide', dx: 1, dy: 0 },
    ]);
    expect(five['moveCount']).toBe(1);
    expect(five['moves']).toEqual([{ kind: 'slide', dx: 5, dy: 0 }]);

    const cancel = observation({ mode: 'slide-flip-turn', at: [1, 1] }, [
      { type: 'slide', dx: 1, dy: 0 },
      { type: 'slide', dx: 1, dy: 0 },
      { type: 'slide', dx: -1, dy: 0 },
      { type: 'slide', dx: -1, dy: 0 },
    ]);
    expect(cancel['moveCount']).toBe(0);
  });

  it('모눈 밖으로 나가는 돌리기는 기록하지 않고 blockedCount만 올린다', () => {
    const result = observation({ mode: 'slide-flip-turn', at: [1, 1] }, [
      { type: 'turn', direction: 'cw', angle: 90, center: [1, 1] },
    ]);
    expect(result['moveCount']).toBe(0);
    expect(result['blockedCount']).toBe(1);
  });

  it('허용하지 않은 이동과 꼭짓점이 아닌 중심은 무시한다', () => {
    const noTurn = apply({ mode: 'slide-flip-turn', allowed: ['slide'] }, [
      { type: 'turn', direction: 'cw', angle: 90, center: [4, 3] },
    ]);
    expect(noTurn.mode).toBe('slide-flip-turn');
    if (noTurn.mode !== 'slide-flip-turn') return;
    expect(noTurn.moves).toHaveLength(0);

    const weird = apply({ mode: 'slide-flip-turn' }, [
      { type: 'turn', direction: 'cw', angle: 90, center: [0, 0] },
    ]);
    if (weird.mode !== 'slide-flip-turn') return;
    expect(weird.moves).toHaveLength(0);
    expect(weird.blockedCount).toBe(0);
  });

  it('select-center·undo·reset이 중심과 기록을 다룬다', () => {
    let state = createInitialState({ mode: 'slide-flip-turn' });
    state = reduce(state, { type: 'select-center', index: 4 });
    if (state.mode !== 'slide-flip-turn') return;
    expect(state.center).toBe(4);
    state = reduce(state, { type: 'slide', dx: 1, dy: 0 });
    state = reduce(state, { type: 'undo-move' });
    if (state.mode !== 'slide-flip-turn') return;
    expect(state.moves).toHaveLength(0);
    state = reduce(state, { type: 'slide', dx: 1, dy: 0 });
    state = reduce(state, { type: 'reset' });
    if (state.mode !== 'slide-flip-turn') return;
    expect(state.center).toBe(0);
    expect(state.moves).toHaveLength(0);
  });
});

describe('E10 두 번 이동 여러 답', () => {
  it('목표 칸을 만들고 (가) 밀기 5,2 뒤 점 ㄱ 중심 시계 90°가 맞는다', () => {
    const actions: TransformAction[] = [
      { type: 'slide', dx: 5, dy: 2 },
      { type: 'turn', direction: 'cw', angle: 90, center: [6, 3] },
    ];
    const state = apply(TARGET_CONFIG, actions);
    if (state.mode !== 'slide-flip-turn') return;
    expect(state.settings.target?.map((cell) => `${cell[0]},${cell[1]}`).join(' ')).toBe(
      '2,3 3,3 4,3 5,3 4,4 5,4 5,5',
    );
    const result = observe(state);
    expect(result['atTarget']).toBe(true);
    expect(result['moveCount']).toBe(2);
    expect(predicates['reachedTarget']?.(result, { moves: 2 })).toBe(true);
    expect(predicates['reachedTarget']?.(result, { moves: 1 })).toBe(false);
    expect(predicates['usedMove']?.(result, { kind: 'turn', direction: 'cw', angle: 90 })).toBe(
      true,
    );
  });

  it('(나) 점 ㅁ 중심 시계 90° 뒤 밀기 1,2도 같은 목표다', () => {
    const state = apply(TARGET_CONFIG, [
      { type: 'select-center', index: 4 },
      { type: 'turn', direction: 'cw', angle: 90, center: [3, 3] },
      { type: 'slide', dx: 1, dy: 2 },
    ]);
    const result = observe(state);
    expect(result['atTarget']).toBe(true);
    expect(result['moveCount']).toBe(2);
    expect(predicates['reachedTarget']?.(result, { maxMoves: 2 })).toBe(true);
  });

  it('목표가 없으면 atTarget은 거짓이고 hasTarget도 거짓이다', () => {
    const result = observation({ mode: 'slide-flip-turn' }, []);
    expect(result['hasTarget']).toBe(false);
    expect(result['atTarget']).toBe(false);
  });
});

const PREDICT: PredictConfig = {
  mode: 'predict',
  at: [1, 1],
  operation: { type: 'slide', direction: 'right', cells: 5 },
};

const SLIDE_FIVE: readonly Cell[] = [
  [6, 1],
  [7, 1],
  [8, 1],
  [6, 2],
  [7, 2],
  [6, 3],
  [6, 4],
];

describe('E10 predict', () => {
  it('오른쪽 5칸 밀기를 정확히 칠하면 matches', () => {
    const result = observation(PREDICT, [{ type: 'paint', cells: SLIDE_FIVE, value: true }]);
    expect(result['paintedCount']).toBe(7);
    expect(result['matches']).toBe(true);
    expect(result['paintedOrientation']).toBe('id');
    expect(result['expectedOrientation']).toBe('id');
    expect(result['offsetOnly']).toBe(false);
  });

  it('뒤집기 과제에 180° 결과를 칠하면 paintedOrientation r180', () => {
    const config: PredictConfig = {
      mode: 'predict',
      at: [1, 1],
      operation: { type: 'flip', side: 'right' },
    };
    const state = createInitialState(config);
    if (state.mode !== 'predict') return;
    const painted = orientCells(state.start.cells, 'r180', [1, 1]);
    const result = observation(config, [{ type: 'paint', cells: painted, value: true }]);
    expect(result['paintedOrientation']).toBe('r180');
    expect(result['matches']).toBe(false);
    expect(predicates['predictedOrientation']?.(result, { is: 'r180' })).toBe(true);
  });

  it('같은 방향으로 한 칸 어긋나면 offsetOnly', () => {
    const state = createInitialState(PREDICT);
    if (state.mode !== 'predict') return;
    const shifted = orientCells(state.start.cells, 'id', [7, 1]);
    const result = observation(PREDICT, [{ type: 'paint', cells: shifted, value: true }]);
    expect(result['paintedOrientation']).toBe('id');
    expect(result['matches']).toBe(false);
    expect(result['offsetOnly']).toBe(true);
    expect(predicates['predictionOffsetOnly']?.(result, undefined)).toBe(true);
  });

  it('확인 전 paint·확인 뒤 paint·clear-paint 무시, retry가 칠한 칸을 비운다', () => {
    let state = createInitialState(PREDICT);
    expect(reduce(state, { type: 'confirm' })).toBe(state);
    state = reduce(state, { type: 'paint', cells: [[1, 1]], value: true });
    state = reduce(state, { type: 'confirm' });
    if (state.mode !== 'predict') return;
    expect(state.confirmed).toBe(true);
    expect(state.attempts).toBe(1);
    const confirmed = state;
    state = reduce(state, { type: 'paint', cells: [[2, 1]], value: true });
    expect(state).toBe(confirmed);
    state = reduce(state, { type: 'clear-paint' });
    expect(state).toBe(confirmed);
    state = reduce(state, { type: 'retry' });
    if (state.mode !== 'predict') return;
    expect(state.confirmed).toBe(false);
    expect(state.painted).toHaveLength(0);
    expect(state.attempts).toBe(1);
  });

  it('predictionMatches는 confirmed: true를 주면 확인까지 요구한다', () => {
    const painted = observation(PREDICT, [{ type: 'paint', cells: SLIDE_FIVE, value: true }]);
    expect(predicates['predictionMatches']?.(painted, { confirmed: true })).toBe(false);
    const confirmed = observation(PREDICT, [
      { type: 'paint', cells: SLIDE_FIVE, value: true },
      { type: 'confirm' },
    ]);
    expect(confirmed['confirmed']).toBe(true);
    expect(confirmed['attempts']).toBe(1);
    expect(predicates['predictionMatches']?.(confirmed, { confirmed: true })).toBe(true);
  });

  it('확인 전 칠한 칸만 Observation에 있고 결과 칸은 화면 문구가 아니다', () => {
    const result = observation(PREDICT, [
      { type: 'paint', cells: [[6, 1]], value: true },
      { type: 'clear-paint' },
    ]);
    expect(result['painted']).toEqual([]);
    expect(result['matches']).toBe(false);
  });
});

describe('E10 직렬화·이벤트', () => {
  it('두 모드 상태·Observation이 JSON으로 왕복한다', () => {
    const slide = apply(TARGET_CONFIG, [
      { type: 'slide', dx: 5, dy: 2 },
      { type: 'turn', direction: 'cw', angle: 90, center: [6, 3] },
    ]);
    const predict = apply(PREDICT, [
      { type: 'paint', cells: SLIDE_FIVE, value: true },
      { type: 'confirm' },
    ]);
    assertSerializable(slide);
    assertSerializable(predict);
    assertSerializable(observe(slide));
    assertSerializable(observe(predict));
  });

  it('이동할 때 moved 이벤트를 한 번 낸다', () => {
    let state = createInitialState({ mode: 'slide-flip-turn' });
    const events: string[] = [];
    for (const action of [
      { type: 'turn', direction: 'cw', angle: 90, center: [4, 3] },
    ] satisfies TransformAction[]) {
      const next = reduce(state, action);
      events.push(...emit(state, next).map((event) => event.name));
      state = next;
    }
    expect(events).toEqual(['moved']);
  });
});
