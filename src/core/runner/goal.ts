/**
 * GoalSpec 판정.
 *
 * 판정은 정답 문자열 비교가 아니라 엔진의 observe() 결과(Observation)에 대한
 * 조건식으로만 한다. 경로가 없거나 값 형식이 맞지 않으면 false다.
 */
import { equivalent } from '../math';
import type { GoalSpec, JsonValue, LoadedEngine, Observation } from '../engine-sdk';

export type GoalEngine = Pick<LoadedEngine, 'predicates'>;

interface PathResult {
  readonly found: boolean;
  readonly value: JsonValue | undefined;
}

/** `groups.0.count` 같은 점 표기 경로를 따라간다. 배열은 숫자 인덱스만 받는다. */
export function resolveObservationPath(observation: Observation, path: string): PathResult {
  if (path.length === 0) return { found: true, value: observation };

  let current: JsonValue = observation;
  for (const key of path.split('.')) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(key)) return { found: false, value: undefined };
      const index = Number(key);
      if (index >= current.length) return { found: false, value: undefined };
      current = current[index] as JsonValue;
      continue;
    }
    if (current === null || typeof current !== 'object') {
      return { found: false, value: undefined };
    }
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      return { found: false, value: undefined };
    }
    current = current[key] as JsonValue;
  }
  return { found: true, value: current };
}

/** JSON 값의 깊은 비교. 객체 키 순서는 무시한다. */
export function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => jsonEqual(value, right[index] as JsonValue));
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      jsonEqual(left[key] as JsonValue, right[key] as JsonValue),
  );
}

function evaluateEquivalent(path: string, expr: string, observation: Observation): boolean {
  const { found, value } = resolveObservationPath(observation, path);
  if (!found || typeof value !== 'string') return false;
  try {
    return equivalent(value, expr);
  } catch {
    // 학생이 아직 수식을 만들지 못했거나 형식이 깨진 경우. 던지지 않고 오답으로 둔다.
    return false;
  }
}

export function evaluateGoal(
  goal: GoalSpec,
  observation: Observation,
  engine: GoalEngine = {},
): boolean {
  switch (goal.kind) {
    case 'equals': {
      const { found, value } = resolveObservationPath(observation, goal.path);
      return found && value !== undefined && jsonEqual(value, goal.value);
    }
    case 'equivalent-expr':
      return evaluateEquivalent(goal.path, goal.expr, observation);
    case 'predicate': {
      const predicate = engine.predicates?.[goal.name];
      return predicate ? predicate(observation, goal.args) : false;
    }
    case 'all':
      return goal.of.every((child) => evaluateGoal(child, observation, engine));
    case 'any':
      return goal.of.some((child) => evaluateGoal(child, observation, engine));
  }
}
