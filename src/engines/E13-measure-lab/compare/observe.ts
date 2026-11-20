/**
 * E13 compare-direct Observation. 물건의 실제 길이·넓이·들이로 가린 결과(longest, order, larger, more)는
 * 여기에만 둔다. 화면·DOM에는 두지 않는다. 오개념은 엔진이 기록하지 않는다(콘텐츠 응답 칸이 맡는다).
 */
import { Rational } from '../../../core/math';
import type { Observation } from '../../../core/engine-sdk';
import { rat } from '../rat';
import type { CompareState, LengthCompareState } from './types';

function value(text: string): Rational {
  return rat(text) ?? Rational.of(0);
}

/** 긴 것부터 id 목록. 길이가 같으면 id 순서. */
export function lengthOrder(state: LengthCompareState): string[] {
  return [...state.items]
    .sort((a, b) => {
      const byLength = value(b.length).compareTo(value(a.length));
      if (byLength !== 0) return byLength;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((item) => item.id);
}

/** 지금 곧은 물건 id(처음부터 곧은 것과 펴기로 편 것). */
export function straightIds(state: LengthCompareState): string[] {
  return state.items
    .filter((item) => item.shape === 'straight' || state.straightened.includes(item.id))
    .map((item) => item.id);
}

/**
 * 출발선에 맞춘 물건 id. 출발선이 있으면 왼쪽 끝이 0인 것, 없으면 모두 같은 x일 때 전부(아니면 없음).
 */
export function alignedIds(state: LengthCompareState): string[] {
  if (state.baseline) return state.items.filter((item) => item.x === '0').map((item) => item.id);
  const first = state.items[0];
  if (first && state.items.every((item) => item.x === first.x)) {
    return state.items.map((item) => item.id);
  }
  return [];
}

export function observeCompare(state: CompareState): Observation {
  const common = { mode: 'compare-direct', attribute: state.attribute, moves: state.moves };
  if (state.error !== null) return { ...common, error: true, misconceptions: [] };
  if (state.attribute === 'length') {
    const order = lengthOrder(state);
    const straightened = straightIds(state);
    const aligned = alignedIds(state);
    return {
      ...common,
      straightened,
      aligned,
      allStraight: straightened.length === state.items.length,
      allAligned: aligned.length === state.items.length,
      longest: order[0] ?? '',
      order,
      misconceptions: [],
    };
  }
  if (state.attribute === 'area') {
    const [a, b] = state.items;
    const same = a !== undefined && b !== undefined && a.x === b.x && a.y === b.y;
    let larger = '';
    if (a && b) {
      const areaA = value(a.w).mul(value(a.h));
      const areaB = value(b.w).mul(value(b.h));
      const cmp = areaA.compareTo(areaB);
      larger = cmp > 0 ? a.id : cmp < 0 ? b.id : '';
    }
    return { ...common, overlapped: same, larger, misconceptions: [] };
  }
  const [a, b] = state.items;
  let more = '';
  if (a && b) {
    const cmp = value(a.capacity).compareTo(value(b.capacity));
    more = cmp > 0 ? a.id : cmp < 0 ? b.id : '';
  }
  return {
    ...common,
    poured: [...state.poured],
    pouredAll: state.poured.length === state.items.length,
    more,
    misconceptions: [],
  };
}
