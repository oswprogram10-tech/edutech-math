import { describe, expect, it } from 'vitest';
import { MathError, Rational, evaluate, parse, solveForBox } from '..';
import type { MathErrorCode } from '..';

function codeOf(action: () => unknown): MathErrorCode {
  try {
    action();
  } catch (error) {
    if (error instanceof MathError) return error.code;
    throw error;
  }
  throw new Error('MathError가 발생하지 않았습니다.');
}

function evalText(source: string): string {
  return evaluate(parse(source)).toString();
}

function solve(source: string, rhs: string): string {
  return solveForBox(parse(source), Rational.parse(rhs)).toString();
}

describe('evaluate', () => {
  it('사칙연산과 괄호를 정확히 계산한다', () => {
    expect(evalText('1 + 2 × 3')).toBe('7');
    expect(evalText('(1 + 2) × 3')).toBe('9');
    expect(evalText('24 − 6 × 3 + 8 ÷ 2')).toBe('10');
    expect(evalText('1/2 + 1/3')).toBe('5/6');
    expect(evalText('0.1 + 0.2')).toBe('3/10');
  });

  it('뺄셈 결과가 음수여도 정상 값이다', () => {
    expect(evalText('2 - 5')).toBe('-3');
    expect(evalText('1/3 - 1/2')).toBe('-1/6');
  });

  it('큰 수도 정확히 계산한다', () => {
    expect(evalText('99999999999999999999 + 1')).toBe('100000000000000000000');
  });

  it('비를 비율 값으로 계산한다', () => {
    expect(evalText('2:3')).toBe('2/3');
    expect(evalText('4:6')).toBe('2/3');
  });

  it('0으로 나누면 DIV_BY_ZERO', () => {
    expect(codeOf(() => evalText('1 ÷ 0'))).toBe('DIV_BY_ZERO');
    expect(codeOf(() => evalText('1 : 0'))).toBe('DIV_BY_ZERO');
  });
});

describe('solveForBox', () => {
  it('덧셈·뺄셈 일차식을 푼다', () => {
    expect(solve('□ + 2', '5')).toBe('3');
    expect(solve('□ - 7', '2')).toBe('9');
    expect(solve('2 + □', '5')).toBe('3');
  });

  it('곱셈·나눗셈 일차식을 푼다', () => {
    expect(solve('2 × □', '7')).toBe('7/2');
    expect(solve('□ ÷ 2', '3')).toBe('6');
    expect(solve('2 × (□ + 1)', '10')).toBe('4');
    expect(solve('□ ÷ 2 + 1/3', '5/6')).toBe('1');
  });

  it('분수·음수 해도 정확히 푼다', () => {
    expect(solve('3 × □', '2')).toBe('2/3');
    expect(solve('□ + 5', '2')).toBe('-3');
    expect(solve('□ - 1/2', '1/4')).toBe('3/4');
  });

  it('비로 표현된 일차식도 푼다', () => {
    expect(solve('□ : 2', '3/2')).toBe('3');
  });

  it('나누는 수에만 □가 있는 식도 푼다', () => {
    expect(solve('12 ÷ □', '4')).toBe('3');
    expect(solve('12 ÷ (□ + 1)', '3')).toBe('3');
    expect(solve('12 ÷ (□ - 4)', '3')).toBe('8');
    expect(solve('2 ÷ □', '1')).toBe('2');
    expect(solve('2 × (12 ÷ □)', '6')).toBe('4');
    expect(solve('12 ÷ □ + 1', '4')).toBe('4');
    expect(solve('12 ÷ □', '5/2')).toBe('24/5');
  });

  it('나눗셈 결과가 0이면 NO_SOLUTION', () => {
    expect(codeOf(() => solve('12 ÷ □', '0'))).toBe('NO_SOLUTION');
    expect(codeOf(() => solve('12 ÷ (□ + 1)', '0'))).toBe('NO_SOLUTION');
    expect(codeOf(() => solve('0 ÷ □', '0'))).toBe('NO_SOLUTION');
    expect(codeOf(() => solve('0 ÷ □', '1'))).toBe('NO_SOLUTION');
  });

  it('□가 없으면 NO_BOX', () => {
    expect(codeOf(() => solve('2 + 3', '5'))).toBe('NO_BOX');
  });

  it('□가 여러 개면 MULTIPLE_BOX', () => {
    expect(codeOf(() => solve('□ + □', '4'))).toBe('MULTIPLE_BOX');
    expect(codeOf(() => solve('□ - □', '0'))).toBe('MULTIPLE_BOX');
    expect(codeOf(() => solve('12 ÷ (□ + □)', '3'))).toBe('MULTIPLE_BOX');
  });

  it('□끼리 곱하거나 □가 양쪽에 있으면 NONLINEAR', () => {
    expect(codeOf(() => solve('□ × □', '4'))).toBe('NONLINEAR');
    expect(codeOf(() => solve('□ × (□ + 1)', '6'))).toBe('NONLINEAR');
    expect(codeOf(() => solve('□ ÷ □', '2'))).toBe('NONLINEAR');
    expect(codeOf(() => solve('(□ + 1) ÷ (□ - 1)', '2'))).toBe('NONLINEAR');
    expect(codeOf(() => solve('12 ÷ (□ × □)', '3'))).toBe('NONLINEAR');
    expect(codeOf(() => solve('1 : □', '2'))).toBe('NONLINEAR');
  });

  it('0으로 나누면 DIV_BY_ZERO', () => {
    expect(codeOf(() => solve('□ ÷ 0', '1'))).toBe('DIV_BY_ZERO');
  });

  it('해가 없거나 무수히 많으면 구분한다', () => {
    expect(codeOf(() => solve('0 × □', '1'))).toBe('NO_SOLUTION');
    expect(codeOf(() => solve('0 × □', '0'))).toBe('INFINITE_SOLUTIONS');
    expect(codeOf(() => solve('□ × 0 + 1', '2'))).toBe('NO_SOLUTION');
    expect(codeOf(() => solve('□ × 0 + 1', '1'))).toBe('INFINITE_SOLUTIONS');
  });
});
