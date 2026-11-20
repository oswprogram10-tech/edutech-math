/**
 * E20 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(범위 밖·최대 초과·모드 불일치)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { isInt, normalizeConfig } from './settings';
import { MAX_SAVED } from './types';
import type {
  Amounts,
  MixState,
  RatioAction,
  RatioConfig,
  RatioState,
  ResizeState,
  Size,
} from './types';

export function createInitialState(config: RatioConfig): RatioState {
  return normalizeConfig(config);
}

function sameAmounts(a: Amounts, b: Amounts): boolean {
  return a.milk === b.milk && a.syrup === b.syrup;
}

function sameSize(a: Size, b: Size): boolean {
  return a.w === b.w && a.h === b.h;
}

function reduceMix(state: MixState, action: RatioAction): MixState {
  const { settings } = state;
  switch (action.type) {
    case 'add':
    case 'remove': {
      if (!settings.hasCup || !isInt(action.n, 1, 99)) return state;
      if (action.ingredient !== 'milk' && action.ingredient !== 'syrup') return state;
      const delta = action.type === 'add' ? action.n : -action.n;
      const next = state.cup[action.ingredient] + delta;
      if (next < 0 || next > settings.maxEach) return state;
      return {
        ...state,
        cup: { ...state.cup, [action.ingredient]: next },
        addOps: state.addOps + 1,
      };
    }
    case 'scale': {
      if (!settings.hasCup || !isInt(action.k, 2, 10)) return state;
      if (state.cup.milk + state.cup.syrup === 0) return state;
      const milk = state.cup.milk * action.k;
      const syrup = state.cup.syrup * action.k;
      if (milk > settings.maxEach || syrup > settings.maxEach) return state;
      return { ...state, cup: { milk, syrup }, scaleOps: state.scaleOps + 1 };
    }
    case 'reset':
      return sameAmounts(state.cup, state.initialCup) ? state : { ...state, cup: state.initialCup };
    default:
      return state;
  }
}

function reduceResize(state: ResizeState, action: RatioAction): ResizeState {
  const { max } = state.settings;
  const fits = (size: Size) => isInt(size.w, 1, max) && isInt(size.h, 1, max);
  switch (action.type) {
    case 'step': {
      if (action.dim !== 'w' && action.dim !== 'h') return state;
      if (action.delta !== 1 && action.delta !== -1) return state;
      const size = { ...state.size, [action.dim]: state.size[action.dim] + action.delta };
      return fits(size) ? { ...state, size } : state;
    }
    case 'add-both': {
      if (!isInt(action.n, 1, max)) return state;
      const size = { w: state.size.w + action.n, h: state.size.h + action.n };
      return fits(size) ? { ...state, size, addOps: state.addOps + 1 } : state;
    }
    case 'scale': {
      if (!isInt(action.k, 2, 10)) return state;
      const size = { w: state.size.w * action.k, h: state.size.h * action.k };
      return fits(size) ? { ...state, size, scaleOps: state.scaleOps + 1 } : state;
    }
    case 'save': {
      if (state.saved.length >= MAX_SAVED) return state;
      if (state.saved.some((s) => sameSize(s, state.size))) return state;
      return { ...state, saved: [...state.saved, state.size] };
    }
    case 'reset':
      // 담은 크기·조작 횟수는 기록이라 지우지 않는다.
      return sameSize(state.size, state.base) ? state : { ...state, size: state.base };
    default:
      return state;
  }
}

export function reduce(state: RatioState, action: RatioAction): RatioState {
  if (state.error !== null) return state;
  return state.mode === 'mix' ? reduceMix(state, action) : reduceResize(state, action);
}
