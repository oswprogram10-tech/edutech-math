/**
 * W1 분수·소수 오개념 감지(순수 함수).
 *
 * 학생이 쓴 값(`response.<id>.value`)과 학생이 쓴 표기(`raw`), 콘텐츠가 준
 * `args`(문제의 수)만 보고 오개념 코드별로 참·거짓을 돌려준다.
 * 모든 수 계산은 `Rational`(BigInt)로만 한다. number 연산을 쓰지 않는다.
 *
 * 감지 함수는 '학생이 그 오개념대로 답했는가'만 본다. 정답 여부는 실행기의
 * GoalSpec 판정이 따로 맡는다. 정답과 우연히 같은 값이 나오는 경우에는
 * 감지하지 않는다(예: 1/2 + 1/2 = 2/4).
 */
import { Rational } from './rational';
import type { DiagnoseDetector, DiagnoseInput } from './diagnose-shared';
import { integerOf, rationalOf, studentValue, textOf } from './diagnose-shared';
import { diagnoseDetectorsW2 } from './diagnose-w2';

export type { DiagnoseDetector, DiagnoseInput };
export { integerOf, rationalOf, studentValue, textOf };

const ZERO = 0n;
const ONE = 1n;
const TEN = 10n;

function abs(value: bigint): bigint {
  return value < ZERO ? -value : value;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = abs(left);
  let b = abs(right);
  while (b !== ZERO) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

function lcm(left: bigint, right: bigint): bigint {
  if (left === ZERO || right === ZERO) return ZERO;
  return (left / gcd(left, right)) * right;
}

function pow10(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

interface RawParts {
  readonly kind: 'fraction' | 'mixed' | 'decimal' | 'integer';
  /** 가분수로 편 값 */
  readonly n: bigint;
  readonly d: bigint;
  readonly whole?: bigint;
  readonly num?: bigint;
  readonly den?: bigint;
}

/** 학생이 쓴 표기를 (약분하지 않고) 그대로 읽는다. */
export function parseRaw(raw: string | null): RawParts | null {
  if (raw === null) return null;
  const text = raw.trim();
  if (text.length === 0) return null;

  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(text);
  if (mixed !== null) {
    const whole = BigInt(mixed[1] as string);
    const num = BigInt(mixed[2] as string);
    const den = BigInt(mixed[3] as string);
    if (den === ZERO) return null;
    return { kind: 'mixed', n: whole * den + num, d: den, whole, num, den };
  }

  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction !== null) {
    const n = BigInt(fraction[1] as string);
    const d = BigInt(fraction[2] as string);
    if (d === ZERO) return null;
    return { kind: 'fraction', n, d };
  }

  const decimal = /^(\d+)\.(\d+)$/.exec(text);
  if (decimal !== null) {
    const whole = decimal[1] as string;
    const fractionDigits = decimal[2] as string;
    return {
      kind: 'decimal',
      n: BigInt(whole + fractionDigits),
      d: pow10(fractionDigits.length),
    };
  }

  if (/^\d+$/.test(text)) {
    const n = BigInt(text);
    return { kind: 'integer', n, d: ONE };
  }

  return null;
}

interface DecimalParts {
  readonly whole: bigint;
  readonly frac: string;
  readonly value: Rational;
}

function decimalOf(text: string | null): DecimalParts | null {
  if (text === null) return null;
  const match = /^(\d+)\.(\d+)$/.exec(text.trim());
  if (match === null) return null;
  const whole = match[1] as string;
  const frac = match[2] as string;
  return { whole: BigInt(whole), frac, value: Rational.parse(`${whole}.${frac}`) };
}

function fractionPartsOf(text: string): RawParts | null {
  const parts = parseRaw(text);
  return parts?.kind === 'mixed' ? parts : null;
}

// ─────────────────────────────────────────────────────────────
// 분수 덧셈·뺄셈
// ─────────────────────────────────────────────────────────────

/** MC-FRAC-ADD-DENOM: (a분자+b분자)/(a분모+b분모). */
const addDenominators: DiagnoseDetector = ({ value, args }) => {
  const a = rationalOf(args, 'a');
  const b = rationalOf(args, 'b');
  const student = studentValue({ value, raw: null, args });
  if (!a || !b || !student) return false;
  const wrong = Rational.of(a.n + b.n, a.d + b.d);
  return student.equals(wrong) && !student.equals(a.add(b));
};

/** MC-FRAC-ADD-DENOM-HALF: 같은 분모 a/c + b/c = (a+b)/(2c). */
const addDenominatorHalf: DiagnoseDetector = (input) => {
  const a = rationalOf(input.args, 'a');
  const b = rationalOf(input.args, 'b');
  const student = studentValue(input);
  if (!a || !b || !student || a.d !== b.d) return false;
  const wrong = Rational.of(a.n + b.n, a.d + b.d);
  return student.equals(wrong) && !student.equals(a.add(b));
};

/** MC-FRAC-ADD-NO-CONVERT-NUM: 분모만 통분하고 분자는 그대로. */
const addNoConvertNumerator: DiagnoseDetector = (input) => {
  const a = rationalOf(input.args, 'a');
  const b = rationalOf(input.args, 'b');
  const student = studentValue(input);
  if (!a || !b || !student) return false;
  const common = lcm(a.d, b.d);
  const wrong = Rational.of(a.n + b.n, common);
  return student.equals(wrong) && !student.equals(a.add(b));
};

/** MC-FRAC-BORROW-AS-TEN: 받아내림한 1을 10/분모로 바꿈. */
const borrowAsTen: DiagnoseDetector = (input) => {
  const minuend = fractionPartsOf(textOf(input.args, 'minuend') ?? '');
  const subtrahend = rationalOf(input.args, 'subtrahend');
  const student = studentValue(input);
  if (!minuend || !subtrahend || !student) return false;
  const whole = minuend.whole as bigint;
  const num = minuend.num as bigint;
  const den = minuend.den as bigint;
  const scaled = subtrahend.mul(Rational.of(den));
  if (!scaled.isInteger()) return false;
  const wrong = Rational.of((whole - ONE) * den + num + TEN - scaled.n, den);
  const correct = Rational.of(whole * den + num, den).sub(subtrahend);
  return student.equals(wrong) && !student.equals(correct);
};

/** MC-FRAC-WHOLE-MINUS: 자연수에서 분수를 뺄 때 자연수를 분수로 못 바꿈. */
const wholeMinus: DiagnoseDetector = (input) => {
  const whole = integerOf(input.args, 'whole');
  const subtrahend = rationalOf(input.args, 'subtrahend');
  const student = studentValue(input);
  if (whole === null || !subtrahend || !student) return false;
  const subtrahendWhole = subtrahend.integerPart();
  const fraction = subtrahend.sub(Rational.of(subtrahendWhole));
  const droppedWhole = Rational.of(whole - subtrahendWhole).add(fraction);
  const keptFraction = fraction;
  const correct = Rational.of(whole).sub(subtrahend);
  const matched = student.equals(droppedWhole) || student.equals(keptFraction);
  return matched && !student.equals(correct);
};

/**
 * MC-SUB-SMALLER-FROM-LARGER: 대분수 뺄셈에서 분수 부분을 거꾸로 뺌.
 *
 * `3 1/4 − 1 3/4`에서 (자연수 부분의 차) + (빼는 수의 분수 − 빼지는 수의 분수)
 * = 2 + 2/4로 계산한 경우다. 두 분수 부분의 크기가 같거나 빼지는 수가 크면
 * 이 오개념이 만들어지지 않으므로 감지하지 않는다.
 */
const subSmallerFromLarger: DiagnoseDetector = (input) => {
  const minuend = fractionPartsOf(textOf(input.args, 'minuend') ?? '');
  const subtrahendText = textOf(input.args, 'subtrahend');
  const student = studentValue(input);
  if (!minuend || subtrahendText === null || !student) return false;

  const subtrahend = parseRaw(subtrahendText);
  if (!subtrahend) return false;

  const minuendFraction = Rational.of(minuend.num as bigint, minuend.den as bigint);
  const subtrahendWhole = subtrahend.kind === 'mixed' ? (subtrahend.whole as bigint) : ZERO;
  const subtrahendFraction =
    subtrahend.kind === 'mixed'
      ? Rational.of(subtrahend.num as bigint, subtrahend.den as bigint)
      : Rational.of(subtrahend.n, subtrahend.d);
  // 빼는 수의 분수 부분은 1보다 작아야 '분수 부분'으로 볼 수 있다.
  if (subtrahendFraction.compareTo(Rational.of(ONE)) >= 0) return false;
  if (minuendFraction.compareTo(subtrahendFraction) >= 0) return false;

  const minuendWhole = minuend.whole as bigint;
  const wrong = Rational.of(minuendWhole - subtrahendWhole).add(
    subtrahendFraction.sub(minuendFraction),
  );
  const correct = Rational.of(minuendWhole)
    .add(minuendFraction)
    .sub(Rational.of(subtrahendWhole).add(subtrahendFraction));
  return student.equals(wrong) && !student.equals(correct);
};

// ─────────────────────────────────────────────────────────────
// 분수 크기·동치·약분
// ─────────────────────────────────────────────────────────────

type Relation = '<' | '=' | '>';

function relationOf(left: Rational, right: Rational): Relation {
  const compared = left.compareTo(right);
  return compared < 0 ? '<' : compared > 0 ? '>' : '=';
}

/** MC-FRAC-BIGGER-DENOM: 분모가 큰 쪽을 큰 수로 고름. */
const biggerDenominator: DiagnoseDetector = ({ value, args }) => {
  const left = rationalOf(args, 'left');
  const right = rationalOf(args, 'right');
  if (!left || !right || left.d === right.d || value === null) return false;
  const predicted: Relation = left.d > right.d ? '>' : '<';
  const actual = relationOf(left, right);
  return value === predicted && predicted !== actual;
};

/** MC-FRAC-EQUIV-ADD-SAME: 분모·분자에 같은 수를 더해도 크기가 같다고 봄. */
const equivalentAddSame: DiagnoseDetector = (input) => {
  const from = rationalOf(input.args, 'from');
  const student = studentValue(input);
  if (!from || !student) return false;

  let added = integerOf(input.args, 'added');
  let denominator = added === null ? null : from.d + added;
  if (added === null) {
    const to = rationalOf(input.args, 'to');
    if (to) {
      added = to.d - from.d;
      denominator = to.d;
    }
  }
  if (added === null || denominator === null || denominator <= ZERO) return false;
  if (from.d + added <= ZERO) return false;
  const wrong = Rational.of(from.n + added, from.d + added);
  return student.equals(wrong) && !student.equals(from);
};

/** MC-FRAC-NO-SIMPLIFY: 결과를 약분하지 않음. */
const noSimplify: DiagnoseDetector = ({ value, raw, args }) => {
  const parts = parseRaw(raw);
  const student = studentValue({ value, raw, args });
  if (!parts || !student) return false;
  if (parts.kind !== 'fraction' && parts.kind !== 'mixed') return false;
  if (gcd(parts.n, parts.d) === ONE) return false;
  const unsimplified = parseRaw(textOf(args, 'unsimplified'));
  if (unsimplified && (unsimplified.n !== parts.n || unsimplified.d !== parts.d)) return false;
  return true;
};

/** MC-SIMPLIFY-PARTIAL: 한 번만 약분하고 멈춤. `args.unsimplified`가 필요하다. */
const simplifyPartial: DiagnoseDetector = ({ value, raw, args }) => {
  const parts = parseRaw(raw);
  const unsimplified = parseRaw(textOf(args, 'unsimplified'));
  const student = studentValue({ value, raw, args });
  if (!parts || !unsimplified || !student) return false;
  if (parts.kind !== 'fraction' && parts.kind !== 'mixed') return false;
  if (gcd(parts.n, parts.d) === ONE) return false;
  if (parts.n === unsimplified.n && parts.d === unsimplified.d) return false;
  return student.equals(Rational.of(unsimplified.n, unsimplified.d));
};

/** MC-FRAC-PART-PART: 부분/부분으로 분수를 씀. */
const partPart: DiagnoseDetector = (input) => {
  const part = integerOf(input.args, 'part');
  const whole = integerOf(input.args, 'whole');
  const student = studentValue(input);
  if (part === null || whole === null || !student) return false;
  const rest = whole - part;
  if (rest <= ZERO || whole <= ZERO || part < ZERO) return false;
  const wrong = Rational.of(part, rest);
  const correct = Rational.of(part, whole);
  return student.equals(wrong) && !student.equals(correct);
};

/** MC-COMMON-DENOM-ONLY-PRODUCT: 공통분모를 두 분모의 곱으로만 만들어 씀. */
const commonDenominatorOnlyProduct: DiagnoseDetector = (input) => {
  const a = rationalOf(input.args, 'a');
  const b = rationalOf(input.args, 'b');
  const student = studentValue(input);
  if (!a || !b || !student) return false;
  const product = a.d * b.d;
  if (lcm(a.d, b.d) >= product) return false;
  const parts = parseRaw(input.raw);
  if (!parts || (parts.kind !== 'fraction' && parts.kind !== 'mixed')) return false;
  if (parts.d !== product) return false;
  return !student.equals(a.add(b));
};

// ─────────────────────────────────────────────────────────────
// 대분수 변환
// ─────────────────────────────────────────────────────────────

function concatBigInts(left: bigint, right: bigint): bigint {
  return BigInt(`${left.toString()}${right.toString()}`);
}

/** MC-FRAC-MIXED-CONVERT: 대분수↔가분수 변환 오류. */
const mixedConvert: DiagnoseDetector = (input) => {
  const student = studentValue(input);
  if (!student) return false;

  const mixedText = textOf(input.args, 'mixed');
  if (mixedText !== null) {
    const parts = fractionPartsOf(mixedText);
    if (!parts) return false;
    const correct = Rational.of(parts.n, parts.d);
    const whole = parts.whole as bigint;
    const num = parts.num as bigint;
    const den = parts.den as bigint;
    const forgotMultiply = Rational.of(whole + num, den);
    const joined = Rational.of(concatBigInts(whole, num), den);
    const matched = student.equals(forgotMultiply) || student.equals(joined);
    return matched && !student.equals(correct);
  }

  const improper = rationalOf(input.args, 'improper');
  const parts = parseRaw(input.raw);
  if (!improper || !parts || parts.kind !== 'mixed') return false;
  const whole = parts.whole as bigint;
  const num = parts.num as bigint;
  const den = parts.den as bigint;
  if (num >= den) return true;
  const correct = improper.toMixed();
  return whole === correct.whole + ONE && num === correct.num && den === correct.den;
};

/** MC-FRAC-SEPARATE-PARTS: 분수 부분 합이 1을 넘어도 정리하지 않음. */
const separateParts: DiagnoseDetector = ({ value, raw, args }) => {
  const parts = parseRaw(raw);
  const student = studentValue({ value, raw, args });
  if (!parts || !student || parts.kind !== 'mixed') return false;
  return (parts.num as bigint) >= (parts.den as bigint);
};

// ─────────────────────────────────────────────────────────────
// 소수
// ─────────────────────────────────────────────────────────────

/** MC-DEC-ALIGN-RIGHT: 소수점 대신 오른쪽 끝을 맞춤. */
const decimalAlignRight: DiagnoseDetector = (input) => {
  const a = decimalOf(textOf(input.args, 'a'));
  const b = decimalOf(textOf(input.args, 'b'));
  const student = studentValue(input);
  if (!a || !b || !student) return false;
  const difference = a.frac.length - b.frac.length;
  if (difference === 0) return false;
  const shift = Math.abs(difference);
  const scale = Rational.of(pow10(shift));
  const wrong = difference < 0 ? a.value.div(scale).add(b.value) : a.value.add(b.value.div(scale));
  const correct = a.value.add(b.value);
  return student.equals(wrong) && !student.equals(correct);
};

/** MC-DEC-LONGER-BIGGER: 자릿수가 많으면 큰 소수라고 생각. */
const decimalLongerBigger: DiagnoseDetector = ({ value, args }) => {
  const left = decimalOf(textOf(args, 'left'));
  const right = decimalOf(textOf(args, 'right'));
  if (!left || !right || value === null) return false;
  if (left.frac.length === right.frac.length) return false;
  const predicted: Relation = left.frac.length > right.frac.length ? '>' : '<';
  const actual = relationOf(left.value, right.value);
  return value === predicted && predicted !== actual;
};

/** MC-DEC-TRAILING-ZERO: 끝자리 0이 값을 바꾼다고 생각. */
const decimalTrailingZero: DiagnoseDetector = ({ value, args }) => {
  const leftText = textOf(args, 'left');
  const rightText = textOf(args, 'right');
  const left = decimalOf(leftText);
  const right = decimalOf(rightText);
  if (!left || !right || leftText === null || rightText === null) return false;
  if (!left.value.equals(right.value)) return false;
  if (leftText.trim() === rightText.trim()) return false;
  return value === '<' || value === '>';
};

/** MC-DEC-POINT-SEPARATOR: 소수점 뒤를 별개의 자연수로 계산. */
const decimalPointSeparator: DiagnoseDetector = (input) => {
  const a = decimalOf(textOf(input.args, 'a'));
  const b = decimalOf(textOf(input.args, 'b'));
  const student = studentValue(input);
  if (!a || !b || !student) return false;
  const wholeSum = a.whole + b.whole;
  const fractionSum = BigInt(a.frac) + BigInt(b.frac);
  const digits = fractionSum.toString().length;
  const scale = pow10(digits);
  const wrong = Rational.of(wholeSum * scale + fractionSum, scale);
  const correct = a.value.add(b.value);
  return student.equals(wrong) && !student.equals(correct);
};

/** MC-FRAC-DEC-LINK: 10분의 몇과 소수를 연결하지 못함(3/10 → 3.10 또는 0.03). */
const fractionDecimalLink: DiagnoseDetector = (input) => {
  const fraction = rationalOf(input.args, 'fraction');
  const student = studentValue(input);
  if (!fraction || !student) return false;
  const denominatorDigits = fraction.d.toString();
  const scale = pow10(denominatorDigits.length);
  const joined = Rational.of(fraction.n * scale + fraction.d, scale);
  const shifted = Rational.of(fraction.n, scale);
  const matched = student.equals(joined) || student.equals(shifted);
  return matched && !student.equals(fraction);
};

/**
 * `detect: 'diagnose'`인 W1 코드의 감지 함수.
 * 엔진 조작으로만 알 수 있는 코드(예: MC-FRAC-UNEQUAL-PARTS)는 여기에 없다.
 */
const diagnoseDetectorsW1: Readonly<Record<string, DiagnoseDetector>> = {
  'MC-COMMON-DENOM-ONLY-PRODUCT': commonDenominatorOnlyProduct,
  'MC-DEC-ALIGN-RIGHT': decimalAlignRight,
  'MC-DEC-LONGER-BIGGER': decimalLongerBigger,
  'MC-DEC-POINT-SEPARATOR': decimalPointSeparator,
  'MC-DEC-TRAILING-ZERO': decimalTrailingZero,
  'MC-FRAC-ADD-DENOM': addDenominators,
  'MC-FRAC-ADD-DENOM-HALF': addDenominatorHalf,
  'MC-FRAC-ADD-NO-CONVERT-NUM': addNoConvertNumerator,
  'MC-FRAC-BIGGER-DENOM': biggerDenominator,
  'MC-FRAC-BORROW-AS-TEN': borrowAsTen,
  'MC-FRAC-DEC-LINK': fractionDecimalLink,
  'MC-FRAC-EQUIV-ADD-SAME': equivalentAddSame,
  'MC-FRAC-MIXED-CONVERT': mixedConvert,
  'MC-FRAC-NO-SIMPLIFY': noSimplify,
  'MC-FRAC-PART-PART': partPart,
  'MC-FRAC-SEPARATE-PARTS': separateParts,
  'MC-FRAC-WHOLE-MINUS': wholeMinus,
  'MC-SIMPLIFY-PARTIAL': simplifyPartial,
  'MC-SUB-SMALLER-FROM-LARGER': subSmallerFromLarger,
};

/** W1·W2 `detect: 'diagnose'` 코드의 감지 함수 전체. */
export const diagnoseDetectors: Readonly<Record<string, DiagnoseDetector>> = {
  ...diagnoseDetectorsW1,
  ...diagnoseDetectorsW2,
};
