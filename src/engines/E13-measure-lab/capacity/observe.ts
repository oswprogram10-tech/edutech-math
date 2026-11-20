/**
 * E13 capacity Observation. 물의 양(mL)은 여기에만 있다. 화면·DOM·aria에는 두지 않는다.
 * 오개념 코드는 아직 엔진이 기록하지 않는다(`misconceptions`는 빈 배열).
 */
import { Rational } from '../../../core/math';
import type { Observation } from '../../../core/engine-sdk';
import { amountOf, capacityOf, cupsOf, isFull } from './settings';
import type { CapacityState } from './types';

/** 들이가 더 큰 그릇의 id. 같거나 그릇이 하나면 "". */
export function moreIdOf(state: CapacityState): string {
  const [a, b] = state.containers;
  if (a === undefined || b === undefined) return '';
  const order = capacityOf(a).compareTo(capacityOf(b));
  return order > 0 ? a.id : order < 0 ? b.id : '';
}

/** puzzle: targetMl과 같은 양이 든 첫 그릇 id. 없으면 null. */
export function reachedInOf(state: CapacityState): string | null {
  const target = Rational.parse(state.targetMl);
  if (target.isZero()) return null;
  const hit = state.containers.find((c) => amountOf(state, c.id).equals(target));
  return hit === undefined ? null : hit.id;
}

export function observeCapacity(state: CapacityState): Observation {
  const base = { mode: 'capacity', variant: state.variant, moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  if (state.variant === 'puzzle') {
    const reachedIn = reachedInOf(state);
    return {
      ...base,
      amounts: Object.fromEntries(
        state.containers.map((c) => [c.id, amountOf(state, c.id).toString()]),
      ),
      steps: state.steps,
      reached: reachedIn !== null,
      reachedIn,
      misconceptions: [],
    };
  }
  return {
    ...base,
    cups: Object.fromEntries(state.containers.map((c) => [c.id, cupsOf(state, c.id)])),
    full: Object.fromEntries(state.containers.map((c) => [c.id, isFull(state, c)])),
    allFull: state.containers.every((c) => isFull(state, c)),
    moreId: moreIdOf(state),
    misconceptions: [],
  };
}
