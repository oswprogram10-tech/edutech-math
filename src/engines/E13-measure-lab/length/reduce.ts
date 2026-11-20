/**
 * E13 length 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(40개 초과·띠 밖·자를 만든 뒤 조각 변경·조건 미달 자 만들기)은 상태 그대로를 돌려준다.
 */
import { rat } from '../rat';
import { unitOf } from '../units';
import { normalizeLength, rulerReady, validStart } from './settings';
import { MAX_PIECES } from './types';
import type { LengthAction, LengthConfig, MeasureState } from './types';

export function createLengthState(config: LengthConfig): MeasureState {
  return normalizeLength(config);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function reduceLength(state: MeasureState, action: LengthAction): MeasureState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'add': {
      if (state.rulerMade || state.pieces.length >= MAX_PIECES) return state;
      if (!state.units.includes(action.unit) || unitOf(action.unit) === undefined) return state;
      const start = rat(action.start);
      if (start === null || !validStart(state, action.unit, start)) return state;
      return {
        ...state,
        pieces: [...state.pieces, { unit: action.unit, start: start.toString() }],
        moves: state.moves + 1,
      };
    }
    case 'move': {
      if (state.rulerMade || !isInt(action.index, 0, state.pieces.length - 1)) return state;
      const piece = state.pieces[action.index];
      const start = rat(action.start);
      if (!piece || start === null || !validStart(state, piece.unit, start)) return state;
      if (piece.start === start.toString()) return state;
      return {
        ...state,
        pieces: state.pieces.map((item, index) =>
          index === action.index ? { ...item, start: start.toString() } : item,
        ),
        moves: state.moves + 1,
      };
    }
    case 'remove': {
      if (state.rulerMade || !isInt(action.index, 0, state.pieces.length - 1)) return state;
      return {
        ...state,
        pieces: state.pieces.filter((_, index) => index !== action.index),
        moves: state.moves + 1,
      };
    }
    case 'make-ruler': {
      if (!state.buildRuler || state.rulerMade || !rulerReady(state)) return state;
      return { ...state, rulerMade: true, moves: state.moves + 1 };
    }
    case 'label': {
      if (!state.rulerMade) return state;
      if (!isInt(action.tick, 0, 10) || !isInt(action.value, 0, 10)) return state;
      if (state.labels[String(action.tick)] === action.value) return state;
      return {
        ...state,
        labels: { ...state.labels, [String(action.tick)]: action.value },
        moves: state.moves + 1,
      };
    }
    case 'reset': {
      if (state.pieces.length === 0 && !state.rulerMade && state.moves === 0) return state;
      return { ...state, pieces: [], rulerMade: false, labels: {}, moves: 0 };
    }
    default:
      return state;
  }
}
