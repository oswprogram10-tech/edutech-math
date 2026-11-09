import { describe, expect, it } from 'vitest';
import { W3_MISCONCEPTIONS } from '../../feedback/misconceptions-w3';
import { diagnoseDetectorsW3 } from '../diagnose-w3';
import type { DiagnoseDetector } from '../diagnose-shared';

function detector(code: string): DiagnoseDetector {
  const found = diagnoseDetectorsW3[code];
  if (!found) throw new Error(`감지 함수가 없습니다: ${code}`);
  return found;
}

function detects(code: string, value: string | null, args?: unknown): boolean {
  return detector(code)({ value, raw: null, args });
}

describe('W3 감지 함수 등록', () => {
  it('diagnose 코드 19개만 감지 함수가 있다', () => {
    const diagnose = W3_MISCONCEPTIONS.filter((item) => item.detect === 'diagnose');
    expect(diagnose).toHaveLength(19);
    expect(Object.keys(diagnoseDetectorsW3)).toHaveLength(19);
    for (const item of diagnose) {
      expect(diagnoseDetectorsW3[item.code], item.code).toBeTypeOf('function');
    }
    for (const item of W3_MISCONCEPTIONS) {
      if (item.detect === 'observation') {
        expect(diagnoseDetectorsW3[item.code], item.code).toBeUndefined();
      }
    }
  });
});

describe('W3 수 감지', () => {
  it('MC-ANGLE-WRONG-SCALE: 180 − actual, actual = 90은 제외', () => {
    expect(detects('MC-ANGLE-WRONG-SCALE', '140', { actual: '40' })).toBe(true);
    expect(detects('MC-ANGLE-WRONG-SCALE', '40', { actual: '40' })).toBe(false);
    expect(detects('MC-ANGLE-WRONG-SCALE', '90', { actual: '90' })).toBe(false);
    expect(detects('MC-ANGLE-WRONG-SCALE', '140', {})).toBe(false);
    expect(detects('MC-ANGLE-WRONG-SCALE', '140', { actual: '사십' })).toBe(false);
  });

  it('MC-AREA-SLANT-SIDE: base × slant, slant ≠ height', () => {
    const args = { base: '6', height: '4', slant: '5' };
    expect(detects('MC-AREA-SLANT-SIDE', '30', args)).toBe(true);
    expect(detects('MC-AREA-SLANT-SIDE', '24', args)).toBe(false);
    expect(detects('MC-AREA-SLANT-SIDE', '24', { base: '6', height: '4', slant: '4' })).toBe(false);
    expect(detects('MC-AREA-SLANT-SIDE', '30', { base: '6' })).toBe(false);
  });

  it('MC-AREA-TRIANGLE-NO-HALF: ÷2 누락', () => {
    expect(detects('MC-AREA-TRIANGLE-NO-HALF', '24', { base: '6', height: '4' })).toBe(true);
    expect(detects('MC-AREA-TRIANGLE-NO-HALF', '12', { base: '6', height: '4' })).toBe(false);
    expect(detects('MC-AREA-TRIANGLE-NO-HALF', '24', { base: '6' })).toBe(false);
  });

  it('MC-CIRCLE-AREA-AS-CIRCUMFERENCE: 2πr과 πr² 구분', () => {
    const args = { radius: '3', pi: '3.14' };
    expect(detects('MC-CIRCLE-AREA-AS-CIRCUMFERENCE', '18.84', args)).toBe(true);
    expect(detects('MC-CIRCLE-AREA-AS-CIRCUMFERENCE', '28.26', args)).toBe(false);
    expect(detects('MC-CIRCLE-AREA-AS-CIRCUMFERENCE', '18.84', { radius: '3' })).toBe(false);
  });

  it('MC-CIRCLE-AREA-RECT-WIDTH: v = 2 × expected', () => {
    expect(detects('MC-CIRCLE-AREA-RECT-WIDTH', '24', { expected: '12' })).toBe(true);
    expect(detects('MC-CIRCLE-AREA-RECT-WIDTH', '12', { expected: '12' })).toBe(false);
    expect(detects('MC-CIRCLE-AREA-RECT-WIDTH', '24', {})).toBe(false);
  });

  it('MC-CLOCK-HOUR-BETWEEN: 12 → 1, 1~12 밖은 제외', () => {
    expect(detects('MC-CLOCK-HOUR-BETWEEN', '4', { hour: '3' })).toBe(true);
    expect(detects('MC-CLOCK-HOUR-BETWEEN', '3', { hour: '3' })).toBe(false);
    expect(detects('MC-CLOCK-HOUR-BETWEEN', '1', { hour: '12' })).toBe(true);
    expect(detects('MC-CLOCK-HOUR-BETWEEN', '14', { hour: '13' })).toBe(false);
    expect(detects('MC-CLOCK-HOUR-BETWEEN', '4', {})).toBe(false);
  });

  it('MC-GEO-DIAGONAL-COUNT-DOUBLE: expected > 0, v = 2 × expected', () => {
    expect(detects('MC-GEO-DIAGONAL-COUNT-DOUBLE', '10', { expected: '5' })).toBe(true);
    expect(detects('MC-GEO-DIAGONAL-COUNT-DOUBLE', '5', { expected: '5' })).toBe(false);
    expect(detects('MC-GEO-DIAGONAL-COUNT-DOUBLE', '0', { expected: '0' })).toBe(false);
    expect(detects('MC-GEO-DIAGONAL-COUNT-DOUBLE', '10', {})).toBe(false);
  });

  it('MC-GEO-RADIUS-DIAMETER: given이 있는 두 방향과 given이 없는 경우', () => {
    // 지름을 구할 때 반지름(given)을 그대로 답하거나 반으로 나눔
    expect(detects('MC-GEO-RADIUS-DIAMETER', '4', { expected: '8', given: '4' })).toBe(true);
    expect(detects('MC-GEO-RADIUS-DIAMETER', '2', { expected: '8', given: '4' })).toBe(true);
    expect(detects('MC-GEO-RADIUS-DIAMETER', '8', { expected: '8', given: '4' })).toBe(false);
    // 반지름을 구할 때 지름(given)을 그대로 답하거나 두 배로 함
    expect(detects('MC-GEO-RADIUS-DIAMETER', '4', { expected: '2', given: '4' })).toBe(true);
    expect(detects('MC-GEO-RADIUS-DIAMETER', '8', { expected: '2', given: '4' })).toBe(true);
    expect(detects('MC-GEO-RADIUS-DIAMETER', '2', { expected: '2', given: '4' })).toBe(false);
    // given이 없으면 expected ÷ 2 또는 expected × 4
    expect(detects('MC-GEO-RADIUS-DIAMETER', '10', { expected: '20' })).toBe(true);
    expect(detects('MC-GEO-RADIUS-DIAMETER', '80', { expected: '20' })).toBe(true);
    expect(detects('MC-GEO-RADIUS-DIAMETER', '20', { expected: '20' })).toBe(false);
    expect(detects('MC-GEO-RADIUS-DIAMETER', '10', {})).toBe(false);
  });

  it('MC-SHAPE-VERTEX-COUNT: 정수이면서 expected보다 큼', () => {
    expect(detects('MC-SHAPE-VERTEX-COUNT', '5', { expected: '4' })).toBe(true);
    expect(detects('MC-SHAPE-VERTEX-COUNT', '4', { expected: '4' })).toBe(false);
    expect(detects('MC-SHAPE-VERTEX-COUNT', '4.5', { expected: '4' })).toBe(false);
    expect(detects('MC-SHAPE-VERTEX-COUNT', '5', {})).toBe(false);
  });
});

describe('W3 고르기 감지', () => {
  const choices: readonly (readonly [string, string, string])[] = [
    ['MC-SHAPE-ORIENTATION', 'trap-orientation', 'answer-orientation'],
    ['MC-GEO-SQUARE-NOT-RECT', 'trap-no', 'answer-yes'],
    ['MC-GEO-EQUI-NOT-ISO', 'trap-reason-iso', 'answer-reason-equi'],
    ['MC-GEO-PARALLELOGRAM-NOT-TRAPEZOID', 'trap-no', 'answer-yes'],
    ['MC-ANGLE-SUM-SHAPE-DEPENDENT', 'trap-bigger', 'answer-same'],
    ['MC-ANGLE-SIDE-LENGTH', 'trap-longer', 'answer-same'],
    ['MC-PERIMETER-AREA-SAME', 'trap-same', 'answer-varies'],
    ['MC-AREA-UNIT-CONFUSION', 'trap-length-unit', 'answer-area-unit'],
    ['MC-CIRCLE-PI-EXACT', 'trap-pi-three', 'answer-pi-ratio'],
    ['MC-CONG-SIZE-ONLY', 'trap-area-only', 'answer-congruent'],
  ];

  it.each(choices)('%s: trap을 고르면 true, 정답이면 false', (code, trap, expected) => {
    expect(detects(code, trap, { trap, expected })).toBe(true);
    expect(detects(code, expected, { trap, expected })).toBe(false);
  });

  it('expected가 없으면 trap이면 true', () => {
    for (const [code, trap] of choices) {
      expect(detects(code, trap, { trap }), code).toBe(true);
    }
  });

  it('trap이 배열이면 그중 하나를 고를 때 true', () => {
    expect(detects('MC-SHAPE-ORIENTATION', 'b', { trap: ['a', 'b'], expected: 'c' })).toBe(true);
    expect(detects('MC-SHAPE-ORIENTATION', 'c', { trap: ['a', 'b'], expected: 'c' })).toBe(false);
  });

  it('args가 없거나 읽을 수 없으면 false', () => {
    for (const [code, trap] of choices) {
      expect(detects(code, trap, undefined), code).toBe(false);
      expect(detects(code, trap, {}), code).toBe(false);
      expect(detects(code, trap, { trap: 7 }), code).toBe(false);
      expect(detects(code, trap, { trap: [] }), code).toBe(false);
      expect(detects(code, null, { trap }), code).toBe(false);
    }
  });
});
