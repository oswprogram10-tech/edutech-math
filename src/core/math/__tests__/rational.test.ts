import { describe, expect, it } from 'vitest';
import { MathError, Rational } from '..';
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

describe('Rational.of', () => {
  it('정수를 기약분수로 만든다', () => {
    expect(Rational.of(12).toString()).toBe('12');
    expect(Rational.of(6n, 8n).toString()).toBe('3/4');
    expect(Rational.of(-6n, 8n).toString()).toBe('-3/4');
  });

  it('음수 분모의 부호를 분자로 옮긴다', () => {
    expect(Rational.of(3, -4).toString()).toBe('-3/4');
    expect(Rational.of(-3, -4).toString()).toBe('3/4');
  });

  it('0은 언제나 0/1이다', () => {
    expect(Rational.of(0).toString()).toBe('0');
    expect(Rational.of(0n, -9n).toString()).toBe('0');
  });

  it('큰 수도 BigInt로 정확히 만든다', () => {
    const big = 123456789012345678901234567890n;
    expect(Rational.of(big).toString()).toBe('123456789012345678901234567890');
  });

  it('안전한 정수가 아닌 number는 거부한다', () => {
    expect(codeOf(() => Rational.of(1.5))).toBe('UNSAFE_NUMBER');
    expect(codeOf(() => Rational.of(1, 0.5))).toBe('UNSAFE_NUMBER');
    expect(codeOf(() => Rational.of(Number.MAX_SAFE_INTEGER + 1))).toBe('UNSAFE_NUMBER');
  });

  it('분모가 0이면 DIV_BY_ZERO', () => {
    expect(codeOf(() => Rational.of(1, 0))).toBe('DIV_BY_ZERO');
    expect(codeOf(() => Rational.of(1n, 0n))).toBe('DIV_BY_ZERO');
  });

  it('불변 값 객체다', () => {
    const value = Rational.of(1, 2);
    expect(Object.isFrozen(value)).toBe(true);
  });
});

describe('Rational.parse', () => {
  it('정수·분수·대분수·소수를 읽는다', () => {
    expect(Rational.parse('12').toString()).toBe('12');
    expect(Rational.parse(' -7/4 ').toString()).toBe('-7/4');
    expect(Rational.parse('3/4').toString()).toBe('3/4');
    expect(Rational.parse('1 2/3').toString()).toBe('5/3');
    expect(Rational.parse('-1 2/3').toString()).toBe('-5/3');
    expect(Rational.parse('0.25').toString()).toBe('1/4');
    expect(Rational.parse('1.50').toString()).toBe('3/2');
    expect(Rational.parse('-0.5').toString()).toBe('-1/2');
    expect(Rational.parse('0 1/2').toString()).toBe('1/2');
  });

  it('큰 수를 Number를 거치지 않고 읽는다', () => {
    expect(Rational.parse('123456789012345678901234567890').toString()).toBe(
      '123456789012345678901234567890',
    );
  });

  it('초등 표기가 아닌 입력은 PARSE 오류다', () => {
    expect(codeOf(() => Rational.parse(''))).toBe('PARSE');
    expect(codeOf(() => Rational.parse('.5'))).toBe('PARSE');
    expect(codeOf(() => Rational.parse('1.'))).toBe('PARSE');
    expect(codeOf(() => Rational.parse('1,000'))).toBe('PARSE');
    expect(codeOf(() => Rational.parse('−3/4'))).toBe('PARSE');
    expect(codeOf(() => Rational.parse('3 / 4'))).toBe('PARSE');
    expect(codeOf(() => Rational.parse('1 4/3'))).toBe('PARSE');
  });

  it('분모가 0인 표기는 DIV_BY_ZERO', () => {
    expect(codeOf(() => Rational.parse('1/0'))).toBe('DIV_BY_ZERO');
    expect(codeOf(() => Rational.parse('1 2/0'))).toBe('DIV_BY_ZERO');
  });
});

describe('Rational 사칙연산', () => {
  it('정확히 더하고 뺀다', () => {
    expect(Rational.parse('1/2').add(Rational.parse('1/3')).toString()).toBe('5/6');
    expect(Rational.parse('1/2').sub(Rational.parse('3/4')).toString()).toBe('-1/4');
    expect(Rational.parse('0.1').add(Rational.parse('0.2')).toString()).toBe('3/10');
  });

  it('정확히 곱하고 나눈다', () => {
    expect(Rational.parse('2').mul(Rational.parse('3/4')).toString()).toBe('3/2');
    expect(Rational.parse('1/2').div(Rational.parse('3/4')).toString()).toBe('2/3');
  });

  it('큰 수도 정확히 계산한다', () => {
    const big = Rational.parse('99999999999999999999');
    expect(big.add(Rational.of(1)).toString()).toBe('100000000000000000000');
  });

  it('0으로 나누면 DIV_BY_ZERO', () => {
    expect(codeOf(() => Rational.parse('1/2').div(Rational.of(0)))).toBe('DIV_BY_ZERO');
  });
});

describe('Rational 비교와 부호', () => {
  it('크기를 정확히 비교한다', () => {
    expect(Rational.parse('1/2').compareTo(Rational.parse('2/4'))).toBe(0);
    expect(Rational.parse('1/3').compareTo(Rational.parse('1/2'))).toBe(-1);
    expect(Rational.parse('3/2').compareTo(Rational.of(1))).toBe(1);
    expect(Rational.parse('1/2').equals(Rational.parse('2/4'))).toBe(true);
    expect(Rational.parse('1/2').equals(Rational.parse('1/3'))).toBe(false);
  });

  it('부호를 판정한다', () => {
    expect(Rational.of(0).isZero()).toBe(true);
    expect(Rational.of(0).isNegative()).toBe(false);
    expect(Rational.parse('-1/3').isNegative()).toBe(true);
    expect(Rational.of(4).isInteger()).toBe(true);
    expect(Rational.parse('4/2').isInteger()).toBe(true);
    expect(Rational.parse('3/2').isInteger()).toBe(false);
  });

  it('음수·절댓값·역수를 만든다', () => {
    expect(Rational.parse('2/3').neg().toString()).toBe('-2/3');
    expect(Rational.parse('-2/3').abs().toString()).toBe('2/3');
    expect(Rational.parse('2/3').abs().toString()).toBe('2/3');
    expect(Rational.parse('0').abs().toString()).toBe('0');
    expect(Rational.parse('2/3').inverse().toString()).toBe('3/2');
    expect(Rational.parse('-2/3').inverse().toString()).toBe('-3/2');
    expect(codeOf(() => Rational.of(0).inverse())).toBe('DIV_BY_ZERO');
  });
});

describe('정수부와 대분수 분해', () => {
  it('0 방향으로 정수부를 자른다', () => {
    expect(Rational.parse('7/4').integerPart()).toBe(1n);
    expect(Rational.parse('-7/4').integerPart()).toBe(-1n);
    expect(Rational.parse('3/4').integerPart()).toBe(0n);
  });

  it('대분수로 분해한다', () => {
    expect(Rational.parse('7/4').toMixed()).toEqual({ whole: 1n, num: 3n, den: 4n });
    expect(Rational.parse('-7/4').toMixed()).toEqual({ whole: -1n, num: 3n, den: 4n });
    expect(Rational.parse('3/4').toMixed()).toEqual({ whole: 0n, num: 3n, den: 4n });
    expect(Rational.parse('-3/4').toMixed()).toEqual({ whole: 0n, num: 3n, den: 4n });
    expect(Rational.of(5).toMixed()).toEqual({ whole: 5n, num: 0n, den: 1n });
  });
});

describe('유한소수', () => {
  it('분모의 소인수가 2와 5뿐인지 판정한다', () => {
    expect(Rational.of(0).isTerminatingDecimal()).toBe(true);
    expect(Rational.parse('1/2').isTerminatingDecimal()).toBe(true);
    expect(Rational.parse('1/5').isTerminatingDecimal()).toBe(true);
    expect(Rational.parse('1/8').isTerminatingDecimal()).toBe(true);
    expect(Rational.parse('3/40').isTerminatingDecimal()).toBe(true);
    expect(Rational.parse('1/3').isTerminatingDecimal()).toBe(false);
    expect(Rational.parse('1/6').isTerminatingDecimal()).toBe(false);
    expect(Rational.parse('7/12').isTerminatingDecimal()).toBe(false);
  });

  it('유한소수를 정확한 문자열로 만든다', () => {
    expect(Rational.of(0).toDecimalString()).toBe('0');
    expect(Rational.of(3).toDecimalString()).toBe('3');
    expect(Rational.parse('1/2').toDecimalString()).toBe('0.5');
    expect(Rational.parse('1/4').toDecimalString()).toBe('0.25');
    expect(Rational.parse('1/8').toDecimalString()).toBe('0.125');
    expect(Rational.parse('3/40').toDecimalString()).toBe('0.075');
    expect(Rational.parse('7/4').toDecimalString()).toBe('1.75');
    expect(Rational.parse('1/10').toDecimalString()).toBe('0.1');
    expect(Rational.parse('50/100').toDecimalString()).toBe('0.5');
    expect(Rational.parse('-3/2').toDecimalString()).toBe('-1.5');
  });

  it('순환소수는 NOT_TERMINATING', () => {
    expect(codeOf(() => Rational.parse('1/3').toDecimalString())).toBe('NOT_TERMINATING');
    expect(codeOf(() => Rational.parse('1/7').toDecimalString())).toBe('NOT_TERMINATING');
  });
});

describe('JSON 왕복', () => {
  it('정규 문자열로 저장하고 parse로 되돌린다', () => {
    const values = [
      Rational.parse('-7/4'),
      Rational.parse('1 2/3'),
      Rational.of(12),
      Rational.of(0),
    ];
    const text = JSON.stringify(values);
    expect(text).toBe('["-7/4","5/3","12","0"]');

    const restored: unknown = JSON.parse(text);
    expect(Array.isArray(restored)).toBe(true);
    const parsed = (restored as string[]).map((value) => Rational.parse(value));
    expect(parsed.map((value) => value.toString())).toEqual(['-7/4', '5/3', '12', '0']);
  });

  it('객체 안의 Rational도 왕복한다', () => {
    const source = { answer: Rational.parse('3/4'), nested: { list: [Rational.parse('-2/5')] } };
    const restored: unknown = JSON.parse(JSON.stringify(source));
    expect(restored).toEqual({ answer: '3/4', nested: { list: ['-2/5'] } });
  });
});

describe('MathError', () => {
  it('기본 메시지와 코드, 위치를 가진다', () => {
    const error = new MathError('PARSE', undefined, { position: 3 });
    expect(error.code).toBe('PARSE');
    expect(error.position).toBe(3);
    expect(error.message).not.toBe('');
    expect(error.name).toBe('MathError');
  });

  it('직접 준 메시지를 쓴다', () => {
    const error = new MathError('DIV_BY_ZERO', '직접 메시지');
    expect(error.message).toBe('직접 메시지');
    expect(error.position).toBeUndefined();
  });
});
