import { describe, expect, it } from 'vitest';
import { Rational } from '../../../core/math';
import { magnifierRange } from '../log';

describe('log-zoom 확대 띠 범위', () => {
  it('234만에서 10만씩 5번 뛰면 234만~334만', () => {
    const range = magnifierRange(Rational.parse('2340000'), Rational.parse('100000'), 5, 8);
    expect(range).not.toBeNull();
    expect(range?.from.equals(Rational.parse('2340000'))).toBe(true);
    expect(range?.to.equals(Rational.parse('3340000'))).toBe(true);
  });

  it('뛴 횟수가 12번이면 10번 대신 12번까지 넓힌다', () => {
    const range = magnifierRange(Rational.parse('2340000'), Rational.parse('100000'), 12, 8);
    expect(range?.to.equals(Rational.parse('3540000'))).toBe(true);
  });

  it('한 번 뛰기 폭이 충분하거나 뛴 점이 없으면 띠를 그리지 않는다', () => {
    expect(magnifierRange(Rational.parse('2340000'), Rational.parse('100000'), 5, 40)).toBeNull();
    expect(magnifierRange(Rational.parse('2340000'), Rational.parse('100000'), 0, 8)).toBeNull();
  });
});
