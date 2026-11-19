/**
 * E08의 이벤트와 판정 함수.
 *
 * 이벤트 이름은 계약이다: `line-added`, `line-checked`, `misconception-found`,
 * `value-changed`. `line-checked`는 앞 줄과의 동치 여부만 담는다(정답 값 아님).
 */
import { Rational } from '../../core/math';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { analyzeState } from './analyze';
import { emitOrderTree } from './order-tree';
import type { AnyStepSolverState, StepSolverAction } from './types';

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function stringOf(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function numberOf(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rationalOf(value: JsonValue | undefined): Rational | null {
  const text = stringOf(value);
  if (text === null) return null;
  try {
    return Rational.parse(text);
  } catch {
    return null;
  }
}

export function emit(
  prev: AnyStepSolverState,
  next: AnyStepSolverState,
  action: StepSolverAction,
): EngineEvent[] {
  if (prev === next) return [];
  if (prev.mode === 'order-tree' || next.mode === 'order-tree') {
    return prev.mode === 'order-tree' && next.mode === 'order-tree'
      ? emitOrderTree(prev, next, action)
      : [];
  }
  const before = analyzeState(prev);
  const after = analyzeState(next);
  const events: EngineEvent[] = [];

  if (action.type === 'add-line' && next.lines.length > prev.lines.length) {
    events.push({ name: 'line-added', payload: { line: next.lines.length - 1 } });
  }

  const count = Math.max(before.lines.length, after.lines.length);
  for (let index = 1; index < count; index += 1) {
    const left = before.lines[index]?.equivalentToPrev ?? null;
    const right = after.lines[index]?.equivalentToPrev ?? null;
    if (right !== null && right !== left) {
      events.push({ name: 'line-checked', payload: { line: index, equivalent: right } });
    }
  }

  const known = new Set(before.misconceptions.map((entry) => `${entry.line}:${entry.code}`));
  for (const entry of after.misconceptions) {
    const key = `${entry.line}:${entry.code}`;
    if (known.has(key)) continue;
    events.push({ name: 'misconception-found', payload: { line: entry.line, code: entry.code } });
  }

  if (after.finalValue !== null && after.finalValue !== before.finalValue) {
    events.push({ name: 'value-changed', payload: { value: after.finalValue } });
  }
  return events;
}

/** 모든 줄이 앞 줄과 값이 같은가. 줄이 하나뿐이면 참. */
export const allLinesEquivalent: EnginePredicate = (observation: Observation): boolean =>
  observation['allEquivalent'] === true;

/** args `{ value }`와 마지막 줄 값이 같은가(표기가 아니라 값). */
export const finalValueIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  const target = rationalOf(record?.['value']);
  const actual = rationalOf(observation['finalValue']);
  if (!target || !actual) return false;
  return target.equals(actual);
};

/** 마지막 줄을 기약 표기로 썼는가. */
export const finalIrreducible: EnginePredicate = (observation: Observation): boolean =>
  observation['finalIrreducible'] === true;

/** args `{ n }`. 줄 수가 n개 이상인가. */
export const lineCountAtLeast: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  const wanted = numberOf(record?.['n']);
  const actual = numberOf(observation['lineCount']);
  if (wanted === null || actual === null) return false;
  return actual >= wanted;
};

/** args `{ line }`. debug에서 고른 친구 풀이 줄(0부터)이 맞는가. */
export const selectedLineIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  const wanted = numberOf(record?.['line']);
  if (wanted === null) return false;
  return observation['selectedLine'] === wanted;
};

/** args `{ code }`. 그 오개념 코드가 하나라도 나왔는가. */
export const hasMisconception: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  const code = stringOf(record?.['code']);
  if (code === null) return false;
  const list = observation['misconceptions'];
  if (!Array.isArray(list)) return false;
  return list.some((entry) => {
    // order-tree는 코드 문자열 목록, 나머지는 { line, code } 목록이다.
    if (entry === code) return true;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return entry['code'] === code;
  });
};

/**
 * args `{ value, count? }`. 값이 args.value인 서로 다른 식이 count개 이상인가.
 * g4s2u1.A3 과제 5("서로 다른 식 2가지")가 쓴다.
 */
export const differentExpressions: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  const target = rationalOf(record?.['value']);
  const wanted = numberOf(record?.['count']) ?? 2;
  if (!target) return false;
  const lines = observation['lines'];
  if (!Array.isArray(lines)) return false;
  const expressions = new Set<string>();
  for (const entry of lines) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    if (entry['valid'] !== true) continue;
    const value = rationalOf(entry['value']);
    const expr = stringOf(entry['expr']);
    if (!value || expr === null) continue;
    if (value.equals(target)) expressions.add(expr);
  }
  return expressions.size >= wanted;
};

function orderOf(value: JsonValue | undefined): number[] | null {
  if (!Array.isArray(value)) return null;
  const order: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry)) return null;
    order.push(entry);
  }
  return order;
}

/** order-tree. args `{ opIndex }`. 첫 번째로 계산한 연산이 그 번호인가. */
export const firstReductionIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const wanted = numberOf(recordOf(args)?.['opIndex']);
  const order = orderOf(observation['reductionOrder']);
  if (wanted === null || order === null) return false;
  return order[0] === wanted;
};

/** order-tree. args `{ order }`. 계산한 순서가 정확히 그 번호 목록인가. */
export const reductionOrderIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const wanted = orderOf(recordOf(args)?.['order']);
  const order = orderOf(observation['reductionOrder']);
  if (wanted === null || order === null) return false;
  return wanted.length === order.length && wanted.every((value, index) => value === order[index]);
};

/** order-tree. 끝까지 계산했는가. */
export const done: EnginePredicate = (observation: Observation): boolean =>
  observation['done'] === true;

/** order-tree. args `{ n }`. 틀린 누름이 n번 이하인가. */
export const wrongTapsAtMost: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const wanted = numberOf(recordOf(args)?.['n']);
  const count = numberOf(observation['wrongTapCount']);
  if (wanted === null || count === null) return false;
  return count <= wanted;
};

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  allLinesEquivalent,
  finalValueIs,
  finalIrreducible,
  lineCountAtLeast,
  selectedLineIs,
  hasMisconception,
  differentExpressions,
  firstReductionIs,
  reductionOrderIs,
  done,
  wrongTapsAtMost,
};
