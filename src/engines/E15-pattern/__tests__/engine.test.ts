/** E15 reduce·observe·events·predicates 단위 테스트. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type {
  ChartState,
  PatternAction,
  PatternConfig,
  PatternState,
  SequenceState,
} from '../types';

function apply(config: PatternConfig, actions: readonly PatternAction[]): PatternState {
  return actions.reduce<PatternState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function seq(state: PatternState): SequenceState {
  if (state.mode !== 'sequence') throw new Error('sequence 상태가 아니다');
  return state;
}

function chart(state: PatternState): ChartState {
  if (state.mode !== 'hundred-chart') throw new Error('hundred-chart 상태가 아니다');
  return state;
}

function fill(tokens: readonly string[]): PatternAction[] {
  return tokens.map((token, slot) => ({ type: 'place', slot, token }));
}

const EXTEND: PatternConfig = {
  mode: 'sequence',
  items: ['circle', 'triangle', 'square'],
  given: ['circle', 'triangle', 'circle', 'triangle', 'circle'],
  blanks: 3,
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

describe('sequence reduce', () => {
  it('place는 빈칸을 채우고 cursor를 다음 칸으로 옮긴다', () => {
    const state = seq(apply(EXTEND, [{ type: 'place', slot: 0, token: 'triangle' }]));
    expect(state.slots).toEqual(['triangle', null, null]);
    expect(state.cursor).toBe(1);
  });

  it('마지막 칸에 놓으면 cursor는 그대로다', () => {
    const state = seq(apply(EXTEND, [{ type: 'place', slot: 2, token: 'circle' }]));
    expect(state.cursor).toBe(2);
  });

  it('범위 밖 slot·팔레트에 없는 토큰은 무시한다(같은 객체)', () => {
    const initial = createInitialState(EXTEND);
    expect(reduce(initial, { type: 'place', slot: 3, token: 'circle' })).toBe(initial);
    expect(reduce(initial, { type: 'place', slot: -1, token: 'circle' })).toBe(initial);
    expect(reduce(initial, { type: 'place', slot: 0, token: 'star' })).toBe(initial);
    expect(reduce(initial, { type: 'place', slot: 0.5, token: 'circle' })).toBe(initial);
  });

  it('move-cursor는 범위 안으로 자른다', () => {
    expect(seq(apply(EXTEND, [{ type: 'move-cursor', slot: 99 }])).cursor).toBe(2);
    expect(seq(apply(EXTEND, [{ type: 'move-cursor', slot: -5 }])).cursor).toBe(0);
  });

  it('clear-slot·clear-all', () => {
    const filled = apply(EXTEND, fill(['circle', 'triangle', 'circle']));
    expect(seq(reduce(filled, { type: 'clear-slot', slot: 1 })).slots).toEqual([
      'circle',
      null,
      'circle',
    ]);
    const cleared = seq(reduce(filled, { type: 'clear-all' }));
    expect(cleared.slots).toEqual([null, null, null]);
    expect(cleared.cursor).toBe(0);
  });

  it('send는 translate에서만 sent를 켜고, 다른 Action은 sent를 되돌린다', () => {
    const translate: PatternConfig = {
      mode: 'sequence',
      variant: 'translate',
      source: ['apple', 'banana'],
      repeat: 2,
      targetAlphabet: ['1', '2'],
    };
    const sent = apply(translate, [...fill(['1', '2', '1', '2']), { type: 'send' }]);
    expect(seq(sent).sent).toBe(true);
    expect(seq(reduce(sent, { type: 'clear-slot', slot: 0 })).sent).toBe(false);
    expect(seq(reduce(sent, { type: 'move-cursor', slot: 0 })).sent).toBe(false);
    // extend에서는 send가 아무 일도 하지 않는다.
    const initial = createInitialState(EXTEND);
    expect(reduce(initial, { type: 'send' })).toBe(initial);
  });

  it('translate는 items·given·blanks를 무시하고 source×repeat 길이다', () => {
    const state = seq(
      createInitialState({
        mode: 'sequence',
        variant: 'translate',
        source: ['apple', 'banana', 'banana'],
        repeat: 2,
        targetAlphabet: ['1', '2'],
        items: ['circle'],
        given: ['star'],
        blanks: 2,
      }),
    );
    expect(state.slots).toHaveLength(6);
    expect(state.settings.given).toEqual([
      'apple',
      'banana',
      'banana',
      'apple',
      'banana',
      'banana',
    ]);
    expect(state.settings.palette).toEqual(['1', '2']);
  });

  it('모르는 키(audio)는 받기만 하고 blanks는 1~16으로 자른다', () => {
    const config = { mode: 'sequence', audio: 'web-audio', blanks: 99 } as unknown as PatternConfig;
    expect(seq(createInitialState(config)).slots).toHaveLength(16);
    const none = { mode: 'sequence', blanks: 0 } as unknown as PatternConfig;
    expect(seq(createInitialState(none)).slots).toHaveLength(1);
  });

  it('내 규칙 만들기(given []·blanks 8)', () => {
    const state = seq(createInitialState({ mode: 'sequence', blanks: 8 }));
    expect(state.settings.given).toEqual([]);
    expect(state.slots).toHaveLength(8);
  });

  it('상태는 직렬화되고 reduce는 입력을 바꾸지 않는다', () => {
    const initial = deepFreeze(createInitialState(EXTEND));
    assertSerializable(initial);
    const next = reduce(initial, { type: 'place', slot: 0, token: 'circle' });
    assertSerializable(next);
    expect(next).not.toBe(initial);
    const after = reduce(deepFreeze(next), { type: 'clear-all' });
    assertSerializable(after);
  });
});

describe('sequence observe·predicates', () => {
  const run = (tokens: readonly string[]) => observe(apply(EXTEND, fill(tokens)));

  it('○△○△○ 뒤 △○△는 continuesGiven', () => {
    const o = run(['triangle', 'circle', 'triangle']);
    expect(o['continuesGiven']).toBe(true);
    expect(o['complete']).toBe(true);
    expect(o['misconceptions']).toEqual([]);
    expect(predicates['continuesGiven']?.(o, undefined)).toBe(true);
  });

  it('○○○이면 LAST-ONLY', () => {
    const o = run(['circle', 'circle', 'circle']);
    expect(o['continuesGiven']).toBe(false);
    expect(o['misconceptions']).toEqual(['MC-PATTERN-LAST-ONLY']);
    expect(predicates['hasMisconception']?.(o, { code: 'MC-PATTERN-LAST-ONLY' })).toBe(true);
    expect(predicates['hasMisconception']?.(o, { code: 'MC-PATTERN-CORE' })).toBe(false);
    expect(predicates['hasMisconception']?.(o, {})).toBe(false);
  });

  it('빈칸이 남으면 complete도 continuesGiven도 아니다', () => {
    const o = run(['triangle']);
    expect(o['filled']).toBe(1);
    expect(o['complete']).toBe(false);
    expect(o['continuesGiven']).toBe(false);
    expect(o['sequence']).toEqual([
      'circle',
      'triangle',
      'circle',
      'triangle',
      'circle',
      'triangle',
      null,
      null,
    ]);
  });

  it('sound-only여도 Observation에는 given이 있다', () => {
    const o = observe(
      createInitialState({ ...EXTEND, givenDisplay: 'sound-only' } as PatternConfig),
    );
    expect(o['given']).toEqual(['circle', 'triangle', 'circle', 'triangle', 'circle']);
  });

  it('blanksAre', () => {
    const o = run(['triangle', 'circle', 'triangle']);
    expect(predicates['blanksAre']?.(o, { tokens: ['triangle', 'circle', 'triangle'] })).toBe(true);
    expect(predicates['blanksAre']?.(o, { tokens: ['triangle', 'circle', 'circle'] })).toBe(false);
    expect(predicates['blanksAre']?.(o, { tokens: ['triangle'] })).toBe(false);
    expect(predicates['blanksAre']?.(o, { tokens: 5 })).toBe(false);
  });

  const FREE: PatternConfig = {
    mode: 'sequence',
    items: ['circle', 'star', 'heart', 'square', 'triangle'],
    blanks: 6,
  };

  it('coreIs·hasRepeat: 내 규칙 만들기', () => {
    const make = (tokens: readonly string[]) => observe(apply(FREE, fill(tokens)));
    const ab = make(['circle', 'star', 'circle', 'star', 'circle', 'star']);
    expect(ab['core']).toEqual(['circle', 'star']);
    expect(predicates['coreIs']?.(ab, { core: ['circle', 'star'] })).toBe(true);
    expect(predicates['coreIs']?.(ab, { core: ['star', 'circle'] })).toBe(false);
    expect(predicates['coreIs']?.(ab, { core: ['star', 'circle'], rotate: true })).toBe(true);
    expect(predicates['hasRepeat']?.(ab, {})).toBe(true);
    expect(predicates['hasRepeat']?.(ab, { minCoreLength: 3 })).toBe(false);

    const same = make(['circle', 'circle', 'circle', 'circle', 'circle', 'circle']);
    expect(predicates['hasRepeat']?.(same, {})).toBe(false);
    expect(predicates['hasRepeat']?.(same, { minCoreLength: 1 })).toBe(true);
    const none = make(['circle', 'star', 'heart', 'square', 'triangle', 'circle']);
    expect(predicates['hasRepeat']?.(none, { minCoreLength: 1 })).toBe(false);
    const partial = observe(apply(FREE, fill(['circle', 'star'])));
    expect(predicates['hasRepeat']?.(partial, {})).toBe(false);
    expect(predicates['coreIs']?.(partial, { core: 7 })).toBe(false);
  });

  const translate: PatternConfig = {
    mode: 'sequence',
    variant: 'translate',
    source: ['apple', 'banana', 'banana'],
    repeat: 2,
    targetAlphabet: ['1', '2', '3'],
  };

  it('translate: 1·2·2·1·2·2는 consistent, 보내기 뒤 되돌린 줄이 같다', () => {
    const state = apply(translate, [...fill(['1', '2', '2', '1', '2', '2']), { type: 'send' }]);
    const o = observe(state);
    expect(o['consistent']).toBe(true);
    expect(o['sent']).toBe(true);
    expect(o['restoredMatches']).toBe(true);
    expect(o['misconceptions']).toEqual([]);
    expect(predicates['translateConsistent']?.(o, undefined)).toBe(true);
    expect(predicates['restoredMatches']?.(o, undefined)).toBe(true);
  });

  it('translate: 1·2·2·1·3·2는 TRANSLATE 오개념이고 consistent가 아니다', () => {
    const o = observe(apply(translate, fill(['1', '2', '2', '1', '3', '2'])));
    expect(o['consistent']).toBe(false);
    expect(o['misconceptions']).toEqual(['MC-PATTERN-TRANSLATE']);
  });

  it('translate: 모두 1이면 되돌린 줄이 원래와 다르다', () => {
    const o = observe(
      apply(translate, [...fill(['1', '1', '1', '1', '1', '1']), { type: 'send' }]),
    );
    expect(o['restoredMatches']).toBe(false);
    expect(o['misconceptions']).toEqual(['MC-PATTERN-TRANSLATE']);
    expect(o['restored']).toEqual(['apple', 'apple', 'apple', 'apple', 'apple', 'apple']);
  });

  it('translate: 빈칸이 남아도 충돌은 감지한다', () => {
    const o = observe(apply(translate, fill(['1', '1'])));
    expect(o['consistent']).toBe(false);
    expect(o['misconceptions']).toEqual(['MC-PATTERN-TRANSLATE']);
  });
});

describe('sequence emit', () => {
  it('place·clear·send·play 이벤트', () => {
    const initial = createInitialState(EXTEND);
    const placed = reduce(initial, { type: 'place', slot: 0, token: 'circle' });
    expect(emit(initial, placed, { type: 'place', slot: 0, token: 'circle' })).toEqual([
      { name: 'token-placed', payload: { slot: 0, token: 'circle' } },
    ]);
    const cleared = reduce(placed, { type: 'clear-slot', slot: 0 });
    expect(emit(placed, cleared, { type: 'clear-slot', slot: 0 })).toEqual([
      { name: 'slot-cleared', payload: { slot: 0 } },
    ]);
    expect(emit(initial, initial, { type: 'play' })).toEqual([
      { name: 'pattern-played', payload: {} },
    ]);
    expect(emit(initial, initial, { type: 'clear-slot', slot: 0 })).toEqual([]);

    const translate: PatternConfig = {
      mode: 'sequence',
      variant: 'translate',
      source: ['apple'],
      repeat: 2,
      targetAlphabet: ['1', '2'],
    };
    const ready = apply(translate, fill(['1', '1']));
    const sent = reduce(ready, { type: 'send' });
    expect(emit(ready, sent, { type: 'send' })).toEqual([
      { name: 'code-sent', payload: { consistent: true } },
    ]);
  });
});

describe('hundred-chart reduce', () => {
  const CROSS: PatternConfig = {
    mode: 'hundred-chart',
    hidden: 'cross',
    center: 46,
    view: 'cross-only',
  };

  it('cross는 center 하나만 가린다', () => {
    const state = chart(createInitialState(CROSS));
    expect(state.hidden).toEqual([46]);
    expect(state.entries).toEqual({});
  });

  it('activate는 가린 칸만, 숫자는 3자리까지', () => {
    const initial = createInitialState(CROSS);
    expect(reduce(initial, { type: 'activate', cell: 45 })).toBe(initial);
    expect(reduce(initial, { type: 'type-digit', digit: '4' })).toBe(initial);
    const typed = chart(
      apply(CROSS, [
        { type: 'activate', cell: 46 },
        { type: 'type-digit', digit: '1' },
        { type: 'type-digit', digit: '2' },
        { type: 'type-digit', digit: '3' },
        { type: 'type-digit', digit: '4' },
        { type: 'type-digit', digit: 'x' },
      ]),
    );
    expect(typed.entries).toEqual({ '46': '123' });
  });

  it('backspace·clear-entry·deactivate', () => {
    const base: PatternAction[] = [
      { type: 'activate', cell: 46 },
      { type: 'type-digit', digit: '4' },
      { type: 'type-digit', digit: '6' },
    ];
    expect(chart(apply(CROSS, [...base, { type: 'backspace' }])).entries).toEqual({ '46': '4' });
    expect(
      chart(apply(CROSS, [...base, { type: 'backspace' }, { type: 'backspace' }])).entries,
    ).toEqual({});
    expect(chart(apply(CROSS, [...base, { type: 'clear-entry' }])).entries).toEqual({});
    expect(chart(apply(CROSS, [...base, { type: 'deactivate' }])).active).toBeNull();
  });

  it('prepainted는 지울 수 없고 가린 칸은 칠할 수 없다', () => {
    const config: PatternConfig = {
      mode: 'hundred-chart',
      paint: true,
      prepainted: [10, 20],
      hidden: [30],
    };
    const state = chart(
      apply(config, [
        { type: 'toggle-paint', cell: 10 },
        { type: 'toggle-paint', cell: 30 },
        { type: 'toggle-paint', cell: 5 },
        { type: 'toggle-paint', cell: 15 },
        { type: 'toggle-paint', cell: 2 },
      ]),
    );
    expect(state.painted).toEqual([2, 5, 10, 15, 20]);
    const off = chart(reduce(state, { type: 'toggle-paint', cell: 5 }));
    expect(off.painted).toEqual([2, 10, 15, 20]);
  });

  it('paint·select가 꺼져 있으면 무시한다', () => {
    const initial = createInitialState({ mode: 'hundred-chart' });
    expect(reduce(initial, { type: 'toggle-paint', cell: 5 })).toBe(initial);
    expect(reduce(initial, { type: 'select-cell', cell: 5 })).toBe(initial);
  });

  it('select-cell은 고르고 같은 칸이면 해제, 그리지 않는 칸은 무시', () => {
    const config: PatternConfig = { mode: 'hundred-chart', select: true };
    const picked = chart(apply(config, [{ type: 'select-cell', cell: 46 }]));
    expect(picked.selected).toBe(46);
    expect(chart(reduce(picked, { type: 'select-cell', cell: 46 })).selected).toBeNull();
    expect(chart(reduce(picked, { type: 'select-cell', cell: 101 })).selected).toBe(46);
    const cross: PatternConfig = {
      mode: 'hundred-chart',
      select: true,
      view: 'cross-only',
      center: 46,
    };
    const outside = createInitialState(cross);
    expect(reduce(outside, { type: 'select-cell', cell: 1 })).toBe(outside);
  });

  it('random hidden은 seed로 되풀이되고 상태에 저장된다', () => {
    const config: PatternConfig = {
      mode: 'hundred-chart',
      hidden: { random: 5, seed: 11 },
    };
    const a = chart(createInitialState(config));
    const b = chart(createInitialState(config));
    expect(a.hidden).toEqual(b.hidden);
    expect(a.hidden).toHaveLength(5);
    for (const cell of a.hidden) {
      expect(a.hidden).not.toContain(cell + 10);
      if (cell % 10 !== 0) expect(a.hidden).not.toContain(cell + 1);
    }
    const noSeed = chart(createInitialState({ mode: 'hundred-chart', hidden: { random: 4 } }));
    expect(noSeed.hidden).toHaveLength(4);
    // 상태에 저장된 hidden은 reduce를 거쳐도 그대로다.
    expect(chart(reduce(noSeed, { type: 'deactivate' })).hidden).toEqual(noSeed.hidden);
  });

  it('상태는 직렬화되고 reduce는 입력을 바꾸지 않는다', () => {
    const initial = deepFreeze(createInitialState({ ...CROSS, paint: true } as PatternConfig));
    assertSerializable(initial);
    const a = reduce(initial, { type: 'activate', cell: 46 });
    const b = reduce(deepFreeze(a), { type: 'type-digit', digit: '4' });
    assertSerializable(b);
    assertSerializable(reduce(deepFreeze(b), { type: 'backspace' }));
  });

  it('다른 모드의 Action은 무시한다', () => {
    const initial = createInitialState(CROSS);
    expect(reduce(initial, { type: 'place', slot: 0, token: 'circle' })).toBe(initial);
    const sequence = createInitialState(EXTEND);
    expect(reduce(sequence, { type: 'activate', cell: 1 })).toBe(sequence);
  });
});

describe('hundred-chart observe·predicates', () => {
  const CROSS: PatternConfig = {
    mode: 'hundred-chart',
    hidden: 'cross',
    center: 46,
    view: 'cross-only',
  };
  const enter = (value: string) =>
    observe(
      apply(CROSS, [
        { type: 'activate', cell: 46 },
        ...[...value].map((digit): PatternAction => ({ type: 'type-digit', digit })),
      ]),
    );

  it('46을 입력하면 entriesCorrect', () => {
    const o = enter('46');
    expect(o['entriesCorrect']).toBe(true);
    expect(o['entriesComplete']).toBe(true);
    expect(o['entries']).toEqual({ '46': 46 });
    expect(predicates['entriesCorrect']?.(o, undefined)).toBe(true);
    expect(predicates['entryIs']?.(o, { cell: 46, value: 46 })).toBe(true);
    expect(predicates['entryIs']?.(o, { cell: 46, value: 47 })).toBe(false);
    expect(predicates['entryIs']?.(o, { cell: '46', value: 46 })).toBe(false);
  });

  it('입력이 없으면 entries가 null이고 correct가 아니다', () => {
    const o = observe(createInitialState(CROSS));
    expect(o['entries']).toEqual({ '46': null });
    expect(o['entriesComplete']).toBe(false);
    expect(o['entriesCorrect']).toBe(false);
  });

  it('가린 칸이 없으면 entriesCorrect가 false(빈 참을 막는다)', () => {
    const o = observe(createInitialState({ mode: 'hundred-chart' }));
    expect(o['entriesCorrect']).toBe(false);
  });

  it('위 칸 수의 +1(37)을 쓰면 MC-CHART-ROW-COL', () => {
    const o = enter('37');
    expect(o['entriesCorrect']).toBe(false);
    expect(o['misconceptions']).toEqual(['MC-CHART-ROW-COL']);
    expect(o['misconceptionCells']).toEqual([46]);
    expect(predicates['hasMisconception']?.(o, { code: 'MC-CHART-ROW-COL' })).toBe(true);
  });

  it('selectedIs·paintedIs·paintedMultiples', () => {
    const config: PatternConfig = { mode: 'hundred-chart', select: true, paint: true };
    const picked = observe(apply(config, [{ type: 'select-cell', cell: 46 }]));
    expect(predicates['selectedIs']?.(picked, { value: 46 })).toBe(true);
    expect(predicates['selectedIs']?.(picked, { value: 47 })).toBe(false);
    const evens = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
    const painted = observe(
      apply(
        config,
        evens.map((cell): PatternAction => ({ type: 'toggle-paint', cell })),
      ),
    );
    expect(predicates['paintedIs']?.(painted, { values: [...evens].reverse() })).toBe(true);
    expect(predicates['paintedIs']?.(painted, { values: [2, 4] })).toBe(false);
    expect(predicates['paintedMultiples']?.(painted, { of: 2, upTo: 30 })).toBe(true);
    expect(predicates['paintedMultiples']?.(painted, { of: 2, upTo: 28 })).toBe(false);
    expect(predicates['paintedMultiples']?.(painted, { of: 3, upTo: 30 })).toBe(false);
    expect(predicates['paintedMultiples']?.(painted, { of: 0, upTo: 30 })).toBe(false);
    const from4 = observe(
      apply(config, [
        { type: 'toggle-paint', cell: 4 },
        { type: 'toggle-paint', cell: 8 },
      ]),
    );
    expect(predicates['paintedMultiples']?.(from4, { of: 4, upTo: 8 })).toBe(true);
    expect(predicates['paintedMultiples']?.(from4, { of: 4, upTo: 8, from: 8 })).toBe(false);
    expect(predicates['paintedIs']?.(from4, { values: 'x' })).toBe(false);
  });

  it('chart emit', () => {
    const initial = createInitialState({ ...CROSS, paint: true, select: true } as PatternConfig);
    const active = reduce(initial, { type: 'activate', cell: 46 });
    const typed = reduce(active, { type: 'type-digit', digit: '4' });
    expect(emit(active, typed, { type: 'type-digit', digit: '4' })).toEqual([
      { name: 'cell-entered', payload: { cell: 46 } },
    ]);
    const painted = reduce(initial, { type: 'toggle-paint', cell: 45 });
    expect(emit(initial, painted, { type: 'toggle-paint', cell: 45 })).toEqual([
      { name: 'cell-painted', payload: { cell: 45, on: true } },
    ]);
    const picked = reduce(initial, { type: 'select-cell', cell: 45 });
    expect(emit(initial, picked, { type: 'select-cell', cell: 45 })).toEqual([
      { name: 'cell-selected', payload: { cell: 45 } },
    ]);
  });
});
