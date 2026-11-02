import { describe, expect, it } from 'vitest';
import { MathError, equivalent, parse } from '..';
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

describe('equivalent', () => {
  it('분수·소수·대분수의 값을 정확히 비교한다', () => {
    expect(equivalent('1/2', '2/4')).toBe(true);
    expect(equivalent('0.5', '1/2')).toBe(true);
    expect(equivalent('1 2/3', '5/3')).toBe(true);
    expect(equivalent('0.1 + 0.2', '0.3')).toBe(true);
  });

  it('값이 다르면 false', () => {
    expect(equivalent('1/3', '0.333')).toBe(false);
    expect(equivalent('1/2', '2/3')).toBe(false);
  });

  it('비의 값으로 비교한다', () => {
    expect(equivalent('2:3', '4:6')).toBe(true);
    expect(equivalent('2:3', '3:2')).toBe(false);
  });

  it('AST를 직접 받는다', () => {
    expect(equivalent(parse('2 × 3'), parse('12 ÷ 2'))).toBe(true);
    expect(equivalent(parse('2 × 3'), '7')).toBe(false);
  });

  it('큰 수도 정확히 비교한다', () => {
    expect(equivalent('99999999999999999999 + 1', '100000000000000000000')).toBe(true);
  });

  it('□가 있으면 NO_BOX, 잘못된 식은 PARSE', () => {
    expect(codeOf(() => equivalent('□ + 1', '3'))).toBe('NO_BOX');
    expect(codeOf(() => equivalent('1 +', '1'))).toBe('PARSE');
  });
});
