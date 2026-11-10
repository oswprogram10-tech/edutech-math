/** circle-sectors 관찰. 원주·넓이 값은 넣지 않는다(응답 칸이 판정한다). */
import type { Observation } from '../../../core/engine-sdk';
import { alternating, arranged, currentDivisions, isManual } from './reduce';
import type { CircleSectorsState } from './types';

export function maxArranged(state: CircleSectorsState): number {
  return state.arrangedDivisions.reduce((best, value) => (value > best ? value : best), 0);
}

export function arrangeAtLeast(state: CircleSectorsState, divisions: number): boolean {
  return maxArranged(state) >= divisions;
}

export function observeCircleSectors(state: CircleSectorsState): Observation {
  return {
    mode: 'circle-sectors',
    divisions: currentDivisions(state),
    level: state.level,
    manual: isManual(state),
    placedCount: state.slots.filter((slot) => slot !== null).length,
    alternating: alternating(state),
    arranged: arranged(state),
    arrangedDivisions: [...state.arrangedDivisions],
    radius: state.settings.radius,
    pi: state.settings.pi,
  };
}
