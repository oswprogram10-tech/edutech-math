/**
 * E13 map-route Observation. 경로 합계·목표와의 차이·가장 가까운 경로의 차이는 여기에만 있고
 * 화면·DOM·aria에는 두지 않는다.
 */
import type { Observation } from '../../../core/engine-sdk';
import { bestDiffOf, totalOf } from './settings';
import type { RouteState } from './types';

/** 끝 노드가 to인가(to가 없으면 구간을 하나라도 이었는가). */
export function reachedTo(state: RouteState): boolean {
  if (state.used.length === 0) return false;
  return state.to === null || state.path[state.path.length - 1] === state.to;
}

export function observeRoute(state: RouteState): Observation {
  const base = { mode: 'map-route', moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  const totalM = totalOf(state);
  const diffFromTarget = Math.abs(totalM - state.targetM);
  return {
    ...base,
    path: [...state.path],
    totalM,
    diffFromTarget,
    reachedTo: reachedTo(state),
    bestDiff: bestDiffOf(state),
    misconceptions: [],
  };
}
