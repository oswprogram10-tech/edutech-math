/**
 * E11 angle-gather 단위 테스트.
 *
 * 카드 T106 결정 7·9·11·17의 꼭짓점 이동 무시, 부채꼴 사슬·겹침 판정,
 * 180°·360°, 시도 기록을 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { CutAction, CutConfig, CutState } from '../types';
import { fanState, fanTrialSum, bestTurn } from '../angle-gather/fan';
import { reduceAngleGather } from '../angle-gather/reduce';
import type { AngleGatherState, Peg } from '../angle-gather/types';

function angleState(state: CutState): AngleGatherState {
  if (state.mode !== 'angle-gather') throw new Error('angle-gather 상태가 아닙니다.');
  return state;
}

function apply(config: CutConfig, actions: readonly CutAction[]): AngleGatherState {
  let state = createInitialState(config);
  assertSerializable(state);
  for (const action of actions) {
    state = reduce(state, action);
    assertSerializable(state);
  }
  return angleState(state);
}

function gatherAll(state: AngleGatherState): AngleGatherState {
  let next = state;
  for (let index = 0; index < next.vertices.length; index += 1) {
    next = reduceAngleGather(next, {
      type: 'gather-corner',
      index,
      turned: bestTurn(next, index),
    });
    assertSerializable(next);
  }
  return next;
}

function gatheredShape(config: CutConfig): AngleGatherState {
  return gatherAll(apply(config, [{ type: 'cut-corners' }]));
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function trials(observation: Observation): readonly Readonly<Record<string, JsonValue>>[] {
  const value = observation['trials'];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Readonly<Record<string, JsonValue>> =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );
}

describe('E11 angle-gather 꼭짓점 이동', () => {
  it('일직선이 되는 이동은 무시한다', () => {
    const state = apply({ mode: 'angle-gather' }, []);
    const next = reduce(state, { type: 'move-vertex', index: 2, to: [5, 10] });
    expect(next).toBe(state);
  });

  it('다른 꼭짓점과 겹치는 이동은 무시한다', () => {
    const state = apply({ mode: 'angle-gather' }, []);
    const next = reduce(state, { type: 'move-vertex', index: 2, to: [1, 10] });
    expect(next).toBe(state);
  });

  it('오목 사각형이 되는 이동은 무시한다', () => {
    const state = apply({ mode: 'angle-gather', shape: 'quadrilateral' }, []);
    const next = reduce(state, { type: 'move-vertex', index: 2, to: [5, 8] });
    expect(next).toBe(state);
  });

  it('deformable: false이면 어떤 이동도 받지 않는다', () => {
    const state = apply({ mode: 'angle-gather', deformable: false }, []);
    expect(reduce(state, { type: 'move-vertex', index: 0, to: [2, 10] })).toBe(state);
  });

  it('자르기 단계에서는 꼭짓점을 옮기지 않는다', () => {
    const state = apply({ mode: 'angle-gather' }, [{ type: 'cut-corners' }]);
    expect(reduce(state, { type: 'move-vertex', index: 0, to: [2, 10] })).toBe(state);
  });
});

describe('E11 angle-gather 부채꼴 사슬', () => {
  it('삼각형 세 조각을 bestTurn으로 모으면 straight·180°이고 시도가 1개다', () => {
    const state = gatheredShape({ mode: 'angle-gather' });
    expect(fanState(state)).toBe('straight');
    expect(fanTrialSum(state)).toBe(180);
    const observation = observe(state);
    expect(observation['fan']).toBe('straight');
    expect(observation['gatheredSum']).toBe(180);
    expect(predicates['gatheredSumIs']?.(observation, { value: 180 })).toBe(true);
    expect(observation['gatheredCount']).toBe(3);
    expect(trials(observation)).toHaveLength(1);
  });

  it('사각형 네 조각을 bestTurn으로 모으면 full·360°다', () => {
    const state = gatheredShape({ mode: 'angle-gather', shape: 'quadrilateral' });
    expect(fanState(state)).toBe('full');
    expect(fanTrialSum(state)).toBe(360);
    const observation = observe(state);
    expect(observation['gatheredSum']).toBe(360);
    expect(predicates['gatheredSumIs']?.(observation, { value: 360 })).toBe(true);
    expect(observation['gatheredCount']).toBe(4);
  });

  it('사각형 네 조각을 모두 turned: false로 모으면 겹쳐서 overlap이고 합은 null이다', () => {
    let state = apply({ mode: 'angle-gather', shape: 'quadrilateral' }, [{ type: 'cut-corners' }]);
    for (let index = 0; index < state.vertices.length; index += 1) {
      state = reduceAngleGather(state, {
        type: 'gather-corner',
        index,
        turned: false,
      });
    }
    expect(fanState(state)).toBe('overlap');
    expect(fanTrialSum(state)).toBeNull();
    const observation = observe(state);
    expect(observation['gatheredSum']).toBeNull();
    expect(trials(observation)).toHaveLength(0);
  });

  it('한 조각만 모으면 partial이다', () => {
    const state = gatherOne({ mode: 'angle-gather' });
    expect(fanState(state)).toBe('partial');
    expect(fanTrialSum(state)).toBeNull();
  });

  it('모은 조각을 빼면 다시 partial이 된다', () => {
    const complete = gatheredShape({ mode: 'angle-gather' });
    const state = reduceAngleGather(complete, {
      type: 'ungather-corner',
      index: complete.vertices.length - 1,
    });
    expect(fanState(state)).toBe('partial');
    expect(fanTrialSum(state)).toBeNull();
  });

  it('turn-corner로 부채가 완성돼도 그 시도를 기록한다', () => {
    let state = apply({ mode: 'angle-gather' }, [{ type: 'cut-corners' }]);
    for (let index = 0; index < state.vertices.length; index += 1) {
      state = reduceAngleGather(state, { type: 'gather-corner', index, turned: false });
    }
    expect(fanState(state)).toBe('gap');
    expect(state.trials).toHaveLength(0);

    const completed = reduceAngleGather(state, { type: 'turn-corner', index: 0 });
    expect(fanState(completed)).toBe('straight');
    expect(completed.recorded).toBe(true);
    expect(completed.trials).toHaveLength(1);
    expect(trials(observe(completed))).toHaveLength(1);
  });

  it('turn-corner는 모은 조각만 뒤집는다', () => {
    const state = gatherOne({ mode: 'angle-gather' });
    const turned = reduceAngleGather(state, { type: 'turn-corner', index: 0 });
    expect(turned.corners[0]?.turned).toBe(!state.corners[0]?.turned);
    const empty = reduceAngleGather(state, { type: 'turn-corner', index: 2 });
    expect(empty.corners[2]?.turned).toBe(false);
  });
});

function gatherOne(config: CutConfig): AngleGatherState {
  let state = apply(config, [{ type: 'cut-corners' }]);
  state = reduceAngleGather(state, {
    type: 'gather-corner',
    index: 0,
    turned: bestTurn(state, 0),
  });
  return state;
}

describe('E11 angle-gather 여러 모양', () => {
  const triangleCases: readonly (readonly Peg[])[] = [
    [
      [1, 10],
      [10, 10],
      [4, 3],
    ],
    [
      [2, 10],
      [8, 10],
      [2, 4],
    ],
    [
      [2, 10],
      [10, 10],
      [4, 9],
    ],
    [
      [2, 9],
      [9, 10],
      [4, 4],
    ],
    [
      [1, 11],
      [8, 11],
      [5, 5],
    ],
    [
      [3, 11],
      [9, 9],
      [2, 5],
    ],
    [
      [1, 9],
      [7, 11],
      [3, 3],
    ],
    [
      [2, 8],
      [10, 9],
      [6, 3],
    ],
    [
      [4, 10],
      [9, 10],
      [6, 6],
    ],
    [
      [1, 10],
      [6, 11],
      [2, 4],
    ],
  ];

  const quadrilateralCases: readonly (readonly Peg[])[] = [
    [
      [1, 10],
      [10, 11],
      [9, 3],
      [3, 2],
    ],
    [
      [2, 9],
      [7, 9],
      [7, 4],
      [2, 4],
    ],
    [
      [2, 9],
      [8, 9],
      [10, 5],
      [4, 5],
    ],
    [
      [2, 9],
      [9, 9],
      [7, 4],
      [4, 4],
    ],
    [
      [1, 10],
      [9, 10],
      [9, 5],
      [1, 5],
    ],
  ];

  it('예각·직각·둔각을 섞은 삼각형 10개가 모두 180°다', () => {
    for (const vertices of triangleCases) {
      const state = gatheredShape({
        mode: 'angle-gather',
        shape: 'triangle',
        vertices,
      });
      expect(fanState(state), JSON.stringify(vertices)).toBe('straight');
      expect(fanTrialSum(state), JSON.stringify(vertices)).toBe(180);
      expect(trials(observe(state))).toHaveLength(1);
    }
  });

  it('볼록 사각형 5개가 모두 360°다', () => {
    for (const vertices of quadrilateralCases) {
      const state = gatheredShape({
        mode: 'angle-gather',
        shape: 'quadrilateral',
        vertices,
      });
      expect(fanState(state), JSON.stringify(vertices)).toBe('full');
      expect(fanTrialSum(state), JSON.stringify(vertices)).toBe(360);
      expect(trials(observe(state))).toHaveLength(1);
    }
  });
});

describe('E11 angle-gather 시도 기록', () => {
  it('2배로 키운 삼각형은 서로 다른 시도 2개다', () => {
    let state = gatheredShape({
      mode: 'angle-gather',
      vertices: [
        [2, 9],
        [5, 9],
        [3, 7],
      ],
    });
    state = reduceAngleGather(state, { type: 'new-trial' });
    state = reduceAngleGather(state, { type: 'move-vertex', index: 0, to: [1, 11] });
    state = reduceAngleGather(state, { type: 'move-vertex', index: 1, to: [7, 11] });
    state = reduceAngleGather(state, { type: 'cut-corners' });
    state = gatherAll(state);

    const observation = observe(state);
    expect(trials(observation)).toHaveLength(2);
    expect(observation['distinctTrials']).toBe(2);
    expect(predicates['distinctTrials']?.(observation, { count: 2, sum: 180 })).toBe(true);
  });

  it('평행이동한 같은 삼각형은 서로 다른 시도가 1개다', () => {
    let state = gatheredShape({
      mode: 'angle-gather',
      vertices: [
        [2, 9],
        [5, 9],
        [3, 7],
      ],
    });
    state = reduceAngleGather(state, { type: 'new-trial' });
    state = reduceAngleGather(state, { type: 'move-vertex', index: 0, to: [5, 10] });
    state = reduceAngleGather(state, { type: 'move-vertex', index: 1, to: [8, 10] });
    state = reduceAngleGather(state, { type: 'move-vertex', index: 2, to: [6, 8] });
    state = reduceAngleGather(state, { type: 'cut-corners' });
    state = gatherAll(state);

    const observation = observe(state);
    expect(trials(observation)).toHaveLength(2);
    expect(observation['distinctTrials']).toBe(1);
  });

  it('new-trial은 자르기 단계와 모은 조각을 비우지만 기록은 남긴다', () => {
    const complete = gatheredShape({ mode: 'angle-gather' });
    const state = reduceAngleGather(complete, { type: 'new-trial' });
    expect(state.phase).toBe('shape');
    expect(state.corners).toHaveLength(0);
    expect(state.recorded).toBe(false);
    expect(state.trials).toHaveLength(1);
  });
});

describe('E11 angle-gather 이벤트', () => {
  it('fan-complete는 다 모아 straight가 될 때 한 번만 나온다', () => {
    let state = apply({ mode: 'angle-gather' }, [{ type: 'cut-corners' }]);
    const completions: number[] = [];
    for (let index = 0; index < state.vertices.length; index += 1) {
      const next = reduceAngleGather(state, {
        type: 'gather-corner',
        index,
        turned: bestTurn(state, index),
      });
      for (const event of emit(state, next)) {
        if (event.name === 'fan-complete') {
          const payload = recordOf(event.payload);
          const sum = payload?.['sum'];
          if (typeof sum === 'number') completions.push(sum);
        }
      }
      state = next;
    }
    expect(completions).toEqual([180]);

    const again = reduceAngleGather(state, {
      type: 'gather-corner',
      index: 0,
      turned: state.corners[0]?.turned ?? false,
    });
    expect(emit(state, again).filter((event) => event.name === 'fan-complete')).toHaveLength(0);
  });

  it('emit은 모드가 다른 상태 사이에서 각도 이벤트를 만들지 않는다', () => {
    const pieces = createInitialState({ mode: 'formula-derive' });
    const angle = createInitialState({ mode: 'angle-gather' });
    expect(emit(pieces, angle)).toEqual([]);
  });
});
