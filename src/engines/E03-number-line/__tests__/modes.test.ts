/**
 * T048 새 모드(skip-count·rounding·log-zoom·double)의 reduce·Observation·이벤트 테스트.
 * 카드 14번에 적힌 수를 그대로 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { EngineEvent } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import {
  emit,
  hasPair,
  hasPointNear,
  hopCountIs,
  landingIs,
  levelIs,
  roundedTo,
  stepIs,
} from '../events';
import { koreanLabel } from '../log';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';

function make(config: NumberLineConfig): NumberLineState {
  return createInitialState(config);
}

function apply(state: NumberLineState, action: NumberLineAction): NumberLineState {
  return reduce(state, action);
}

function eventNames(events: readonly EngineEvent[]): string[] {
  return events.map((event) => event.name);
}

function payloadOf(events: readonly EngineEvent[], name: string): unknown {
  return events.find((event) => event.name === name)?.payload;
}

describe('T048 skip-count', () => {
  it('5씩 4번 뛰면 landing 20, hopCount 4다', () => {
    let state = make({ mode: 'skip-count', min: 0, max: 30, step: 5 });
    for (let index = 0; index < 4; index += 1) {
      state = apply(state, { type: 'hop', row: 0 });
    }
    const observed = observe(state);
    expect(observed['landing']).toBe('20');
    expect(observed['hopCount']).toBe(4);
    expect(observed['step']).toBe('5');
    expect(observed['skipRows']).toEqual([
      { step: '5', hops: ['5', '10', '15', '20'], hopCount: 4, landing: '20' },
    ]);
    assertSerializable(state);
    assertSerializable(observed);
  });

  it('max를 넘는 hop은 무시한다', () => {
    const state = make({ mode: 'skip-count', min: 0, max: 12, step: 5 });
    const first = apply(state, { type: 'hop', row: 0 });
    const second = apply(first, { type: 'hop', row: 0 });
    const overflow = apply(second, { type: 'hop', row: 0 });
    expect(overflow).toBe(second);
    expect(observe(overflow)['landing']).toBe('10');
  });

  it('choose-step은 그 줄의 hops를 비운다', () => {
    let state = make({ mode: 'skip-count', min: 0, max: 30, step: 5 });
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'choose-step', row: 0, step: '3' });
    expect(state.skip?.rows[0]).toEqual({ step: '3', hops: [] });
    expect(observe(state)['landing']).toBe('0');
  });

  it('steps [4, 6] 두 줄은 서로 독립적으로 뛴다', () => {
    let state = make({ mode: 'skip-count', min: 0, max: 48, steps: [4, 6] });
    expect(state.skip?.rows.map((row) => row.step)).toEqual(['4', '6']);
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'hop', row: 1 });
    expect(observe(state)['skipRows']).toEqual([
      { step: '4', hops: ['4', '8'], hopCount: 2, landing: '8' },
      { step: '6', hops: ['6'], hopCount: 1, landing: '6' },
    ]);
  });

  it('unhop은 마지막 도착만 지운다', () => {
    let state = make({ mode: 'skip-count', min: 0, max: 30, step: 5 });
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'unhop', row: 0 });
    expect(observe(state)['landing']).toBe('5');
  });
});

describe('T048 rounding', () => {
  it('243을 10 자리에서 올림·버림·반올림한다', () => {
    const base = make({ mode: 'rounding', value: 243, place: 10 });
    expect(base.rounding?.items[0]?.value).toBe('243');
    expect(base.unit).toBe('1');
    const up = apply(base, { type: 'round', item: 0, method: 'up' });
    const down = apply(base, { type: 'round', item: 0, method: 'down' });
    const half = apply(base, { type: 'round', item: 0, method: 'half-up' });
    expect(up.rounding?.items[0]).toEqual({ value: '243', marker: '250', method: 'up' });
    expect(down.rounding?.items[0]?.marker).toBe('240');
    expect(half.rounding?.items[0]?.marker).toBe('240');
    expect(observe(up)['rounding']).toEqual([{ value: '243', marker: '250', method: 'up' }]);
    assertSerializable(up);
  });

  it('245는 반올림에서 250으로 간다', () => {
    const state = apply(make({ mode: 'rounding', value: 245, place: 10 }), {
      type: 'round',
      item: 0,
      method: 'half-up',
    });
    expect(state.rounding?.items[0]?.marker).toBe('250');
  });

  it('4537을 100 자리에서 반올림하면 4500이다', () => {
    const state = apply(make({ mode: 'rounding', value: 4537, place: 100 }), {
      type: 'round',
      item: 0,
      method: 'half-up',
    });
    expect(state.rounding?.items[0]?.marker).toBe('4500');
  });

  it('143.6을 1 자리에서 반올림하면 144다', () => {
    const state = apply(make({ mode: 'rounding', value: '143.6', place: 1 }), {
      type: 'round',
      item: 0,
      method: 'half-up',
    });
    expect(state.rounding?.items[0]?.marker).toBe('144');
    expect(state.unit).toBe('1/10');
  });

  it('move-marker는 큰 눈금으로만 스냅한다', () => {
    let state = make({ mode: 'rounding', value: 243, place: 10 });
    state = apply(state, { type: 'move-marker', item: 0, value: '247' });
    expect(state.rounding?.items[0]?.marker).toBe('250');
    state = apply(state, { type: 'move-marker', item: 0, value: '233' });
    expect(state.rounding?.items[0]?.marker).toBe('230');
    // 작은 눈금(1)에는 붙지 않는다.
    state = apply(state, { type: 'move-marker', item: 0, value: '241' });
    expect(state.rounding?.items[0]?.marker).toBe('240');
    expect(state.rounding?.items[0]?.method).toBeNull();
  });

  it('값 목록과 화면 구간을 값마다의 아래·위 큰 눈금으로 잡는다', () => {
    const state = make({ mode: 'rounding', values: [389, 412], place: 100 });
    expect(state.rounding?.items.map((item) => item.value)).toEqual(['389', '412']);
    expect(state.min).toBe('200');
    expect(state.max).toBe('600');
  });
});

describe('T048 log-zoom', () => {
  it('level 0 → 3 → 3(끝에서 무시) → 2로 간다', () => {
    let state = make({ mode: 'log-zoom' });
    expect(observe(state)['level']).toBe(0);
    state = apply(state, { type: 'log-zoom', level: 3 });
    expect(observe(state)['level']).toBe(3);
    expect(observe(state)['levelMax']).toBe('10000');
    const atEnd = apply(state, { type: 'log-zoom', level: 3 });
    expect(atEnd).toBe(state);
    state = apply(state, { type: 'log-zoom', level: 2 });
    expect(observe(state)['level']).toBe(2);
    expect(observe(state)['levelMax']).toBe('1000');
    expect(state.max).toBe('1000');
    expect(state.viewMax).toBe('1000');
  });

  it('16자리 정수 level은 받고 17자리는 기본값으로 떨어진다', () => {
    const accepted = make({ mode: 'log-zoom', levels: ['1000000000000000'] });
    expect(accepted.logZoom?.levels).toEqual(['1000000000000000']);
    expect(accepted.max).toBe('1000000000000000');
    const rejected = make({ mode: 'log-zoom', levels: ['10000000000000000'] });
    expect(rejected.logZoom?.levels).toEqual(['10', '100', '1000', '10000']);
  });

  it('korean 라벨은 만·억 단위로 쓴다', () => {
    expect(koreanLabel(Rational.parse('30000'))).toBe('3만');
    expect(koreanLabel(Rational.parse('200000000'))).toBe('2억');
    expect(koreanLabel(Rational.parse('23400000'))).toBe('2340만');
  });

  it('hasPointNear는 점과 꽂힌 카드 모두를 센다', () => {
    let state = make({ mode: 'log-zoom', cards: [2500] });
    state = apply(state, { type: 'place-point', value: '2500' });
    state = apply(state, { type: 'place-card', card: '2500', value: '2500' });
    const observed = observe(state);
    expect(hasPointNear(observed, { value: '2550', within: '100' })).toBe(true);
    expect(hasPointNear(observed, { value: '2700', within: '100' })).toBe(false);
  });

  it('levelIs는 현재 단계를 본다', () => {
    const state = apply(make({ mode: 'log-zoom' }), { type: 'log-zoom', level: 2 });
    expect(levelIs(observe(state), { level: 2 })).toBe(true);
    expect(levelIs(observe(state), { level: 1 })).toBe(false);
  });
});

describe('T048 double', () => {
  function base(): NumberLineState {
    return make({
      mode: 'double',
      top: { label: '양', max: '3/4' },
      anchors: [['2/3', '1']],
      divisors: [2, 3, 4],
      multipliers: [2, 3],
    });
  }

  it('anchor 2/3↔1에서 ÷2, ×3을 하면 1↔3/2가 된다', () => {
    let state = base();
    expect(observe(state)['pairs']).toEqual([{ top: '2/3', bottom: '1' }]);
    state = apply(state, { type: 'scale-pair', kind: 'divide', factor: 2 });
    expect(observe(state)['pairs']).toEqual([
      { top: '2/3', bottom: '1' },
      { top: '1/3', bottom: '1/2' },
    ]);
    expect(observe(state)['doubleOps']).toEqual(['divide:2']);
    state = apply(state, { type: 'scale-pair', kind: 'multiply', factor: 3 });
    expect(observe(state)['pairs']).toEqual([
      { top: '2/3', bottom: '1' },
      { top: '1/3', bottom: '1/2' },
      { top: '1', bottom: '3/2' },
    ]);
    expect(observe(state)['doubleOps']).toEqual(['divide:2', 'multiply:3']);
    expect(hasPair(observe(state), { top: '1', bottom: '3/2' })).toBe(true);
  });

  it('top이 top.max보다 커지면 화면 구간이 1.1배로 늘어난다', () => {
    let state = base();
    expect(state.max).toBe('33/40');
    state = apply(state, { type: 'scale-pair', kind: 'divide', factor: 2 });
    state = apply(state, { type: 'scale-pair', kind: 'multiply', factor: 3 });
    expect(state.max).toBe('11/10');
    expect(state.viewMax).toBe('11/10');
  });

  it('anchor는 remove-pair로 지우지 않는다', () => {
    const state = base();
    expect(apply(state, { type: 'remove-pair' })).toBe(state);
    let withPair = apply(state, { type: 'scale-pair', kind: 'divide', factor: 2 });
    withPair = apply(withPair, { type: 'remove-pair' });
    expect(withPair.double?.pairs).toHaveLength(1);
    expect(apply(withPair, { type: 'remove-pair' })).toBe(withPair);
  });
});

describe('T048 이벤트', () => {
  it('hop은 hopped와 value-changed를 낸다', () => {
    const before = make({ mode: 'skip-count', min: 0, max: 30, step: 5 });
    const after = apply(before, { type: 'hop', row: 0 });
    const events = emit(before, after, { type: 'hop', row: 0 });
    expect(eventNames(events)).toEqual(['hopped', 'value-changed']);
    expect(payloadOf(events, 'hopped')).toEqual({
      row: 0,
      step: '5',
      count: 1,
      landing: '5',
    });
    expect(payloadOf(events, 'value-changed')).toEqual({ value: '5' });
  });

  it('round는 rounded와 value-changed를 낸다', () => {
    const before = make({ mode: 'rounding', value: 243, place: 10 });
    const after = apply(before, { type: 'round', item: 0, method: 'up' });
    const events = emit(before, after, { type: 'round', item: 0, method: 'up' });
    expect(eventNames(events)).toEqual(['rounded', 'value-changed']);
    expect(payloadOf(events, 'rounded')).toEqual({
      item: 0,
      value: '243',
      result: '250',
      method: 'up',
    });
  });

  it('log-zoom의 zoomed tick은 큰 눈금 간격이다', () => {
    const before = make({ mode: 'log-zoom' });
    const after = apply(before, { type: 'log-zoom', level: 3 });
    const events = emit(before, after, { type: 'log-zoom', level: 3 });
    expect(payloadOf(events, 'zoomed')).toEqual({ level: 3, tick: '1000' });
  });

  it('scale-pair는 pair-added만 내고 새 값은 value-changed로 흘리지 않는다', () => {
    const before = make({
      mode: 'double',
      anchors: [['2/3', '1']],
      top: { max: '3/4' },
    });
    const after = apply(before, { type: 'scale-pair', kind: 'divide', factor: 2 });
    const events = emit(before, after, { type: 'scale-pair', kind: 'divide', factor: 2 });
    expect(eventNames(events)).toEqual(['pair-added']);
    expect(payloadOf(events, 'pair-added')).toEqual({ top: '1/3', bottom: '1/2' });
  });
});

describe('T048 predicates', () => {
  it('landingIs·hopCountIs·stepIs는 row를 고를 수 있다', () => {
    let state = make({ mode: 'skip-count', min: 0, max: 48, steps: [4, 6] });
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'hop', row: 0 });
    state = apply(state, { type: 'hop', row: 1 });
    const observed = observe(state);
    expect(landingIs(observed, { value: '8', row: 0 })).toBe(true);
    expect(landingIs(observed, { value: '6', row: 1 })).toBe(true);
    expect(landingIs(observed, { value: '6', row: 0 })).toBe(false);
    expect(hopCountIs(observed, { count: 2, row: 0 })).toBe(true);
    expect(stepIs(observed, { value: '6', row: 1 })).toBe(true);
  });

  it('roundedTo는 값·결과·방법을 함께 본다', () => {
    const state = apply(make({ mode: 'rounding', value: 243, place: 10 }), {
      type: 'round',
      item: 0,
      method: 'up',
    });
    const observed = observe(state);
    expect(roundedTo(observed, { value: '243', result: '250', method: 'up' })).toBe(true);
    expect(roundedTo(observed, { value: '243', result: '240', method: 'up' })).toBe(false);
  });
});

describe('T048 직렬화', () => {
  it('새 모드의 모든 Action 뒤 상태가 JSON으로 직렬화된다', () => {
    const scenarios: { config: NumberLineConfig; actions: NumberLineAction[] }[] = [
      {
        config: { mode: 'skip-count', min: 0, max: 48, steps: [4, 6] },
        actions: [
          { type: 'choose-step', row: 0, step: '3' },
          { type: 'hop', row: 0 },
          { type: 'hop', row: 1 },
          { type: 'unhop', row: 0 },
          { type: 'clear-hops', row: 1 },
          { type: 'place-point', value: '12' },
        ],
      },
      {
        config: { mode: 'rounding', values: [389, 412], place: 100 },
        actions: [
          { type: 'round', item: 0, method: 'up' },
          { type: 'select-item', item: 1 },
          { type: 'round', item: 1, method: 'half-up' },
          { type: 'move-marker', item: 1, value: '450' },
          { type: 'clear-marker', item: 1 },
        ],
      },
      {
        config: { mode: 'log-zoom', cards: [2500], start: 100, step: 100 },
        actions: [
          { type: 'log-zoom', level: 3 },
          { type: 'hop', row: 0 },
          { type: 'place-point', value: '2500' },
          { type: 'place-card', card: '2500', value: '2500' },
          { type: 'log-zoom', level: 1 },
        ],
      },
      {
        config: {
          mode: 'double',
          anchors: [['2/3', '1']],
          top: { max: '3/4' },
        },
        actions: [
          { type: 'scale-pair', kind: 'divide', factor: 2 },
          { type: 'scale-pair', kind: 'multiply', factor: 3 },
          { type: 'select-pair', index: 0 },
          { type: 'remove-pair' },
        ],
      },
    ];
    for (const scenario of scenarios) {
      let state = make(scenario.config);
      assertSerializable(state);
      assertSerializable(observe(state));
      for (const action of scenario.actions) {
        state = apply(state, action);
        assertSerializable(state);
        assertSerializable(observe(state));
      }
    }
  });
});
