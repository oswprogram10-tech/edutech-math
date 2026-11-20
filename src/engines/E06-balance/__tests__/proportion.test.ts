import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../../../core/engine-sdk';
import { assertSerializable } from '../../../core/engine-sdk';
import { createState, observeState, reduceState } from '../engine';
import { emit, predicates } from '../events';
import definition from '../index';
import { observeProportion } from '../proportion/observe';
import { additiveValue } from '../proportion/read';
import { createProportionState, reduceProportion } from '../proportion/reduce';
import { cellUnit, platesOf } from '../proportion/layout';
import { readProportion } from '../proportion/read';
import type { ProportionAction, ProportionConfig, ProportionState } from '../proportion/types';

const BASE: ProportionConfig = { mode: 'proportion', equation: '3 : 5 = □ : 20' };

function play(config: ProportionConfig, actions: readonly ProportionAction[]): ProportionState {
  return actions.reduce<ProportionState>(reduceProportion, createProportionState(config));
}

const tryValue = (value: string): ProportionAction => ({ type: 'try', value });
const obs = (state: ProportionState) => observeProportion(state);
const holds = (name: string, state: ProportionState, args?: JsonValue): boolean => {
  const predicate = predicates[name];
  if (!predicate) throw new Error(`predicate ${name} 없음`);
  return predicate(obs(state), args);
};

describe('proportion 설정', () => {
  it('equation·cards가 없으면 샌드박스 기본 3 : 5 = □ : 20', () => {
    const state = createProportionState({ mode: 'proportion' });
    expect(state.error).toBeNull();
    expect(state.terms).toEqual(['3', '5', null, '20']);
    expect(state.boxIndex).toBe(2);
    expect(state.settings.slider).toEqual({ min: 1, max: 20 });
    expect(state.settings.look).toBe('scale');
  });

  it('□ 자리 네 곳과 □ 없는 식을 읽는다', () => {
    expect(
      createProportionState({ mode: 'proportion', equation: '□ : 5 = 12 : 20' }).boxIndex,
    ).toBe(0);
    expect(
      createProportionState({ mode: 'proportion', equation: '3 : □ = 12 : 20' }).boxIndex,
    ).toBe(1);
    expect(createProportionState({ mode: 'proportion', equation: '3 : 5 = 12 : □' }).boxIndex).toBe(
      3,
    );
    const none = createProportionState({ mode: 'proportion', equation: '2 : 3 = 4 : 6' });
    expect(none.error).toBeNull();
    expect(none.boxIndex).toBeNull();
  });

  it('항은 1~30의 정수: 1과 30은 받고 0·31은 거절', () => {
    expect(
      createProportionState({ mode: 'proportion', equation: '1 : 30 = 1 : 30' }).error,
    ).toBeNull();
    for (const equation of ['0 : 5 = 3 : 20', '31 : 5 = 3 : 20', '3 : 5 = 3 : 031']) {
      expect(createProportionState({ mode: 'proportion', equation }).error).not.toBeNull();
    }
  });

  it.each([
    ['소수', { equation: '1.5 : 5 = □ : 20' }],
    ['분수', { equation: '1/2 : 5 = □ : 20' }],
    ['음수', { equation: '-3 : 5 = □ : 20' }],
    ['□ 두 개', { equation: '□ : 5 = □ : 20' }],
    ['항이 셋', { equation: '3 : 5 = 20' }],
    ['항이 다섯', { equation: '3 : 5 : 6 = 4 : 20' }],
    ['= 없음', { equation: '3 : 5 : 4 : 20' }],
    ['글자', { equation: 'a : 5 = 3 : 20' }],
    [
      'equation과 cards 둘 다',
      { equation: '3 : 5 = □ : 20', cards: ['2 : 3 = 4 : 6', '1 : 2 = 2 : 4'] },
    ],
    ['카드 한 장', { cards: ['2 : 3 = 4 : 6'] }],
    ['카드 다섯 장', { cards: Array.from({ length: 5 }, () => '2 : 3 = 4 : 6') }],
    ['카드에 □', { cards: ['2 : 3 = 4 : 6', '2 : □ = 4 : 6'] }],
    ['슬라이더 min>max', { unknownSlider: { min: 10, max: 5 } }],
    ['슬라이더 0', { unknownSlider: { min: 0, max: 5 } }],
    ['슬라이더 너무 큼', { unknownSlider: { min: 1, max: 46 } }],
    ['슬라이더 소수', { unknownSlider: { min: 1, max: 5.5 } }],
  ])('설정 오류: %s', (_name, extra) => {
    const state = createProportionState({ mode: 'proportion', ...extra } as ProportionConfig);
    expect(state.error).not.toBeNull();
    expect(reduceProportion(state, tryValue('3'))).toBe(state);
  });
});

describe('□ 값에 따른 기울기와 오개념 (3 : 5 = □ : 20)', () => {
  it('□를 넣기 전에는 알 수 없다(unknown)', () => {
    const o = obs(createProportionState(BASE));
    expect(o['tilt']).toBe('unknown');
    expect(o['leftArea']).toBe('60');
    expect(o['rightArea']).toBeNull();
    expect(o['balanced']).toBe(false);
    expect(o['isProportion']).toBeNull();
  });

  it('12 → 수평, boxValue 12', () => {
    const o = obs(play(BASE, [tryValue('12')]));
    expect(o['balanced']).toBe(true);
    expect(o['tilt']).toBe('level');
    expect(o['leftArea']).toBe('60');
    expect(o['rightArea']).toBe('60');
    expect(o['boxValue']).toBe('12');
    expect(o['isProportion']).toBe(true);
    expect(o['terms']).toEqual(['3', '5', '12', '20']);
  });

  it('11 → 오른쪽이 가볍다(왼쪽 60 > 오른쪽 55)', () => {
    const o = obs(play(BASE, [tryValue('11')]));
    expect(o['tilt']).toBe('left');
    expect(o['balanced']).toBe(false);
    expect(o['boxValue']).toBeNull();
    expect(o['misconceptions']).toEqual([]);
  });

  it('13 → 오른쪽이 무겁다', () => {
    expect(obs(play(BASE, [tryValue('13')]))['tilt']).toBe('right');
  });

  it('18은 MC-RATIO-ADDITIVE(차 보존)', () => {
    expect(additiveValue(createProportionState(BASE))?.toString()).toBe('18');
    const state = play(BASE, [tryValue('18')]);
    expect(obs(state)['misconceptions']).toEqual(['MC-RATIO-ADDITIVE']);
    expect(holds('hasMisconception', state, { code: 'MC-RATIO-ADDITIVE' })).toBe(true);
    expect(obs(state)['balanced']).toBe(false);
  });

  it('18을 넣어 본 뒤 12로 고쳐도 기록은 남는다(tries 기록)', () => {
    const state = play(BASE, [tryValue('18'), tryValue('12')]);
    expect(obs(state)['balanced']).toBe(true);
    expect(obs(state)['misconceptions']).toEqual(['MC-RATIO-ADDITIVE']);
  });

  it('차 보존 값이 비례식도 되면 기록하지 않는다(2 : 2 = □ : 2의 2)', () => {
    const state = play({ mode: 'proportion', equation: '2 : 2 = □ : 2' }, [tryValue('2')]);
    expect(obs(state)['balanced']).toBe(true);
    expect(obs(state)['misconceptions']).toEqual([]);
  });

  it.each([
    ['□ : 5 = 12 : 20', 0, '12 - (20 - 5)', '-3'],
    ['3 : □ = 12 : 20', 1, '20 - (12 - 3)', '11'],
    ['3 : 5 = □ : 20', 2, '3 + (20 - 5)', '18'],
    ['3 : 5 = 12 : □', 3, '5 + (12 - 3)', '14'],
  ])('차 보존 값: %s (자리 %i, %s)', (equation, index, _formula, expected) => {
    const state = createProportionState({ mode: 'proportion', equation });
    expect(state.boxIndex).toBe(index);
    expect(additiveValue(state)?.toString()).toBe(expected);
  });

  it('□ 자리 b·d에서도 차 보존 값을 넣으면 기록한다', () => {
    const b = play({ mode: 'proportion', equation: '3 : □ = 12 : 20' }, [tryValue('11')]);
    expect(obs(b)['misconceptions']).toEqual(['MC-RATIO-ADDITIVE']);
    const d = play({ mode: 'proportion', equation: '3 : 5 = 12 : □' }, [tryValue('14')]);
    expect(obs(d)['misconceptions']).toEqual(['MC-RATIO-ADDITIVE']);
  });

  it('□ 자리 a: 음수 차 보존 값은 슬라이더 밖이라 기록할 수 없다', () => {
    const state = play({ mode: 'proportion', equation: '□ : 5 = 12 : 20' }, [tryValue('1')]);
    expect(obs(state)['misconceptions']).toEqual([]);
  });
});

describe('슬라이더 경계', () => {
  const sliderConfig: ProportionConfig = {
    mode: 'proportion',
    equation: '3 : 5 = □ : 20',
    unknownSlider: { min: 4, max: 9 },
  };
  it('min·max는 받고 바로 밖은 거절한다', () => {
    const state = createProportionState(sliderConfig);
    expect(reduceProportion(state, tryValue('4')).tryValue).toBe('4');
    expect(reduceProportion(state, tryValue('9')).tryValue).toBe('9');
    expect(reduceProportion(state, tryValue('3'))).toBe(state);
    expect(reduceProportion(state, tryValue('10'))).toBe(state);
  });

  it('정수 문자열이 아니면 거절한다', () => {
    const state = createProportionState(BASE);
    for (const bad of ['', '1.5', '-1', 'abc', '1e1', ' 5']) {
      expect(reduceProportion(state, tryValue(bad))).toBe(state);
    }
    expect(reduceProportion(state, { type: 'try', value: 5 as unknown as string })).toBe(state);
  });

  it('□가 없으면 try는 거절한다', () => {
    const state = createProportionState({ mode: 'proportion', equation: '2 : 3 = 4 : 6' });
    expect(reduceProportion(state, tryValue('3'))).toBe(state);
  });

  it('기본 범위 1~20, 최대 범위 45까지 설정할 수 있다', () => {
    const state = createProportionState({
      mode: 'proportion',
      equation: '30 : 30 = 30 : □',
      unknownSlider: { min: 1, max: 45 },
    });
    expect(state.error).toBeNull();
    expect(reduceProportion(state, tryValue('45')).tryValue).toBe('45');
  });

  it('triesAtMost는 넣어 본 횟수를 센다', () => {
    const state = play(BASE, [tryValue('3'), tryValue('12')]);
    expect(holds('triesAtMost', state, { n: 2 })).toBe(true);
    expect(holds('triesAtMost', state, { n: 1 })).toBe(false);
    expect(holds('boxValueIs', state, { value: '12' })).toBe(true);
    expect(holds('boxValueIs', play(BASE, [tryValue('11')]), { value: '11' })).toBe(false);
    expect(holds('balanced', state)).toBe(true);
  });
});

describe('cards', () => {
  const CARDS: ProportionConfig = {
    mode: 'proportion',
    cards: ['2 : 3 = 4 : 6', '2 : 3 = 3 : 4', '1 : 2 = 3 : 6'],
  };

  it('처음에는 저울이 비어 있다', () => {
    const state = createProportionState(CARDS);
    const o = obs(state);
    expect(state.terms).toEqual([]);
    expect(o['cardIndex']).toBeNull();
    expect(o['tilt']).toBe('unknown');
    expect(o['leftArea']).toBeNull();
    expect(o['isProportion']).toBeNull();
    expect(readProportion(state).placed).toBe(false);
  });

  it('2 : 3 = 4 : 6 → 비례식, 수평', () => {
    const state = play(CARDS, [{ type: 'select-card', index: 0 }]);
    const o = obs(state);
    expect(o['isProportion']).toBe(true);
    expect(o['balanced']).toBe(true);
    expect(o['leftArea']).toBe('12');
    expect(o['rightArea']).toBe('12');
    expect(holds('isProportion', state)).toBe(true);
    expect(holds('cardIs', state, { index: 0 })).toBe(true);
    expect(holds('cardIs', state, { index: 1 })).toBe(false);
  });

  it('2 : 3 = 3 : 4 → 비례식 아님, 기울어짐', () => {
    const state = play(CARDS, [{ type: 'select-card', index: 1 }]);
    const o = obs(state);
    expect(o['isProportion']).toBe(false);
    expect(o['tilt']).toBe('right');
    expect(o['leftArea']).toBe('8');
    expect(o['rightArea']).toBe('9');
    expect(holds('isProportion', state)).toBe(false);
  });

  it('범위 밖·소수 번호·같은 카드는 거절한다', () => {
    const state = createProportionState(CARDS);
    for (const index of [-1, 3, 0.5, Number.NaN]) {
      expect(reduceProportion(state, { type: 'select-card', index })).toBe(state);
    }
    const picked = reduceProportion(state, { type: 'select-card', index: 2 });
    expect(reduceProportion(picked, { type: 'select-card', index: 2 })).toBe(picked);
    // equation 모드는 카드가 없어 거절
    const equation = createProportionState(BASE);
    expect(reduceProportion(equation, { type: 'select-card', index: 0 })).toBe(equation);
  });

  it('reset은 저울을 비우고 같은 상태에서는 같은 객체를 돌려준다', () => {
    const start = createProportionState(CARDS);
    expect(reduceProportion(start, { type: 'reset' })).toBe(start);
    const picked = reduceProportion(start, { type: 'select-card', index: 1 });
    const back = reduceProportion(picked, { type: 'reset' });
    expect(back.terms).toEqual([]);
    expect(back.cardIndex).toBeNull();
  });
});

describe('pairSelect', () => {
  const PAIR: ProportionConfig = {
    mode: 'proportion',
    equation: '3 : 5 = 12 : 20',
    pairSelect: true,
  };
  const pick = (i: number, j: number): ProportionAction => ({ type: 'pick-pair', indices: [i, j] });

  it('짝을 고르기 전에는 저울이 비어 있다', () => {
    const o = obs(createProportionState(PAIR));
    expect(o['pair']).toBeNull();
    expect(o['pairing']).toBeNull();
    expect(o['tilt']).toBe('unknown');
    expect(o['leftArea']).toBeNull();
  });

  it('{0,3}은 외항 짝: pairingCorrect, 수평', () => {
    const state = play(PAIR, [pick(0, 3)]);
    expect(obs(state)['pairing']).toBe('extremes-means');
    expect(obs(state)['leftArea']).toBe('60');
    expect(obs(state)['rightArea']).toBe('60');
    expect(holds('pairingCorrect', state)).toBe(true);
    expect(obs(state)['misconceptions']).toEqual([]);
  });

  it('{1,2}도 맞는 짝(내항 짝)이고 순서를 바꿔도 같다', () => {
    const state = play(PAIR, [pick(2, 1)]);
    expect(holds('pairingCorrect', state)).toBe(true);
    expect(obs(state)['balanced']).toBe(true);
  });

  it('{0,2}는 MC-PROPORTION-CROSS-WRONG, 격자가 달라 기울어진다', () => {
    const state = play(PAIR, [pick(0, 2)]);
    const o = obs(state);
    expect(o['pairing']).toBe('other');
    expect(o['misconceptions']).toEqual(['MC-PROPORTION-CROSS-WRONG']);
    expect(o['leftArea']).toBe('36');
    expect(o['rightArea']).toBe('100');
    expect(o['tilt']).toBe('right');
    expect(holds('pairingCorrect', state)).toBe(false);
    expect(holds('hasMisconception', state, { code: 'MC-PROPORTION-CROSS-WRONG' })).toBe(true);
  });

  it('{0,1}·{2,3}·{1,3}·{0,3}의 짝 판정', () => {
    const results = (
      [
        [0, 1],
        [2, 3],
        [1, 3],
        [0, 3],
      ] as const
    ).map(([i, j]) => obs(play(PAIR, [pick(i, j)]))['pairing']);
    expect(results).toEqual(['other', 'other', 'other', 'extremes-means']);
  });

  it('같은 항·범위 밖 번호·pairSelect가 꺼진 설정은 거절한다', () => {
    const state = createProportionState(PAIR);
    for (const indices of [
      [1, 1],
      [0, 4],
      [-1, 2],
      [0.5, 2],
    ]) {
      expect(
        reduceProportion(state, { type: 'pick-pair', indices } as unknown as ProportionAction),
      ).toBe(state);
    }
    const off = createProportionState({ ...PAIR, pairSelect: false });
    expect(reduceProportion(off, pick(0, 3))).toBe(off);
  });

  it('□가 있는 짝은 □를 넣어 보기 전까지 알 수 없다', () => {
    const config: ProportionConfig = {
      mode: 'proportion',
      equation: '3 : 5 = □ : 20',
      pairSelect: true,
    };
    const picked = play(config, [pick(0, 2)]);
    expect(obs(picked)['tilt']).toBe('unknown');
    expect(obs(picked)['leftArea']).toBeNull();
    expect(obs(picked)['rightArea']).toBe('100');
    const tried = play(config, [pick(0, 2), tryValue('12')]);
    expect(obs(tried)['leftArea']).toBe('36');
    expect(obs(tried)['rightArea']).toBe('100');
  });

  it('카드 모드에서는 카드를 올리기 전에 항을 고를 수 없다', () => {
    const state = createProportionState({
      mode: 'proportion',
      cards: ['2 : 3 = 4 : 6', '2 : 3 = 3 : 4'],
      pairSelect: true,
    });
    expect(reduceProportion(state, pick(0, 3))).toBe(state);
    const withCard = play(
      { mode: 'proportion', cards: ['2 : 3 = 4 : 6', '2 : 3 = 3 : 4'], pairSelect: true },
      [{ type: 'select-card', index: 0 }, pick(0, 3)],
    );
    expect(obs(withCard)['pairing']).toBe('extremes-means');
  });
});

describe('격자 배치', () => {
  it('두 접시는 같은 칸 크기를 쓰고 4~36논리px', () => {
    const state = play(BASE, [tryValue('12')]);
    const plates = platesOf(readProportion(state), 'scale');
    const [left, right] = plates;
    expect(left?.box?.unit).toBe(right?.box?.unit);
    expect(left?.box?.w).toBe(3);
    expect(left?.box?.h).toBe(20);
    expect(right?.box?.w).toBe(5);
    expect(right?.box?.h).toBe(12);
  });

  it('가장 큰 변이 45칸이어도 칸은 4논리px 아래로 줄지 않는다', () => {
    const state = play(
      { mode: 'proportion', equation: '30 : 30 = 30 : □', unknownSlider: { min: 1, max: 45 } },
      [tryValue('45')],
    );
    const unit = cellUnit([readProportion(state).leftDims, readProportion(state).rightDims], {
      width: 260,
      height: 180,
    });
    expect(unit).toBeGreaterThanOrEqual(4);
  });

  it('□를 모르는 쪽은 격자를 만들지 않는다', () => {
    const plates = platesOf(readProportion(createProportionState(BASE)), 'scale');
    expect(plates[0]?.box).not.toBeNull();
    expect(plates[1]?.box).toBeNull();
  });
});

describe('엔진 정의·직렬화', () => {
  it('mode 설정에 따라 상태를 만들고 엔진 정의로 한 판을 돈다', () => {
    const initial = createState(BASE);
    expect(initial.mode).toBe('proportion');
    const next = reduceState(initial, tryValue('12'));
    expect(observeState(next, BASE)['balanced']).toBe(true);
    // 다른 모드의 Action은 무시한다.
    expect(reduceState(next, { type: 'both', op: 'add', n: '3' })).toBe(next);
    expect(createState({ left: [{ num: 1 }], right: [{ num: 1 }] }).mode).toBe('equation');
    const equation = createState({});
    expect(reduceState(equation, { type: 'select-card', index: 0 })).toBe(equation);
  });

  it('상태와 관찰은 JSON 왕복을 해도 같다', () => {
    const state = play({ mode: 'proportion', equation: '3 : 5 = □ : 20', pairSelect: true }, [
      { type: 'pick-pair', indices: [0, 3] },
      tryValue('18'),
      tryValue('12'),
    ]);
    assertSerializable(state);
    assertSerializable(obs(state));
    const restored = JSON.parse(JSON.stringify(state)) as ProportionState;
    expect(restored).toEqual(state);
    expect(obs(restored)).toEqual(obs(state));
  });

  it('emit은 상태가 바뀔 때만 balance-changed를 알린다', () => {
    const prev = createState(BASE);
    const next = reduceState(prev, tryValue('12'));
    expect(emit(prev, prev, tryValue('12'))).toEqual([]);
    const events = emit(prev, next, tryValue('12'));
    expect(events).toEqual([
      { name: 'balance-changed', payload: { balanced: true, tilt: 'level' } },
    ]);
    for (const event of events) expect(definition.events).toContain(event.name);
  });

  it('observe 결과에 정답이 미리 들어 있지 않다', () => {
    const text = JSON.stringify(obs(createProportionState(BASE)));
    expect(text).not.toContain('12');
    expect(text).not.toContain('18');
  });
});
