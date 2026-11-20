import { describe, expect, it } from 'vitest';
import { W6_MISCONCEPTIONS } from '../../feedback/misconceptions-w6';
import { diagnoseDetectors } from '../diagnose';
import { diagnoseDetectorsW6 } from '../diagnose-w6';
import type { DiagnoseDetector } from '../diagnose-shared';

function detects(code: string, value: string | null, args?: unknown): boolean {
  const found: DiagnoseDetector | undefined = diagnoseDetectorsW6[code];
  if (!found) throw new Error(`감지 함수가 없습니다: ${code}`);
  return found({ value, raw: null, args });
}

const TRAP_VALUE_CODES = [
  'MC-MEASURE-ENDPOINT',
  'MC-LENGTH-UNIT-MIX',
  'MC-CLOCK-MINUTE-NUMERAL',
  'MC-TIME-BASE-100',
  'MC-MEAS-UNIT-CONVERT',
  'MC-MEAS-MIXED-UNIT-CALC',
  'MC-ROUND-WRONG-PLACE',
];
const TRAP_CHOICE_CODES = [
  'MC-MEASURE-CURVE',
  'MC-SIZE-IS-WEIGHT',
  'MC-MEASURE-UNIT-SIZE',
  'MC-MEAS-CAPACITY-SHAPE',
  'MC-MEAS-WEIGHT-SIZE',
  'MC-SORT-SUBJECTIVE',
  'MC-ROUND-CONTEXT-BLIND',
];
const OBSERVATION_CODES = [
  'MC-MEASURE-GAP',
  'MC-LENGTH-NO-PROMOTE',
  'MC-SORT-INCONSISTENT',
  'MC-SHAPE-BY-COLOR-SIZE',
  'MC-RANGE-BOUNDARY-INCLUSION',
];

describe('W6 감지 함수 등록', () => {
  it('레지스트리는 19개이고 diagnose 14개·observation 5개다', () => {
    expect(W6_MISCONCEPTIONS).toHaveLength(19);
    expect(W6_MISCONCEPTIONS.filter((item) => item.detect === 'diagnose')).toHaveLength(14);
    const observed = W6_MISCONCEPTIONS.filter((item) => item.detect === 'observation');
    expect(observed.map((item) => item.code).sort()).toEqual([...OBSERVATION_CODES].sort());
  });

  it('diagnose 코드만 감지 함수가 있고 observation 코드는 없다', () => {
    expect(Object.keys(diagnoseDetectorsW6)).toHaveLength(14);
    for (const item of W6_MISCONCEPTIONS) {
      if (item.detect === 'diagnose') {
        expect(diagnoseDetectorsW6[item.code], item.code).toBeTypeOf('function');
        expect(diagnoseDetectors[item.code], item.code).toBeTypeOf('function');
      } else {
        expect(diagnoseDetectorsW6[item.code], item.code).toBeUndefined();
        expect(diagnoseDetectors[item.code], item.code).toBeUndefined();
      }
    }
  });
});

describe('W6 수 함정(trapValue)', () => {
  it.each(TRAP_VALUE_CODES)('%s: trap과 같으면 true, expected·args 없음이면 false', (code) => {
    expect(detects(code, '12', { trap: '12', expected: '4' })).toBe(true);
    expect(detects(code, '12', { trap: ['3', '12'], expected: '4' })).toBe(true);
    expect(detects(code, '3', { trap: ['3', '12'], expected: '4' })).toBe(true);
    expect(detects(code, '4', { trap: ['3', '12'], expected: '4' })).toBe(false);
    expect(detects(code, '4', { trap: ['4', '12'], expected: '4' })).toBe(false);
    expect(detects(code, '5', { trap: '12', expected: '4' })).toBe(false);
    expect(detects(code, '12', undefined)).toBe(false);
    expect(detects(code, '12', {})).toBe(false);
    expect(detects(code, '12', { trap: [] })).toBe(false);
    expect(detects(code, '12', { trap: ['12', 3] })).toBe(false);
    expect(detects(code, '12', { trap: '가나다' })).toBe(false);
    expect(detects(code, null, { trap: '12' })).toBe(false);
  });

  it('경계값: 0, 소수·분수 값, 큰 수, 표기가 다른 같은 값', () => {
    expect(detects('MC-MEASURE-ENDPOINT', '0', { trap: '0', expected: '5' })).toBe(true);
    expect(detects('MC-TIME-BASE-100', '1.5', { trap: '3/2', expected: '90' })).toBe(true);
    expect(detects('MC-LENGTH-UNIT-MIX', '2 1/2', { trap: '5/2', expected: '250' })).toBe(true);
    const big = '99999999999999999999';
    expect(detects('MC-ROUND-WRONG-PLACE', big, { trap: big, expected: '1' })).toBe(true);
  });
});

describe('W6 고르기 감지(trapChoice)', () => {
  it.each(TRAP_CHOICE_CODES)('%s: trap 선택지면 true', (code) => {
    const args = { trap: ['b', 'c'], expected: 'a' };
    expect(detects(code, 'b', args)).toBe(true);
    expect(detects(code, 'c', args)).toBe(true);
    expect(detects(code, 'a', args)).toBe(false);
    expect(detects(code, 'a', { trap: ['a', 'b'], expected: 'a' })).toBe(false);
    expect(detects(code, 'd', args)).toBe(false);
    expect(detects(code, 'b', { trap: 'b' })).toBe(true);
    expect(detects(code, 'b', undefined)).toBe(false);
    expect(detects(code, 'b', {})).toBe(false);
    expect(detects(code, 'b', { trap: [] })).toBe(false);
    expect(detects(code, null, args)).toBe(false);
  });
});
