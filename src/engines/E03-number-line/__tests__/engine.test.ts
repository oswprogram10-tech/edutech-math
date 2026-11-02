import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { receive } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce, rowsOf, snapValue, viewSpanOf } from '../reduce';
import { parseValue, pinchLevel, sameValue, visibleTicks, zoomDeltaForPinch } from '../ticks';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';

function make(config: NumberLineConfig = {}): NumberLineState {
  return createInitialState(config);
}

function fraction(overrides: NumberLineConfig = {}): NumberLineState {
  return make({ mode: 'fraction', min: '0', max: '1', subdivisions: 4, ...overrides });
}

function decimal(overrides: NumberLineConfig = {}): NumberLineState {
  return make({ mode: 'decimal', min: '0', max: '1', ...overrides });
}

function visibleValues(state: NumberLineState): string[] {
  const originMin = parseValue(state.min);
  const viewMin = parseValue(state.viewMin);
  const viewMax = parseValue(state.viewMax);
  if (!originMin || !viewMin || !viewMax) return [];
  return rowsOf(state).flatMap((row) =>
    visibleTicks(row, originMin, viewMin, viewMax).map((tick) => tick.value.toJSON()),
  );
}

describe('E03 눈금 스냅', () => {
  it('정수 눈금은 unit 간격이고 범위 밖은 min·max로 자른다', () => {
    const state = make({ mode: 'integer', min: '0', max: '9', unit: '1' });
    expect(snapValue(state, '-5')?.toJSON()).toBe('0');
    expect(snapValue(state, '99')?.toJSON()).toBe('9');
    expect(snapValue(state, '2.6')?.toJSON()).toBe('3');
  });

  it('fraction은 1/subdivisions 간격으로 스냅한다', () => {
    const state = fraction();
    expect(snapValue(state, '0.37')?.toJSON()).toBe('1/4');
    // 1/4과 1/2의 정중앙(3/8)은 큰 쪽 눈금으로 보낸다.
    expect(snapValue(state, '3/8')?.toJSON()).toBe('1/2');
    expect(snapValue(state, '0.99')?.toJSON()).toBe('1');
  });

  it('max가 눈금에 딱 맞지 않아도 마지막 눈금을 넘지 않는다', () => {
    const state = make({ mode: 'fraction', min: '0', max: '1', subdivisions: 3 });
    expect(snapValue(state, '10')?.toJSON()).toBe('1');
  });

  it('줄이 여럿이면 y에 가까운 줄의 눈금을 쓴다', () => {
    const state = make({
      mode: 'fraction',
      min: '0',
      max: '1',
      subdivisions: [3, 5],
    });
    const observed = observe(state);
    expect(observed['rows']).toEqual([
      { subdivisions: 3, tick: '1/3' },
      { subdivisions: 5, tick: '1/5' },
    ]);
    expect(observed['tick']).toBe('1/3');
  });
});

describe('E03 점과 카드', () => {
  it('점을 찍으면 Rational 문자열로 저장하고 오름차순으로 관찰한다', () => {
    let state = fraction();
    state = reduce(state, { type: 'place-point', value: '3/4' });
    state = reduce(state, { type: 'place-point', value: '1/4' });
    const observed = observe(state);
    expect(observed['points']).toEqual([{ value: '1/4' }, { value: '3/4' }]);
    expect(observed['pointPlaced']).toBe(2);
    expect(observed['valueChanged']).toBe(2);
  });

  it('3/4과 0.75는 같은 점으로 기록된다', () => {
    let state = fraction();
    state = reduce(state, { type: 'place-point', value: '3/4' });
    const afterFraction = state;
    state = reduce(state, { type: 'place-point', value: '0.75' });
    expect(afterFraction.points[0]?.value).toBe('3/4');
    expect(state.points[0]?.value).toBe('3/4');
    expect(state.points[1]?.value).toBe('3/4');
    expect(sameValue('3/4', '0.75')).toBe(true);
    expect(observe(state)['hasSamePoint']).toBe(true);
  });

  it('대분수 카드를 자기 자리에 꽂으면 cardsCorrect가 참이 된다', () => {
    let state = make({
      mode: 'fraction',
      min: '0',
      max: '3',
      subdivisions: 4,
      cards: ['1 1/4', '5/4'],
    });
    state = reduce(state, {
      type: 'place-card',
      card: '1 1/4',
      value: '5/4',
    });
    state = reduce(state, {
      type: 'place-card',
      card: '5/4',
      value: '1 1/4',
    });
    const observed = observe(state);
    expect(observed['cards']).toEqual({ '1 1/4': '5/4', '5/4': '5/4' });
    expect(observed['cardsCorrect']).toBe(true);
    expect(observed['samePointGroups']).toEqual([
      { value: '5/4', sources: ['card:1 1/4', 'card:5/4'] },
    ]);
  });

  it('카드를 엉뚱한 자리에 꽂으면 cardsCorrect가 거짓이다', () => {
    let state = make({
      mode: 'fraction',
      min: '0',
      max: '1',
      subdivisions: 4,
      cards: ['3/4'],
    });
    state = reduce(state, { type: 'place-card', card: '3/4', value: '1/2' });
    expect(observe(state)['cardsCorrect']).toBe(false);
  });
});

describe('E03 점프', () => {
  it('점프 크기와 합계를 Rational로 낸다', () => {
    let state = fraction();
    state = reduce(state, { type: 'add-jump', from: '1/4', to: '3/4' });
    state = reduce(state, { type: 'add-jump', from: '0', to: '1/4' });
    const observed = observe(state);
    expect(observed['jumps']).toEqual([
      { from: '1/4', to: '3/4', size: '1/2' },
      { from: '0', to: '1/4', size: '1/4' },
    ]);
    expect(observed['jumpTotal']).toBe('3/4');
  });

  it('같은 곳으로 가는 점프는 만들지 않는다', () => {
    const state = fraction();
    expect(reduce(state, { type: 'add-jump', from: '1/2', to: '2/4' })).toBe(state);
  });
});

describe('E03 처음 보이는 구간', () => {
  it('integer 0~20은 전체 0~20이 보인다', () => {
    const state = make({ mode: 'integer', min: '0', max: '20' });
    expect([state.viewMin, state.viewMax]).toEqual(['0', '20']);
  });

  it('fraction 0~1, 12등분은 전체와 눈금 13개가 보인다', () => {
    const state = make({ mode: 'fraction', min: '0', max: '1', subdivisions: 12 });
    expect([state.viewMin, state.viewMax]).toEqual(['0', '1']);
    const values = visibleValues(state);
    expect(values).toHaveLength(13);
    expect([values[0], values[values.length - 1]]).toEqual(['0', '1']);
    expect(values).toContain('11/12');
  });

  it('fraction 0~3, 4등분은 전체 0~3이 보인다', () => {
    const state = make({ mode: 'fraction', min: '0', max: '3', subdivisions: 4 });
    expect([state.viewMin, state.viewMax]).toEqual(['0', '3']);
  });

  it('decimal 0~3은 확대 전에 전체 0~3이 보인다', () => {
    const state = make({ mode: 'decimal', min: '0', max: '3' });
    expect(state.zoomLevel).toBe(0);
    expect([state.viewMin, state.viewMax]).toEqual(['0', '3']);
  });
});

describe('E03 줌', () => {
  it('zoom.from이 1/10이면 0~1에서는 처음부터 전체가 보인다', () => {
    const state = decimal({ zoom: { from: '1/10', to: '1/100' } });
    expect(state.zoomLevel).toBe(1);
    expect(viewSpanOf(state).toJSON()).toBe('1');
    expect([state.viewMin, state.viewMax]).toEqual(['0', '1']);
  });

  it('decimal은 1 → 1/10 → 1/100 → 1/1000 단계로 간다', () => {
    let state = decimal({ zoom: { from: '1', to: '1/1000' } });
    expect(observe(state)['tick']).toBe('1');
    state = reduce(state, { type: 'zoom', level: 1, center: '0' });
    expect(observe(state)['tick']).toBe('1/10');
    state = reduce(state, { type: 'zoom', level: 2, center: '0' });
    expect(observe(state)['tick']).toBe('1/100');
    state = reduce(state, { type: 'zoom', level: 3, center: '0' });
    expect(observe(state)['tick']).toBe('1/1000');
  });

  it('줌 단계마다 눈금 10칸만큼 보인다', () => {
    const widthOf = (state: NumberLineState): string => viewSpanOf(state).toJSON();
    let state = decimal({ zoom: { from: '1', to: '1/1000' } });
    expect(widthOf(state)).toBe('1');
    state = reduce(state, { type: 'zoom', level: 1, center: '1/2' });
    expect(widthOf(state)).toBe('1');
    state = reduce(state, { type: 'zoom', level: 2, center: '1/2' });
    expect(widthOf(state)).toBe('1/10');
    state = reduce(state, { type: 'zoom', level: 3, center: '1/2' });
    expect(widthOf(state)).toBe('1/100');
    const observed = observe(state);
    expect(observed['viewMin']).toBe(state.viewMin);
    expect(observed['viewMax']).toBe(state.viewMax);
  });

  it('0~1에서 0.1 단계는 전체와 눈금 11개를 보여 준다', () => {
    const state = reduce(decimal({ zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 1,
      center: '1/2',
    });
    expect([state.viewMin, state.viewMax]).toEqual(['0', '1']);
    expect(visibleValues(state)).toEqual([
      '0',
      '1/10',
      '1/5',
      '3/10',
      '2/5',
      '1/2',
      '3/5',
      '7/10',
      '4/5',
      '9/10',
      '1',
    ]);
  });

  it('0~1에서 0.01 단계는 0.75 둘레 0.7~0.8과 눈금 11개를 보여 준다', () => {
    const state = reduce(decimal({ zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 2,
      center: '3/4',
    });
    expect([state.viewMin, state.viewMax]).toEqual(['7/10', '4/5']);
    expect(visibleValues(state)).toEqual([
      '7/10',
      '71/100',
      '18/25',
      '73/100',
      '37/50',
      '3/4',
      '19/25',
      '77/100',
      '39/50',
      '79/100',
      '4/5',
    ]);
  });

  it('0~3에서 0.1 단계는 폭 1과 눈금 11개를 보여 준다', () => {
    const state = reduce(decimal({ min: '0', max: '3', zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 1,
      center: '3/4',
    });
    expect([state.viewMin, state.viewMax]).toEqual(['3/10', '13/10']);
    expect(visibleValues(state)).toEqual([
      '3/10',
      '2/5',
      '1/2',
      '3/5',
      '7/10',
      '4/5',
      '9/10',
      '1',
      '11/10',
      '6/5',
      '13/10',
    ]);
  });

  it('줌은 요청한 중심을 가운데 두고 min·max 밖으로 나가지 않는다', () => {
    const base = decimal({ zoom: { from: '1', to: '1/100' } });
    const middle = reduce(base, { type: 'zoom', level: 2, center: '3/4' });
    expect([middle.viewMin, middle.viewMax]).toEqual(['7/10', '4/5']);

    const low = reduce(base, { type: 'zoom', level: 2, center: '0' });
    expect([low.viewMin, low.viewMax]).toEqual(['0', '1/10']);

    const high = reduce(base, { type: 'zoom', level: 2, center: '1' });
    expect([high.viewMin, high.viewMax]).toEqual(['9/10', '1']);
  });

  it('경계 근처에서 확대하면 창이 범위 안으로 밀려 들어온다', () => {
    const base = decimal({ zoom: { from: '1', to: '1/100' } });
    const nearZero = reduce(base, { type: 'zoom', level: 2, center: '1/100' });
    expect([nearZero.viewMin, nearZero.viewMax]).toEqual(['0', '1/10']);
    expect(visibleValues(nearZero)).toHaveLength(11);

    const nearMax = reduce(base, { type: 'zoom', level: 2, center: '99/100' });
    expect([nearMax.viewMin, nearMax.viewMax]).toEqual(['9/10', '1']);
    expect(visibleValues(nearMax)).toHaveLength(11);

    const wide = decimal({ min: '0', max: '3', zoom: { from: '1', to: '1/100' } });
    const wideLow = reduce(wide, { type: 'zoom', level: 1, center: '1/20' });
    expect([wideLow.viewMin, wideLow.viewMax]).toEqual(['0', '1']);
    expect(visibleValues(wideLow)).toHaveLength(11);

    const wideHigh = reduce(wide, { type: 'zoom', level: 1, center: '59/20' });
    expect([wideHigh.viewMin, wideHigh.viewMax]).toEqual(['2', '3']);
    expect(visibleValues(wideHigh)).toHaveLength(11);
  });

  it('이동은 보기 범위를 min·max 밖으로 내보내지 않는다', () => {
    const base = reduce(decimal({ zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 2,
      center: '0',
    });
    expect([base.viewMin, base.viewMax]).toEqual(['0', '1/10']);

    const right = reduce(base, { type: 'pan', delta: '1/10' });
    expect([right.viewMin, right.viewMax]).toEqual(['1/10', '1/5']);

    const back = reduce(right, { type: 'pan', delta: '-1/10' });
    expect([back.viewMin, back.viewMax]).toEqual(['0', '1/10']);

    // 왼쪽 경계에서는 더 왼쪽으로 가지 않는다(같은 상태를 돌려준다).
    expect(reduce(back, { type: 'pan', delta: '-1' })).toBe(back);

    const atRight = reduce(decimal({ zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 2,
      center: '1',
    });
    expect([atRight.viewMin, atRight.viewMax]).toEqual(['9/10', '1']);
    expect(reduce(atRight, { type: 'pan', delta: '1' })).toBe(atRight);
  });

  it('확대하면 보이는 눈금에만 스냅한다', () => {
    const state = reduce(decimal({ zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 2,
      center: '0',
    });
    expect([state.viewMin, state.viewMax]).toEqual(['0', '1/10']);
    expect(snapValue(state, '0.004')?.toJSON()).toBe('0');
    expect(snapValue(state, '0.007')?.toJSON()).toBe('1/100');
    // 보기 밖 값은 보이는 경계 눈금으로 당긴다.
    expect(snapValue(state, '0.99')?.toJSON()).toBe('1/10');
  });

  it('확대한 뒤 중심이 아닌 0.73 자리에 점을 찍을 수 있다', () => {
    let state = reduce(decimal({ zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 2,
      center: '3/4',
    });
    expect([state.viewMin, state.viewMax]).toEqual(['7/10', '4/5']);
    state = reduce(state, { type: 'place-point', value: '0.73' });
    expect(state.points[0]?.value).toBe('73/100');
  });

  it('이동한 뒤 0.81 자리에 점을 찍을 수 있다', () => {
    let state = reduce(decimal({ zoom: { from: '1', to: '1/100' } }), {
      type: 'zoom',
      level: 2,
      center: '3/4',
    });
    state = reduce(state, { type: 'pan', delta: '1/10' });
    expect([state.viewMin, state.viewMax]).toEqual(['4/5', '9/10']);
    state = reduce(state, { type: 'place-point', value: '0.81' });
    expect(state.points[0]?.value).toBe('81/100');
  });

  it('줌 범위를 넘으면 경계에서 멈춘다', () => {
    const state = decimal({ zoom: { from: '1', to: '1/100' } });
    const high = reduce(state, { type: 'zoom', level: 99, center: '1/2' });
    expect(high.zoomLevel).toBe(2);
    expect(observe(high)['tick']).toBe('1/100');
    const low = reduce(high, { type: 'zoom', level: -99, center: '1/2' });
    expect(low.zoomLevel).toBe(0);
    expect(observe(low)['tick']).toBe('1');
    expect([low.viewMin, low.viewMax]).toEqual(['0', '1']);
  });

  it('핀치 배율을 눈금 단계로 바꾸고 범위를 지킨다', () => {
    expect(zoomDeltaForPinch(1, 1, 0.25)).toBe(0);
    expect(zoomDeltaForPinch(1, 1.1, 0.25)).toBe(0);
    expect(zoomDeltaForPinch(1, 1.5, 0.25)).toBe(2);
    expect(zoomDeltaForPinch(1.5, 1, 0.25)).toBe(-2);
    expect(pinchLevel(0, 1, 1.5, 0, 3, 0.25)).toBe(2);
    expect(pinchLevel(2, 1, 1.5, 0, 3, 0.25)).toBe(3);
    expect(pinchLevel(0, 1, 0.5, 0, 3, 0.25)).toBe(0);
  });
});

describe('E03 연결 점', () => {
  it('value-changed를 받으면 학생 점을 만들지 않고 연결 점만 표시한다', () => {
    const state = fraction();
    const action = receive(state, { name: 'value-changed', payload: { value: '0.75' } });
    expect(action).toEqual({ type: 'set-linked', value: '3/4' });
    const next = reduce(state, action as NumberLineAction);
    expect(next.linkedValue).toBe('3/4');
    expect(next.points).toEqual([]);
    expect(observe(next)['linkedValue']).toBe('3/4');
  });

  it('다른 이벤트와 잘못된 payload는 무시한다', () => {
    const state = fraction();
    expect(receive(state, { name: 'zoomed', payload: { level: 1 } })).toBeNull();
    expect(receive(state, { name: 'value-changed', payload: { value: 'x' } })).toBeNull();
  });
});

describe('E03 직렬화', () => {
  it('모든 Action 뒤 상태가 JSON으로 직렬화된다', () => {
    const actions: NumberLineAction[] = [
      { type: 'place-point', value: '3/4' },
      { type: 'move-point', id: 'p1', value: '1/2' },
      { type: 'select-point', id: 'p1' },
      { type: 'add-jump', from: '0', to: '3/4' },
      { type: 'zoom', level: 1, center: '1/2' },
      { type: 'pan', delta: '1/10' },
      { type: 'pan', delta: '-1/10' },
      { type: 'zoom', level: 0, center: '1/2' },
      { type: 'remove-point', id: 'p1' },
    ];
    let state = decimal();
    assertSerializable(state);
    for (const action of actions) {
      state = reduce(state, action);
      assertSerializable(state);
    }
  });

  it('카드가 있는 상태도 직렬화된다', () => {
    const state = make({
      mode: 'fraction',
      min: '0',
      max: '3',
      subdivisions: [3, 4],
      cards: ['1 1/4', '5/4'],
      laser: true,
      showJumps: true,
    });
    assertSerializable(state);
    assertSerializable(observe(state));
  });
});
