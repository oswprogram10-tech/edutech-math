import { describe, expect, it } from 'vitest';
import { diagnoseDetectorsW2 } from '../diagnose-w2';

interface Case {
  readonly code: string;
  readonly args: unknown;
  readonly value: string;
  readonly correct: string;
  /** 오개념도 정답도 아닌 오답. */
  readonly unrelated: string;
}

/**
 * W2 감지 함수 하나에 (오개념 값, 정답, 관계없는 오답)을 넣는다.
 * 학생 값이 정답과 같으면 언제나 false여야 한다.
 */
const CASES: readonly Case[] = [
  {
    code: 'MC-ADD-BRIDGE-OFF-BY-ONE',
    args: { a: '8', b: '5' },
    value: '14',
    correct: '13',
    unrelated: '15',
  },
  {
    code: 'MC-BIGNUM-FIRST-DIGIT',
    args: { left: '987', right: '1000' },
    value: '>',
    correct: '<',
    unrelated: '=',
  },
  {
    code: 'MC-BIGNUM-ZERO-PLACE',
    args: { expected: '40508' },
    value: '458',
    correct: '40508',
    unrelated: '4050',
  },
  {
    code: 'MC-CHART-ROW-COL',
    args: { neighbor: '12', expected: '22' },
    value: '13',
    correct: '22',
    unrelated: '14',
  },
  {
    code: 'MC-COMPARE-DIGIT-COUNT',
    args: { left: '81', right: '79' },
    value: '<',
    correct: '>',
    unrelated: '=',
  },
  {
    code: 'MC-COUNT-ONE-TO-ONE',
    args: { total: '12' },
    value: '13',
    correct: '12',
    unrelated: '15',
  },
  {
    code: 'MC-DEC-POINT-PLACEMENT',
    args: { expected: '2.08' },
    value: '20.8',
    correct: '2.08',
    unrelated: '2.8',
  },
  {
    code: 'MC-DEC-SHIFT-POINT-MOVES',
    args: { original: '3.5', expected: '35' },
    value: '3.5',
    correct: '35',
    unrelated: '350',
  },
  {
    code: 'MC-DIV-CHECK-NO-REMAINDER',
    args: { quotient: '17', divisor: '4', remainder: '3' },
    value: '68',
    correct: '71',
    unrelated: '69',
  },
  {
    code: 'MC-DIV-ORDER-SWAP',
    args: { dividend: '48', divisor: '6' },
    value: '1/8',
    correct: '8',
    unrelated: '1/6',
  },
  {
    code: 'MC-DIV-QUOTIENT-ZERO',
    args: { expected: '408' },
    value: '48',
    correct: '408',
    unrelated: '40',
  },
  {
    code: 'MC-DIV-REMAINDER-SCALED',
    args: { remainder: '3', scale: '10' },
    value: '30',
    correct: '3',
    unrelated: '13',
  },
  {
    code: 'MC-DIV-REMAINDER-TOO-BIG',
    args: { divisor: '6' },
    value: '6',
    correct: '5',
    unrelated: '4',
  },
  {
    code: 'MC-EQUAL-ANSWER',
    args: { a: '5', b: '12' },
    value: '17',
    correct: '7',
    unrelated: '12',
  },
  {
    code: 'MC-FACTOR-MULTIPLE-SWAP',
    args: { n: '12' },
    value: '24',
    correct: '4',
    unrelated: '18',
  },
  {
    code: 'MC-FRAC-DIV-INVERT-WRONG',
    args: { dividend: '2/3', divisor: '4/5' },
    value: '6/5',
    correct: '5/6',
    unrelated: '1/2',
  },
  {
    code: 'MC-FRAC-DIV-MULT-DENOM-WRONG',
    args: { fraction: '3/4', n: '2' },
    value: '3/2',
    correct: '3/8',
    unrelated: '3/4',
  },
  {
    code: 'MC-FRAC-MULT-WHOLE-BOTH',
    args: { fraction: '2/3', n: '4' },
    value: '2/3',
    correct: '8/3',
    unrelated: '4/3',
  },
  {
    code: 'MC-GCD-LCM-SWAP',
    args: { a: '12', b: '18', asked: 'lcm' },
    value: '6',
    correct: '36',
    unrelated: '12',
  },
  {
    code: 'MC-JUMP-COUNT-START',
    args: { expected: '7' },
    value: '8',
    correct: '7',
    unrelated: '9',
  },
  {
    code: 'MC-LCM-AS-PRODUCT',
    args: { a: '4', b: '6' },
    value: '24',
    correct: '12',
    unrelated: '36',
  },
  {
    code: 'MC-MAKE10-PAIR',
    args: { expected: '7' },
    value: '8',
    correct: '7',
    unrelated: '9',
  },
  {
    code: 'MC-MAKE10-SPLIT',
    args: { left: '7', addend: '8' },
    value: '4',
    correct: '3',
    unrelated: '8',
  },
  {
    code: 'MC-MUL-ADD-CONFUSE',
    args: { a: '23', b: '4' },
    value: '27',
    correct: '92',
    unrelated: '19',
  },
  {
    code: 'MC-MUL-CARRY-ADD-BEFORE',
    args: { a: '46', b: '3' },
    value: '158',
    correct: '138',
    unrelated: '128',
  },
  {
    code: 'MC-MUL-FACT-NEIGHBOR',
    args: { a: '7', b: '8' },
    value: '49',
    correct: '56',
    unrelated: '54',
  },
  {
    code: 'MC-MUL-NO-PLACE-VALUE',
    args: { a: '23', b: '4' },
    value: '20',
    correct: '92',
    unrelated: '12',
  },
  {
    code: 'MC-MUL-PARTIAL-MISSING',
    args: { a: '46', b: '27' },
    value: '1200',
    correct: '1242',
    unrelated: '414',
  },
  {
    code: 'MC-MUL-PARTIAL-SHIFT',
    args: { a: '46', b: '27' },
    value: '414',
    correct: '1242',
    unrelated: '828',
  },
  {
    code: 'MC-MUL-SPLIT-PARTIAL-DROP',
    args: { a: '6', parts: ['20', '7'] },
    value: '120',
    correct: '162',
    unrelated: '84',
  },
  {
    code: 'MC-MUL-ZERO-ONE',
    args: { a: '5', b: '0' },
    value: '5',
    correct: '0',
    unrelated: '6',
  },
  {
    code: 'MC-PV-BORROW-ACROSS-ZERO',
    args: { a: '503', b: '128' },
    value: '385',
    correct: '375',
    unrelated: '395',
  },
  {
    code: 'MC-PV-DIGIT-FACE',
    args: { digit: '3', place: '1' },
    value: '3',
    correct: '30',
    unrelated: '300',
  },
  {
    code: 'MC-PV-MIXED-UNITS',
    args: { a: '12', b: '3' },
    value: '6',
    correct: '15',
    unrelated: '5',
  },
  {
    code: 'MC-PV-NO-CARRY',
    args: { a: '46', b: '27', op: 'add' },
    value: '63',
    correct: '73',
    unrelated: '613',
  },
  {
    code: 'MC-PV-NONCANON',
    args: { parts: ['3', '12'] },
    value: '312',
    correct: '42',
    unrelated: '24',
  },
  {
    code: 'MC-PV-ZERO',
    args: { expected: '305' },
    value: '35',
    correct: '305',
    unrelated: '30',
  },
  {
    code: 'MC-SUB-DIRECTION',
    args: { a: '32', b: '25' },
    value: '57',
    correct: '7',
    unrelated: '12',
  },
  {
    code: 'MC-THREE-ADDEND-SKIP',
    args: { addends: ['12', '8', '5'] },
    value: '20',
    correct: '25',
    unrelated: '23',
  },
];

function detect(code: string, value: string, args: unknown): boolean {
  const detector = diagnoseDetectorsW2[code];
  if (!detector) throw new Error(`감지 함수가 없습니다: ${code}`);
  return detector({ value, raw: null, args });
}

describe('W2 오개념 감지', () => {
  for (const testCase of CASES) {
    it(`${testCase.code}는 오개념 값만 감지한다`, () => {
      expect(detect(testCase.code, testCase.value, testCase.args)).toBe(true);
      expect(detect(testCase.code, testCase.correct, testCase.args)).toBe(false);
      expect(detect(testCase.code, testCase.unrelated, testCase.args)).toBe(false);
    });

    it(`${testCase.code}는 args가 없거나 잘못되면 false다`, () => {
      expect(detect(testCase.code, testCase.value, undefined)).toBe(false);
      expect(detect(testCase.code, testCase.value, null)).toBe(false);
      expect(detect(testCase.code, testCase.value, {})).toBe(false);
      expect(detect(testCase.code, testCase.value, { a: 5 })).toBe(false);
    });
  }

  it('감지 함수 표에는 diagnose 코드 39개만 있다', () => {
    expect(Object.keys(diagnoseDetectorsW2)).toHaveLength(39);
    expect(diagnoseDetectorsW2['MC-DIV-BRING-DOWN']).toBeUndefined();
    expect(diagnoseDetectorsW2['MC-DIV-ESTIMATE-OFF']).toBeUndefined();
  });
});

describe('W2 감지 경계', () => {
  it('0과 1의 곱을 구분한다', () => {
    expect(detect('MC-MUL-ZERO-ONE', '5', { a: '5', b: '0' })).toBe(true);
    expect(detect('MC-MUL-ZERO-ONE', '0', { a: '5', b: '0' })).toBe(false);
    expect(detect('MC-MUL-ZERO-ONE', '6', { a: '5', b: '1' })).toBe(true);
    expect(detect('MC-MUL-ZERO-ONE', '5', { a: '5', b: '1' })).toBe(false);
  });

  it('큰 수의 자릿값 없는 곱도 감지한다', () => {
    expect(detect('MC-MUL-NO-PLACE-VALUE', '324', { a: '9999', b: '9' })).toBe(true);
    expect(detect('MC-MUL-NO-PLACE-VALUE', '89991', { a: '9999', b: '9' })).toBe(false);
  });

  it('부등호 기호가 정답이면 감지하지 않는다', () => {
    expect(detect('MC-BIGNUM-FIRST-DIGIT', '<', { left: '987', right: '1000' })).toBe(false);
    expect(detect('MC-COMPARE-DIGIT-COUNT', '=', { left: '81', right: '79' })).toBe(false);
  });

  it('소수 표기가 아닌 expected는 몫의 0 누락으로 보지 않는다', () => {
    expect(detect('MC-DIV-QUOTIENT-ZERO', '1/3', { expected: '1/3' })).toBe(false);
    expect(detect('MC-DIV-QUOTIENT-ZERO', '2.8', { expected: '2.08' })).toBe(true);
    expect(detect('MC-DIV-QUOTIENT-ZERO', '0.9', { expected: '0.09' })).toBe(false);
  });

  it('0으로 나누는 args는 false다', () => {
    expect(detect('MC-DIV-ORDER-SWAP', '0', { dividend: '0', divisor: '6' })).toBe(false);
    expect(detect('MC-FRAC-DIV-INVERT-WRONG', '0', { dividend: '0', divisor: '4/5' })).toBe(false);
  });

  it('PV-NO-CARRY는 곱셈에서도 자리별로 계산한다', () => {
    expect(detect('MC-PV-NO-CARRY', '82', { a: '23', b: '4', op: 'mul' })).toBe(true);
    expect(detect('MC-PV-NO-CARRY', '92', { a: '23', b: '4', op: 'mul' })).toBe(false);
    expect(detect('MC-PV-NO-CARRY', '82', { a: '23', b: '4', op: 'sub' })).toBe(false);
  });
});
