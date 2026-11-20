/** E13 compare-direct의 공개 판정(순수 함수). 이벤트에는 비교 결과(정답)를 싣지 않는다. */
import type { EnginePredicate, JsonValue, Observation } from '../../../core/engine-sdk';

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function listHas(observation: Observation, key: string, id: unknown): boolean {
  const list = observation[key];
  return typeof id === 'string' && Array.isArray(list) && list.includes(id);
}

export const comparePredicates: Readonly<Record<string, EnginePredicate>> = {
  allStraight: (observation) => observation['allStraight'] === true,
  /** args `{ id }`: 그 물건이 지금 곧은가. */
  straightened: (observation, args) => listHas(observation, 'straightened', record(args)?.['id']),
  allAligned: (observation) => observation['allAligned'] === true,
  overlapped: (observation) => observation['overlapped'] === true,
  pouredAll: (observation) => observation['pouredAll'] === true,
  /** args `{ id }`: 그 컵의 물을 부었는가. */
  poured: (observation, args) => listHas(observation, 'poured', record(args)?.['id']),
};
