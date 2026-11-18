import { describe, expect, it } from 'vitest';
import { W5_MISCONCEPTIONS } from '../../feedback/misconceptions-w5';
import { diagnoseDetectors } from '../diagnose';
import { diagnoseDetectorsW5 } from '../diagnose-w5';
import type { DiagnoseDetector } from '../diagnose-shared';

function detector(code: string): DiagnoseDetector {
  const found = diagnoseDetectorsW5[code];
  if (!found) throw new Error(`감지 함수가 없습니다: ${code}`);
  return found;
}

function detects(code: string, value: string | null, args?: unknown): boolean {
  return detector(code)({ value, raw: null, args });
}

const FORMULA_CODES = [
  'MC-PATTERN-LAST-ONLY',
  'MC-PATTERN-GROWTH-TOTAL',
  'MC-GRAPH-ICON-VALUE',
  'MC-GRAPH-SCALE-ONE',
  'MC-MEAN-SUM-ONLY',
  'MC-MEAN-MIDDLE-VALUE',
  'MC-RATIO-ORDER',
];
const TRAP_VALUE_CODES = [
  'MC-ORDER-LEFT-TO-RIGHT',
  'MC-ORDER-PAREN-IGNORED',
  'MC-ORDER-MUL-BEFORE-DIV',
  'MC-GRAPH-WAVY-LINE',
  'MC-PERCENT-AS-NUMBER',
  'MC-RATIO-ADDITIVE',
];
const TRAP_CHOICE_CODES = [
  'MC-GRAPH-ICON-COUNT-COMPARE',
  'MC-GRAPH-BAR-WIDTH',
  'MC-GRAPH-HEIGHT-NOT-CHANGE',
  'MC-GRAPH-NO-INTERPOLATE',
  'MC-GRAPH-TRUNCATED-AXIS',
  'MC-GRAPH-AREA-AS-AMOUNT',
  'MC-CHANCE-SMALL-SAMPLE',
  'MC-CHANCE-GAMBLER',
  'MC-RATE-DISTANCE-ONLY',
  'MC-PROPORTION-CROSS-WRONG',
];

describe('W5 감지 함수 등록', () => {
  it('레지스트리는 33개이고 diagnose 23개·observation 10개다', () => {
    expect(W5_MISCONCEPTIONS).toHaveLength(33);
    expect(W5_MISCONCEPTIONS.filter((item) => item.detect === 'diagnose')).toHaveLength(23);
    expect(W5_MISCONCEPTIONS.filter((item) => item.detect === 'observation')).toHaveLength(10);
  });

  it('diagnose 코드만 감지 함수가 있고 observation 코드는 없다', () => {
    expect(FORMULA_CODES.length + TRAP_VALUE_CODES.length + TRAP_CHOICE_CODES.length).toBe(23);
    expect(Object.keys(diagnoseDetectorsW5)).toHaveLength(23);
    for (const item of W5_MISCONCEPTIONS) {
      if (item.detect === 'diagnose') {
        expect(diagnoseDetectorsW5[item.code], item.code).toBeTypeOf('function');
        expect(diagnoseDetectors[item.code], item.code).toBeTypeOf('function');
      } else {
        expect(diagnoseDetectorsW5[item.code], item.code).toBeUndefined();
        expect(diagnoseDetectors[item.code], item.code).toBeUndefined();
      }
    }
  });
});

describe('W5 수 감지(공식)', () => {
  it.each([
    ['MC-PATTERN-LAST-ONLY', 'last', '7', '9'],
    ['MC-PATTERN-GROWTH-TOTAL', 'increment', '2', '8'],
    ['MC-GRAPH-ICON-VALUE', 'icons', '3', '30'],
    ['MC-GRAPH-SCALE-ONE', 'cells', '5', '25'],
  ])('%s: v = %s이고 expected면 제외', (code, key, wrong, correct) => {
    const args = { [key]: wrong, expected: correct };
    expect(detects(code, wrong, args)).toBe(true);
    expect(detects(code, correct, args)).toBe(false);
    expect(detects(code, '1', args)).toBe(false);
    expect(detects(code, wrong, undefined)).toBe(false);
    expect(detects(code, wrong, {})).toBe(false);
    expect(detects(code, wrong, { [key]: '가나다' })).toBe(false);
    expect(detects(code, null, args)).toBe(false);
    expect(detects(code, '가나다', args)).toBe(false);
  });

  it('경계값: 0, 분수 값, 큰 수, 같은 값의 다른 표기', () => {
    expect(detects('MC-PATTERN-LAST-ONLY', '0', { last: '0', expected: '1' })).toBe(true);
    expect(detects('MC-GRAPH-SCALE-ONE', '1/2', { cells: '1/2', expected: '5' })).toBe(true);
    expect(detects('MC-GRAPH-SCALE-ONE', '0.5', { cells: '1/2', expected: '5' })).toBe(true);
    const big = '123456789012345678901234567890';
    expect(detects('MC-GRAPH-ICON-VALUE', big, { icons: big, expected: '1' })).toBe(true);
    // expected가 없으면 정답 제외 조건 없이 v = 값만 본다.
    expect(detects('MC-GRAPH-ICON-VALUE', '3', { icons: '3' })).toBe(true);
  });

  it('MC-MEAN-SUM-ONLY: v = 합, 합 ≠ 평균', () => {
    const args = { values: ['4', '6', '8'], expected: '6' };
    expect(detects('MC-MEAN-SUM-ONLY', '18', args)).toBe(true);
    expect(detects('MC-MEAN-SUM-ONLY', '6', args)).toBe(false);
    expect(detects('MC-MEAN-SUM-ONLY', '17', args)).toBe(false);
    // 자료가 하나면 합 = 평균이므로 감지하지 않는다.
    expect(detects('MC-MEAN-SUM-ONLY', '5', { values: ['5'] })).toBe(false);
    // 모두 0이면 합 = 평균 = 0.
    expect(detects('MC-MEAN-SUM-ONLY', '0', { values: ['0', '0'] })).toBe(false);
    expect(detects('MC-MEAN-SUM-ONLY', '3/2', { values: ['1/2', '1', '0'] })).toBe(true);
    expect(detects('MC-MEAN-SUM-ONLY', '18', { values: [] })).toBe(false);
    expect(detects('MC-MEAN-SUM-ONLY', '18', { values: '4,6,8' })).toBe(false);
    expect(detects('MC-MEAN-SUM-ONLY', '18', { values: ['4', 6, '8'] })).toBe(false);
    expect(detects('MC-MEAN-SUM-ONLY', '18', { values: ['4', '여섯'] })).toBe(false);
    expect(detects('MC-MEAN-SUM-ONLY', '18', undefined)).toBe(false);
  });

  it('MC-MEAN-MIDDLE-VALUE: 홀수 개 중앙값', () => {
    // 평균 (1+2+9)/3 = 4, 중앙값 2
    const args = { values: ['9', '1', '2'] };
    expect(detects('MC-MEAN-MIDDLE-VALUE', '2', args)).toBe(true);
    expect(detects('MC-MEAN-MIDDLE-VALUE', '4', args)).toBe(false);
    expect(detects('MC-MEAN-MIDDLE-VALUE', '3', args)).toBe(false);
  });

  it('MC-MEAN-MIDDLE-VALUE: 짝수 개 중앙값(가운데 두 수의 평균)', () => {
    // 정렬 1, 2, 6, 11 → 평균 5, 중앙값 (2+6)/2 = 4, 중간값 (1+11)/2 = 6
    const args = { values: ['6', '1', '11', '2'], expected: '5' };
    expect(detects('MC-MEAN-MIDDLE-VALUE', '4', args)).toBe(true);
    expect(detects('MC-MEAN-MIDDLE-VALUE', '6', args)).toBe(true);
    expect(detects('MC-MEAN-MIDDLE-VALUE', '5', args)).toBe(false);
  });

  it('MC-MEAN-MIDDLE-VALUE: 최솟값과 최댓값의 중간', () => {
    // 평균 (1+2+9)/3 = 4, 중간값 (1+9)/2 = 5
    expect(detects('MC-MEAN-MIDDLE-VALUE', '5', { values: ['1', '2', '9'] })).toBe(true);
    // 분수 자료: 1/2, 1, 2 → 중앙값 1, 평균 7/6
    expect(detects('MC-MEAN-MIDDLE-VALUE', '1', { values: ['1/2', '1', '2'] })).toBe(true);
  });

  it('MC-MEAN-MIDDLE-VALUE: 평균과 중앙값이 같은 자료면 false', () => {
    // 2, 4, 6 → 평균 = 중앙값 = 중간값 = 4
    expect(detects('MC-MEAN-MIDDLE-VALUE', '4', { values: ['2', '4', '6'] })).toBe(false);
    expect(detects('MC-MEAN-MIDDLE-VALUE', '3', { values: ['3', '3', '3', '3'] })).toBe(false);
    expect(detects('MC-MEAN-MIDDLE-VALUE', '7', { values: ['7'] })).toBe(false);
  });

  it('MC-MEAN-MIDDLE-VALUE: expected·args 없음·읽을 수 없는 값은 false', () => {
    expect(detects('MC-MEAN-MIDDLE-VALUE', '2', { values: ['9', '1', '2'], expected: '2' })).toBe(
      false,
    );
    expect(detects('MC-MEAN-MIDDLE-VALUE', '2', undefined)).toBe(false);
    expect(detects('MC-MEAN-MIDDLE-VALUE', '2', { values: [] })).toBe(false);
    expect(detects('MC-MEAN-MIDDLE-VALUE', null, { values: ['9', '1', '2'] })).toBe(false);
  });

  it('MC-RATIO-ORDER: v = b ÷ a, a = b면 false', () => {
    const args = { a: '3', b: '5', expected: '3/5' };
    expect(detects('MC-RATIO-ORDER', '5/3', args)).toBe(true);
    expect(detects('MC-RATIO-ORDER', '3/5', args)).toBe(false);
    expect(detects('MC-RATIO-ORDER', '0.6', args)).toBe(false);
    expect(detects('MC-RATIO-ORDER', '1', { a: '4', b: '4' })).toBe(false);
    // 0으로 나누게 되는 경우
    expect(detects('MC-RATIO-ORDER', '0', { a: '0', b: '5' })).toBe(false);
    expect(detects('MC-RATIO-ORDER', '0', { a: '5', b: '0' })).toBe(false);
    // 큰 수·분수
    expect(detects('MC-RATIO-ORDER', '1000000', { a: '1', b: '1000000' })).toBe(true);
    expect(detects('MC-RATIO-ORDER', '4/3', { a: '3/2', b: '2' })).toBe(true);
    expect(detects('MC-RATIO-ORDER', '5/3', { a: '3' })).toBe(false);
    expect(detects('MC-RATIO-ORDER', '5/3', undefined)).toBe(false);
  });
});

describe('W5 수 함정(trapValue)', () => {
  it.each(TRAP_VALUE_CODES)('%s: trap과 같으면 true, expected·args 없음이면 false', (code) => {
    expect(detects(code, '12', { trap: '12', expected: '4' })).toBe(true);
    expect(detects(code, '12', { trap: ['3', '12'], expected: '4' })).toBe(true);
    expect(detects(code, '3', { trap: ['3', '12'], expected: '4' })).toBe(true);
    expect(detects(code, '4', { trap: ['3', '12'], expected: '4' })).toBe(false);
    // trap에 정답이 섞여 있어도 expected면 제외한다.
    expect(detects(code, '4', { trap: ['4', '12'], expected: '4' })).toBe(false);
    expect(detects(code, '5', { trap: '12', expected: '4' })).toBe(false);
    expect(detects(code, '12', undefined)).toBe(false);
    expect(detects(code, '12', {})).toBe(false);
    expect(detects(code, '12', { trap: [] })).toBe(false);
    expect(detects(code, '12', { trap: ['12', 3] })).toBe(false);
    expect(detects(code, '12', { trap: '가나다' })).toBe(false);
    expect(detects(code, null, { trap: '12' })).toBe(false);
  });

  it('경계값: 0, 분수 값, 큰 수, 표기가 다른 같은 값', () => {
    expect(detects('MC-ORDER-LEFT-TO-RIGHT', '0', { trap: '0', expected: '10' })).toBe(true);
    expect(detects('MC-PERCENT-AS-NUMBER', '1/4', { trap: '0.25', expected: '5' })).toBe(true);
    expect(detects('MC-RATIO-ADDITIVE', '2 1/2', { trap: '5/2', expected: '10' })).toBe(true);
    const big = '99999999999999999999';
    expect(detects('MC-GRAPH-WAVY-LINE', big, { trap: big, expected: '1' })).toBe(true);
  });
});

describe('W5 고르기 감지(trapChoice)', () => {
  it.each(TRAP_CHOICE_CODES)('%s: trap 선택지면 true', (code) => {
    const args = { trap: ['b', 'c'], expected: 'a' };
    expect(detects(code, 'b', args)).toBe(true);
    expect(detects(code, 'c', args)).toBe(true);
    expect(detects(code, 'a', args)).toBe(false);
    expect(detects(code, 'd', args)).toBe(false);
    expect(detects(code, 'a', { trap: 'a', expected: 'a' })).toBe(false);
    expect(detects(code, 'b', { trap: 'b' })).toBe(true);
    expect(detects(code, 'b', undefined)).toBe(false);
    expect(detects(code, 'b', {})).toBe(false);
    expect(detects(code, 'b', { trap: [] })).toBe(false);
    expect(detects(code, null, args)).toBe(false);
  });
});
