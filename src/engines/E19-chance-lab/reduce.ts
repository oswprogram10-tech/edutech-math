/**
 * E19 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(범위 밖·모드 불일치·예측 전 끌기)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { Rational } from '../../core/math';
import { isInt, normalizeConfig, parseRational } from './settings';
import type {
  ChanceAction,
  ChanceConfig,
  ChanceState,
  LevelingState,
  OutlierState,
  SeesawState,
} from './types';

export function createInitialState(config: ChanceConfig): ChanceState {
  return normalizeConfig(config);
}

function sameList(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** 받침점 격자: (value − min) ÷ step이 정수이고 min ≤ value ≤ max. */
export function onGrid(state: SeesawState, value: Rational): boolean {
  const step = Rational.parse(state.step);
  if (value.compareTo(Rational.of(state.min)) < 0) return false;
  if (value.compareTo(Rational.of(state.max)) > 0) return false;
  return value.sub(Rational.of(state.min)).div(step).isInteger();
}

function reduceLeveling(state: LevelingState, action: ChanceAction): LevelingState {
  if (action.type === 'reset') {
    return sameList(state.heights, state.data) && state.moves === 0
      ? state
      : { ...state, heights: [...state.data], moves: 0 };
  }
  if (action.type !== 'move') return state;
  const { from, to } = action;
  const last = state.heights.length - 1;
  if (!isInt(from, 0, last) || !isInt(to, 0, last) || from === to) return state;
  const fromHeight = state.heights[from] ?? 0;
  const toHeight = state.heights[to] ?? 0;
  if (fromHeight <= 0 || toHeight >= state.maxHeight) return state;
  const heights = state.heights.map((h, i) => (i === from ? h - 1 : i === to ? h + 1 : h));
  return { ...state, heights, moves: state.moves + 1 };
}

function reduceSeesaw(state: SeesawState, action: ChanceAction): SeesawState {
  if (action.type === 'reset') {
    const start = Rational.of(state.min).toString();
    return state.fulcrum === start && state.moves === 0
      ? state
      : { ...state, fulcrum: start, moves: 0 };
  }
  if (action.type !== 'set-fulcrum') return state;
  const value = parseRational(action.value);
  if (value === null || !onGrid(state, value)) return state;
  if (value.toString() === state.fulcrum) return state;
  return { ...state, fulcrum: value.toString(), moves: state.moves + 1 };
}

function reduceOutlier(state: OutlierState, action: ChanceAction): OutlierState {
  if (action.type === 'reset') {
    return sameList(state.values, state.data) && !state.dragged
      ? state
      : { ...state, values: [...state.data], dragged: false };
  }
  if (action.type === 'predict') {
    if (!state.requirePrediction || state.prediction !== null) return state;
    const value = parseRational(action.value);
    if (value === null) return state;
    if (value.compareTo(Rational.of(state.min)) < 0) return state;
    if (value.compareTo(Rational.of(state.max)) > 0) return state;
    return { ...state, prediction: value.toString() };
  }
  if (action.type !== 'set-value') return state;
  if (state.requirePrediction && state.prediction === null) return state;
  if (!isInt(action.value, state.min, state.max)) return state;
  if (state.values[state.dragIndex] === action.value) return state;
  const values = state.values.map((v, i) => (i === state.dragIndex ? action.value : v));
  return { ...state, values, dragged: true };
}

export function reduce(state: ChanceState, action: ChanceAction): ChanceState {
  if (state.error !== null) return state;
  switch (state.mode) {
    case 'leveling':
      return reduceLeveling(state, action);
    case 'seesaw':
      return reduceSeesaw(state, action);
    case 'outlier':
      return reduceOutlier(state, action);
  }
}
