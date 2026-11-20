/** E13 roll-circle의 공개 판정(순수 함수). */
import type { EnginePredicate, JsonValue, Observation } from '../../../../core/engine-sdk';

function field(args: JsonValue | undefined, key: string): JsonValue | undefined {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  return args[key];
}

function atLeast(observationKey: string) {
  return (observation: Observation, args?: JsonValue): boolean => {
    const n = field(args, 'n');
    const value = observation[observationKey];
    return typeof n === 'number' && Number.isInteger(n) && typeof value === 'number' && value >= n;
  };
}

export const rollPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** 굴렁쇠를 굴렸다(지금 지름 기준). */
  rolled: (observation) => observation['rolled'] === true,
  /** args `{ n }`: 기록표에 n줄 이상 쌓였다. */
  logCountAtLeast: atLeast('logCount'),
  /** args `{ d }`: 그 지름(정수 cm)을 기록표에 기록했다. */
  logged: (observation, args) => {
    const raw = field(args, 'd');
    const d = typeof raw === 'number' ? String(raw) : raw;
    const list = observation['log'];
    return (
      typeof d === 'string' &&
      Array.isArray(list) &&
      list.some(
        (row) => typeof row === 'object' && row !== null && !Array.isArray(row) && row['d'] === d,
      )
    );
  },
  /** args `{ n }`: 지름 막대를 n개 이상 이었다. */
  sticksAtLeast: atLeast('sticks'),
};
