/**
 * E08 줄 분석과 오개념 진단.
 *
 * 줄 i(i ≥ 1)가 줄 i−1과 값이 같은지만 본다. 이는 "앞 줄과 같은가"이지
 * 정답 값을 알려 주는 것이 아니다. 진단 문구·막대는 학생이 쓴 줄과 그 앞 줄의
 * 값만 쓰고, 정답 값은 어디에도 만들지 않는다.
 */
import { Rational, parse } from '../../core/math';
import type { Ast, NumberForm } from '../../core/math';
import { diagnoseDetectors } from '../../core/math/diagnose';
import type { DiagnoseInput } from '../../core/math/diagnose';
import {
  analyzeLine,
  equivalentAnalyses,
  exprOfTokens,
  notationIsIrreducible,
  notationIsMixed,
} from './expression';
import type { LineValue } from './expression';
import type { StepLine, StepSolverState, Token } from './types';

export interface LineAnalysis {
  readonly expr: string;
  readonly value: Rational | null;
  readonly valid: boolean;
  readonly equivalentToPrev: boolean | null;
  readonly label: string | null;
}

export interface Misconception {
  readonly line: number;
  readonly code: string;
}

export interface Diagnosis {
  readonly line: number;
  readonly code: string;
  /** 앞 줄의 값(Rational 문자열). 정답이 아니다. */
  readonly previousValue: string;
  /** 학생이 쓴 줄의 값(Rational 문자열). */
  readonly studentValue: string;
  /** 학생이 쓴 줄의 표기. */
  readonly studentExpr: string;
  /** 앞 줄의 왼쪽 항(예: "1/2"). */
  readonly leftText: string;
  /** 앞 줄의 오른쪽 항(예: "1/3"). */
  readonly rightText: string;
  /** 덧셈에서 두 항 중 큰 값의 표기. 뺄셈이면 null. */
  readonly bigText: string | null;
  /** `bigText`의 Rational 문자열. 뺄셈이면 null. */
  readonly bigValue: string | null;
  readonly op: 'add' | 'sub';
}

export interface StateAnalysis {
  readonly lines: readonly LineAnalysis[];
  readonly firstBrokenLine: number | null;
  readonly allEquivalent: boolean;
  readonly finalValue: string | null;
  readonly finalRaw: string | null;
  readonly finalIrreducible: boolean;
  readonly finalIsMixed: boolean;
  readonly misconceptions: readonly Misconception[];
  /** 화면 반례 상자·힌트 ②가 쓰는 상세 진단. Observation에는 코드만 내보낸다. */
  readonly diagnoses: readonly Diagnosis[];
}

function lineAnalysis(line: StepLine, previous: LineValue | null): LineAnalysis {
  const current = analyzeLine(line.tokens);
  return {
    expr: current.expr,
    value: current.value,
    valid: current.valid,
    equivalentToPrev: previous === null ? null : equivalentAnalyses(previous, current),
    label: line.label,
  };
}

function toLineValue(analysis: LineAnalysis): LineValue {
  return {
    expr: analysis.expr,
    value: analysis.value,
    valid: analysis.valid,
    reason: null,
  };
}

function firstBroken(lines: readonly LineAnalysis[]): number | null {
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.equivalentToPrev === false) return index;
  }
  return null;
}

function everyEquivalent(lines: readonly LineAnalysis[]): boolean {
  if (lines.length <= 1) return true;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.equivalentToPrev !== true) return false;
  }
  return true;
}

interface Operand {
  readonly text: string;
  readonly value: Rational;
  readonly form: NumberForm;
}

function unwrap(ast: Ast): Ast {
  let current = ast;
  while (current.kind === 'group') current = current.expr;
  return current;
}

function operandOf(ast: Ast): Operand | null {
  const node = unwrap(ast);
  if (node.kind !== 'number') return null;
  return { text: node.text, value: node.value, form: node.form };
}

interface BinaryOperands {
  readonly left: Operand;
  readonly right: Operand;
  readonly op: 'add' | 'sub';
}

function operandsOf(tokens: readonly Token[]): BinaryOperands | null {
  const expr = exprOfTokens(tokens);
  let ast: Ast;
  try {
    ast = parse(expr);
  } catch {
    return null;
  }
  const node = unwrap(ast);
  if (node.kind !== 'binary') return null;
  if (node.op !== 'add' && node.op !== 'sub') return null;
  const left = operandOf(node.left);
  const right = operandOf(node.right);
  if (!left || !right) return null;
  return { left, right, op: node.op };
}

function diagnosisAt(previous: StepLine, current: LineAnalysis, line: number): Diagnosis | null {
  if (!current.valid || current.value === null) return null;
  const operands = operandsOf(previous.tokens);
  if (!operands) return null;

  const args: Record<string, string> = {
    a: operands.left.text,
    b: operands.right.text,
  };
  if (operands.op === 'sub') {
    args['minuend'] = operands.left.text;
    args['subtrahend'] = operands.right.text;
    if (operands.left.form === 'integer') args['whole'] = operands.left.text;
  }
  const mixed =
    operands.left.form === 'mixed'
      ? operands.left.text
      : operands.right.form === 'mixed'
        ? operands.right.text
        : null;
  if (mixed !== null) args['mixed'] = mixed;

  const input: DiagnoseInput = {
    value: current.value.toString(),
    raw: current.expr,
    args,
  };

  const codes =
    operands.op === 'add'
      ? [
          'MC-FRAC-ADD-DENOM',
          'MC-FRAC-ADD-DENOM-HALF',
          'MC-FRAC-ADD-NO-CONVERT-NUM',
          'MC-COMMON-DENOM-ONLY-PRODUCT',
          'MC-FRAC-MIXED-CONVERT',
        ]
      : [
          'MC-SUB-SMALLER-FROM-LARGER',
          'MC-FRAC-BORROW-AS-TEN',
          'MC-FRAC-WHOLE-MINUS',
          'MC-FRAC-MIXED-CONVERT',
        ];

  // 덧셈 반례 문장은 '더한 두 수 중 큰 수'와 비교한다. 큰 수는 값으로 고른다.
  const bigger =
    operands.left.value.compareTo(operands.right.value) >= 0 ? operands.left : operands.right;

  for (const code of codes) {
    const detector = diagnoseDetectors[code];
    if (detector?.(input) === true) {
      return {
        line,
        code,
        previousValue: valueOfPrevious(previous),
        studentValue: current.value.toString(),
        studentExpr: current.expr,
        leftText: operands.left.text,
        rightText: operands.right.text,
        bigText: operands.op === 'add' ? bigger.text : null,
        bigValue: operands.op === 'add' ? bigger.value.toString() : null,
        op: operands.op,
      };
    }
  }
  return null;
}

function valueOfPrevious(previous: StepLine): string {
  const analysis = analyzeLine(previous.tokens);
  return analysis.value?.toString() ?? '0';
}

function diagnoseLines(lines: readonly StepLine[], analyses: readonly LineAnalysis[]): Diagnosis[] {
  const result: Diagnosis[] = [];
  for (let index = 1; index < analyses.length; index += 1) {
    if (analyses[index]?.equivalentToPrev !== false) continue;
    const previous = lines[index - 1];
    const current = analyses[index];
    if (!previous || !current) continue;
    const diagnosis = diagnosisAt(previous, current, index);
    if (diagnosis) result.push(diagnosis);
  }
  return result;
}

function linesMode(state: StepSolverState): StateAnalysis {
  const analyses: LineAnalysis[] = [];
  let previous: LineValue | null = null;
  for (const line of state.lines) {
    const analysis = lineAnalysis(line, previous);
    analyses.push(analysis);
    previous = toLineValue(analysis);
  }

  const last = analyses[analyses.length - 1];
  const diagnoses =
    state.diagnose && state.mode !== 'debug' ? diagnoseLines(state.lines, analyses) : [];
  return {
    lines: analyses,
    firstBrokenLine: firstBroken(analyses),
    allEquivalent: everyEquivalent(analyses),
    finalValue: last?.value?.toString() ?? null,
    finalRaw: last !== undefined && last.expr.length > 0 ? last.expr : null,
    finalIrreducible:
      last !== undefined
        ? notationIsIrreducible(state.lines[state.lines.length - 1]?.tokens ?? [])
        : false,
    finalIsMixed:
      last !== undefined
        ? notationIsMixed(state.lines[state.lines.length - 1]?.tokens ?? [])
        : false,
    misconceptions: diagnoses.map((diagnosis) => ({ line: diagnosis.line, code: diagnosis.code })),
    diagnoses,
  };
}

function debugMode(state: StepSolverState): StateAnalysis {
  const samples: LineAnalysis[] = [];
  let previous: LineValue | null = null;
  for (const line of state.samples) {
    const analysis = lineAnalysis(line, previous);
    samples.push(analysis);
    previous = toLineValue(analysis);
  }

  const correctionLine = state.lines[0];
  const correctionTokens = correctionLine?.tokens ?? [];
  const correction = analyzeLine(correctionTokens);
  const hasCorrection = correctionTokens.length > 0;

  let correctionEquivalent: boolean | null = null;
  if (hasCorrection && state.selectedLine !== null && state.selectedLine > 0) {
    const previousSample = samples[state.selectedLine - 1];
    if (previousSample) {
      correctionEquivalent = equivalentAnalyses(toLineValue(previousSample), correction);
    }
  }

  const lines = hasCorrection
    ? [
        ...samples,
        {
          expr: correction.expr,
          value: correction.value,
          valid: correction.valid,
          equivalentToPrev: correctionEquivalent,
          label: null,
        },
      ]
    : samples;

  return {
    lines,
    firstBrokenLine: firstBroken(samples),
    allEquivalent: everyEquivalent(samples),
    finalValue: correction.value?.toString() ?? null,
    finalRaw: hasCorrection && correction.expr.length > 0 ? correction.expr : null,
    finalIrreducible: hasCorrection ? notationIsIrreducible(correctionTokens) : false,
    finalIsMixed: hasCorrection ? notationIsMixed(correctionTokens) : false,
    misconceptions: [],
    diagnoses: [],
  };
}

/** 현재 상태의 줄 판정. `observe`·이벤트·화면이 같은 계산을 쓴다. */
export function analyzeState(state: StepSolverState): StateAnalysis {
  return state.mode === 'debug' ? debugMode(state) : linesMode(state);
}

/** 화면 반례 상자에 쓸 첫 진단. 없으면 null. */
export function firstDiagnosis(state: StepSolverState): Diagnosis | null {
  return analyzeState(state).diagnoses[0] ?? null;
}

/** 화면에서 줄 i의 앞 줄 값. 없으면 null. */
export function previousValueOf(state: StepSolverState, line: number): Rational | null {
  const analysis = analyzeState(state);
  if (line <= 0 || line >= analysis.lines.length) return null;
  return analysis.lines[line - 1]?.value ?? null;
}

/** 두 줄의 값을 막대 비율로 바꿀 때 쓰는 화면용 수. 큰 값이 1이 된다. */
export function barRatio(value: Rational, maximum: Rational): number {
  if (value.isNegative() || maximum.isNegative() || maximum.isZero()) return 0;
  const scaled = Number((value.n * 1000n) / value.d) / 1000;
  const max = Number((maximum.n * 1000n) / maximum.d) / 1000;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, scaled / max));
}
