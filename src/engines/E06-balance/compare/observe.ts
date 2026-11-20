/** compare 관찰 결과. 무게 숫자는 담지 않고, 무거운 순서만 담는다. */
import type { Observation } from '../../../core/engine-sdk';
import { readCompare } from './reduce';
import type { CompareState } from './types';

function byCode(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 무거운 순(같은 무게는 id 순). 모든 items 기준이다. */
export function heavyFirst(state: CompareState): string[] {
  return [...state.items]
    .sort((a, b) => b.weight - a.weight || byCode(a.id, b.id))
    .map((item) => item.id);
}

export function observeCompare(state: CompareState): Observation {
  const reading = readCompare(state);
  const order = heavyFirst(state);
  return {
    mode: 'compare',
    left: [...state.left],
    right: [...state.right],
    tilt: reading.tilt,
    balanced: reading.balanced,
    weighings: state.seen.length,
    pairsCompared: [...state.pairs].sort(byCode),
    heaviest: order[0] ?? '',
    orderHeavyFirst: order,
    misconceptions: [],
  };
}
