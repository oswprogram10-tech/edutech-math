import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import {
  bridgeSumOf,
  bubbleValuesOf,
  createInitialState,
  measureOutLooseOf,
  pairingLeftoverOf,
  reduce,
  rekenrekTotalOf,
} from '../reduce';
import type {
  BridgeState,
  BubblePairsState,
  CountersConfig,
  CountersState,
  MeasureOutState,
  PairingState,
  RekenrekState,
  ShareState,
} from '../types';

function asRekenrek(state: CountersState): RekenrekState {
  if (state.mode !== 'rekenrek') throw new Error('rekenrek 상태가 아닙니다.');
  return state;
}

function asPairing(state: CountersState): PairingState {
  if (state.mode !== 'pairing') throw new Error('pairing 상태가 아닙니다.');
  return state;
}

function asShare(state: CountersState): ShareState {
  if (state.mode !== 'share') throw new Error('share 상태가 아닙니다.');
  return state;
}

function asMeasure(state: CountersState): MeasureOutState {
  if (state.mode !== 'measure-out') throw new Error('measure-out 상태가 아닙니다.');
  return state;
}

function asBubble(state: CountersState): BubblePairsState {
  if (!(state.mode === 'part-whole' && 'variant' in state && state.variant === 'bubble-pairs')) {
    throw new Error('bubble-pairs 상태가 아닙니다.');
  }
  return state;
}

function asBridge(state: CountersState): BridgeState {
  if (!(state.mode === 'part-whole' && 'variant' in state && state.variant === 'bridge')) {
    throw new Error('bridge 상태가 아닙니다.');
  }
  return state;
}

function bubbleId(state: BubblePairsState, value: number): string {
  const found = state.bubbles.find((bubble) => bubble.value === value && !bubble.popped);
  if (!found) throw new Error(`값 ${value}인 방울이 없습니다.`);
  return found.id;
}

describe('E02 rekenrek', () => {
  it('구슬을 밀면 그 구슬과 왼쪽 구슬이 함께 밀린다', () => {
    let state = asRekenrek(createInitialState({ mode: 'rekenrek', rows: 2 }));
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 3 }));
    expect(state.left).toEqual([3, 0]);
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 4 }));
    expect(state.left).toEqual([7, 0]);
  });

  it('한 줄에 10개를 넘겨 밀지 않는다', () => {
    let state = asRekenrek(createInitialState({ mode: 'rekenrek', rows: 1 }));
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 9 }));
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 5 }));
    expect(state.left).toEqual([10]);
    expect(rekenrekTotalOf(state)).toBe(10);
  });

  it('밀기·되밀기마다 history와 reached를 남긴다', () => {
    let state = asRekenrek(createInitialState({ mode: 'rekenrek', rows: 1 }));
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 5 }));
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 5 }));
    state = asRekenrek(reduce(state, { type: 'pull', row: 0, count: 2 }));
    expect(state.history).toEqual([5, 10, 8]);
    expect(state.reached).toEqual([5, 10, 8]);
    expect(state.fullRowPushes).toBe(0);
    expect(state.moves).toBe(3);
  });

  it('한 번에 10개를 밀면 fullRowPushes가 늘어난다', () => {
    const state = asRekenrek(createInitialState({ mode: 'rekenrek', rows: 1 }));
    const pushed = asRekenrek(reduce(state, { type: 'push', row: 0, count: 10 }));
    expect(pushed.fullRowPushes).toBe(1);
  });

  it('없는 줄·0개는 상태를 바꾸지 않는다', () => {
    const state = asRekenrek(createInitialState({ mode: 'rekenrek', rows: 1 }));
    expect(reduce(state, { type: 'push', row: 3, count: 1 })).toBe(state);
    expect(reduce(state, { type: 'push', row: 0, count: 0 })).toBe(state);
  });

  it('history predicate는 순서대로 나타나는지 본다', () => {
    let state = asRekenrek(createInitialState({ mode: 'rekenrek', rows: 1 }));
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 5 }));
    state = asRekenrek(reduce(state, { type: 'push', row: 0, count: 5 }));
    const observation = observe(state, { mode: 'rekenrek' });
    expect(predicates.historyIncludesInOrder?.(observation, { values: [5, 10] })).toBe(true);
    expect(predicates.historyIncludesInOrder?.(observation, { values: [10, 5] })).toBe(false);
    expect(predicates.reachedAll?.(observation, { values: [5, 10] })).toBe(true);
  });
});

describe('E02 pairing', () => {
  it('예측 전에는 짝 만들기를 무시한다', () => {
    const state = asPairing(createInitialState({ mode: 'pairing', count: 6, predictFirst: true }));
    expect(state.phase).toBe('predict');
    expect(reduce(state, { type: 'make-pairs' })).toBe(state);
    const ready = asPairing(reduce(state, { type: 'predict', choice: 0 }));
    expect(ready.phase).toBe('ready');
    expect(ready.prediction).toBe(0);
    expect(asPairing(reduce(ready, { type: 'make-pairs' })).phase).toBe('paired');
  });

  it('13명을 짝지으면 남는 사람이 1명이다', () => {
    let state = asPairing(createInitialState({ mode: 'pairing', count: 13, predictFirst: false }));
    expect(state.phase).toBe('ready');
    state = asPairing(reduce(state, { type: 'make-pairs' }));
    expect(pairingLeftoverOf(state)).toBe(1);
    const observation = observe(state, { mode: 'pairing' });
    expect(observation['pairs']).toBe(6);
    expect(observation['leftover']).toBe(1);
    expect(predicates.pairedDone?.(observation, undefined)).toBe(true);
  });

  it('다시를 누르면 ready로 돌아가고 예측은 남는다', () => {
    let state = asPairing(createInitialState({ mode: 'pairing', count: 4 }));
    state = asPairing(reduce(state, { type: 'predict', choice: 1 }));
    state = asPairing(reduce(state, { type: 'make-pairs' }));
    state = asPairing(reduce(state, { type: 'reset-pairs' }));
    expect(state.phase).toBe('ready');
    expect(state.prediction).toBe(1);
  });
});

describe('E02 share', () => {
  it('한 바퀴 나누기는 무더기가 접시 수보다 적으면 무시한다', () => {
    let state = asShare(createInitialState({ mode: 'share', total: 2, groups: 3 }));
    expect(reduce(state, { type: 'deal-round' })).toBe(state);
    state = asShare(createInitialState({ mode: 'share', total: 12, groups: 3 }));
    state = asShare(reduce(state, { type: 'deal-round' }));
    state = asShare(reduce(state, { type: 'deal-round' }));
    state = asShare(reduce(state, { type: 'deal-round' }));
    state = asShare(reduce(state, { type: 'deal-round' }));
    expect(state.plates).toEqual([4, 4, 4]);
    expect(state.pile).toBe(0);
    expect(state.rounds).toBe(4);
    expect(observe(state, { mode: 'share' })['equal']).toBe(true);
  });

  it('접시에서 하나를 되돌리면 무더기가 늘어난다', () => {
    let state = asShare(createInitialState({ mode: 'share', total: 6, groups: 3 }));
    state = asShare(reduce(state, { type: 'deal', plate: 1 }));
    expect(state.plates).toEqual([0, 1, 0]);
    expect(state.pile).toBe(5);
    state = asShare(reduce(state, { type: 'take-back', plate: 1 }));
    expect(state.plates).toEqual([0, 0, 0]);
    expect(state.pile).toBe(6);
    expect(reduce(state, { type: 'take-back', plate: 1 })).toBe(state);
  });
});

describe('E02 measure-out', () => {
  it('정확히 groupSize개만 봉지에 담는다', () => {
    let state = asMeasure(createInitialState({ mode: 'measure-out', total: 12, groupSize: 4 }));
    const ids = state.counters.map((counter) => counter.id);
    state = asMeasure(reduce(state, { type: 'bag', ids: ids.slice(0, 3) }));
    expect(state.bagCount).toBe(0);
    expect(state.lastAttempt).toEqual({ count: 3, ok: false });
    state = asMeasure(reduce(state, { type: 'bag', ids: ids.slice(0, 4) }));
    expect(state.bagCount).toBe(1);
    expect(measureOutLooseOf(state)).toBe(8);
    state = asMeasure(reduce(state, { type: 'bag', ids: ids.slice(4, 9) }));
    expect(state.bagCount).toBe(1);
    expect(state.lastAttempt).toEqual({ count: 5, ok: false });
    state = asMeasure(reduce(state, { type: 'bag', ids: ids.slice(4, 8) }));
    expect(state.bagCount).toBe(2);
  });

  it('bag-next는 안 든 것 중 앞에서부터 담는다', () => {
    let state = asMeasure(createInitialState({ mode: 'measure-out', total: 12, groupSize: 3 }));
    for (let count = 0; count < 4; count += 1) {
      state = asMeasure(reduce(state, { type: 'bag-next' }));
    }
    expect(state.bagCount).toBe(4);
    state = asMeasure(reduce(state, { type: 'bag-next' }));
    expect(state.bagCount).toBe(4);
  });

  it('12개를 5개씩 덜어 내면 봉지 2개, 남은 2개다', () => {
    let state = asMeasure(createInitialState({ mode: 'measure-out', total: 12, groupSize: 5 }));
    state = asMeasure(reduce(state, { type: 'bag-next' }));
    state = asMeasure(reduce(state, { type: 'bag-next' }));
    expect(state.bagCount).toBe(2);
    expect(measureOutLooseOf(state)).toBe(2);
    expect(observe(state, { mode: 'measure-out' })['loose']).toBe(2);
  });

  it('묶음 크기를 바꾸면 모든 봉지를 푼다', () => {
    let state = asMeasure(
      createInitialState({ mode: 'measure-out', total: 9, groupSizeChoices: [2, 3] }),
    );
    expect(state.groupSize).toBeNull();
    expect(reduce(state, { type: 'bag-next' })).toBe(state);
    state = asMeasure(reduce(state, { type: 'choose-size', size: 3 }));
    state = asMeasure(reduce(state, { type: 'bag-next' }));
    expect(state.bagCount).toBe(1);
    state = asMeasure(reduce(state, { type: 'choose-size', size: 2 }));
    expect(state.bagCount).toBe(0);
    expect(measureOutLooseOf(state)).toBe(9);
    expect(predicates.groupSizeIs?.(observe(state, { mode: 'measure-out' }), { value: 2 })).toBe(
      true,
    );
  });

  it('bagged 이벤트를 낸다', () => {
    const before = asMeasure(createInitialState({ mode: 'measure-out', total: 6, groupSize: 3 }));
    const after = asMeasure(reduce(before, { type: 'bag-next' }));
    const events = emit(before, after, { type: 'bag-next' });
    expect(events).toContainEqual({ name: 'bagged', payload: { size: 3, bags: 1 } });
    expect(events.some((event) => event.name === 'value-changed')).toBe(false);
  });
});

describe('E02 bubble-pairs', () => {
  const config: CountersConfig = {
    mode: 'part-whole',
    variant: 'bubble-pairs',
    target: 10,
    bubbles: [3, 7, 2, 8],
  };

  it('합이 목표와 같으면 방울이 터진다', () => {
    let state = asBubble(createInitialState(config));
    state = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 3) }));
    expect(state.selected).toHaveLength(1);
    state = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 7) }));
    expect(state.pops).toEqual([[3, 7]]);
    expect(state.streak).toBe(1);
    expect([...bubbleValuesOf(state)].sort((a, b) => a - b)).toEqual([2, 8]);
    const observation = observe(state, config);
    expect(observation['popCount']).toBe(1);
    expect(observation['allPopsHitTarget']).toBe(true);
    expect(predicates.poppedWith?.(observation, { size: 10 })).toBe(true);
  });

  it('합이 목표를 넘으면 lastMiss를 남기고 선택을 푼다', () => {
    const state = asBubble(createInitialState(config));
    const first = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 7) }));
    const next = asBubble(reduce(first, { type: 'pick', id: bubbleId(state, 8) }));
    expect(next.selected).toEqual([]);
    expect(next.lastMiss?.sum).toBe(15);
    expect(next.misses).toBe(1);
    expect(next.streak).toBe(0);
  });

  it('pickUpTo 3이면 세 방울로도 터진다', () => {
    const three: CountersConfig = {
      mode: 'part-whole',
      variant: 'bubble-pairs',
      target: 9,
      bubbles: [3, 3, 3],
      pickUpTo: 3,
    };
    let state = asBubble(createInitialState(three));
    state = asBubble(reduce(state, { type: 'pick', id: state.bubbles[0]?.id ?? '' }));
    state = asBubble(reduce(state, { type: 'pick', id: state.bubbles[1]?.id ?? '' }));
    expect(state.selected).toHaveLength(2);
    state = asBubble(reduce(state, { type: 'pick', id: state.bubbles[2]?.id ?? '' }));
    expect(state.pops).toEqual([[3, 3, 3]]);
  });

  it('빗나가면 streak이 0이 되고 bestStreak은 남는다', () => {
    const streakConfig: CountersConfig = {
      mode: 'part-whole',
      variant: 'bubble-pairs',
      target: 10,
      bubbles: [3, 7, 2, 4],
    };
    let state = asBubble(createInitialState(streakConfig));
    state = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 3) }));
    state = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 7) }));
    expect(state.streak).toBe(1);
    const wrong = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 2) }));
    const missed = asBubble(reduce(wrong, { type: 'pick', id: bubbleId(state, 4) }));
    expect(missed.streak).toBe(0);
    expect(missed.bestStreak).toBe(1);
  });

  it('터진 방울은 다시 고를 수 없다', () => {
    let state = asBubble(createInitialState(config));
    const third = bubbleId(state, 3);
    state = asBubble(reduce(state, { type: 'pick', id: third }));
    state = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 7) }));
    const popped = state;
    expect(reduce(popped, { type: 'pick', id: third })).toBe(popped);
  });

  it('bubble-popped 이벤트를 내고 value-changed는 내지 않는다', () => {
    let state = asBubble(createInitialState(config));
    state = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 3) }));
    const before = state;
    const after = asBubble(reduce(state, { type: 'pick', id: bubbleId(state, 7) }));
    const events = emit(before, after, { type: 'pick', id: 'x' });
    expect(events).toContainEqual({ name: 'bubble-popped', payload: { values: [3, 7] } });
    expect(events.some((event) => event.name === 'value-changed')).toBe(false);
  });
});

describe('E02 bridge', () => {
  const config: CountersConfig = {
    mode: 'part-whole',
    variant: 'bridge',
    gap: 13,
    rods: [9, 4, 5],
    maxRods: 2,
  };

  it('막대를 이어 틈을 채우면 fits가 된다', () => {
    let state = asBridge(createInitialState(config));
    state = asBridge(reduce(state, { type: 'place-rod', length: 9 }));
    state = asBridge(reduce(state, { type: 'place-rod', length: 4 }));
    expect(bridgeSumOf(state)).toBe(13);
    const observation = observe(state, config);
    expect(observation['fits']).toBe(true);
    expect(predicates.bridgeFits?.(observation, undefined)).toBe(true);
    expect(predicates.placedInclude?.(observation, { length: 4 })).toBe(true);
  });

  it('maxRods를 넘겨 놓지 않는다', () => {
    let state = asBridge(createInitialState({ ...config, maxRods: 1 }));
    state = asBridge(reduce(state, { type: 'place-rod', length: 9 }));
    expect(reduce(state, { type: 'place-rod', length: 4 })).toBe(state);
  });

  it('preset은 presetLocked가 아니면 뺄 수 있다', () => {
    const free = asBridge(createInitialState({ ...config, preset: [9], presetLocked: false }));
    expect(free.placed).toEqual([9]);
    expect(asBridge(reduce(free, { type: 'remove-rod', index: 0 })).placed).toEqual([]);
    const locked = asBridge(createInitialState({ ...config, preset: [9], presetLocked: true }));
    expect(reduce(locked, { type: 'remove-rod', index: 0 })).toBe(locked);
  });

  it('같은 다리는 한 번만 기록한다', () => {
    let state = asBridge(createInitialState({ ...config, preset: [9] }));
    state = asBridge(reduce(state, { type: 'place-rod', length: 4 }));
    state = asBridge(reduce(state, { type: 'record-bridge' }));
    expect(state.recorded).toEqual([[4, 9]]);
    const again = asBridge(reduce(state, { type: 'record-bridge' }));
    expect(again.recorded).toHaveLength(1);
    expect(predicates.distinctBridgesAtLeast?.(observe(again, config), { count: 1 })).toBe(true);
  });

  it('틈과 합이 다르면 기록하지 않는다', () => {
    let state = asBridge(createInitialState(config));
    state = asBridge(reduce(state, { type: 'place-rod', length: 9 }));
    expect(reduce(state, { type: 'record-bridge' })).toBe(state);
  });
});

describe('E02 새 모드 공통', () => {
  const configs: CountersConfig[] = [
    { mode: 'rekenrek', rows: 5 },
    { mode: 'pairing', count: 13 },
    { mode: 'share', total: 12, groups: 3 },
    { mode: 'measure-out', total: 12, groupSizeChoices: [2, 3] },
    { mode: 'part-whole', variant: 'bubble-pairs', bubbles: [1, 9] },
    { mode: 'part-whole', variant: 'bridge', gap: 14, rods: [9, 5] },
  ];

  it('모든 새 상태는 JSON 직렬화 가능하다', () => {
    configs.forEach((config) => {
      expect(() => assertSerializable(createInitialState(config))).not.toThrow();
    });
  });

  it('seed가 같으면 measure-out 배치가 같다', () => {
    const config: CountersConfig = { mode: 'measure-out', total: 12, groupSize: 3, seed: 7 };
    expect(createInitialState(config)).toEqual(createInitialState(config));
  });

  it('rekenrek 밀기는 value-changed를 낸다', () => {
    const before = asRekenrek(createInitialState({ mode: 'rekenrek', rows: 1 }));
    const after = asRekenrek(reduce(before, { type: 'push', row: 0, count: 5 }));
    expect(emit(before, after, { type: 'push', row: 0, count: 5 })).toContainEqual({
      name: 'value-changed',
      payload: { value: 5 },
    });
  });

  it('inferMode는 새 설정 키를 알아본다', () => {
    expect(createInitialState({ rows: 2 }).mode).toBe('rekenrek');
    expect(createInitialState({ mode: 'part-whole', variant: 'bridge', gap: 8 }).mode).toBe(
      'part-whole',
    );
    expect(createInitialState({ groups: 4, total: 8 }).mode).toBe('share');
  });
});
