/** E13 unit-train의 공개 판정(순수 함수). */
import type { EnginePredicate, JsonValue, Observation } from '../../../core/engine-sdk';

function number(args: JsonValue | undefined, key: string): number | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  const value = args[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function atLeast(field: string) {
  return (observation: Observation, args?: JsonValue): boolean => {
    const n = number(args, 'n');
    const value = observation[field];
    return n !== null && typeof value === 'number' && value >= n;
  };
}

export const trainPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ m, cm }`: 지금 기차가 m칸 cm다. */
  trainIs: (observation, args) => {
    const m = number(args, 'm');
    const cm = number(args, 'cm');
    return m !== null && cm !== null && observation['m'] === m && observation['cm'] === cm;
  },
  /** cm 줄이 100 미만이다(승격을 마쳤다). */
  normalized: (observation) => observation['normalized'] === true,
  /** args `{ n }`: 승격을 n번 이상 했다. */
  promotedAtLeast: atLeast('promotes'),
  /** args `{ n }`: 풀기를 n번 이상 했다. */
  unpackedAtLeast: atLeast('unpacks'),
  /** sub에서 빼기를 했다. */
  tookAway: (observation) => observation['tookAway'] === true,
};
