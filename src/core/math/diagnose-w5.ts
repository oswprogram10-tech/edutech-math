/**
 * W5 오개념 감지(순수 함수).
 *
 * 학생이 쓴 수·고른 선택지 id(`value`)와 콘텐츠가 준 `args`만 보고 오개념
 * 코드별로 참·거짓을 돌려준다. 모든 수 계산은 `Rational`(BigInt)로만 한다.
 *
 * 감지 함수는 '학생이 그 오개념대로 답했는가'만 본다. args `expected`가 있고
 * 학생 값이 그것과 같으면 언제나 false다. args가 없거나 읽을 수 없으면 false를
 * 돌려주고 예외를 던지지 않는다.
 *
 * `detect: 'observation'` 코드(예: MC-PATTERN-CORE)는 여기에 없다. 그 코드는
 * 엔진 predicate `hasMisconception`이나 GoalSpec이 맡는다.
 */
import type { DiagnoseDetector, DiagnoseInput } from './diagnose-shared';
import { rationalOf, recordOf, studentValue, trapChoice, trapsOf } from './diagnose-shared';
import { Rational } from './rational';

const ZERO = 0n;
const TWO = 2n;

/** args `expected`가 있고 v와 같으면 true(정답이므로 감지하지 않는다). */
function isExpected(input: DiagnoseInput, student: Rational): boolean {
  const expected = rationalOf(input.args, 'expected');
  return expected !== null && student.equals(expected);
}

/** `args[key]`(문자열 배열)를 Rational 목록으로 읽는다. 비었거나 읽을 수 없으면 null. */
function rationalListOf(args: unknown, key: string): Rational[] | null {
  const value = recordOf(args)?.[key];
  if (!Array.isArray(value) || value.length === 0) return null;
  const list: Rational[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    try {
      list.push(Rational.parse(item));
    } catch {
      return null;
    }
  }
  return list;
}

function sortedAscending(list: readonly Rational[]): Rational[] {
  return [...list].sort((left, right) => left.compareTo(right));
}

function sumOf(list: readonly Rational[]): Rational {
  return list.reduce((total, item) => total.add(item), Rational.of(ZERO));
}

/** `args[key]`와 같은 값을 쓴 오개념. 정답(expected)과 같으면 제외. */
function sameAsArg(key: string): DiagnoseDetector {
  return (input) => {
    const wrong = rationalOf(input.args, key);
    const student = studentValue(input);
    if (wrong === null || student === null) return false;
    if (isExpected(input, student)) return false;
    return student.equals(wrong);
  };
}

// ─────────────────────────────────────────────────────────────
// 수 감지(공식 7개 + 함정 6개)
// ─────────────────────────────────────────────────────────────

/** MC-PATTERN-LAST-ONLY: v = last(직전 항을 그대로 씀). */
const patternLastOnly = sameAsArg('last');

/** MC-PATTERN-GROWTH-TOTAL: v = increment(전체 대신 늘어난 양). */
const patternGrowthTotal = sameAsArg('increment');

/** MC-GRAPH-ICON-VALUE: v = icons(그림 개수만 셈). */
const graphIconValue = sameAsArg('icons');

/** MC-GRAPH-SCALE-ONE: v = cells(칸 수를 값으로 읽음), cells ≠ expected. */
const graphScaleOne = sameAsArg('cells');

/** MC-MEAN-SUM-ONLY: v = 합, 합 ≠ 평균. */
const meanSumOnly: DiagnoseDetector = (input) => {
  const values = rationalListOf(input.args, 'values');
  const student = studentValue(input);
  if (values === null || student === null) return false;
  if (isExpected(input, student)) return false;
  const sum = sumOf(values);
  const mean = sum.div(Rational.of(values.length));
  return student.equals(sum) && !student.equals(mean);
};

/**
 * MC-MEAN-MIDDLE-VALUE: v = 중앙값(짝수 개면 가운데 두 수의 평균) 또는
 * v = (최솟값 + 최댓값) ÷ 2, 그리고 v ≠ 평균.
 */
const meanMiddleValue: DiagnoseDetector = (input) => {
  const values = rationalListOf(input.args, 'values');
  const student = studentValue(input);
  if (values === null || student === null) return false;
  if (isExpected(input, student)) return false;
  const mean = sumOf(values).div(Rational.of(values.length));
  if (student.equals(mean)) return false;

  const sorted = sortedAscending(values);
  const two = Rational.of(TWO);
  const half = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[half] as Rational)
      : (sorted[half - 1] as Rational).add(sorted[half] as Rational).div(two);
  const midrange = (sorted[0] as Rational).add(sorted[sorted.length - 1] as Rational).div(two);
  return student.equals(median) || student.equals(midrange);
};

/**
 * MC-RATIO-ORDER: a ≠ b이고 v = b ÷ a(정답은 a ÷ b). 콘텐츠가 정답 쪽 a·b를
 * 넘긴다. 0으로 나누게 되는 a = 0, b = 0은 감지하지 않는다.
 */
const ratioOrder: DiagnoseDetector = (input) => {
  const a = rationalOf(input.args, 'a');
  const b = rationalOf(input.args, 'b');
  const student = studentValue(input);
  if (a === null || b === null || student === null) return false;
  const zero = Rational.of(ZERO);
  if (a.equals(b) || a.equals(zero) || b.equals(zero)) return false;
  if (isExpected(input, student)) return false;
  return student.equals(b.div(a));
};

/**
 * 수 함정: 오답 값을 콘텐츠 작성자가 계산해 args `trap`(문자열 또는 배열)으로
 * 넘긴다. v가 trap 중 하나와 같고 expected와 다르면 감지한다.
 */
const trapValue: DiagnoseDetector = (input) => {
  const traps = trapsOf(input);
  const student = studentValue(input);
  if (traps === null || student === null) return false;
  if (isExpected(input, student)) return false;
  for (const trap of traps) {
    let parsed: Rational;
    try {
      parsed = Rational.parse(trap);
    } catch {
      return false;
    }
    if (student.equals(parsed)) return true;
  }
  return false;
};

/**
 * `detect: 'diagnose'`인 W5 코드의 감지 함수(23개).
 * 엔진 조작으로만 알 수 있는 observation 코드는 여기에 없다.
 */
export const diagnoseDetectorsW5: Readonly<Record<string, DiagnoseDetector>> = {
  // 수 감지(공식)
  'MC-PATTERN-LAST-ONLY': patternLastOnly,
  'MC-PATTERN-GROWTH-TOTAL': patternGrowthTotal,
  'MC-GRAPH-ICON-VALUE': graphIconValue,
  'MC-GRAPH-SCALE-ONE': graphScaleOne,
  'MC-MEAN-SUM-ONLY': meanSumOnly,
  'MC-MEAN-MIDDLE-VALUE': meanMiddleValue,
  'MC-RATIO-ORDER': ratioOrder,
  // 수 함정
  'MC-ORDER-LEFT-TO-RIGHT': trapValue,
  'MC-ORDER-PAREN-IGNORED': trapValue,
  'MC-ORDER-MUL-BEFORE-DIV': trapValue,
  'MC-GRAPH-WAVY-LINE': trapValue,
  'MC-PERCENT-AS-NUMBER': trapValue,
  'MC-RATIO-ADDITIVE': trapValue,
  // 고르기 감지
  'MC-GRAPH-ICON-COUNT-COMPARE': trapChoice,
  'MC-GRAPH-BAR-WIDTH': trapChoice,
  'MC-GRAPH-HEIGHT-NOT-CHANGE': trapChoice,
  'MC-GRAPH-NO-INTERPOLATE': trapChoice,
  'MC-GRAPH-TRUNCATED-AXIS': trapChoice,
  'MC-GRAPH-AREA-AS-AMOUNT': trapChoice,
  'MC-CHANCE-SMALL-SAMPLE': trapChoice,
  'MC-CHANCE-GAMBLER': trapChoice,
  'MC-RATE-DISTANCE-ONLY': trapChoice,
  'MC-PROPORTION-CROSS-WRONG': trapChoice,
};
