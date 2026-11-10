/** diagonal 모드의 판정(T103). Observation만 본다. 정답 개수는 화면에 쓰지 않는다. */
import type { EnginePredicate, JsonValue, Observation } from '../../../../core/engine-sdk';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function polygonRecords(observation: Observation): Readonly<Record<string, JsonValue>>[] {
  const value = observation['polygons'];
  if (!Array.isArray(value)) return [];
  const result: Readonly<Record<string, JsonValue>>[] = [];
  for (const item of value) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) result.push(item);
  }
  return result;
}

function polygonOf(
  observation: Observation,
  n: number,
): Readonly<Record<string, JsonValue>> | null {
  return polygonRecords(observation).find((record) => record['n'] === n) ?? null;
}

export const diagonalPredicates: Readonly<Record<string, EnginePredicate>> = {
  diagonalsComplete: (observation, args) => {
    const n = numberArg(argsRecord(args), 'n');
    if (n === null) return false;
    const polygon = polygonOf(observation, Math.round(n));
    return polygon !== null && polygon['complete'] === true;
  },

  diagonalCount: (observation, args) => {
    const record = argsRecord(args);
    const n = numberArg(record, 'n');
    const count = numberArg(record, 'count');
    if (n === null || count === null) return false;
    const polygon = polygonOf(observation, Math.round(n));
    if (polygon === null) return false;
    const drawn = polygon['drawn'];
    return typeof drawn === 'number' && drawn >= count;
  },

  adjacentAttempts: (observation, args) => {
    const min = numberArg(argsRecord(args), 'min');
    if (min === null) return false;
    const value = observation['adjacentAttempts'];
    return typeof value === 'number' && value >= min;
  },

  duplicateAttempts: (observation, args) => {
    const min = numberArg(argsRecord(args), 'min');
    if (min === null) return false;
    const value = observation['duplicateAttempts'];
    return typeof value === 'number' && value >= min;
  },
};
