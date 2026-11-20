/** E13 weight의 공개 판정(순수 함수). */
import type { EnginePredicate, JsonValue, Observation } from '../../../core/engine-sdk';

function field(args: JsonValue | undefined, key: string): JsonValue | undefined {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  return args[key];
}

export const weightPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** 학생이 예측을 했다. */
  predictionLocked: (observation: Observation) => observation['predictionLocked'] === true,
  /** args `{ id }`: 학생이 그 물건이 더 무겁다고 예측했다. */
  predictionIs: (observation, args) => {
    const id = field(args, 'id');
    return (
      typeof id === 'string' &&
      observation['predictionLocked'] === true &&
      observation['prediction'] === id
    );
  },
  /** args `{ a, b }`: 한 번이라도 a와 b를 서로 반대 접시에 하나씩 올렸다. */
  compared: (observation, args) => {
    const a = field(args, 'a');
    const b = field(args, 'b');
    const list = observation['pairsCompared'];
    if (typeof a !== 'string' || typeof b !== 'string' || a === b || !Array.isArray(list)) {
      return false;
    }
    return list.includes(a < b ? `${a}|${b}` : `${b}|${a}`);
  },
  /** args `{ id }`: 그 물건을 용수철저울에 걸었다. */
  hungIs: (observation, args) => {
    const id = field(args, 'id');
    return typeof id === 'string' && observation['hung'] === id;
  },
  /** 양쪽 접시에 올린 것이 있고 무게가 같다. */
  balanced: (observation: Observation) => observation['balanced'] === true,
  /** args `{ n }`: 오른쪽 접시의 클립이 n개다(n은 1 이상). */
  clipsIs: (observation, args) => {
    const n = field(args, 'n');
    return typeof n === 'number' && n >= 1 && observation['clips'] === n;
  },
};
