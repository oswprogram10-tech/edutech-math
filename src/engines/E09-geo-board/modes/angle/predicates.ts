/** angle 모드의 판정(T102). Observation만 본다. */
import type { EnginePredicate, JsonValue, Observation } from '../../../../core/engine-sdk';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function angleRecords(observation: Observation): Readonly<Record<string, JsonValue>>[] {
  const value = observation['angles'];
  if (!Array.isArray(value)) return [];
  const result: Readonly<Record<string, JsonValue>>[] = [];
  for (const item of value) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) result.push(item);
  }
  return result;
}

function within(
  value: JsonValue | undefined,
  error: JsonValue | undefined,
  tolerance: number,
): boolean {
  if (typeof value !== 'number' || typeof error !== 'number') return false;
  return error <= tolerance;
}

export const anglePredicates: Readonly<Record<string, EnginePredicate>> = {
  readingsWithin: (observation, args) => {
    const tolerance = numberArg(argsRecord(args), 'tolerance');
    if (tolerance === null) return false;
    const records = angleRecords(observation);
    if (records.length === 0) return false;
    return records.every(
      (record) =>
        typeof record['reading'] === 'number' &&
        within(record['reading'], record['readingError'], tolerance),
    );
  },

  readingWithin: (observation, args) => {
    const record = argsRecord(args);
    const id = record['angle'];
    const tolerance = numberArg(record, 'tolerance');
    if (typeof id !== 'string' || tolerance === null) return false;
    return angleRecords(observation).some(
      (angle) => angle['id'] === id && within(angle['reading'], angle['readingError'], tolerance),
    );
  },

  estimatesWithin: (observation, args) => {
    const tolerance = numberArg(argsRecord(args), 'tolerance');
    if (tolerance === null) return false;
    const records = angleRecords(observation);
    if (records.length === 0) return false;
    return records.every(
      (record) =>
        typeof record['estimate'] === 'number' &&
        within(record['estimate'], record['estimateError'], tolerance),
    );
  },

  estimatedBeforeReading: (observation) => {
    const records = angleRecords(observation);
    const puzzle = recordOf(observation['puzzle']);
    let activity = false;
    for (const record of records) {
      if (typeof record['reading'] !== 'number') continue;
      activity = true;
      if (typeof record['estimate'] !== 'number') return false;
    }
    if (puzzle) {
      const fired = puzzle['fired'];
      if (Array.isArray(fired) && fired.length > 0) {
        activity = true;
        if (typeof puzzle['estimate'] !== 'number') return false;
      }
    }
    return activity;
  },

  readingFlipped: (observation) =>
    angleRecords(observation).some((record) => record['flipped'] === true),

  readWithoutAlign: (observation) =>
    angleRecords(observation).some(
      (record) => typeof record['reading'] === 'number' && record['readingAligned'] === false,
    ),

  laserHit: (observation) => {
    const puzzle = recordOf(observation['puzzle']);
    return puzzle !== null && puzzle['hit'] === true;
  },
};
