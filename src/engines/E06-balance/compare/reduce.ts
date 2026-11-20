/**
 * compare 상태 전이와 읽기. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(없는 물건·같은 자리·가득 찬 접시)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { Rational } from '../../../core/math';
import { normalizeCompare } from './settings';
import type {
  CompareAction,
  CompareConfig,
  CompareItem,
  CompareState,
  CompareTarget,
  CompareTilt,
} from './types';

export function createCompareState(config: CompareConfig): CompareState {
  return normalizeCompare(config);
}

const TARGETS: readonly string[] = ['left', 'right', 'shelf'];

export function placeOf(state: CompareState, id: string): CompareTarget {
  if (state.left.includes(id)) return 'left';
  if (state.right.includes(id)) return 'right';
  return 'shelf';
}

export type PlaceReason = 'ok' | 'unknown' | 'same' | 'full';

/** 물건을 그 자리로 옮길 수 있는지(거절 이유). View가 안내 문구에 쓴다. */
export function placeReason(state: CompareState, id: unknown, pan: unknown): PlaceReason {
  if (state.error !== null) return 'unknown';
  if (typeof id !== 'string' || !state.items.some((item) => item.id === id)) return 'unknown';
  if (typeof pan !== 'string' || !TARGETS.includes(pan)) return 'unknown';
  if (placeOf(state, id) === pan) return 'same';
  if (pan !== 'shelf' && state[pan as 'left' | 'right'].length >= state.maxPerPan) return 'full';
  return 'ok';
}

function byCode(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** (왼쪽 집합, 오른쪽 집합) 조합 이름. id는 `[A-Za-z0-9_-]`라 구분자와 겹치지 않는다. */
export function comboKey(left: readonly string[], right: readonly string[]): string {
  return `${[...left].sort(byCode).join(',')}|${[...right].sort(byCode).join(',')}`;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort(byCode).join('|');
}

export function reduceCompare(state: CompareState, action: CompareAction): CompareState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'place': {
      const { id, pan } = action;
      if (placeReason(state, id, pan) !== 'ok') return state;
      const left = state.left.filter((other) => other !== id);
      const right = state.right.filter((other) => other !== id);
      if (pan === 'left') left.push(id);
      if (pan === 'right') right.push(id);
      let { seen, pairs } = state;
      if (left.length > 0 && right.length > 0) {
        const key = comboKey(left, right);
        if (!seen.includes(key)) seen = [...seen, key];
      }
      if (left.length === 1 && right.length === 1) {
        const key = pairKey(left[0] ?? '', right[0] ?? '');
        if (!pairs.includes(key)) pairs = [...pairs, key];
      }
      return { ...state, left, right, seen, pairs };
    }
    case 'reset': {
      // 비교 기록(seen·pairs)은 지우지 않는다.
      if (state.left.length === 0 && state.right.length === 0) return state;
      return { ...state, left: [], right: [] };
    }
    default:
      return state;
  }
}

export function itemOf(state: CompareState, id: string): CompareItem | undefined {
  return state.items.find((item) => item.id === id);
}

function sumOf(state: CompareState, ids: readonly string[]): Rational {
  return ids.reduce(
    (total, id) => total.add(Rational.of(itemOf(state, id)?.weight ?? 0)),
    Rational.of(0),
  );
}

export interface CompareReading {
  readonly left: Rational;
  readonly right: Rational;
  readonly tilt: CompareTilt;
  /** 양쪽에 물건이 있고 무게 합이 같다. */
  readonly balanced: boolean;
  readonly bothUsed: boolean;
}

/** 양쪽 무게 합을 비교한다. 한쪽만 비었으면 물건이 있는 쪽으로 기운다. */
export function readCompare(state: CompareState): CompareReading {
  const left = sumOf(state, state.left);
  const right = sumOf(state, state.right);
  const order = left.compareTo(right);
  const tilt: CompareTilt = order > 0 ? 'left' : order < 0 ? 'right' : 'level';
  const bothUsed = state.left.length > 0 && state.right.length > 0;
  return { left, right, tilt, balanced: bothUsed && order === 0, bothUsed };
}
