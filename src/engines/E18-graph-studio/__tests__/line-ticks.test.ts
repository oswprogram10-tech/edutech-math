/** T165: E18 line-graph 눈금 건너뛰기(skip × yStep이 1·2·5 × 10ⁿ 꼴). */
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../core/math';
import { isNiceStep, lineTickCells, tickSkip } from '../line';

const r = (text: string) => Rational.parse(text);

describe('isNiceStep', () => {
  it('1·2·5 × 10ⁿ만 true', () => {
    for (const ok of ['0.1', '0.2', '0.5', '1', '2', '5', '10', '20', '50', '100', '1/2', '1/5']) {
      expect(isNiceStep(r(ok)), ok).toBe(true);
    }
    for (const bad of ['0', '0.3', '3', '4', '2.5', '4.2', '6', '15', '25', '1/3']) {
      expect(isNiceStep(r(bad)), bad).toBe(false);
    }
  });
});

describe('tickSkip', () => {
  it('yStep 0.2: 12칸이 겹치면 5 단위(25칸)', () => {
    const skip = tickSkip(r('0.2'), 12);
    expect(skip).toBe(25);
    expect(r('0.2').mul(Rational.of(skip)).equals(r('5'))).toBe(true);
  });

  it('yStep 0.2: 최소 칸이 작으면 0.2·0.5·1·2 단위', () => {
    expect(tickSkip(r('0.2'), 1)).toBe(1); // 0.2
    expect(tickSkip(r('0.2'), 2)).toBe(5); // 0.4·0.6·0.8은 꼴이 아니다
    expect(tickSkip(r('0.2'), 3)).toBe(5); // 1
    expect(tickSkip(r('0.2'), 6)).toBe(10); // 2
    expect(tickSkip(r('0.2'), 11)).toBe(25); // 5
    expect(tickSkip(r('0.2'), 26)).toBe(50); // 10
  });

  it('yStep 0.5, 1, 2', () => {
    expect(tickSkip(r('0.5'), 1)).toBe(1); // 0.5
    expect(tickSkip(r('0.5'), 3)).toBe(4); // 2
    expect(tickSkip(r('0.5'), 5)).toBe(10); // 5
    expect(tickSkip(r('1'), 1)).toBe(1);
    expect(tickSkip(r('1'), 3)).toBe(5);
    expect(tickSkip(r('1'), 6)).toBe(10);
    expect(tickSkip(r('2'), 2)).toBe(5); // 10
  });

  it('분수 yStep(1/2)', () => {
    expect(tickSkip(r('1/2'), 1)).toBe(1);
    expect(tickSkip(r('1/2'), 3)).toBe(4); // 2
  });

  it('최소 칸이 0 이하여도 1칸부터, 맞는 값이 없으면 최소 칸', () => {
    expect(tickSkip(r('1'), 0)).toBe(1);
    expect(tickSkip(r('1'), -3)).toBe(1);
    expect(tickSkip(r('3'), 4)).toBe(4); // 3의 배수는 끝내 꼴이 안 된다
  });

  it('0부터 눈금: 0, 5, 10, …', () => {
    const skip = tickSkip(r('0.2'), 12);
    const values = lineTickCells(188, skip).map((k) =>
      r('0')
        .add(r('0.2').mul(Rational.of(k)))
        .toDecimalString(),
    );
    expect(values.slice(0, 4)).toEqual(['0', '5', '10', '15']);
  });
});
