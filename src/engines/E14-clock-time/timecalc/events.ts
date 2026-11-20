/** E14 time-calc의 공개 이벤트·판정(순수 함수). 이벤트에는 시간 값을 싣지 않고 횟수만 싣는다. */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { TimeCalcState } from './types';

export const TIMECALC_EVENT_NAMES = ['time-calc-changed', 'bundled', 'unbundled'] as const;

export function emitTimeCalc(prev: TimeCalcState, next: TimeCalcState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [
    { name: 'time-calc-changed', payload: { moved: next.moves >= 1 } },
  ];
  if (next.bundles > prev.bundles)
    events.push({ name: 'bundled', payload: { bundles: next.bundles } });
  if (next.unbundles > prev.unbundles) {
    events.push({ name: 'unbundled', payload: { unbundles: next.unbundles } });
  }
  return events;
}

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

export const timeCalcPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ big, small }`: 지금 줄이 큰 단위 big칸, 작은 단위 small칸이다. */
  valueIs: (observation, args) => {
    const big = number(args, 'big');
    const small = number(args, 'small');
    return (
      big !== null &&
      small !== null &&
      observation['mode'] === 'time-calc' &&
      observation['big'] === big &&
      observation['small'] === small
    );
  },
  /** 작은 단위가 60 미만이다(묶기를 마쳤다). */
  normalized: (observation) => observation['normalized'] === true,
  /** args `{ n }`: 묶기를 n번 이상 했다. */
  bundledAtLeast: atLeast('bundles'),
  /** args `{ n }`: 풀기를 n번 이상 했다. */
  unbundledAtLeast: atLeast('unbundles'),
  /** sub에서 빼기를 했다. */
  tookAway: (observation) => observation['tookAway'] === true,
};
