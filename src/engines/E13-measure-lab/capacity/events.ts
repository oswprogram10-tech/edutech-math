/** E13 capacity의 공개 판정(순수 함수). */
import type { EnginePredicate, JsonValue, Observation } from '../../../core/engine-sdk';

function field(args: JsonValue | undefined, key: string): JsonValue | undefined {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  return args[key];
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

export const capacityPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** cup-count: 모든 그릇이 가득 찼다. */
  allFull: (observation: Observation) => observation['allFull'] === true,
  /** cup-count, args `{ id }`: 그 그릇이 가득 찼다. */
  full: (observation, args) => {
    const id = field(args, 'id');
    return typeof id === 'string' && recordOf(observation['full'])?.[id] === true;
  },
  /** cup-count, args `{ id, n }`: 그 그릇에 부은 컵이 n번이다(n은 1 이상). */
  cupsIs: (observation, args) => {
    const id = field(args, 'id');
    const n = field(args, 'n');
    return (
      typeof id === 'string' &&
      typeof n === 'number' &&
      n >= 1 &&
      recordOf(observation['cups'])?.[id] === n
    );
  },
  /** puzzle: 어느 그릇이든 targetMl과 같다. */
  reached: (observation: Observation) => observation['reached'] === true,
  /** puzzle, args `{ id, ml }`: 그 그릇의 물이 ml이다(ml은 1 이상). */
  amountIs: (observation, args) => {
    const id = field(args, 'id');
    const ml = field(args, 'ml');
    return (
      typeof id === 'string' &&
      typeof ml === 'number' &&
      Number.isInteger(ml) &&
      ml >= 1 &&
      recordOf(observation['amounts'])?.[id] === String(ml)
    );
  },
  /** puzzle, args `{ n }`: 지금까지 받아들여진 조작이 n번 이하다(처음·reset 직후도 참이다). */
  stepsAtMost: (observation, args) => {
    const n = field(args, 'n');
    const steps = observation['steps'];
    return typeof n === 'number' && typeof steps === 'number' && steps <= n;
  },
};
