import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import {
  createInitialState,
  distinctSplitsOf,
  frameFillOf,
  platesOf,
  reduce,
  subtractStrategyOf,
  totalOf,
} from '../reduce';
import type {
  CountersConfig,
  CountersState,
  FlashState,
  PartWholeState,
  SummonState,
  TenFrameState,
} from '../types';

function asSummon(state: CountersState): SummonState {
  if (state.mode !== 'summon') throw new Error('summon 상태가 아닙니다.');
  return state;
}

function asTen(state: CountersState): TenFrameState {
  if (state.mode !== 'ten-frame') throw new Error('ten-frame 상태가 아닙니다.');
  return state;
}

function asPartWhole(state: CountersState): PartWholeState {
  if (state.mode !== 'part-whole') throw new Error('part-whole 상태가 아닙니다.');
  return state;
}

function asFlash(state: CountersState): FlashState {
  if (state.mode !== 'flash') throw new Error('flash 상태가 아닙니다.');
  return state;
}

function counterId(state: TenFrameState, frame: number, cell: number): string {
  const found = state.counters.find((counter) => counter.frame === frame && counter.cell === cell);
  if (!found) throw new Error(`프레임 ${frame} 칸 ${cell}에 셈돌이 없습니다.`);
  return found.id;
}

describe('E02 summon', () => {
  it('max를 넘는 만큼은 생기지 않는다', () => {
    let state = asSummon(createInitialState({ mode: 'summon', max: 10, start: 9 }));
    state = asSummon(reduce(state, { type: 'summon', count: 5 }));
    expect(totalOf(state)).toBe(10);
    expect(state.counters).toHaveLength(10);
  });

  it('0개나 음수는 상태를 바꾸지 않는다', () => {
    const state = asSummon(createInitialState({ mode: 'summon', max: 10, start: 3 }));
    expect(reduce(state, { type: 'summon', count: 0 })).toBe(state);
    expect(reduce(state, { type: 'summon', count: -2 })).toBe(state);
  });

  it('셈돌은 선반에 왼쪽부터 줄 선다', () => {
    const state = asSummon(
      reduce(createInitialState({ mode: 'summon', max: 10, start: 0 }), {
        type: 'summon',
        count: 3,
      }),
    );
    expect(state.counters[0]?.x).toBeLessThan(state.counters[1]?.x ?? 0);
    expect(state.counters[1]?.x).toBeLessThan(state.counters[2]?.x ?? 0);
    expect(state.counters[0]?.y).toBe(state.counters[1]?.y);
  });

  it('하나를 빼면 남은 셈돌이 다시 왼쪽부터 줄 선다', () => {
    let state = asSummon(createInitialState({ mode: 'summon', max: 10, start: 3 }));
    const first = state.counters[0];
    if (!first) throw new Error('셈돌이 없습니다.');
    state = asSummon(reduce(state, { type: 'remove', id: first.id }));
    expect(state.counters).toHaveLength(2);
    expect(state.counters[0]?.x).toBe(110);
  });
});

describe('E02 ten-frame', () => {
  const twoFrames = (left: number, right: number): CountersConfig => ({
    mode: 'ten-frame',
    frames: 2,
    left,
    right,
    trayCount: 0,
  });

  it('8+5에서 오른쪽을 왼쪽으로 밀면 왼쪽 빈칸 2개만큼만 넘어간다', () => {
    let state = asTen(createInitialState(twoFrames(8, 5)));
    state = asTen(reduce(state, { type: 'swipe-fill', from: 1, to: 0 }));
    expect(frameFillOf(state)).toEqual([10, 3]);
    expect(state.bond).toEqual([5, 2, 3]);
    expect(state.moves).toBe(1);
  });

  it('받는 프레임에 빈칸이 없으면 아무것도 넘어가지 않는다', () => {
    const state = asTen(createInitialState(twoFrames(10, 5)));
    expect(reduce(state, { type: 'swipe-fill', from: 1, to: 0 })).toBe(state);
  });

  it('가득 찬 프레임에서 먼저 빼면 from-ten 전략이다', () => {
    let state = asTen(createInitialState(twoFrames(10, 3)));
    state = asTen(reduce(state, { type: 'take-out', id: counterId(state, 0, 0) }));
    expect(subtractStrategyOf(state)).toBe('from-ten');
  });

  it('가득 차지 않은 프레임에서 먼저 빼면 sequential 전략이다', () => {
    let state = asTen(createInitialState(twoFrames(10, 3)));
    state = asTen(reduce(state, { type: 'take-out', id: counterId(state, 1, 0) }));
    expect(subtractStrategyOf(state)).toBe('sequential');
  });

  it('프레임이 처음 가득 차면 madeTenFirst가 참이 된다', () => {
    let state = asTen(
      createInitialState({ mode: 'ten-frame', frames: 2, left: 9, right: 0, trayCount: 1 }),
    );
    const tray = state.counters.find((counter) => counter.tray >= 0);
    if (!tray) throw new Error('상자 셈돌이 없습니다.');
    state = asTen(reduce(state, { type: 'place', id: tray.id, frame: 0, cell: 9 }));
    expect(frameFillOf(state)).toEqual([10, 0]);
    expect(state.madeTenFirst).toBe(true);
  });

  it('이미 채운 칸에는 놓을 수 없다', () => {
    const trayState = asTen(
      createInitialState({ mode: 'ten-frame', frames: 2, left: 2, right: 0, trayCount: 1 }),
    );
    const tray = trayState.counters.find((counter) => counter.tray >= 0);
    if (!tray) throw new Error('상자 셈돌이 없습니다.');
    expect(reduce(trayState, { type: 'place', id: tray.id, frame: 0, cell: 0 })).toBe(trayState);
  });

  it('removable이 false면 빼기가 무시된다', () => {
    const state = asTen(
      createInitialState({ mode: 'ten-frame', frames: 1, prefill: 3, removable: false }),
    );
    expect(reduce(state, { type: 'take-out', id: counterId(state, 0, 0) })).toBe(state);
  });
});

describe('E02 part-whole', () => {
  it('같은 가르기는 순서를 바꿔도 한 번만 기록한다', () => {
    let state = asPartWhole(createInitialState({ mode: 'part-whole', groups: [4, 2], parts: 2 }));
    state = asPartWhole(reduce(state, { type: 'record-split' }));
    expect(state.recorded).toEqual([[2, 4]]);

    state = asPartWhole(reduce(state, { type: 'set-split', plate: 0, left: 2 }));
    expect(platesOf(state)).toEqual([2, 4]);
    const before = state;
    state = asPartWhole(reduce(state, { type: 'record-split' }));
    expect(state).toBe(before);
    expect(distinctSplitsOf(state)).toBe(1);
  });

  it('칸막이 −/+로 왼쪽 몫을 1개씩 바꾼다', () => {
    let state = asPartWhole(createInitialState({ mode: 'part-whole', groups: [6, 0], parts: 2 }));
    for (const left of [5, 4, 3, 2]) {
      state = asPartWhole(reduce(state, { type: 'set-split', plate: 0, left }));
    }
    expect(platesOf(state)).toEqual([2, 4]);
    state = asPartWhole(reduce(state, { type: 'set-split', plate: 0, left: 3 }));
    expect(platesOf(state)).toEqual([3, 3]);
  });

  it('두 접시를 합치면 한 접시에 모인다', () => {
    let state = asPartWhole(createInitialState({ mode: 'part-whole', groups: [3, 2], parts: 2 }));
    state = asPartWhole(reduce(state, { type: 'merge', from: 1, to: 0 }));
    expect(platesOf(state)).toEqual([5, 0]);
  });

  it('compare에서 다른 접시의 셈돌끼리만 짝지을 수 있다', () => {
    let state = asPartWhole(
      createInitialState({
        mode: 'part-whole',
        scene: { icon: 'dot', kind: 'compare', numbers: [3, 2] },
        parts: 2,
      }),
    );
    const first = state.counters.find((counter) => counter.plate === 0);
    const second = state.counters.find((counter) => counter.plate === 1);
    if (!first || !second) throw new Error('셈돌이 없습니다.');
    state = asPartWhole(reduce(state, { type: 'pair', a: first.id, b: second.id }));
    expect(state.pairs).toHaveLength(1);
    expect(observe(state, { mode: 'part-whole' })['unpaired']).toBe(3);
  });
});

describe('E02 flash', () => {
  it('같은 seed면 같은 수와 같은 배치를 만든다', () => {
    const config: CountersConfig = {
      mode: 'flash',
      range: [1, 10],
      layout: 'random',
      seed: 7,
    };
    expect(createInitialState(config)).toEqual(createInitialState(config));
  });

  it('hide 뒤에도 shown은 유지된다', () => {
    let state = asFlash(createInitialState({ mode: 'flash', count: 6, displayMs: 500 }));
    state = asFlash(reduce(state, { type: 'show' }));
    expect(state.phase).toBe('showing');
    expect(state.shown).toBe(6);
    state = asFlash(reduce(state, { type: 'hide' }));
    expect(state.phase).toBe('hidden');
    expect(state.shown).toBe(6);
    expect(observe(state, { mode: 'flash' })['shown']).toBe(6);
  });

  it('displayMs는 500~3000으로 자른다', () => {
    expect(asFlash(createInitialState({ mode: 'flash', displayMs: 100 })).displayMs).toBe(500);
    expect(asFlash(createInitialState({ mode: 'flash', displayMs: 9000 })).displayMs).toBe(3000);
  });

  it('ready에서는 shown이 null이다', () => {
    const state = asFlash(createInitialState({ mode: 'flash', count: 4 }));
    expect(state.shown).toBeNull();
    expect(observe(state, { mode: 'flash' })['shown']).toBeNull();
  });
});

describe('E02 observe·predicates', () => {
  it('ten-frame Observation에 프레임별 개수와 전략이 담긴다', () => {
    let state = asTen(createInitialState({ mode: 'ten-frame', frames: 2, left: 8, right: 5 }));
    state = asTen(reduce(state, { type: 'swipe-fill', from: 1, to: 0 }));
    const observation = observe(state, { mode: 'ten-frame' });
    expect(observation['frameFill']).toEqual([10, 3]);
    expect(observation['full']).toEqual([true, false]);
    expect(observation['moves']).toBe(1);
    expect(predicates['frameFillIs']?.(observation, { frame: 1, value: 3 })).toBe(true);
    expect(predicates['totalIs']?.(observation, { value: 13 })).toBe(true);
  });

  it('part-whole predicates가 순서 무시·정렬을 지킨다', () => {
    const state = asPartWhole(createInitialState({ mode: 'part-whole', groups: [2, 4], parts: 2 }));
    let next = asPartWhole(reduce(state, { type: 'record-split' }));
    next = asPartWhole(reduce(next, { type: 'set-split', plate: 1, left: 4 }));
    const observation = observe(next, { mode: 'part-whole' });
    expect(predicates['platesAre']?.(observation, { values: [4, 2] })).toBe(true);
    expect(predicates['platesAre']?.(observation, { values: [4, 2], ordered: true })).toBe(false);
    expect(predicates['platesAre']?.(observation, { values: [2, 4], ordered: true })).toBe(true);
    expect(predicates['allPlatesAtLeast']?.(observation, { min: 2 })).toBe(true);
    expect(predicates['distinctSplitsAtLeast']?.(observation, { count: 1 })).toBe(true);
  });
});

describe('E02 이벤트·직렬화', () => {
  it('개수가 바뀌면 value-changed를 낸다', () => {
    const before = asSummon(createInitialState({ mode: 'summon', start: 1 }));
    const after = asSummon(reduce(before, { type: 'summon', count: 2 }));
    expect(emit(before, after, { type: 'summon', count: 2 })).toContainEqual({
      name: 'value-changed',
      payload: { value: 3 },
    });
  });

  it('프레임이 가득 차면 frame-filled를 낸다', () => {
    const before = asTen(
      createInitialState({ mode: 'ten-frame', frames: 1, prefill: 9, trayCount: 1 }),
    );
    const tray = before.counters.find((counter) => counter.tray >= 0);
    if (!tray) throw new Error('상자 셈돌이 없습니다.');
    const after = asTen(reduce(before, { type: 'place', id: tray.id, frame: 0, cell: 9 }));
    expect(emit(before, after, { type: 'place', id: tray.id, frame: 0, cell: 9 })).toContainEqual({
      name: 'frame-filled',
      payload: { frame: 0 },
    });
  });

  it('모든 모드의 상태가 JSON으로 안전하다', () => {
    const configs: CountersConfig[] = [
      { mode: 'summon', start: 3 },
      { mode: 'ten-frame', frames: 2, left: 8, right: 5 },
      {
        mode: 'part-whole',
        groups: [3, 2],
        scene: { icon: 'dot', kind: 'compare', numbers: [3, 2] },
      },
      { mode: 'flash', count: 7, layout: 'random', seed: 3 },
    ];
    for (const config of configs) {
      let state = createInitialState(config);
      assertSerializable(state);
      if (state.mode === 'ten-frame') {
        state = reduce(state, { type: 'swipe-fill', from: 1, to: 0 });
      }
      if (state.mode === 'part-whole') {
        state = reduce(state, { type: 'record-split' });
      }
      if (state.mode === 'flash') {
        state = reduce(state, { type: 'show' });
      }
      assertSerializable(state);
    }
  });
});
