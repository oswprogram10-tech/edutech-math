/**
 * E15 calc-pattern 순수 계산. 수 계산은 모두 Rational(BigInt)로 한다.
 * 식 읽기는 `src/core/math`의 `parseRelation`·`evaluateTerm`을 쓴다.
 */
import { MathError, Rational, evaluateTerm, parseRelation } from '../../core/math';
import type { RelTerm } from '../../core/math';
import type { CalcPatternName } from './types';

export const SYMMETRIC: CalcPatternName = 'symmetric-sum-square';
export const REPUNIT: CalcPatternName = 'repunit-square';
export const CALC_PATTERNS: readonly string[] = [SYMMETRIC, REPUNIT];

export const MC_RECURSIVE_ONLY = 'MC-PATTERN-RECURSIVE-ONLY';

/** 식 입력 키. */
export const EXPR_KEYS: readonly string[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '+',
  '×',
  '=',
];
export const EXPR_MAX_LENGTH = 60;

/** n단계 블록 열 높이: 1, 2, …, n, …, 2, 1 (2n−1열). */
export function stepColumns(n: number): number[] {
  const up = Array.from({ length: n }, (_, i) => i + 1);
  const down = Array.from({ length: Math.max(0, n - 1) }, (_, i) => n - 1 - i);
  return [...up, ...down];
}

/** 1이 n개인 수(BigInt). */
export function repunit(n: number): bigint {
  return (10n ** BigInt(n) - 1n) / 9n;
}

/** 그 단계의 식이 가리키는 값. symmetric은 n × n, repunit은 1…1의 제곱. */
export function stepTotal(pattern: CalcPatternName, n: number): Rational {
  if (pattern === REPUNIT) {
    const r = repunit(n);
    return Rational.of(r * r);
  }
  return Rational.of(BigInt(n) * BigInt(n));
}

/** 그 단계 식의 왼쪽 변 수들(symmetric은 더하는 수, repunit은 곱하는 두 수). */
export function stepTerms(pattern: CalcPatternName, n: number): string[] {
  if (pattern === REPUNIT) return [repunit(n).toString(), repunit(n).toString()];
  return stepColumns(n).map(String);
}

/** 표시용 식. 예: "1 + 2 + 1 = 2 × 2", "11 × 11 = 121". */
export function stepExpression(pattern: CalcPatternName, n: number): string {
  if (pattern === REPUNIT) {
    const r = repunit(n).toString();
    return `${r} × ${r} = ${stepTotal(pattern, n).toString()}`;
  }
  return `${stepColumns(n).join(' + ')} = ${n} × ${n}`;
}

export function trimHeights(heights: readonly number[]): number[] {
  let start = 0;
  let end = heights.length;
  while (start < end && heights[start] === 0) start += 1;
  while (end > start && heights[end - 1] === 0) end -= 1;
  return heights.slice(start, end);
}

function sameList(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 앞뒤 0을 뺀 열 높이가 1…n…1과 같은가. */
export function isPyramid(heights: readonly number[], n: number): boolean {
  if (!Number.isInteger(n) || n < 1) return false;
  return sameList(trimHeights(heights), stepColumns(n));
}

export function totalOf(heights: readonly number[]): number {
  return heights.reduce((sum, value) => sum + value, 0);
}

export interface ExprReading {
  /** 읽을 수 있는 관계식이다(○·□가 없고 계산할 수 있다). */
  readonly valid: boolean;
  /** 양변 값이 같다. */
  readonly holds: boolean;
  /** 양변 값(Rational 문자열). 읽을 수 없으면 null. */
  readonly left: string | null;
  readonly right: string | null;
  /** 한 변이 수의 덧셈만이면 그 수 목록(문자열). 두 수 이상인 변을 먼저 보고, 없으면 수 하나인 변. */
  readonly addends: string[] | null;
  /** 한 변이 `a × b` 하나이면 [a, b](왼쪽 변 우선). */
  readonly factors: [string, string] | null;
  /** 읽을 수 없을 때 원문에서 문제가 되는 글자 위치(알면). */
  readonly errorAt: number | null;
}

const INVALID: ExprReading = {
  valid: false,
  holds: false,
  left: null,
  right: null,
  addends: null,
  factors: null,
  errorAt: null,
};

function hasVariable(term: RelTerm): boolean {
  switch (term.kind) {
    case 'number':
      return false;
    case 'var':
      return true;
    case 'group':
      return hasVariable(term.expr);
    case 'binary':
      return hasVariable(term.left) || hasVariable(term.right);
  }
}

function addTerms(term: RelTerm): Rational[] | null {
  switch (term.kind) {
    case 'number':
      return [term.value];
    case 'group':
      return addTerms(term.expr);
    case 'binary': {
      if (term.op !== 'add') return null;
      const left = addTerms(term.left);
      const right = addTerms(term.right);
      return left === null || right === null ? null : [...left, ...right];
    }
    default:
      return null;
  }
}

function plainNumber(term: RelTerm): Rational | null {
  if (term.kind === 'number') return term.value;
  if (term.kind === 'group') return plainNumber(term.expr);
  return null;
}

function mulFactors(term: RelTerm): [Rational, Rational] | null {
  if (term.kind === 'group') return mulFactors(term.expr);
  if (term.kind !== 'binary' || term.op !== 'mul') return null;
  const a = plainNumber(term.left);
  const b = plainNumber(term.right);
  return a === null || b === null ? null : [a, b];
}

/** 학생이 쓴 식을 읽는다. 읽을 수 없으면 `valid: false`다(throw하지 않는다). */
export function readExpression(text: string): ExprReading {
  if (text.trim() === '') return INVALID;
  try {
    const rel = parseRelation(text);
    if (hasVariable(rel.left) || hasVariable(rel.right)) return INVALID;
    const zero = Rational.of(0);
    const env = { circle: zero, box: zero };
    const left = evaluateTerm(rel.left, env);
    const right = evaluateTerm(rel.right, env);
    const sides = [addTerms(rel.left), addTerms(rel.right)];
    const chosen =
      sides.find((list) => list !== null && list.length >= 2) ??
      sides.find((list) => list !== null) ??
      null;
    const product = mulFactors(rel.left) ?? mulFactors(rel.right);
    return {
      valid: true,
      holds: left.equals(right),
      left: left.toString(),
      right: right.toString(),
      addends: chosen === null ? null : chosen.map((value) => value.toString()),
      factors: product === null ? null : [product[0].toString(), product[1].toString()],
      errorAt: null,
    };
  } catch (error) {
    if (error instanceof MathError) return { ...INVALID, errorAt: error.position ?? null };
    throw error;
  }
}

/**
 * 오개념 ① 쌓은 모양이 (workStep−1)단계 피라미드에 한 열만 붙인 모양이다
 * (예: 4단계에서 1,2,3,2,1,4).
 */
export function isRecursiveBuild(heights: readonly number[], workStep: number): boolean {
  if (!Number.isInteger(workStep) || workStep < 2) return false;
  const trimmed = trimHeights(heights);
  const previous = stepColumns(workStep - 1);
  if (trimmed.length !== previous.length + 1) return false;
  return sameList(trimmed.slice(0, -1), previous) || sameList(trimmed.slice(1), previous);
}

/**
 * 오개념 ② 식이 성립하고 덧셈 항이 (앞 단계 합)과 (증가분 2n−1) 두 수뿐이다(예: 9 + 7 = 16).
 * symmetric 패턴에서만 본다.
 */
export function isRecursiveExpression(
  reading: ExprReading,
  pattern: CalcPatternName,
  workStep: number,
): boolean {
  if (pattern !== SYMMETRIC || !Number.isInteger(workStep) || workStep < 2) return false;
  if (!reading.valid || !reading.holds || reading.addends === null) return false;
  if (reading.addends.length !== 2) return false;
  const previous = String((workStep - 1) * (workStep - 1));
  const step = String(2 * workStep - 1);
  const [a, b] = reading.addends as [string, string];
  return (a === previous && b === step) || (a === step && b === previous);
}

/** 입력 칸에 보일 조각. `error`인 조각에는 밑줄을 긋는다. */
export interface ExprPart {
  readonly text: string;
  readonly error: boolean;
}

/**
 * 입력 칸 글자. 연산 기호 둘레를 띄워 `formatRelation`과 같은 모양으로 쓴다.
 * 읽을 수 없으면 문제 글자(위치를 모르면 끝)에 밑줄 표시를 단다.
 */
export function exprParts(text: string, errorAt: number | null, valid: boolean): ExprPart[] {
  const parts: ExprPart[] = [];
  const push = (value: string, error: boolean) => {
    const last = parts[parts.length - 1];
    if (last !== undefined && last.error === error) {
      parts[parts.length - 1] = { text: last.text + value, error };
    } else {
      parts.push({ text: value, error });
    }
  };
  let seen = 0;
  [...text].forEach((char, index) => {
    if (/\s/.test(char)) return;
    seen += 1;
    const bad = !valid && errorAt === index;
    if (char === '+' || char === '×' || char === '=') {
      push(' ', false);
      push(char, bad);
      push(' ', false);
    } else {
      push(char, bad);
    }
  });
  if (!valid && seen > 0 && (errorAt === null || errorAt >= text.length)) {
    push(' ', true);
  }
  return parts;
}
