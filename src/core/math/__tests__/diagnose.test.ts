import { describe, expect, it } from 'vitest';
import { diagnoseDetectors, parseRaw } from '../diagnose';

interface Case {
  readonly code: string;
  readonly args: unknown;
  readonly value: string;
  readonly raw?: string;
  readonly correct: string;
  readonly correctRaw?: string;
}

/**
 * W1 오개념 감지 함수 하나에 (오개념대로 쓴 답, 올바른 답)을 넣는다.
 * 정답이 같은 값으로 우연히 겹치는 경우는 감지하지 않아야 한다.
 */
const CASES: readonly Case[] = [
  {
    code: 'MC-FRAC-ADD-DENOM',
    args: { a: '1/2', b: '1/3' },
    value: '2/5',
    correct: '5/6',
  },
  {
    code: 'MC-FRAC-ADD-DENOM-HALF',
    args: { a: '1/5', b: '2/5' },
    value: '3/10',
    correct: '3/5',
  },
  {
    code: 'MC-FRAC-ADD-NO-CONVERT-NUM',
    args: { a: '1/2', b: '1/3' },
    value: '1/3',
    correct: '5/6',
  },
  {
    code: 'MC-FRAC-BIGGER-DENOM',
    args: { left: '1/5', right: '1/3' },
    value: '>',
    correct: '<',
  },
  {
    code: 'MC-FRAC-EQUIV-ADD-SAME',
    args: { from: '1/2', added: '1' },
    value: '2/3',
    correct: '1/2',
  },
  {
    code: 'MC-FRAC-NO-SIMPLIFY',
    args: { unsimplified: '4/8' },
    value: '1/2',
    raw: '4/8',
    correct: '3/4',
    correctRaw: '3/4',
  },
  {
    code: 'MC-SIMPLIFY-PARTIAL',
    args: { unsimplified: '4/8' },
    value: '1/2',
    raw: '2/4',
    correct: '1/2',
    correctRaw: '1/2',
  },
  {
    code: 'MC-FRAC-MIXED-CONVERT',
    args: { mixed: '2 1/3' },
    value: '1',
    correct: '7/3',
  },
  {
    code: 'MC-FRAC-SEPARATE-PARTS',
    args: {},
    value: '5/2',
    raw: '1 3/2',
    correct: '3/2',
    correctRaw: '1 1/2',
  },
  {
    code: 'MC-FRAC-WHOLE-MINUS',
    args: { whole: '3', subtrahend: '1/2' },
    value: '7/2',
    correct: '5/2',
  },
  {
    code: 'MC-FRAC-PART-PART',
    args: { part: '3', whole: '8' },
    value: '3/5',
    correct: '3/8',
  },
  {
    code: 'MC-COMMON-DENOM-ONLY-PRODUCT',
    args: { a: '1/2', b: '1/4' },
    value: '3/8',
    raw: '3/8',
    correct: '3/4',
    correctRaw: '6/8',
  },
  {
    code: 'MC-FRAC-BORROW-AS-TEN',
    args: { minuend: '3 1/4', subtrahend: '1 2/4' },
    value: '13/4',
    correct: '7/4',
  },
  {
    code: 'MC-SUB-SMALLER-FROM-LARGER',
    args: { minuend: '3 1/4', subtrahend: '1 3/4' },
    value: '5/2',
    correct: '3/2',
  },
  {
    code: 'MC-DEC-ALIGN-RIGHT',
    args: { a: '1.2', b: '0.35' },
    value: '0.47',
    correct: '1.55',
  },
  {
    code: 'MC-DEC-LONGER-BIGGER',
    args: { left: '0.35', right: '0.5' },
    value: '>',
    correct: '<',
  },
  {
    code: 'MC-DEC-TRAILING-ZERO',
    args: { left: '0.5', right: '0.50' },
    value: '<',
    correct: '=',
  },
  {
    code: 'MC-DEC-POINT-SEPARATOR',
    args: { a: '0.6', b: '0.7' },
    value: '0.13',
    correct: '1.3',
  },
  {
    code: 'MC-FRAC-DEC-LINK',
    args: { fraction: '3/10' },
    value: '3.1',
    correct: '0.3',
  },
];

function detect(testCase: Case, value: string, raw: string | undefined): boolean {
  const detector = diagnoseDetectors[testCase.code];
  if (!detector) throw new Error(`감지 함수가 없습니다: ${testCase.code}`);
  return detector({ value, raw: raw ?? null, args: testCase.args });
}

describe('W1 오개념 감지', () => {
  for (const testCase of CASES) {
    it(`${testCase.code}는 오개념 답만 감지한다`, () => {
      expect(detect(testCase, testCase.value, testCase.raw)).toBe(true);
      expect(detect(testCase, testCase.correct, testCase.correctRaw)).toBe(false);
    });
  }

  it('MC-SUB-SMALLER-FROM-LARGER는 오개념 답만 감지하고 정답 표기는 감지하지 않는다', () => {
    const detector = diagnoseDetectors['MC-SUB-SMALLER-FROM-LARGER'];
    const args = { minuend: '3 1/4', subtrahend: '1 3/4' };
    // (3 − 1) + (3/4 − 1/4) = 2 2/4
    expect(detector?.({ value: '5/2', raw: '2 2/4', args })).toBe(true);
    expect(detector?.({ value: '5/2', raw: '10/4', args })).toBe(true);
    // 정답 1 2/4 = 1 1/2 = 3/2
    expect(detector?.({ value: '3/2', raw: '1 2/4', args })).toBe(false);
    expect(detector?.({ value: '3/2', raw: '1 1/2', args })).toBe(false);
    expect(detector?.({ value: '6/4', raw: '6/4', args })).toBe(false);
  });

  it('MC-SUB-SMALLER-FROM-LARGER는 분수 부분을 거꾸로 뺄 수 없는 경우 감지하지 않는다', () => {
    const detector = diagnoseDetectors['MC-SUB-SMALLER-FROM-LARGER'];
    // 3 3/4 − 1 1/4은 빼지는 수의 분수 부분이 더 크다. 2 2/4는 정답이라 감지 대상이 아니다.
    expect(
      detector?.({ value: '5/2', raw: '2 2/4', args: { minuend: '3 3/4', subtrahend: '1 1/4' } }),
    ).toBe(false);
    // 빼지는 수가 대분수가 아니면 대상이 아니다.
    expect(
      detector?.({ value: '5/2', raw: '2 2/4', args: { minuend: '7/4', subtrahend: '1 3/4' } }),
    ).toBe(false);
  });

  it('정답과 같은 값이 나오는 오개념 답은 감지하지 않는다', () => {
    // 1/2 + 1/2 = 2/4는 분모끼리 더한 값이지만 답과 같다.
    expect(
      diagnoseDetectors['MC-FRAC-ADD-DENOM']?.({
        value: '1',
        raw: null,
        args: { a: '1/2', b: '1/2' },
      }),
    ).toBe(false);
  });

  it('입력이 없거나 형식이 다르면 감지하지 않는다', () => {
    for (const detector of Object.values(diagnoseDetectors)) {
      expect(detector({ value: null, raw: null, args: {} })).toBe(false);
      expect(detector({ value: 'not a number', raw: null, args: {} })).toBe(false);
    }
  });

  it('학생 표기를 약분하지 않고 읽는다', () => {
    expect(parseRaw('4/8')).toMatchObject({ kind: 'fraction', n: 4n, d: 8n });
    expect(parseRaw('1 3/2')).toMatchObject({ kind: 'mixed', n: 5n, d: 2n });
    expect(parseRaw('0.40')).toMatchObject({ kind: 'decimal', n: 40n, d: 100n });
    expect(parseRaw('12')).toMatchObject({ kind: 'integer', n: 12n, d: 1n });
    expect(parseRaw('3/0')).toBeNull();
    expect(parseRaw('')).toBeNull();
  });
});
