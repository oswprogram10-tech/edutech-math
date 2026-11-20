/**
 * E20 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(범위 밖·최대 초과·모드 불일치)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { cleanExpr, cleanInteger } from './bar';
import { isDistanceOnly, racersComplete } from './observe';
import { isInt, normalizeConfig, prefixCells } from './settings';
import { MAX_SAVED, PERCENT_CELLS, SAME_PREDICTION } from './types';
import type {
  Amounts,
  BarState,
  MixState,
  PercentState,
  RacerState,
  RateState,
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

function sameRacers(a: readonly RacerState[], b: readonly RacerState[]): boolean {
  return a.every((r, i) => r.distance === b[i]?.distance && r.time === b[i]?.time);
}

function reduceRate(state: RateState, action: RatioAction): RateState {
  const { settings } = state;
  switch (action.type) {
    case 'set': {
      const racer = state.racers.find((r) => r.id === action.racerId);
      if (!racer) return state;
      if (action.field !== 'distance' && action.field !== 'time') return state;
      const editable = action.field === 'distance' ? racer.editDistance : racer.editTime;
      const max = action.field === 'distance' ? settings.maxDistance : settings.maxTime;
      if (!editable || !isInt(action.value, 1, max)) return state;
      if (racer[action.field] === action.value) return state;
      return {
        ...state,
        racers: state.racers.map((r) =>
          r.id === racer.id ? { ...r, [action.field]: action.value } : r,
        ),
      };
    }
    case 'predict': {
      if (state.prediction !== null || !racersComplete(state.racers)) return state;
      const known =
        action.value === SAME_PREDICTION || state.racers.some((r) => r.id === action.value);
      if (!known) return state;
      return {
        ...state,
        prediction: action.value,
        distanceOnly: isDistanceOnly(state.racers, action.value),
      };
    }
    case 'run':
      if (!racersComplete(state.racers)) return state;
      if (settings.predictFirst && state.prediction === null) return state;
      return { ...state, runs: state.runs + 1 };
    case 'reset':
      // 예측·실행 기록은 지우지 않는다.
      return sameRacers(state.racers, state.initialRacers)
        ? state
        : { ...state, racers: state.initialRacers };
    default:
      return state;
  }
}

function reducePercent(state: PercentState, action: RatioAction): PercentState {
  if (action.type === 'reset') {
    return state.cells.length === state.initialCells.length &&
      state.cells.every((c, i) => c === state.initialCells[i])
      ? state
      : { ...state, cells: state.initialCells };
  }
  if (!state.settings.editable) return state;
  switch (action.type) {
    case 'toggle': {
      if (!isInt(action.index, 0, PERCENT_CELLS - 1)) return state;
      const on = state.cells.includes(action.index);
      const cells = on
        ? state.cells.filter((c) => c !== action.index)
        : [...state.cells, action.index].sort((a, b) => a - b);
      return { ...state, cells };
    }
    case 'fill-to': {
      if (!isInt(action.count, 0, PERCENT_CELLS)) return state;
      const cells = prefixCells(action.count);
      return cells.length === state.cells.length && cells.every((c, i) => c === state.cells[i])
        ? state
        : { ...state, cells };
    }
    case 'clear':
      return state.cells.length === 0 ? state : { ...state, cells: [] };
    default:
      return state;
  }
}

function reduceBar(state: BarState, action: RatioAction): BarState {
  const { settings } = state;
  switch (action.type) {
    case 'mark': {
      if (!isInt(action.index, 0, settings.tokens.length - 1)) return state;
      const current = state.marks[action.index];
      if (state.tool === 'erase' || current === state.tool) {
        if (current === undefined) return state;
        const kept = Object.entries(state.marks).filter(([key]) => Number(key) !== action.index);
        return { ...state, marks: Object.fromEntries(kept) };
      }
      return { ...state, marks: { ...state.marks, [action.index]: state.tool } };
    }
    case 'set-tool':
      if (action.tool !== 'total' && action.tool !== 'ratio' && action.tool !== 'erase') {
        return state;
      }
      return state.tool === action.tool ? state : { ...state, tool: action.tool };
    case 'set-unit': {
      const value = cleanInteger(action.value);
      if (settings.look === 'symbols' || value === undefined || value === state.unit) return state;
      return { ...state, unit: value };
    }
    case 'set-part': {
      const value = cleanInteger(action.value);
      if (!isInt(action.index, 0, settings.parts.length - 1)) return state;
      if (settings.known?.part === action.index) return state;
      if (value === undefined || value === state.partValues[action.index]) return state;
      return {
        ...state,
        partValues: state.partValues.map((v, i) => (i === action.index ? value : v)),
      };
    }
    case 'set-total': {
      const value = cleanInteger(action.value);
      if (settings.total !== null || value === undefined || value === state.totalValue) {
        return state;
      }
      return { ...state, totalValue: value };
    }
    case 'set-expr': {
      const value = cleanExpr(action.value);
      if (settings.look !== 'symbols' || value === undefined) return state;
      return value === state.expr ? state : { ...state, expr: value };
    }
    case 'reset': {
      // 칠한 형광펜과 쓴 값을 모두 처음으로 돌린다(도구는 그대로).
      const partValues = settings.parts.map((_, i) =>
        settings.known !== null && settings.known.part === i ? String(settings.known.value) : null,
      );
      const same =
        state.unit === null &&
        state.totalValue === null &&
        state.expr === null &&
        Object.keys(state.marks).length === 0 &&
        partValues.every((v, i) => v === state.partValues[i]);
      return same
        ? state
        : { ...state, marks: {}, unit: null, totalValue: null, expr: null, partValues };
    }
    default:
      return state;
  }
}

export function reduce(state: RatioState, action: RatioAction): RatioState {
  if (state.error !== null) return state;
  switch (state.mode) {
    case 'mix':
      return reduceMix(state, action);
    case 'resize':
      return reduceResize(state, action);
    case 'rate':
      return reduceRate(state, action);
    case 'percent':
      return reducePercent(state, action);
    case 'bar-model':
      return reduceBar(state, action);
  }
}
