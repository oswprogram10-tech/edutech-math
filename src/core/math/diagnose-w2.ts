/**
 * W2 오개념 감지(순수 함수).
 *
 * 학생이 쓴 값(`response.<id>.value`)과 학생이 쓴 표기(`raw`), 콘텐츠가 준
 * `args`(문제의 수)만 보고 오개념 코드별로 참·거짓을 돌려준다. 모든 수 계산은
 * `Rational`(BigInt)로만 한다. number 연산은 쓰지 않는다.
 *
 * 감지 함수는 '학생이 그 오개념대로 답했는가'만 본다. 학생 값이 정답과 같으면
 * 언제나 false다. args가 없거나 읽을 수 없으면 false를 돌려주고 예외를 던지지
 * 않는다.
 *
 * `detect: 'observation'` 코드(예: MC-DIV-BRING-DOWN)는 여기에 없다. 그 코드는
 * 엔진 predicate `hasMisconception`이나 GoalSpec이 맡는다.
 */
import type { DiagnoseInput, DiagnoseDetector } from './diagnose-shared';
import { integerOf, rationalOf, studentValue, textOf } from './diagnose-shared';
import { Rational } from './rational';

const ZERO = 0n;
const ONE = 1n;
const NINE = 9n;
const TEN = 10n;

type Relation = '<' | '=' | '>';

function absBig(value: bigint): bigint {
  return value < ZERO ? -value : value;
}

/** 두 정수의 최대공약수. */
function gcdBig(left: bigint, right: bigint): bigint {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== ZERO) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

/** 두 정수의 최소공배수(0이면 0). */
function lcmBig(left: bigint, right: bigint): bigint {
  if (left === ZERO || right === ZERO) return ZERO;
  return (left / gcdBig(left, right)) * right;
}

/** 10의 거듭제곱. 지수는 작은 자연수만 온다. */
function pow10(exponent: bigint): bigint {
  return TEN ** exponent;
}

function studentInteger(input: DiagnoseInput): bigint | null {
  const student = studentValue(input);
  return student !== null && student.isInteger() ? student.n : null;
}

/** 정규 문자열을 Rational로 읽는다. 실패하면 null. */
function rationalText(text: string | null): Rational | null {
  if (text === null) return null;
  try {
    return Rational.parse(text.trim());
  } catch {
    return null;
  }
}

function relationOfBig(left: bigint, right: bigint): Relation {
  return left < right ? '<' : left > right ? '>' : '=';
}

/** `args`의 문자열 배열. 하나라도 문자열이 아니면 null. */
function stringsOf(args: unknown, key: string): string[] | null {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return null;
  const value = (args as Readonly<Record<string, unknown>>)[key];
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) return null;
    out.push(item);
  }
  return out;
}

/** 음이 아닌 정수 문자열. */
function naturalText(text: string): bigint | null {
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

function digitsOf(value: bigint): string {
  return value.toString();
}

function digitAtFromRight(value: bigint, place: number): bigint {
  const text = digitsOf(value);
  if (place < 0 || place >= text.length) return ZERO;
  return BigInt(text.charAt(text.length - 1 - place));
}

function digitSum(value: bigint): bigint {
  let total = ZERO;
  for (const char of digitsOf(value)) total += BigInt(char);
  return total;
}

/**
 * `expected` 숫자열에서 0을 하나 이상 뺀 수들의 표기 목록.
 *
 * - `mode: 'any'`: 어느 자리의 0이든 뺀다(BIGNUM-ZERO-PLACE·PV-ZERO).
 * - `mode: 'interior'`: 양쪽에 0이 아닌 숫자가 있는 0만 뺀다(DIV-QUOTIENT-ZERO).
 *
 * 소수점 위치는 숫자열에서 그대로 둔다. `2.08`에서 가운데 0을 빼면 `2.8`이다.
 */
function zeroRemovedCandidates(text: string, mode: 'any' | 'interior'): string[] {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (match === null) return [];
  const intPart = match[1] as string;
  const fracPart = match[2] ?? '';
  const digits = intPart + fracPart;
  const point = intPart.length;

  const removable: number[] = [];
  for (let index = 0; index < digits.length; index += 1) {
    if (digits.charAt(index) !== '0') continue;
    if (mode === 'any') {
      removable.push(index);
      continue;
    }
    const hasLeft = /[1-9]/.test(digits.slice(0, index));
    const hasRight = /[1-9]/.test(digits.slice(index + 1));
    if (hasLeft && hasRight) removable.push(index);
  }
  if (removable.length === 0) return [];
  // 0이 아주 많으면 후보가 폭발한다. 문제의 수는 짧으므로 안전 상한을 둔다.
  if (removable.length > 12) return [];

  const results = new Set<string>();
  const total = 1 << removable.length;
  for (let mask = 1; mask < total; mask += 1) {
    const removed = new Set<number>();
    for (let bit = 0; bit < removable.length; bit += 1) {
      if ((mask & (1 << bit)) !== 0) removed.add(removable[bit] as number);
    }
    const kept = digits
      .split('')
      .filter((_char, index) => !removed.has(index))
      .join('');
    let removedBeforePoint = 0;
    for (const index of removed) {
      if (index < point) removedBeforePoint += 1;
    }
    const newPoint = point - removedBeforePoint;
    if (newPoint <= 0) {
      results.add(`0.${'0'.repeat(-newPoint)}${kept}`);
    } else if (newPoint >= kept.length) {
      results.add(kept + '0'.repeat(newPoint - kept.length));
    } else {
      results.add(`${kept.slice(0, newPoint)}.${kept.slice(newPoint)}`);
    }
  }
  return [...results];
}

function matchesAny(student: Rational, candidates: readonly string[]): boolean {
  for (const candidate of candidates) {
    const value = rationalText(candidate);
    if (value !== null && student.equals(value)) return true;
  }
  return false;
}

/** v = expected ± 1 (10을 넘긴 뒤 1 차이, 수직선 출발점, 10의 짝꿍). */
function offByOne(input: DiagnoseInput, expected: bigint | null): boolean {
  const student = studentInteger(input);
  if (expected === null || student === null) return false;
  const difference = absBig(student - expected);
  return difference === ONE;
}

// ─────────────────────────────────────────────────────────────
// 수 세기·10 만들기·자료
// ─────────────────────────────────────────────────────────────

/** MC-ADD-BRIDGE-OFF-BY-ONE: |v − (a+b)| = 1. */
const addBridgeOffByOne: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  const sum = a + b;
  const difference = student.sub(Rational.of(sum));
  return (
    (difference.equals(Rational.of(ONE)) || difference.equals(Rational.of(-ONE))) &&
    !student.equals(Rational.of(sum))
  );
};

/** MC-CHART-ROW-COL: v = neighbor ± 1. */
const chartRowColumn: DiagnoseDetector = (input) => {
  const neighbor = integerOf(input.args, 'neighbor');
  const expected = integerOf(input.args, 'expected');
  const student = studentValue(input);
  if (neighbor === null || expected === null || student === null) return false;
  const value = student.isInteger() ? student.n : null;
  if (value === null) return false;
  const nearNeighbor = value === neighbor + ONE || value === neighbor - ONE;
  return nearNeighbor && !student.equals(Rational.of(expected));
};

/** MC-COUNT-ONE-TO-ONE: 1 ≤ |v − total| ≤ 2. */
const countOneToOne: DiagnoseDetector = (input) => {
  const total = integerOf(input.args, 'total');
  const student = studentInteger(input);
  if (total === null || student === null) return false;
  const difference = absBig(student - total);
  return difference >= ONE && difference <= 2n;
};

/** MC-JUMP-COUNT-START: |v − expected| = 1. */
const jumpCountStart: DiagnoseDetector = (input) => {
  return offByOne(input, integerOf(input.args, 'expected'));
};

/** MC-MAKE10-PAIR: |v − expected| = 1. */
const make10Pair: DiagnoseDetector = (input) => {
  return offByOne(input, integerOf(input.args, 'expected'));
};

/** MC-MAKE10-SPLIT: 1 ≤ v < addend이고 v ≠ 10 − left. */
const make10Split: DiagnoseDetector = (input) => {
  const left = integerOf(input.args, 'left');
  const addend = integerOf(input.args, 'addend');
  const student = studentInteger(input);
  if (left === null || addend === null || student === null) return false;
  if (addend <= ONE) return false;
  const correct = TEN - left;
  return student >= ONE && student < addend && student !== correct;
};

/** MC-THREE-ADDEND-SKIP: v = 세 수 중 두 수의 합. */
const threeAddendSkip: DiagnoseDetector = (input) => {
  const addends = stringsOf(input.args, 'addends');
  const student = studentValue(input);
  if (addends === null || student === null || addends.length !== 3) return false;
  const values: bigint[] = [];
  for (const text of addends) {
    const value = naturalText(text);
    if (value === null) return false;
    values.push(value);
  }
  const first = values[0] as bigint;
  const second = values[1] as bigint;
  const third = values[2] as bigint;
  const total = first + second + third;
  if (student.equals(Rational.of(total))) return false;
  return (
    student.equals(Rational.of(first + second)) ||
    student.equals(Rational.of(second + third)) ||
    student.equals(Rational.of(first + third))
  );
};

// ─────────────────────────────────────────────────────────────
// 큰 수·자릿값
// ─────────────────────────────────────────────────────────────

/** MC-BIGNUM-FIRST-DIGIT: 맨 앞 숫자끼리만 비교. */
const bignumFirstDigit: DiagnoseDetector = ({ value, args }) => {
  if (value !== '<' && value !== '=' && value !== '>') return false;
  const left = integerOf(args, 'left');
  const right = integerOf(args, 'right');
  if (left === null || right === null || left < ZERO || right < ZERO) return false;
  const leftText = digitsOf(left);
  const rightText = digitsOf(right);
  if (leftText.length === rightText.length) return false;
  const leftFirst = leftText.charAt(0);
  const rightFirst = rightText.charAt(0);
  if (leftFirst.length === 0 || rightFirst.length === 0) return false;
  if (leftFirst === rightFirst) return false;
  const predicted: Relation = leftFirst > rightFirst ? '>' : '<';
  const actual = relationOfBig(left, right);
  return value === predicted && predicted !== actual;
};

/** MC-BIGNUM-ZERO-PLACE: 0을 하나 이상 뺀 수와 같음. */
const bignumZeroPlace: DiagnoseDetector = ({ value, args }) => {
  const expectedText = textOf(args, 'expected');
  const student = studentValue({ value, raw: null, args });
  const expected = rationalText(expectedText);
  if (expectedText === null || student === null || expected === null) return false;
  if (student.equals(expected)) return false;
  return matchesAny(student, zeroRemovedCandidates(expectedText, 'any'));
};

/** MC-PV-ZERO: BIGNUM-ZERO-PLACE와 같은 도우미. */
const placeValueZero: DiagnoseDetector = ({ value, args }) => {
  const expectedText = textOf(args, 'expected');
  const student = studentValue({ value, raw: null, args });
  const expected = rationalText(expectedText);
  if (expectedText === null || student === null || expected === null) return false;
  if (student.equals(expected)) return false;
  return matchesAny(student, zeroRemovedCandidates(expectedText, 'any'));
};

/** MC-COMPARE-DIGIT-COUNT: 숫자 합이나 끝자리로 크기 비교. */
const compareDigitCount: DiagnoseDetector = ({ value, args }) => {
  if (value !== '<' && value !== '=' && value !== '>') return false;
  const left = integerOf(args, 'left');
  const right = integerOf(args, 'right');
  if (left === null || right === null || left < ZERO || right < ZERO) return false;
  const actual = relationOfBig(left, right);
  if (value === actual) return false;
  const predictions = new Set<Relation>([
    relationOfBig(digitSum(left), digitSum(right)),
    relationOfBig(left % TEN, right % TEN),
  ]);
  return predictions.has(value);
};

/** MC-PV-DIGIT-FACE: 자릿값을 무시하고 숫자 낱개로 봄. */
const placeValueDigitFace: DiagnoseDetector = (input) => {
  const digit = integerOf(input.args, 'digit');
  const place = integerOf(input.args, 'place');
  const student = studentValue(input);
  if (digit === null || place === null || student === null) return false;
  if (place < ONE || digit < ZERO) return false;
  const correct = digit * pow10(place);
  return student.equals(Rational.of(digit)) && !student.equals(Rational.of(correct));
};

/** MC-PV-MIXED-UNITS: 모든 숫자를 낱개처럼 더함. */
const placeValueMixedUnits: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null || a < ZERO || b < ZERO) return false;
  const wrong = digitSum(a) + digitSum(b);
  const correct = a + b;
  return student.equals(Rational.of(wrong)) && !student.equals(Rational.of(correct));
};

/** MC-PV-NO-CARRY: 자리마다 계산한 값을 받아올림 없이 이어 붙임. */
const placeValueNoCarry: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const operation = textOf(input.args, 'op');
  const student = studentValue(input);
  if (a === null || b === null || operation === null || student === null) return false;
  if (a < ZERO || b < ZERO) return false;

  const aText = digitsOf(a);
  const bText = digitsOf(b);
  const digits: string[] = [];
  if (operation === 'add') {
    const length = Math.max(aText.length, bText.length);
    for (let index = 0; index < length; index += 1) {
      const place = length - 1 - index;
      const digitA = digitAtFromRight(a, place);
      const digitB = digitAtFromRight(b, place);
      digits.push(((digitA + digitB) % TEN).toString());
    }
  } else if (operation === 'mul') {
    if (bText.length !== 1) return false;
    for (const char of aText) {
      digits.push(((BigInt(char) * b) % TEN).toString());
    }
  } else {
    return false;
  }

  const wrongText = digits.join('').replace(/^0+(?=\d)/, '');
  if (wrongText.length === 0) return false;
  const wrong = BigInt(wrongText);
  const correct = operation === 'add' ? a + b : a * b;
  return student.equals(Rational.of(wrong)) && !student.equals(Rational.of(correct));
};

/** MC-PV-NONCANON: 자리 묶음을 그대로 이어 붙임. */
const placeValueNonCanonical: DiagnoseDetector = (input) => {
  const parts = stringsOf(input.args, 'parts');
  const student = studentValue(input);
  if (parts === null || student === null || parts.length < 2) return false;
  const values: bigint[] = [];
  for (const part of parts) {
    const value = naturalText(part);
    if (value === null) return false;
    values.push(value);
  }
  if (!values.some((value) => value >= TEN)) return false;

  const joined = parts.join('');
  if (!/^\d+$/.test(joined)) return false;
  const wrong = BigInt(joined);
  let correct = ZERO;
  for (let index = 0; index < values.length; index += 1) {
    correct += (values[index] as bigint) * pow10(BigInt(values.length - 1 - index));
  }
  return student.equals(Rational.of(wrong)) && !student.equals(Rational.of(correct));
};

/** MC-PV-BORROW-ACROSS-ZERO: 0을 건너 받아내림을 실패해 10^k만큼 큼. */
const placeValueBorrowAcrossZero: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentInteger(input);
  if (a === null || b === null || student === null) return false;
  if (a < ZERO || b < ZERO || a < b) return false;
  const correct = a - b;
  if (student === correct) return false;
  const difference = student - correct;
  if (difference <= ZERO) return false;
  const differenceText = difference.toString();
  if (!/^1(0+)$/.test(differenceText)) return false;
  const exponent = differenceText.length - 1;
  return digitAtFromRight(a, exponent) === ZERO;
};

// ─────────────────────────────────────────────────────────────
// 덧셈·뺄셈·곱셈
// ─────────────────────────────────────────────────────────────

/** MC-SUB-DIRECTION: 뺄셈에서 더하거나 뺀 수를 답함. */
const subtractionDirection: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  const correct = a - b;
  if (student.equals(Rational.of(correct))) return false;
  return student.equals(Rational.of(a + b)) || student.equals(Rational.of(b));
};

/** MC-EQUAL-ANSWER: □ + a = b에서 v = a + b. */
const equalAnswer: DiagnoseDetector = (input) => {
  const a = rationalOf(input.args, 'a');
  const b = rationalOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  return student.equals(a.add(b)) && !student.equals(b.sub(a));
};

/** MC-MUL-ADD-CONFUSE: 곱셈을 덧셈으로. */
const mulAddConfuse: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  return student.equals(Rational.of(a + b)) && !student.equals(Rational.of(a * b));
};

/** MC-MUL-CARRY-ADD-BEFORE: 받아올림 수를 곱하기 전에 더함. */
const mulCarryAddBefore: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  if (a < ZERO || b < ZERO || b > NINE) return false;

  const aDigits = digitsOf(a).split('').reverse();
  let carry = ZERO;
  const lowToHigh: string[] = [];
  for (const char of aDigits) {
    const total = (BigInt(char) + carry) * b;
    lowToHigh.push((total % TEN).toString());
    carry = total / TEN;
  }
  const highToLow = lowToHigh.reverse().join('');
  const wrongText = (carry === ZERO ? '' : carry.toString()) + highToLow;
  if (wrongText.length === 0) return false;
  const wrong = BigInt(wrongText);
  return student.equals(Rational.of(wrong)) && !student.equals(Rational.of(a * b));
};

/** MC-MUL-FACT-NEIGHBOR: 이웃 곱과 혼동. */
const mulFactNeighbor: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  const correct = a * b;
  if (student.equals(Rational.of(correct))) return false;
  const candidates = [a * (b - ONE), a * (b + ONE), (a - ONE) * b, (a + ONE) * b];
  return candidates.some((value) => value >= ZERO && student.equals(Rational.of(value)));
};

/** MC-MUL-NO-PLACE-VALUE: 자릿값 없이 각 숫자만 곱함. */
const mulNoPlaceValue: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  if (a < TEN || b < ZERO || b > NINE) return false;
  let wrong = ZERO;
  for (const char of digitsOf(a)) wrong += BigInt(char) * b;
  return student.equals(Rational.of(wrong)) && !student.equals(Rational.of(a * b));
};

/** 자리별 조각: 0이 아닌 자리값 목록. */
function placePieces(value: bigint): bigint[] {
  const text = digitsOf(value);
  const pieces: bigint[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const digit = BigInt(text.charAt(index));
    if (digit === ZERO) continue;
    pieces.push(digit * pow10(BigInt(text.length - 1 - index)));
  }
  return pieces;
}

/** MC-MUL-PARTIAL-MISSING: 자리별 조각을 일부만 더함. */
const mulPartialMissing: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  if (a <= ZERO || b <= ZERO) return false;
  const pieces: bigint[] = [];
  for (const pieceA of placePieces(a)) {
    for (const pieceB of placePieces(b)) pieces.push(pieceA * pieceB);
  }
  if (pieces.length < 2) return false;
  const sums = new Set<bigint>([ZERO]);
  for (const piece of pieces) {
    const next = new Set(sums);
    for (const sum of sums) next.add(sum + piece);
    sums.clear();
    for (const sum of next) sums.add(sum);
  }
  const correct = a * b;
  for (const sum of sums) {
    if (sum === ZERO || sum === correct) continue;
    if (student.equals(Rational.of(sum))) return true;
  }
  return false;
};

/** MC-MUL-PARTIAL-SHIFT: 둘째 부분곱을 자릿값만큼 밀지 않음. */
const mulPartialShift: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  if (a < ZERO || b < TEN) return false;
  let wrong = ZERO;
  for (const char of digitsOf(b)) wrong += a * BigInt(char);
  return student.equals(Rational.of(wrong)) && !student.equals(Rational.of(a * b));
};

/** MC-MUL-SPLIT-PARTIAL-DROP: 쪼갠 두 부분 중 하나만 계산. */
const mulSplitPartialDrop: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const parts = stringsOf(input.args, 'parts');
  const student = studentValue(input);
  if (a === null || parts === null || student === null || parts.length !== 2) return false;
  const first = naturalText(parts[0] as string);
  const second = naturalText(parts[1] as string);
  if (first === null || second === null) return false;
  const correct = a * (first + second);
  if (student.equals(Rational.of(correct))) return false;
  return student.equals(Rational.of(a * first)) || student.equals(Rational.of(a * second));
};

/** MC-MUL-ZERO-ONE: 0·1의 곱을 잘못 계산. */
const mulZeroOne: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  const involvesZeroOrOne = a === ZERO || a === ONE || b === ZERO || b === ONE;
  if (!involvesZeroOrOne) return false;
  const correct = a * b;
  if (student.equals(Rational.of(correct))) return false;
  const candidates = [a + b, a, b];
  return candidates.some((value) => student.equals(Rational.of(value)));
};

// ─────────────────────────────────────────────────────────────
// 나눗셈·약수·배수·분수
// ─────────────────────────────────────────────────────────────

/** MC-DIV-CHECK-NO-REMAINDER: 검산에서 나머지를 더하지 않음. */
const divCheckNoRemainder: DiagnoseDetector = (input) => {
  const quotient = rationalOf(input.args, 'quotient');
  const divisor = rationalOf(input.args, 'divisor');
  const remainder = rationalOf(input.args, 'remainder');
  const student = studentValue(input);
  if (quotient === null || divisor === null || remainder === null || student === null) {
    return false;
  }
  if (remainder.equals(Rational.of(ZERO))) return false;
  const wrong = quotient.mul(divisor);
  const correct = wrong.add(remainder);
  return student.equals(wrong) && !student.equals(correct);
};

/** MC-DIV-ORDER-SWAP: 나누어지는 수와 나누는 수를 바꿈. */
const divOrderSwap: DiagnoseDetector = (input) => {
  const dividend = integerOf(input.args, 'dividend');
  const divisor = integerOf(input.args, 'divisor');
  const student = studentValue(input);
  if (dividend === null || divisor === null || student === null) return false;
  if (dividend === ZERO || divisor === ZERO) return false;
  const wrong = Rational.of(divisor).div(Rational.of(dividend));
  const correct = Rational.of(dividend).div(Rational.of(divisor));
  return student.equals(wrong) && !student.equals(correct);
};

/** MC-DIV-QUOTIENT-ZERO: 가운데 0을 하나 이상 뺀 값. */
const divQuotientZero: DiagnoseDetector = ({ value, args }) => {
  const expectedText = textOf(args, 'expected');
  const student = studentValue({ value, raw: null, args });
  const expected = rationalText(expectedText);
  if (expectedText === null || student === null || expected === null) return false;
  if (student.equals(expected)) return false;
  return matchesAny(student, zeroRemovedCandidates(expectedText, 'interior'));
};

/** MC-DIV-REMAINDER-SCALED: 나머지를 확대된 수 그대로 씀. */
const divRemainderScaled: DiagnoseDetector = (input) => {
  const remainder = rationalOf(input.args, 'remainder');
  const scale = rationalOf(input.args, 'scale');
  const student = studentValue(input);
  if (remainder === null || scale === null || student === null) return false;
  if (scale.equals(Rational.of(ONE))) return false;
  const wrong = remainder.mul(scale);
  return student.equals(wrong) && !student.equals(remainder);
};

/** MC-DIV-REMAINDER-TOO-BIG: v ≥ divisor. */
const divRemainderTooBig: DiagnoseDetector = (input) => {
  const divisor = integerOf(input.args, 'divisor');
  const student = studentValue(input);
  if (divisor === null || divisor <= ZERO || student === null) return false;
  return student.compareTo(Rational.of(divisor)) >= 0;
};

/** MC-FACTOR-MULTIPLE-SWAP: n의 배수를 n보다 큰 수로 답함. */
const factorMultipleSwap: DiagnoseDetector = (input) => {
  const n = integerOf(input.args, 'n');
  const student = studentInteger(input);
  if (n === null || student === null || n <= ZERO) return false;
  return student > n && student % n === ZERO;
};

/** MC-GCD-LCM-SWAP: 묻지 않은 쪽을 답함. */
const gcdLcmSwap: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const asked = textOf(input.args, 'asked');
  const student = studentValue(input);
  if (a === null || b === null || asked === null || student === null) return false;
  if (a <= ZERO || b <= ZERO) return false;
  const common = gcdBig(a, b);
  const multiple = lcmBig(a, b);
  if (common === multiple) return false;
  const wrong = asked === 'gcd' ? multiple : asked === 'lcm' ? common : null;
  if (wrong === null) return false;
  return student.equals(Rational.of(wrong));
};

/** MC-LCM-AS-PRODUCT: 최소공배수를 두 수의 곱으로. */
const lcmAsProduct: DiagnoseDetector = (input) => {
  const a = integerOf(input.args, 'a');
  const b = integerOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  if (a <= ZERO || b <= ZERO) return false;
  const product = a * b;
  if (product === lcmBig(a, b)) return false;
  return student.equals(Rational.of(product));
};

/** MC-FRAC-DIV-INVERT-WRONG: 피제수를 뒤집거나 둘 다 뒤집음. */
const fracDivInvertWrong: DiagnoseDetector = (input) => {
  const dividend = rationalOf(input.args, 'dividend');
  const divisor = rationalOf(input.args, 'divisor');
  const student = studentValue(input);
  if (dividend === null || divisor === null || student === null) return false;
  if (dividend.n === ZERO || divisor.n === ZERO) return false;
  const invertedDividend = Rational.of(dividend.d, dividend.n);
  const invertedDivisor = Rational.of(divisor.d, divisor.n);
  const wrongBoth = invertedDividend.mul(invertedDivisor);
  const wrongDividend = invertedDividend.mul(divisor);
  const correct = dividend.div(divisor);
  return (student.equals(wrongBoth) || student.equals(wrongDividend)) && !student.equals(correct);
};

/** MC-FRAC-DIV-MULT-DENOM-WRONG: ÷n에서 분자에 n을 곱함. */
const fracDivMultDenominatorWrong: DiagnoseDetector = (input) => {
  const fraction = rationalOf(input.args, 'fraction');
  const n = rationalOf(input.args, 'n');
  const student = studentValue(input);
  if (fraction === null || n === null || student === null) return false;
  if (n.n === ZERO) return false;
  return student.equals(fraction.mul(n)) && !student.equals(fraction.div(n));
};

/** MC-FRAC-MULT-WHOLE-BOTH: (자연수)×(분수)에서 분모는 그대로 둠. */
const fracMultWholeBoth: DiagnoseDetector = (input) => {
  const fraction = rationalOf(input.args, 'fraction');
  const n = rationalOf(input.args, 'n');
  const student = studentValue(input);
  if (fraction === null || n === null || student === null) return false;
  if (n.equals(Rational.of(ONE))) return false;
  return student.equals(fraction) && !student.equals(fraction.mul(n));
};

/** MC-DEC-POINT-PLACEMENT: v = expected × 10^k (k ≠ 0, |k| ≤ 3). */
const decimalPointPlacement: DiagnoseDetector = (input) => {
  const expected = rationalOf(input.args, 'expected');
  const student = studentValue(input);
  if (expected === null || student === null) return false;
  if (student.equals(expected)) return false;
  for (let exponent = -3; exponent <= 3; exponent += 1) {
    if (exponent === 0) continue;
    const magnitude = pow10(BigInt(Math.abs(exponent)));
    const shifted =
      exponent > 0
        ? expected.mul(Rational.of(magnitude))
        : expected.mul(Rational.of(ONE, magnitude));
    if (student.equals(shifted)) return true;
  }
  return false;
};

/** MC-DEC-SHIFT-POINT-MOVES: ×10을 0 붙이기로 처리해 값이 그대로. */
const decimalShiftPointMoves: DiagnoseDetector = (input) => {
  const original = rationalOf(input.args, 'original');
  const expected = rationalOf(input.args, 'expected');
  const student = studentValue(input);
  if (original === null || expected === null || student === null) return false;
  return student.equals(original) && !student.equals(expected);
};

/**
 * `detect: 'diagnose'`인 W2 코드의 감지 함수(39개).
 * 엔진 조작으로만 알 수 있는 observation 코드는 여기에 없다.
 */
export const diagnoseDetectorsW2: Readonly<Record<string, DiagnoseDetector>> = {
  'MC-ADD-BRIDGE-OFF-BY-ONE': addBridgeOffByOne,
  'MC-BIGNUM-FIRST-DIGIT': bignumFirstDigit,
  'MC-BIGNUM-ZERO-PLACE': bignumZeroPlace,
  'MC-CHART-ROW-COL': chartRowColumn,
  'MC-COMPARE-DIGIT-COUNT': compareDigitCount,
  'MC-COUNT-ONE-TO-ONE': countOneToOne,
  'MC-DEC-POINT-PLACEMENT': decimalPointPlacement,
  'MC-DEC-SHIFT-POINT-MOVES': decimalShiftPointMoves,
  'MC-DIV-CHECK-NO-REMAINDER': divCheckNoRemainder,
  'MC-DIV-ORDER-SWAP': divOrderSwap,
  'MC-DIV-QUOTIENT-ZERO': divQuotientZero,
  'MC-DIV-REMAINDER-SCALED': divRemainderScaled,
  'MC-DIV-REMAINDER-TOO-BIG': divRemainderTooBig,
  'MC-EQUAL-ANSWER': equalAnswer,
  'MC-FACTOR-MULTIPLE-SWAP': factorMultipleSwap,
  'MC-FRAC-DIV-INVERT-WRONG': fracDivInvertWrong,
  'MC-FRAC-DIV-MULT-DENOM-WRONG': fracDivMultDenominatorWrong,
  'MC-FRAC-MULT-WHOLE-BOTH': fracMultWholeBoth,
  'MC-GCD-LCM-SWAP': gcdLcmSwap,
  'MC-JUMP-COUNT-START': jumpCountStart,
  'MC-LCM-AS-PRODUCT': lcmAsProduct,
  'MC-MAKE10-PAIR': make10Pair,
  'MC-MAKE10-SPLIT': make10Split,
  'MC-MUL-ADD-CONFUSE': mulAddConfuse,
  'MC-MUL-CARRY-ADD-BEFORE': mulCarryAddBefore,
  'MC-MUL-FACT-NEIGHBOR': mulFactNeighbor,
  'MC-MUL-NO-PLACE-VALUE': mulNoPlaceValue,
  'MC-MUL-PARTIAL-MISSING': mulPartialMissing,
  'MC-MUL-PARTIAL-SHIFT': mulPartialShift,
  'MC-MUL-SPLIT-PARTIAL-DROP': mulSplitPartialDrop,
  'MC-MUL-ZERO-ONE': mulZeroOne,
  'MC-PV-BORROW-ACROSS-ZERO': placeValueBorrowAcrossZero,
  'MC-PV-DIGIT-FACE': placeValueDigitFace,
  'MC-PV-MIXED-UNITS': placeValueMixedUnits,
  'MC-PV-NO-CARRY': placeValueNoCarry,
  'MC-PV-NONCANON': placeValueNonCanonical,
  'MC-PV-ZERO': placeValueZero,
  'MC-SUB-DIRECTION': subtractionDirection,
  'MC-THREE-ADDEND-SKIP': threeAddendSkip,
};
