/** E13 length `roll-circle` 테스트: 측정 원주·비 값, 설정 오류, 거절, choose, JSON 왕복, predicates. */
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../core/math';
import { assertSerializable } from '../../../core/engine-sdk';
import { boardHeight } from '../length/roll-circle/layout';
import { rollPredicates } from '../length/roll-circle/events';
import { observeRoll } from '../length/roll-circle/observe';
import {
  formatFixed,
  measuredCircumference,
  PI_APPROX,
  ratioOf,
  roundToDigits,
} from '../length/roll-circle/pi';
import { createRollState, reduceRoll, rejectReason } from '../length/roll-circle/reduce';
import type { RollAction, RollConfig, RollState } from '../length/roll-circle/types';
import {
  createInitialState,
  emit,
  isPlainLength,
  isRoll,
  isTrain,
  observe,
  reduce,
} from '../modes';
import type { E13State } from '../modes';

const base: RollConfig = {
  mode: 'length',
  variant: 'roll-circle',
  diameters: ['2', '3', '5', '8', '10'],
  unit: 'cm',
};

function make(extra: Partial<RollConfig> = {}): RollState {
  return createRollState({ ...base, ...extra });
}
function play(state: RollState, ...actions: RollAction[]): RollState {
  return actions.reduce(reduceRoll, state);
}
const choose = (d: string): RollAction => ({ type: 'choose', d });
const roll: RollAction = { type: 'roll' };
const record: RollAction = { type: 'record' };
const plus: RollAction = { type: 'stick', delta: 1 };
const minus: RollAction = { type: 'stick', delta: -1 };
const reset: RollAction = { type: 'reset' };

describe('측정 원주·비 (부동소수 없음)', () => {
  it('원주율 근삿값은 Rational 상수다', () => {
    expect(PI_APPROX).toBeInstanceOf(Rational);
    expect(PI_APPROX.equals(Rational.parse('3.14159265358979'))).toBe(true);
  });

  it.each([
    ['2', '6.3'],
    ['3', '9.4'],
    ['5', '15.7'],
    ['8', '25.1'],
    ['10', '31.4'],
    ['1', '3.1'],
    ['7', '22.0'],
  ])('지름 %s → 측정 원주 %s(0.1cm 반올림)', (d, expected) => {
    expect(formatFixed(measuredCircumference(Rational.parse(d)), 1)).toBe(expected);
  });

  it.each([
    ['2', '6.3', '3.15', '3.150'],
    ['3', '9.4', '3.13', '3.133'],
    ['5', '15.7', '3.14', '3.140'],
    ['8', '25.1', '3.14', '3.138'],
    ['10', '31.4', '3.14', '3.140'],
  ])('지름 %s·원주 %s → 비 0.01 %s, 0.001 %s', (d, c, two, three) => {
    const diameter = Rational.parse(d);
    const circumference = Rational.parse(c);
    expect(formatFixed(ratioOf(circumference, diameter, 2), 2)).toBe(two);
    expect(formatFixed(ratioOf(circumference, diameter, 3), 3)).toBe(three);
  });

  it('반올림은 0.5를 올린다(경계값)', () => {
    expect(roundToDigits(Rational.parse('0.25'), 1).toString()).toBe('3/10');
    expect(roundToDigits(Rational.parse('0.24'), 1).toString()).toBe('1/5');
    expect(roundToDigits(Rational.of(0), 2).isZero()).toBe(true);
    expect(formatFixed(Rational.of(0), 1)).toBe('0.0');
  });

  it('reduce가 정한 값이 기록표 문자열과 같다(precision 기본 0.01, 0.001)', () => {
    const two = play(make(), choose('2'), roll, record);
    expect(two.log).toEqual([{ d: '2', c: '6.3', ratio: '3.15' }]);
    const fine = play(make({ precision: '0.001' }), choose('8'), roll, record);
    expect(fine.log).toEqual([{ d: '8', c: '25.1', ratio: '3.138' }]);
  });
});

describe('설정', () => {
  it('샌드박스 기본(mode·variant뿐): 지름 2·3·5·8·10, 도구 둘 다 켬', () => {
    const state = createRollState({ mode: 'length', variant: 'roll-circle' });
    expect(state.error).toBeNull();
    expect(state.diameters).toEqual(['2', '3', '5', '8', '10']);
    expect(state.precision).toBe('0.01');
    expect(state.diameterStickTool).toBe(true);
    expect(state.logEnabled).toBe(true);
    expect(state.diameter).toBe('2');
  });

  it('지름 1~10 정수 1~6개는 받는다(경계)', () => {
    expect(make({ diameters: ['1'] }).error).toBeNull();
    expect(make({ diameters: ['10'] }).error).toBeNull();
    expect(make({ diameters: ['1', '2', '3', '4', '5', '6'] }).error).toBeNull();
  });

  it.each([
    ['11', ['11']],
    ['0', ['0']],
    ['소수', ['2.5']],
    ['중복', ['2', '2']],
    ['7개', ['1', '2', '3', '4', '5', '6', '7']],
    ['빈 목록', []],
    ['숫자 형식', [2] as unknown as string[]],
    ['앞자리 0', ['02']],
  ])('설정 오류: %s', (_name, diameters) => {
    const state = make({ diameters });
    expect(state.error).not.toBeNull();
    expect(observeRoll(state)).toMatchObject({ error: true, misconceptions: [] });
    expect(reduceRoll(state, roll)).toBe(state);
  });

  it('precision·unit·도구 값이 잘못되면 설정 오류', () => {
    expect(make({ precision: '0.1' as '0.01' }).error).not.toBeNull();
    expect(make({ unit: 'm' as 'cm' }).error).not.toBeNull();
    expect(make({ log: 'yes' as unknown as boolean }).error).not.toBeNull();
    expect(make({ diameterStickTool: 1 as unknown as boolean }).error).not.toBeNull();
  });

  it('diameters 없이 다른 키가 있으면 설정 오류', () => {
    expect(createRollState({ variant: 'roll-circle', precision: '0.01' }).error).not.toBeNull();
  });
});

describe('Action과 거절', () => {
  it('굴리면 측정 원주가 생기고, 굴리기 전에는 null이다', () => {
    const start = make();
    expect(start.rolled).toBe(false);
    expect(start.measuredCm).toBeNull();
    const rolled = play(start, roll);
    expect(rolled.rolled).toBe(true);
    expect(rolled.measuredCm).toBe('6.3');
  });

  it('굴리기 전 막대·기록은 거절한다', () => {
    const start = make();
    expect(reduceRoll(start, plus)).toBe(start);
    expect(reduceRoll(start, record)).toBe(start);
    expect(rejectReason(start, plus)).toBe('not-rolled');
    expect(rejectReason(start, record)).toBe('not-rolled');
  });

  it('굴린 뒤 다시 굴리기는 거절한다', () => {
    const rolled = play(make(), roll);
    expect(reduceRoll(rolled, roll)).toBe(rolled);
    expect(rejectReason(rolled, roll)).toBe('already-rolled');
  });

  it('같은 지름은 한 번만 기록한다', () => {
    const once = play(make(), roll, record);
    expect(reduceRoll(once, record)).toBe(once);
    expect(rejectReason(once, record)).toBe('logged');
    expect(once.log).toHaveLength(1);
  });

  it('막대는 0 아래·4 위로 못 간다', () => {
    const rolled = play(make(), roll);
    expect(reduceRoll(rolled, minus)).toBe(rolled);
    const four = play(rolled, plus, plus, plus, plus);
    expect(four.sticks).toBe(4);
    expect(reduceRoll(four, plus)).toBe(four);
    expect(play(four, minus).sticks).toBe(3);
  });

  it('도구가 꺼져 있으면 막대·기록을 거절한다', () => {
    const noStick = play(make({ diameterStickTool: false }), roll);
    expect(reduceRoll(noStick, plus)).toBe(noStick);
    const noLog = play(make({ log: false }), roll);
    expect(reduceRoll(noLog, record)).toBe(noLog);
  });

  it('choose는 굴리기·막대를 처음으로 되돌리고 기록표는 남긴다', () => {
    const state = play(make(), roll, plus, plus, record, choose('5'));
    expect(state.diameter).toBe('5');
    expect(state.rolled).toBe(false);
    expect(state.measuredCm).toBeNull();
    expect(state.sticks).toBe(0);
    expect(state.log).toHaveLength(1);
    // 굴리기 전 같은 지름 고르기·목록에 없는 지름은 거절
    expect(reduceRoll(state, choose('5'))).toBe(state);
    expect(reduceRoll(state, choose('7'))).toBe(state);
    // 굴린 뒤 같은 지름을 고르면 처음으로 돌아간다
    const again = play(state, roll, choose('5'));
    expect(again.rolled).toBe(false);
  });

  it('reset은 굴리기·막대만 되돌리고 기록표와 지름은 남긴다', () => {
    const state = play(make(), choose('3'), roll, plus, record, reset);
    expect(state.diameter).toBe('3');
    expect(state.rolled).toBe(false);
    expect(state.sticks).toBe(0);
    expect(state.log).toHaveLength(1);
    expect(reduceRoll(state, reset)).toBe(state);
  });

  it('기록표는 모든 지름(6개)을 채울 수 있다', () => {
    let state = make({ diameters: ['1', '2', '3', '4', '5', '6'] });
    for (const d of ['1', '2', '3', '4', '5', '6']) state = play(state, choose(d), roll, record);
    expect(state.log).toHaveLength(6);
  });

  it('JSON 직렬화가 되고 왕복해도 같다', () => {
    const state = play(make(), roll, plus, record);
    assertSerializable(state);
    assertSerializable(observeRoll(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('Observation과 predicates', () => {
  it('시작: 굴리기 전이라 원주가 없다', () => {
    const o = observeRoll(make());
    expect(o).toMatchObject({
      mode: 'length',
      variant: 'roll-circle',
      diameter: '2',
      rolled: false,
      measuredCm: null,
      sticks: 0,
      sticksFit: 0,
      log: [],
      logCount: 0,
      misconceptions: [],
    });
  });

  it('sticksFit = min(sticks, 3)', () => {
    const rolled = play(make(), roll);
    expect(observeRoll(play(rolled, plus, plus)).sticksFit).toBe(2);
    expect(observeRoll(play(rolled, plus, plus, plus, plus))).toMatchObject({
      sticks: 4,
      sticksFit: 3,
    });
  });

  it('predicates: rolled·logCountAtLeast·logged·sticksAtLeast', () => {
    const rolledState = play(make(), choose('3'), roll, plus, plus, record);
    const o = observeRoll(rolledState);
    expect(rollPredicates['rolled']?.(observeRoll(make()), {})).toBe(false);
    expect(rollPredicates['rolled']?.(o, {})).toBe(true);
    expect(rollPredicates['logCountAtLeast']?.(o, { n: 1 })).toBe(true);
    expect(rollPredicates['logCountAtLeast']?.(o, { n: 2 })).toBe(false);
    expect(rollPredicates['logged']?.(o, { d: '3' })).toBe(true);
    expect(rollPredicates['logged']?.(o, { d: 3 })).toBe(true);
    expect(rollPredicates['logged']?.(o, { d: '5' })).toBe(false);
    expect(rollPredicates['sticksAtLeast']?.(o, { n: 2 })).toBe(true);
    expect(rollPredicates['sticksAtLeast']?.(o, { n: 3 })).toBe(false);
    expect(rollPredicates['sticksAtLeast']?.(o, {})).toBe(false);
  });
});

describe('모드 나누기', () => {
  it('variant roll-circle은 roll 상태, 없으면 기본 length, unit-train은 그대로', () => {
    const rollState = createInitialState({ mode: 'length', variant: 'roll-circle' });
    expect(isRoll(rollState)).toBe(true);
    expect(isTrain(rollState)).toBe(false);
    expect(isPlainLength(rollState)).toBe(false);
    const plain = createInitialState({ mode: 'length' });
    expect(isPlainLength(plain)).toBe(true);
    expect(isRoll(plain)).toBe(false);
    const train = createInitialState({
      mode: 'length',
      variant: 'unit-train',
      op: 'add',
      a: '1m',
      b: '1m',
    });
    expect(isTrain(train)).toBe(true);
    expect(isRoll(train)).toBe(false);
  });

  it('알 수 없는 variant는 기존처럼 설정 오류', () => {
    const state = createInitialState({
      mode: 'length',
      variant: 'nope',
      op: 'add',
    } as never) as E13State;
    expect((state as { error: string | null }).error).not.toBeNull();
  });

  it('reduce·observe·emit이 roll을 나눠 처리한다', () => {
    const a = createInitialState({ mode: 'length', variant: 'roll-circle' });
    const b = reduce(a, roll);
    expect(observe(b)).toMatchObject({ variant: 'roll-circle', rolled: true });
    expect(emit(a, a)).toEqual([]);
    expect(emit(a, b)).toEqual([{ name: 'measure-changed', payload: { moved: true } }]);
  });
});

describe('논리 높이(T223)', () => {
  const six = ['1', '2', '3', '4', '5', '6'];
  it('최대 설정도 600 이하이고, 작은 지름만 있으면 더 낮다', () => {
    const full = {
      diameters: ['1', '2', '3', '5', '8', '10'],
      diameterStickTool: true,
      logEnabled: true,
    };
    expect(boardHeight(full)).toBeLessThanOrEqual(600);
    const small = { diameters: ['2'], diameterStickTool: true, logEnabled: true };
    expect(boardHeight(small)).toBeLessThan(boardHeight(full));
  });

  it('도구·기록표가 없으면 그만큼 낮아진다', () => {
    const all = { diameters: six, diameterStickTool: true, logEnabled: true };
    expect(boardHeight({ ...all, logEnabled: false })).toBeLessThan(boardHeight(all));
    expect(boardHeight({ ...all, logEnabled: false, diameterStickTool: false })).toBeLessThan(
      boardHeight({ ...all, logEnabled: false }),
    );
  });

  it('높이는 처음·굴린 뒤·기록 뒤에 늘 같다(설정만으로 정한다)', () => {
    const s = make();
    const after = play(s, roll, plus, record);
    expect(boardHeight(after)).toBe(boardHeight(s));
  });
});
