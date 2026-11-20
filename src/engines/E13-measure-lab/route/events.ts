/** E13 map-route의 공개 판정(순수 함수). */
import type { EnginePredicate, JsonValue, Observation } from '../../../core/engine-sdk';

function field(args: JsonValue | undefined, key: string): JsonValue | undefined {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  return args[key];
}

export const routePredicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ nodes: string[] }`: 지나온 노드 순서가 정확히 같다. */
  pathIs: (observation: Observation, args) => {
    const nodes = field(args, 'nodes');
    const path = observation['path'];
    return (
      Array.isArray(nodes) &&
      Array.isArray(path) &&
      nodes.length === path.length &&
      nodes.every((node, i) => node === path[i])
    );
  },
  /** args `{ m }`: 경로 합이 m이다(m은 1 이상이라 구간을 하나 이상 이었을 때만 참이다). */
  totalIs: (observation: Observation, args) => {
    const m = field(args, 'm');
    return typeof m === 'number' && m >= 1 && observation['totalM'] === m;
  },
  /** 끝 노드가 to이다(to가 없으면 구간을 하나라도 이었다). */
  reachedTo: (observation: Observation) => observation['reachedTo'] === true,
  /** reachedTo이고 목표와의 차이가 가능한 경로 중 가장 작다. */
  closestToTarget: (observation: Observation) =>
    observation['reachedTo'] === true &&
    typeof observation['bestDiff'] === 'number' &&
    observation['diffFromTarget'] === observation['bestDiff'],
};
