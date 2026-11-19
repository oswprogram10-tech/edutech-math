/**
 * E16의 판정. 코어 `relation.ts` 위에 엔진 쪽 규칙(오개념·표 열·빈칸 정답)을 얹는다.
 * 모두 순수 함수다. 숨은 규칙과 빈칸 정답은 여기와 Observation에만 있고 화면 코드는 쓰지 않는다.
 */
import {
  MathError,
  Rational,
  checkPairs,
  formatRelation,
  parseRelation,
  relationInfo,
  sameOnDomain,
  solveBox,
  swappedHolds,
} from '../../core/math';
import type { Relation, RelationInfo } from '../../core/math';
import type { FunctionState, Tested } from './types';

export type ParseResult =
  | { readonly ok: true; readonly rel: Relation }
  | { readonly ok: false; readonly errorAt: number | null };

export function tryParse(text: string): ParseResult {
  try {
    return { ok: true, rel: parseRelation(text) };
  } catch (error) {
    if (error instanceof MathError) return { ok: false, errorAt: error.position ?? null };
    return { ok: false, errorAt: null };
  }
}

/** 숨은 규칙. 읽히고 □ 하나로 풀린 꼴(solvedForBox)이어야 한다. 아니면 null. */
export function hiddenOf(rule: string): Relation | null {
  const parsed = tryParse(rule);
  if (!parsed.ok) return null;
  return relationInfo(parsed.rel).solvedForBox ? parsed.rel : null;
}

/** solveBox가 NONLINEAR 같은 오류를 던져도 null로 돌려 준다. */
export function safeSolve(rel: Relation, circle: Rational): Rational | null {
  try {
    return solveBox(rel, circle);
  } catch (error) {
    if (error instanceof MathError) return null;
    throw error;
  }
}

export function rationalOf(text: string): Rational | null {
  try {
    return Rational.parse(text);
  } catch (error) {
    if (error instanceof MathError) return null;
    throw error;
  }
}

/** ○의 계수(○ = 0, 1을 넣어 □의 차이). 구할 수 없으면 null. */
export function circleCoefficient(rel: Relation): Rational | null {
  const zero = safeSolve(rel, Rational.of(0));
  const one = safeSolve(rel, Rational.of(1));
  if (zero === null || one === null) return null;
  return one.sub(zero);
}

export function domainList(domain: readonly [number, number]): Rational[] {
  const list: Rational[] = [];
  for (let n = domain[0]; n <= domain[1]; n += 1) list.push(Rational.of(n));
  return list;
}

// ─────────────────────────────────────────────────────────────
// 표의 열
// ─────────────────────────────────────────────────────────────

export interface ColumnCell {
  /** 보이는 수(주어진 수 또는 학생이 쓴 수). 빈칸이고 아직 안 썼으면 null. */
  readonly value: string | null;
  readonly blank: boolean;
  /** 빈칸일 때 칸 이름(`"<열>.x"`). */
  readonly key: string | null;
}

export interface Column {
  readonly id: string;
  readonly x: ColumnCell;
  readonly y: ColumnCell;
}

function cellOf(
  value: string | null,
  key: string,
  cells: Readonly<Record<string, string>>,
): ColumnCell {
  if (value !== null) return { value, blank: false, key: null };
  const entered = cells[key];
  return { value: entered === undefined || entered === '' ? null : entered, blank: true, key };
}

/** 상태에서 표의 열(화면 순서)을 만든다. */
export function columnsOf(state: FunctionState): Column[] {
  if (state.mode === 'black-box') {
    return state.trials.map(([x, y], index) => ({
      id: String(index),
      x: { value: x, blank: false, key: null },
      y: { value: y, blank: false, key: null },
    }));
  }
  if (state.mode === 'table') {
    return state.settings.rows.map((row, index) => ({
      id: String(index),
      x: cellOf(row.x, `${index}.x`, state.cells),
      y: cellOf(row.y, `${index}.y`, state.cells),
    }));
  }
  const rel = hiddenOf(state.settings.rule);
  return state.visited.map((x) => {
    const blank = state.settings.blankRows.includes(Number(x));
    const y = rel === null ? null : safeSolve(rel, Rational.of(Number(x)));
    return {
      id: x,
      x: { value: x, blank: false, key: null },
      y: blank
        ? cellOf(null, `${x}.y`, state.cells)
        : { value: y === null ? null : y.toString(), blank: false, key: null },
    };
  });
}

/** 두 값이 모두 있는 열의 [○, □]. */
export function pairsOf(columns: readonly Column[]): [Rational, Rational][] {
  const pairs: [Rational, Rational][] = [];
  for (const column of columns) {
    const x = column.x.value === null ? null : rationalOf(column.x.value);
    const y = column.y.value === null ? null : rationalOf(column.y.value);
    if (x !== null && y !== null) pairs.push([x, y]);
  }
  return pairs;
}

/** 열마다 식이 성립하는지. 쌍이 안 되는 열은 null. */
export function columnHolds(rel: Relation, columns: readonly Column[]): (boolean | null)[] {
  return columns.map((column) => {
    const pair = pairsOf([column])[0];
    if (pair === undefined) return null;
    return checkPairs(rel, [pair])[0] ?? null;
  });
}

/**
 * 표에 그릴 ✓/✕. 마지막 시험한 식이 읽혔고 지금 입력과 같을 때만 있다(식을 고치면 사라진다).
 * 학생 식을 학생이 본 쌍에 넣은 결과라 정답 노출이 아니다.
 */
export function visibleMarks(
  state: FunctionState,
  columns: readonly Column[],
): (boolean | null)[] | null {
  const tested = state.tested;
  if (tested === null || !tested.ok || tested.text !== state.ruleText) return null;
  const parsed = tryParse(tested.text);
  return parsed.ok ? columnHolds(parsed.rel, columns) : null;
}

// ─────────────────────────────────────────────────────────────
// 빈칸 정답(Observation에서만 쓴다)
// ─────────────────────────────────────────────────────────────

function blankCorrect(state: FunctionState, column: Column, which: 'x' | 'y'): boolean {
  const rel = hiddenOf(state.settings.rule);
  const cell = column[which];
  if (rel === null || cell.value === null) return false;
  const entered = rationalOf(cell.value);
  if (entered === null) return false;
  if (which === 'y') {
    const x = column.x.value === null ? null : rationalOf(column.x.value);
    if (x === null) return false;
    return safeSolve(rel, x)?.equals(entered) ?? false;
  }
  const y = column.y.value === null ? null : rationalOf(column.y.value);
  if (y === null) return false;
  const [min, max] = state.settings.domain;
  if (!entered.isInteger() || entered.isNegative()) return false;
  const n = Number(entered.integerPart());
  if (n < min || n > max) return false;
  return safeSolve(rel, entered)?.equals(y) ?? false;
}

export interface BlankStatus {
  readonly total: number;
  readonly filled: number;
  readonly correct: number;
}

export function blankStatus(state: FunctionState): BlankStatus {
  if (state.mode === 'black-box') return { total: 0, filled: 0, correct: 0 };
  const columns = columnsOf(state);
  let total = 0;
  let filled = 0;
  let correct = 0;
  const count = (column: Column, which: 'x' | 'y') => {
    total += 1;
    if (column[which].value !== null) filled += 1;
    if (blankCorrect(state, column, which)) correct += 1;
  };
  for (const column of columns) {
    if (column.x.blank) count(column, 'x');
    if (column.y.blank) count(column, 'y');
  }
  if (state.mode === 'covary') {
    // 아직 지나지 않은 빈칸 줄도 빈칸이다(찾아가서 채워야 한다).
    const missing = state.settings.blankRows.filter((n) => !state.visited.includes(String(n)));
    total += missing.length;
  }
  return { total, filled, correct };
}

// ─────────────────────────────────────────────────────────────
// 식 판정과 오개념
// ─────────────────────────────────────────────────────────────

export interface Judgement {
  readonly pairs: [string, string][];
  /** 시험한 식이 읽혔는가. */
  readonly ruleValid: boolean;
  readonly formatted: string | null;
  readonly info: RelationInfo | null;
  readonly holdsCount: number;
  readonly holdsAll: boolean;
  readonly matchesHidden: boolean;
  readonly misconceptions: string[];
}

export interface MisconceptionInput {
  readonly tested: Tested | null;
  /** 숨은 규칙(없으면 null). */
  readonly hidden: Relation | null;
  readonly pairs: readonly (readonly [Rational, Rational])[];
  readonly ruleHistory: readonly string[];
}

function isAddOnlyForm(text: string): boolean {
  const parsed = tryParse(text);
  if (!parsed.ok) return false;
  const info = relationInfo(parsed.rel);
  if (!info.solvedForBox || info.circleCount !== 1) return false;
  const a = circleCoefficient(parsed.rel);
  return a !== null && a.equals(Rational.of(1));
}

/** 마지막 시험 기준 오개념. 코드는 정렬해 돌려 준다. */
export function detectMisconceptions(input: MisconceptionInput): string[] {
  const { tested, hidden, pairs, ruleHistory } = input;
  const found = new Set<string>();
  if (tested === null) return [];
  const parsed = tryParse(tested.text);

  if (!tested.ok || !parsed.ok) {
    // "+4"처럼 앞 값에서 더해 가는 말만 쓴 경우
    const text = tested.text.trim();
    if (/^[+−-]/.test(text) && !text.includes('=')) found.add('MC-PATTERN-RECURSIVE-ONLY');
    return [...found];
  }
  const rel = parsed.rel;
  const info = relationInfo(rel);
  const holds = checkPairs(rel, pairs);
  const holdCount = holds.filter(Boolean).length;
  const holdsAll = pairs.length >= 2 && holdCount === pairs.length;

  if (pairs.length >= 2 && holdCount >= 1 && holdCount < pairs.length) {
    found.add('MC-PATTERN-ONE-PAIR');
  }
  if (pairs.length >= 2 && !holdsAll && swappedHolds(rel, pairs)) found.add('MC-CORR-SWAP-VARS');
  if (info.boxOnly) found.add('MC-PATTERN-RECURSIVE-ONLY');

  if (hidden !== null && ruleHistory.length >= 2) {
    const a = circleCoefficient(hidden);
    const last = ruleHistory.slice(-2);
    if (
      a !== null &&
      !a.equals(Rational.of(1)) &&
      last.every(isAddOnlyForm) &&
      ruleHistory[ruleHistory.length - 1] === formatRelation(rel)
    ) {
      found.add('MC-FUNC-ADD-ONLY');
    }
  }
  return [...found].sort();
}

/** 상태 하나에서 판정 값을 모두 뽑는다. */
export function judge(state: FunctionState): Judgement {
  const columns = columnsOf(state);
  const pairs = pairsOf(columns);
  const hidden = hiddenOf(state.settings.rule);
  const tested = state.tested;
  const parsed = tested === null ? null : tryParse(tested.text);
  const rel = parsed !== null && parsed.ok ? parsed.rel : null;
  const holds = rel === null ? [] : checkPairs(rel, pairs);
  const holdsCount = holds.filter(Boolean).length;
  const holdsAll = rel !== null && pairs.length >= 2 && holdsCount === pairs.length;

  let matchesHidden = false;
  if (rel !== null && hidden !== null) {
    try {
      matchesHidden = sameOnDomain(rel, hidden, domainList(state.settings.domain));
    } catch (error) {
      if (!(error instanceof MathError)) throw error;
      matchesHidden = false;
    }
  }
  return {
    pairs: pairs.map(([x, y]) => [x.toString(), y.toString()]),
    ruleValid: rel !== null,
    formatted: rel === null ? null : formatRelation(rel),
    info: rel === null ? null : relationInfo(rel),
    holdsCount,
    holdsAll,
    matchesHidden,
    misconceptions: detectMisconceptions({
      tested,
      hidden,
      pairs,
      ruleHistory: state.ruleHistory,
    }),
  };
}
