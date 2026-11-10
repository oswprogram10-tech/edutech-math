/** geoboard 고정 둘레의 판정(T103). 순서 무관 (가로, 세로) 쌍만 본다. */
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

function logRecords(observation: Observation): Readonly<Record<string, JsonValue>>[] {
  const value = observation['log'];
  if (!Array.isArray(value)) return [];
  const result: Readonly<Record<string, JsonValue>>[] = [];
  for (const item of value) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) result.push(item);
  }
  return result;
}

/** (가로, 세로)가 순서와 상관없이 같은지. */
function sameRect(
  entry: Readonly<Record<string, JsonValue>>,
  width: number,
  height: number,
): boolean {
  const entryWidth = entry['width'];
  const entryHeight = entry['height'];
  if (typeof entryWidth !== 'number' || typeof entryHeight !== 'number') return false;
  return (
    (entryWidth === width && entryHeight === height) ||
    (entryWidth === height && entryHeight === width)
  );
}

export const perimeterPredicates: Readonly<Record<string, EnginePredicate>> = {
  loggedDistinctRects: (observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    if (count === null) return false;
    const seen = new Set<string>();
    for (const entry of logRecords(observation)) {
      const width = entry['width'];
      const height = entry['height'];
      if (typeof width !== 'number' || typeof height !== 'number') continue;
      seen.add(`${width},${height}`);
    }
    return seen.size >= count;
  },

  loggedRect: (observation, args) => {
    const record = argsRecord(args);
    const width = numberArg(record, 'width');
    const height = numberArg(record, 'height');
    if (width === null || height === null) return false;
    return logRecords(observation).some((entry) => sameRect(entry, width, height));
  },

  currentRect: (observation, args) => {
    const record = argsRecord(args);
    const width = numberArg(record, 'width');
    const height = numberArg(record, 'height');
    if (width === null || height === null) return false;
    const current = recordOf(observation['rect']);
    return current !== null && sameRect(current, width, height);
  },
};
