/**
 * E13 compare-direct 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(없는 물건·이미 한 펴기·붓기·판 밖·같은 자리)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { rat } from '../rat';
import { areaHome, boundsOf, homeOf, normalizeCompare } from './settings';
import type { CompareAction, CompareConfig, CompareState } from './types';

export function createCompareState(config: CompareConfig): CompareState {
  return normalizeCompare(config);
}

function intIn(text: string, min: number, max: number): number | null {
  const value = rat(text);
  if (value === null || !value.isInteger()) return null;
  const n = Number(value.n);
  return n >= min && n <= max ? n : null;
}

function moveItem<T extends { readonly id: string; readonly x: string; readonly y: string }>(
  items: readonly T[],
  id: string,
  x: string,
  y: string,
): readonly T[] {
  return items.map((item) => (item.id === id ? { ...item, x, y } : item));
}

export function reduceCompare(state: CompareState, action: CompareAction): CompareState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'straighten': {
      if (state.attribute !== 'length' || !state.straighten) return state;
      const item = state.items.find((candidate) => candidate.id === action.id);
      if (!item || item.shape !== 'curvy' || state.straightened.includes(item.id)) return state;
      return { ...state, straightened: [...state.straightened, item.id], moves: state.moves + 1 };
    }
    case 'place': {
      if (state.attribute === 'capacity') return state;
      const bounds = boundsOf(state, action.id);
      if (!bounds) return state;
      const x = intIn(action.x, 0, bounds.maxX);
      const y = intIn(action.y, 0, bounds.maxY);
      if (x === null || y === null) return state;
      const nx = String(x);
      const ny = String(y);
      const current = state.items.find((item) => item.id === action.id);
      if (!current || (current.x === nx && current.y === ny)) return state;
      if (state.attribute === 'length') {
        return {
          ...state,
          items: moveItem(state.items, action.id, nx, ny),
          moves: state.moves + 1,
        };
      }
      return {
        ...state,
        items: moveItem(state.items, action.id, nx, ny),
        last: action.id,
        moves: state.moves + 1,
      };
    }
    case 'pour': {
      if (state.attribute !== 'capacity' || !state.pour) return state;
      if (!state.items.some((item) => item.id === action.id)) return state;
      if (state.poured.includes(action.id)) return state;
      return { ...state, poured: [...state.poured, action.id], moves: state.moves + 1 };
    }
    case 'reset': {
      if (state.moves === 0) return state;
      if (state.attribute === 'length') {
        return {
          ...state,
          items: state.items.map((item, index) => ({ ...item, ...homeOf(index, item.offset) })),
          straightened: [],
          moves: 0,
        };
      }
      if (state.attribute === 'area') {
        return {
          ...state,
          items: state.items.map((item, index) => ({ ...item, ...areaHome(state.items, index) })),
          last: null,
          moves: 0,
        };
      }
      return { ...state, poured: [], moves: 0 };
    }
    default:
      return state;
  }
}
