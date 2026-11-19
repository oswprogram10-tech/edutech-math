import { describe, expect, it } from 'vitest';
import {
  MathError,
  Rational,
  checkPairs,
  evaluateTerm,
  formatRelation,
  parseRelation,
  relationHolds,
  relationInfo,
  sameOnDomain,
  solveBox,
  swappedHolds,
} from '..';
import type { MathErrorCode } from '..';

function errorOf(action: () => unknown): MathError {
  try {
    action();
  } catch (error) {
    if (error instanceof MathError) return error;
    throw error;
  }
  throw new Error('MathError가 발생하지 않았습니다.');
}

function codeOf(action: () => unknown): MathErrorCode {
  return errorOf(action).code;
}

const r = (n: number, d = 1): Rational => Rational.of(n, d);
const pairs = (list: [number, number][]): [Rational, Rational][] =>
  list.map(([c, b]) => [r(c), r(b)]);
const range = (from: number, to: number): Rational[] =>
  Array.from({ length: to - from + 1 }, (_, i) => r(from + i));

describe('parseRelation 성공', () => {
  it('□ = ○ × 4 와 ASCII', () => {
    expect(formatRelation(parseRelation('□ = ○ × 4'))).toBe('□ = ○ × 4');
    expect(formatRelation(parseRelation('□=○*4'))).toBe('□ = ○ × 4');
  });

  it('여러 모양', () => {
    expect(formatRelation(parseRelation('□ - 1 = ○ × 3'))).toBe('□ − 1 = ○ × 3');
    expect(formatRelation(parseRelation('(○ + 1) × 2 = □'))).toBe('(○ + 1) × 2 = □');
    expect(formatRelation(parseRelation('□ = ○ ÷ 2'))).toBe('□ = ○ ÷ 2');
    expect(formatRelation(parseRelation('□ = 1/2 × ○'))).toBe('□ = 1/2 × ○');
    expect(formatRelation(parseRelation('□ = 0.5 × ○'))).toBe('□ = 0.5 × ○');
  });

  it('기호 없는 식도 읽힌다', () => {
    const rel = parseRelation('4 = 4');
    expect(relationInfo(rel).usesBox).toBe(false);
    expect(relationHolds(rel, r(1), r(1))).toBe(true);
  });
});

describe('parseRelation 실패와 위치', () => {
  const cases: [string, number][] = [
    ['+4', 0],
    ['□ = □ + ', 8],
    ['□ = ○ = 4', 6],
    ['□ ○', 2],
    ['3○', 1],
    ['□ : ○', 2],
    ['', 0],
    ['□ + 1', 5],
    ['2 1/2 = □', 2],
  ];
  it.each(cases)('%j 는 PARSE, 위치 %i', (source, position) => {
    const error = errorOf(() => parseRelation(source));
    expect(error.code).toBe('PARSE');
    expect(error.position).toBe(position);
  });
});

describe('checkPairs', () => {
  const chair = pairs([
    [1, 4],
    [2, 8],
    [5, 20],
  ]);

  it('□ = ○ × 4 는 모두 참', () => {
    expect(checkPairs(parseRelation('□ = ○ × 4'), chair)).toEqual([true, true, true]);
  });

  it('□ = ○ + 3 은 첫 쌍만 참(ONE-PAIR)', () => {
    expect(checkPairs(parseRelation('□ = ○ + 3'), chair)).toEqual([true, false, false]);
  });

  it('0 쌍, 큰 수, 분수 쌍', () => {
    const rel = parseRelation('□ = ○ × 4');
    expect(checkPairs(rel, pairs([[0, 0]]))).toEqual([true]);
    expect(checkPairs(rel, pairs([[1000000, 4000000]]))).toEqual([true]);
    expect(checkPairs(rel, [[r(1, 2), r(2)]])).toEqual([true]);
    expect(checkPairs(rel, [[r(1, 3), r(1)]])).toEqual([false]);
  });
});

describe('0으로 나누기', () => {
  const rel = parseRelation('□ = 4 ÷ ○');
  it('relationHolds 는 false', () => {
    expect(relationHolds(rel, r(0), r(0))).toBe(false);
    expect(relationHolds(rel, r(2), r(2))).toBe(true);
  });
  it('evaluateTerm 은 DIV_BY_ZERO', () => {
    expect(codeOf(() => evaluateTerm(rel.right, { circle: r(0), box: r(0) }))).toBe('DIV_BY_ZERO');
  });
  it('solveBox 는 null', () => {
    expect(solveBox(rel, r(0))).toBeNull();
  });
});

describe('relationInfo', () => {
  it('boxOnly', () => {
    const info = relationInfo(parseRelation('□ = □ + 4'));
    expect(info.boxOnly).toBe(true);
    expect(info.boxCount).toBe(2);
    expect(info.usesCircle).toBe(false);
  });
  it('solvedForBox', () => {
    const a = relationInfo(parseRelation('□ = ○ × 4'));
    expect(a.solvedForBox).toBe(true);
    expect(a.boxOnly).toBe(false);
    expect(a.circleCount).toBe(1);
    expect(relationInfo(parseRelation('○ × 4 = □')).solvedForBox).toBe(true);
    expect(relationInfo(parseRelation('□ - 1 = ○ × 3')).solvedForBox).toBe(false);
    expect(relationInfo(parseRelation('□ = □ + 4')).solvedForBox).toBe(false);
  });
});

describe('sameOnDomain', () => {
  const dom = range(1, 20);
  it('같은 식', () => {
    expect(sameOnDomain(parseRelation('□ = ○ × 3 + 1'), parseRelation('□ − 1 = ○ × 3'), dom)).toBe(
      true,
    );
  });
  it('다른 식', () => {
    expect(sameOnDomain(parseRelation('□ = ○ × 3 + 1'), parseRelation('□ = ○ × 3'), dom)).toBe(
      false,
    );
  });
  it('□ 에 일차가 아니면 NONLINEAR', () => {
    expect(
      codeOf(() => sameOnDomain(parseRelation('□ × □ = ○'), parseRelation('□ = ○'), dom)),
    ).toBe('NONLINEAR');
    expect(codeOf(() => solveBox(parseRelation('4 ÷ □ = ○'), r(2)))).toBe('NONLINEAR');
  });
  it('0 × □ = ○ 은 false', () => {
    expect(sameOnDomain(parseRelation('0 × □ = ○'), parseRelation('0 × □ = ○'), dom)).toBe(false);
  });
  it('solveBox 분수 해와 0', () => {
    expect(solveBox(parseRelation('□ = ○ ÷ 2'), r(1))?.toString()).toBe('1/2');
    expect(solveBox(parseRelation('□ = ○ × 4'), r(0))?.toString()).toBe('0');
  });
});

describe('swappedHolds', () => {
  it('○ = □ × 4 는 ○와 □를 바꾸면 성립', () => {
    const list = pairs([
      [1, 4],
      [2, 8],
    ]);
    expect(swappedHolds(parseRelation('○ = □ × 4'), list)).toBe(true);
    expect(swappedHolds(parseRelation('□ = ○ × 4'), list)).toBe(false);
  });
});

describe('formatRelation', () => {
  it('유니코드로 바꾸고 괄호를 보존한다', () => {
    expect(formatRelation(parseRelation('(○+1)*2=□'))).toBe('(○ + 1) × 2 = □');
    expect(formatRelation(parseRelation('□-1=○/2'))).toBe('□ − 1 = ○ ÷ 2');
  });
});
