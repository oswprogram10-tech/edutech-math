/**
 * E13 capacity 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(이미 가득·이미 빔·없는 그릇·바뀌지 않는 붓기)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { Rational } from '../../../core/math';
import { amountOf, capacityOf, containerOf, isEmpty, isFull, normalizeCapacity } from './settings';
import type { CapacityAction, CapacityConfig, CapacityState } from './types';

export function createCapacityState(config: CapacityConfig): CapacityState {
  return normalizeCapacity(config);
}

export type CapacityReject =
  'ok' | 'unknown' | 'wrong-variant' | 'full' | 'empty' | 'same' | 'source-empty' | 'target-full';

/** Action을 받아들일 수 있는지(거절 이유). View가 안내 글에 쓴다. */
export function rejectReason(state: CapacityState, action: CapacityAction): CapacityReject {
  if (state.error !== null) return 'unknown';
  const puzzle = state.variant === 'puzzle';
  switch (action.type) {
    case 'pour-cup': {
      if (puzzle) return 'wrong-variant';
      const c = containerOf(state, action.id);
      if (c === undefined) return 'unknown';
      return isFull(state, c) ? 'full' : 'ok';
    }
    case 'fill': {
      if (!puzzle) return 'wrong-variant';
      const c = containerOf(state, action.id);
      if (c === undefined) return 'unknown';
      return isFull(state, c) ? 'full' : 'ok';
    }
    case 'empty': {
      const c = containerOf(state, action.id);
      if (c === undefined) return 'unknown';
      return isEmpty(state, c.id) ? 'empty' : 'ok';
    }
    case 'pour': {
      if (!puzzle) return 'wrong-variant';
      const from = containerOf(state, action.from);
      const to = containerOf(state, action.to);
      if (from === undefined || to === undefined) return 'unknown';
      if (from.id === to.id) return 'same';
      if (isEmpty(state, from.id)) return 'source-empty';
      if (isFull(state, to)) return 'target-full';
      return 'ok';
    }
    case 'reset': {
      const clean = state.steps === 0 && state.containers.every((c) => isEmpty(state, c.id));
      return clean ? 'same' : 'ok';
    }
    default:
      return 'unknown';
  }
}

export function reduceCapacity(state: CapacityState, action: CapacityAction): CapacityState {
  if (rejectReason(state, action) !== 'ok') return state;
  const puzzle = state.variant === 'puzzle';
  const next = (amounts: Record<string, string>): CapacityState => ({
    ...state,
    amounts,
    steps: puzzle ? state.steps + 1 : state.steps,
    moves: state.moves + 1,
  });
  switch (action.type) {
    case 'pour-cup': {
      const c = containerOf(state, action.id);
      if (c === undefined) return state;
      const total = amountOf(state, c.id).add(Rational.parse(state.cupMl));
      return next({ ...state.amounts, [c.id]: total.toString() });
    }
    case 'fill': {
      const c = containerOf(state, action.id);
      if (c === undefined) return state;
      return next({ ...state.amounts, [c.id]: capacityOf(c).toString() });
    }
    case 'empty':
      return next({ ...state.amounts, [action.id]: '0' });
    case 'pour': {
      const from = containerOf(state, action.from);
      const to = containerOf(state, action.to);
      if (from === undefined || to === undefined) return state;
      const have = amountOf(state, from.id);
      const room = capacityOf(to).sub(amountOf(state, to.id));
      const moved = have.compareTo(room) < 0 ? have : room;
      return next({
        ...state.amounts,
        [from.id]: have.sub(moved).toString(),
        [to.id]: amountOf(state, to.id).add(moved).toString(),
      });
    }
    case 'reset':
      return {
        ...state,
        amounts: Object.fromEntries(state.containers.map((c) => [c.id, '0'])),
        steps: 0,
        moves: state.moves + 1,
      };
    default:
      return state;
  }
}
