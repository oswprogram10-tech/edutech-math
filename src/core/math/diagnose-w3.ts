/**
 * W3 오개념 감지(순수 함수).
 *
 * 학생이 고른 선택지 id(`value`)나 쓴 수(`value`), 콘텐츠가 준 `args`만 보고
 * 오개념 코드별로 참·거짓을 돌려준다. 모든 수 계산은 `Rational`(BigInt)로만
 * 한다. number 연산은 쓰지 않는다.
 *
 * 감지 함수는 '학생이 그 오개념대로 답했는가'만 본다. 학생 값이 정답과 같으면
 * 언제나 false다. args가 없거나 읽을 수 없으면 false를 돌려주고 예외를 던지지
 * 않는다.
 *
 * `detect: 'observation'` 코드(예: MC-GEO-RAY-LINE-CONFUSE)는 여기에 없다.
 * 그 코드는 엔진 predicate `hasMisconception`이나 GoalSpec이 맡는다.
 */
import type { DiagnoseDetector, DiagnoseInput } from './diagnose-shared';
import { rationalOf, recordOf, studentValue } from './diagnose-shared';
import { Rational } from './rational';

const ZERO = 0n;
const ONE = 1n;
const TWO = 2n;
const FOUR = 4n;
const TWELVE = 12n;
const HALF_CIRCLE = 180n;
const RIGHT_ANGLE = 90n;

/** `v ≠ 정답`을 모든 조건에 붙이기 위한 도우미. */
function wrongAndNotCorrect(student: Rational, wrong: Rational, correct: Rational): boolean {
  return student.equals(wrong) && !student.equals(correct);
}

/** `args.trap`(문자열 또는 문자열 배열)을 읽는다. 비었거나 형식이 다르면 null. */
function trapsOf(input: DiagnoseInput): string[] | null {
  const record = recordOf(input.args);
  if (record === null) return null;
  const value = record.trap;
  if (typeof value === 'string' && value.length > 0) return [value];
  if (!Array.isArray(value) || value.length === 0) return null;
  const traps: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) return null;
    traps.push(item);
  }
  return traps;
}

// ─────────────────────────────────────────────────────────────
// 수 감지(9개)
// ─────────────────────────────────────────────────────────────

/** MC-ANGLE-WRONG-SCALE: v = 180 − actual, actual ≠ 90. */
const angleWrongScale: DiagnoseDetector = (input) => {
  const actual = rationalOf(input.args, 'actual');
  const student = studentValue(input);
  if (actual === null || student === null) return false;
  if (actual.equals(Rational.of(RIGHT_ANGLE))) return false;
  return student.equals(Rational.of(HALF_CIRCLE).sub(actual));
};

/** MC-AREA-SLANT-SIDE: v = base × slant, slant ≠ height. */
const areaSlantSide: DiagnoseDetector = (input) => {
  const base = rationalOf(input.args, 'base');
  const height = rationalOf(input.args, 'height');
  const slant = rationalOf(input.args, 'slant');
  const student = studentValue(input);
  if (base === null || height === null || slant === null || student === null) return false;
  if (slant.equals(height)) return false;
  return wrongAndNotCorrect(student, base.mul(slant), base.mul(height));
};

/** MC-AREA-TRIANGLE-NO-HALF: v = base × height (정답은 그 절반). */
const areaTriangleNoHalf: DiagnoseDetector = (input) => {
  const base = rationalOf(input.args, 'base');
  const height = rationalOf(input.args, 'height');
  const student = studentValue(input);
  if (base === null || height === null || student === null) return false;
  const product = base.mul(height);
  return wrongAndNotCorrect(student, product, product.div(Rational.of(TWO)));
};

/** MC-CIRCLE-AREA-AS-CIRCUMFERENCE: v = 2 × radius × pi, v ≠ radius² × pi. */
const circleAreaAsCircumference: DiagnoseDetector = (input) => {
  const radius = rationalOf(input.args, 'radius');
  const pi = rationalOf(input.args, 'pi');
  const student = studentValue(input);
  if (radius === null || pi === null || student === null) return false;
  const wrong = Rational.of(TWO).mul(radius).mul(pi);
  const correct = radius.mul(radius).mul(pi);
  return wrongAndNotCorrect(student, wrong, correct);
};

/** MC-CIRCLE-AREA-RECT-WIDTH: v = 2 × expected. */
const circleAreaRectWidth: DiagnoseDetector = (input) => {
  const expected = rationalOf(input.args, 'expected');
  const student = studentValue(input);
  if (expected === null || student === null) return false;
  return wrongAndNotCorrect(student, expected.mul(Rational.of(TWO)), expected);
};

/** MC-CLOCK-HOUR-BETWEEN: 두 수 사이의 짧은바늘을 다음 시로 읽음. 12 → 1. */
const clockHourBetween: DiagnoseDetector = (input) => {
  const hour = rationalOf(input.args, 'hour');
  const student = studentValue(input);
  if (hour === null || student === null) return false;
  if (!hour.isInteger() || hour.compareTo(Rational.of(ONE)) < 0) return false;
  if (hour.compareTo(Rational.of(TWELVE)) > 0) return false;
  const next = hour.equals(Rational.of(TWELVE)) ? Rational.of(ONE) : Rational.of(hour.n + ONE);
  return student.equals(next);
};

/** MC-GEO-DIAGONAL-COUNT-DOUBLE: expected > 0이고 v = 2 × expected. */
const diagonalCountDouble: DiagnoseDetector = (input) => {
  const expected = rationalOf(input.args, 'expected');
  const student = studentValue(input);
  if (expected === null || student === null) return false;
  if (expected.compareTo(Rational.of(ZERO)) <= 0) return false;
  return wrongAndNotCorrect(student, expected.mul(Rational.of(TWO)), expected);
};

/**
 * MC-GEO-RADIUS-DIAMETER: 반지름·지름을 바꾸거나 2배 관계를 잘못 적용.
 *
 * given이 있으면 v = given이거나, given과 expected의 관계를 뒤집은 값이다.
 * given이 없으면(넓이·원주 계산) v = expected ÷ 2 또는 expected × 4다.
 */
const radiusDiameter: DiagnoseDetector = (input) => {
  const expected = rationalOf(input.args, 'expected');
  const student = studentValue(input);
  if (expected === null || student === null) return false;
  if (student.equals(expected)) return false;

  const given = rationalOf(input.args, 'given');
  if (given !== null) {
    const doubled = given.mul(Rational.of(TWO));
    const halved = given.div(Rational.of(TWO));
    const opposite = expected.equals(doubled) ? halved : expected.equals(halved) ? doubled : null;
    return student.equals(given) || (opposite !== null && student.equals(opposite));
  }

  return (
    student.equals(expected.div(Rational.of(TWO))) ||
    student.equals(expected.mul(Rational.of(FOUR)))
  );
};

/** MC-SHAPE-VERTEX-COUNT: v가 정수이고 expected보다 큼. */
const shapeVertexCount: DiagnoseDetector = (input) => {
  const expected = rationalOf(input.args, 'expected');
  const student = studentValue(input);
  if (expected === null || student === null) return false;
  if (!student.isInteger()) return false;
  return student.compareTo(expected) > 0;
};

// ─────────────────────────────────────────────────────────────
// 고르기 감지(10개)
// ─────────────────────────────────────────────────────────────

/**
 * 고르기 응답 감지. `args.trap`은 오개념 선택지 id(문자열 또는 문자열 배열)다.
 * `args.expected`가 있으면 그 선택지는 정답이므로 감지하지 않는다.
 */
const trapChoice: DiagnoseDetector = (input) => {
  if (input.value === null) return false;
  const traps = trapsOf(input);
  if (traps === null) return false;
  const expected = recordOf(input.args)?.expected;
  if (typeof expected === 'string' && input.value === expected) return false;
  return traps.includes(input.value);
};

/**
 * `detect: 'diagnose'`인 W3 코드의 감지 함수(19개).
 * 엔진 조작으로만 알 수 있는 observation 코드는 여기에 없다.
 */
export const diagnoseDetectorsW3: Readonly<Record<string, DiagnoseDetector>> = {
  'MC-ANGLE-SIDE-LENGTH': trapChoice,
  'MC-ANGLE-SUM-SHAPE-DEPENDENT': trapChoice,
  'MC-ANGLE-WRONG-SCALE': angleWrongScale,
  'MC-AREA-SLANT-SIDE': areaSlantSide,
  'MC-AREA-TRIANGLE-NO-HALF': areaTriangleNoHalf,
  'MC-AREA-UNIT-CONFUSION': trapChoice,
  'MC-CIRCLE-AREA-AS-CIRCUMFERENCE': circleAreaAsCircumference,
  'MC-CIRCLE-AREA-RECT-WIDTH': circleAreaRectWidth,
  'MC-CIRCLE-PI-EXACT': trapChoice,
  'MC-CLOCK-HOUR-BETWEEN': clockHourBetween,
  'MC-CONG-SIZE-ONLY': trapChoice,
  'MC-GEO-DIAGONAL-COUNT-DOUBLE': diagonalCountDouble,
  'MC-GEO-EQUI-NOT-ISO': trapChoice,
  'MC-GEO-PARALLELOGRAM-NOT-TRAPEZOID': trapChoice,
  'MC-GEO-RADIUS-DIAMETER': radiusDiameter,
  'MC-GEO-SQUARE-NOT-RECT': trapChoice,
  'MC-PERIMETER-AREA-SAME': trapChoice,
  'MC-SHAPE-ORIENTATION': trapChoice,
  'MC-SHAPE-VERTEX-COUNT': shapeVertexCount,
};
