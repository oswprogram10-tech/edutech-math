import { MathError } from './errors';

const ZERO = 0n;
const ONE = 1n;
const TWO = 2n;
const FIVE = 5n;
const TEN = 10n;

function absBigInt(value: bigint): bigint {
  return value < ZERO ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  let left = absBigInt(a);
  let right = absBigInt(b);
  while (right !== ZERO) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function toBigInt(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) {
    throw new MathError('UNSAFE_NUMBER', `안전한 정수가 아닙니다: ${String(value)}`);
  }
  return BigInt(value);
}

function pow10(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

function parseError(value: string, position: number): MathError {
  return new MathError('PARSE', `수를 읽을 수 없습니다: ${value}`, { position });
}

/** 대분수 분해 결과. `whole`은 부호를 가지고, `num`은 항상 0 이상이다. */
export interface MixedParts {
  readonly whole: bigint;
  readonly num: bigint;
  readonly den: bigint;
}

/**
 * 정확한 유리수 값 객체. 내부는 기약분수 `n / d` (d > 0)이고 0은 `0 / 1`이다.
 * 모든 계산은 BigInt로만 한다. number는 생성 시 안전한 정수인지 검사만 한다.
 */
export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
    Object.freeze(this);
  }

  /** `bigint` 또는 안전한 정수 `number`만 받는다. 그 밖의 number는 UNSAFE_NUMBER. */
  static of(n: bigint | number, d: bigint | number = ONE): Rational {
    let numerator = toBigInt(n);
    let denominator = toBigInt(d);
    if (denominator === ZERO) {
      throw new MathError('DIV_BY_ZERO', '분모가 0입니다.');
    }
    if (numerator === ZERO) return new Rational(ZERO, ONE);
    if (denominator < ZERO) {
      numerator = -numerator;
      denominator = -denominator;
    }
    const divisor = gcd(numerator, denominator);
    return new Rational(numerator / divisor, denominator / divisor);
  }

  /**
   * 문자열 생성. `"12"`, `"-7/4"`, `"3/4"`, `"1 2/3"`, `"0.25"`를 받는다.
   * `".5"`, `"1,000"`처럼 초등 표기가 아닌 입력은 PARSE 오류다.
   */
  static parse(input: string): Rational {
    const text = input.trim();
    if (text.length === 0) throw parseError(input, 0);

    const mixed = /^(-?)(\d+)[ \u00a0]+(\d+)\/(\d+)$/.exec(text);
    if (mixed !== null) {
      const sign = mixed[1] === '-' ? -ONE : ONE;
      const whole = BigInt(mixed[2] as string);
      const num = BigInt(mixed[3] as string);
      const den = BigInt(mixed[4] as string);
      if (den === ZERO) throw new MathError('DIV_BY_ZERO', '분모가 0입니다.', { position: 0 });
      if (whole < ONE || num < ONE) throw parseError(input, 0);
      if (num >= den) throw parseError(input, 0);
      return Rational.of(sign * (whole * den + num), den);
    }

    const fraction = /^(-?)(\d+)\/(\d+)$/.exec(text);
    if (fraction !== null) {
      const sign = fraction[1] === '-' ? -ONE : ONE;
      const num = BigInt(fraction[2] as string);
      const den = BigInt(fraction[3] as string);
      if (den === ZERO) throw new MathError('DIV_BY_ZERO', '분모가 0입니다.', { position: 0 });
      return Rational.of(sign * num, den);
    }

    const decimal = /^(-?)(\d+)\.(\d+)$/.exec(text);
    if (decimal !== null) {
      const sign = decimal[1] === '-' ? -ONE : ONE;
      const whole = decimal[2] as string;
      const fractionDigits = decimal[3] as string;
      const num = BigInt(whole + fractionDigits);
      return Rational.of(sign * num, pow10(fractionDigits.length));
    }

    const integer = /^-?\d+$/.exec(text);
    if (integer !== null) return Rational.of(BigInt(text));

    throw parseError(input, 0);
  }

  add(other: Rational): Rational {
    return Rational.of(this.n * other.d + other.n * this.d, this.d * other.d);
  }

  sub(other: Rational): Rational {
    return Rational.of(this.n * other.d - other.n * this.d, this.d * other.d);
  }

  mul(other: Rational): Rational {
    return Rational.of(this.n * other.n, this.d * other.d);
  }

  div(other: Rational): Rational {
    if (other.n === ZERO) throw new MathError('DIV_BY_ZERO', '0으로 나눌 수 없습니다.');
    return Rational.of(this.n * other.d, this.d * other.n);
  }

  neg(): Rational {
    return Rational.of(-this.n, this.d);
  }

  abs(): Rational {
    return this.n < ZERO ? this.neg() : this;
  }

  /** 역수. 0의 역수는 DIV_BY_ZERO. */
  inverse(): Rational {
    if (this.n === ZERO) throw new MathError('DIV_BY_ZERO', '0의 역수는 없습니다.');
    return Rational.of(this.d, this.n);
  }

  /** `this`가 `other`보다 작으면 -1, 같으면 0, 크면 1. */
  compareTo(other: Rational): -1 | 0 | 1 {
    const difference = this.n * other.d - other.n * this.d;
    if (difference < ZERO) return -1;
    if (difference > ZERO) return 1;
    return 0;
  }

  equals(other: Rational): boolean {
    return this.n === other.n && this.d === other.d;
  }

  isZero(): boolean {
    return this.n === ZERO;
  }

  isNegative(): boolean {
    return this.n < ZERO;
  }

  isInteger(): boolean {
    return this.d === ONE;
  }

  /** 0 방향으로 자른 정수부. */
  integerPart(): bigint {
    return this.n / this.d;
  }

  /** 정수부와 진분수부로 나눈다. 예: -7/4 → { whole: -1n, num: 3n, den: 4n }. */
  toMixed(): MixedParts {
    const whole = this.integerPart();
    const remainder = this.n % this.d;
    return {
      whole,
      num: remainder < ZERO ? -remainder : remainder,
      den: this.d,
    };
  }

  /** 기약분모의 소인수가 2와 5뿐이면 유한소수다. */
  isTerminatingDecimal(): boolean {
    let rest = this.d;
    while (rest % TWO === ZERO) rest /= TWO;
    while (rest % FIVE === ZERO) rest /= FIVE;
    return rest === ONE;
  }

  /** 유한소수 문자열. 유한소수가 아니면 NOT_TERMINATING. */
  toDecimalString(): string {
    if (this.d === ONE) return this.n.toString();

    let rest = this.d;
    let twos = 0;
    let fives = 0;
    while (rest % TWO === ZERO) {
      rest /= TWO;
      twos += 1;
    }
    while (rest % FIVE === ZERO) {
      rest /= FIVE;
      fives += 1;
    }
    if (rest !== ONE) {
      throw new MathError('NOT_TERMINATING', `${this.toString()}은 유한소수가 아닙니다.`);
    }

    const digits = twos > fives ? twos : fives;
    const scaled = (absBigInt(this.n) * pow10(digits)) / this.d;
    const padded = scaled.toString().padStart(digits + 1, '0');
    const integer = padded.slice(0, padded.length - digits);
    const fraction = padded.slice(padded.length - digits).replace(/0+$/, '');
    const sign = this.n < ZERO ? '-' : '';
    return `${sign}${integer}.${fraction}`;
  }

  /** JSON에는 정규 문자열(`"3"`, `"-7/4"`)로 저장한다. `Rational.parse`로 되돌린다. */
  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return this.d === ONE ? this.n.toString() : `${this.n.toString()}/${this.d.toString()}`;
  }
}
