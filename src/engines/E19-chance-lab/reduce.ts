/**
 * E19 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(범위 밖·모드 불일치·예측 전 끌기)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { Rational } from '../../core/math';
import { emptyCounts, isSeed, sameDevice, spinOnce, tally, totalOf } from './device';
import { isInt, isOutcome, normalizeConfig, parseRational } from './settings';
import {
  LAST_COUNT,
  MAX_MARBLES,
  MAX_MARBLES_PER_COLOR,
  MAX_SECTORS,
  MAX_SECTOR_SIZE,
  OUTCOMES,
} from './types';
import type {
  ChanceAction,
  ChanceConfig,
  ChanceState,
  Device,
  LevelingState,
  OutlierState,
  SeesawState,
  SimulateState,
  SpinnerState,
  WordsState,
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

// ── words ────────────────────────────────────────────────

function reduceWords(state: WordsState, action: ChanceAction): WordsState {
  if (action.type === 'reset') {
    return state.cards.every((c) => state.placements[c.id] === null)
      ? state
      : { ...state, placements: Object.fromEntries(state.cards.map((c) => [c.id, null])) };
  }
  if (action.type === 'place') {
    if (!state.cards.some((c) => c.id === action.cardId)) return state;
    const slot = parseRational(action.slot);
    if (slot === null) return state;
    const canonical = state.slotValues.find((v) => Rational.parse(v).equals(slot));
    if (canonical === undefined || state.placements[action.cardId] === canonical) return state;
    return { ...state, placements: { ...state.placements, [action.cardId]: canonical } };
  }
  if (action.type === 'unplace') {
    if (!state.cards.some((c) => c.id === action.cardId)) return state;
    if (state.placements[action.cardId] === null) return state;
    return { ...state, placements: { ...state.placements, [action.cardId]: null } };
  }
  return state;
}

// ── 장치(spinner·simulate 공통) ───────────────────────────

/** 장치를 바꾸는 Action이면 새 장치를, 아니면 undefined(Action 종류가 아님)·null(거절)을 돌려준다. */
function editDevice(device: Device, action: ChanceAction): Device | null | undefined {
  switch (action.type) {
    case 'sector-add': {
      if (device.type !== 'spinner' || !isOutcome(action.color)) return null;
      if (device.sectors.length >= MAX_SECTORS) return null;
      return { type: 'spinner', sectors: [...device.sectors, { color: action.color, size: 1 }] };
    }
    case 'sector-remove': {
      if (device.type !== 'spinner' || device.sectors.length <= 1) return null;
      if (!isInt(action.index, 0, device.sectors.length - 1)) return null;
      return { type: 'spinner', sectors: device.sectors.filter((_, i) => i !== action.index) };
    }
    case 'sector-color': {
      if (device.type !== 'spinner' || !isOutcome(action.color)) return null;
      if (!isInt(action.index, 0, device.sectors.length - 1)) return null;
      if (device.sectors[action.index]?.color === action.color) return null;
      return {
        type: 'spinner',
        sectors: device.sectors.map((s, i) =>
          i === action.index ? { ...s, color: action.color } : s,
        ),
      };
    }
    case 'sector-size': {
      if (device.type !== 'spinner' || !isInt(action.size, 1, MAX_SECTOR_SIZE)) return null;
      if (!isInt(action.index, 0, device.sectors.length - 1)) return null;
      if (device.sectors[action.index]?.size === action.size) return null;
      return {
        type: 'spinner',
        sectors: device.sectors.map((s, i) =>
          i === action.index ? { ...s, size: action.size } : s,
        ),
      };
    }
    case 'marble-set': {
      if (device.type !== 'bag' || !isOutcome(action.color)) return null;
      if (!isInt(action.count, 0, MAX_MARBLES_PER_COLOR)) return null;
      const marbles = OUTCOMES.map((color) => ({
        color,
        count:
          color === action.color
            ? action.count
            : (device.marbles.find((m) => m.color === color)?.count ?? 0),
      }));
      const next: Device = { type: 'bag', marbles };
      const total = totalOf(next);
      if (total < 1 || total > MAX_MARBLES) return null;
      return sameDevice(device, next) ? null : next;
    }
    default:
      return undefined;
  }
}

function resetDevice<T extends SpinnerState | SimulateState>(state: T): T {
  return { ...state, device: state.initialDevice, edits: 0 };
}

function reduceSpinner(state: SpinnerState, action: ChanceAction): SpinnerState {
  if (action.type === 'reset') {
    const fresh = {
      ...resetDevice(state),
      trials: 0,
      counts: emptyCounts(),
      last: [],
      lastPick: null,
    };
    return state.trials === 0 && state.edits === 0 && sameDevice(state.device, state.initialDevice)
      ? state
      : fresh;
  }
  if (action.type === 'spin') {
    if (!isSeed(action.seed) || totalOf(state.device) < 1) return state;
    const { pick, outcome } = spinOnce(state.device, action.seed);
    const counts = { ...state.counts, [outcome]: state.counts[outcome] + 1 };
    return {
      ...state,
      trials: state.trials + 1,
      counts,
      last: [...state.last, outcome].slice(-LAST_COUNT),
      lastPick: pick,
    };
  }
  const device = editDevice(state.device, action);
  if (device === undefined || device === null || !state.editable) return state;
  return {
    ...state,
    device,
    edits: state.edits + 1,
    trials: 0,
    counts: emptyCounts(),
    last: [],
    lastPick: null,
  };
}

function reduceSimulate(state: SimulateState, action: ChanceAction): SimulateState {
  if (action.type === 'reset') {
    return state.runs === 0 && state.edits === 0 && sameDevice(state.device, state.initialDevice)
      ? state
      : { ...resetDevice(state), results: [], runs: 0 };
  }
  if (action.type === 'clear') {
    return state.results.length === 0 && state.runs === 0
      ? state
      : { ...state, results: [], runs: 0 };
  }
  if (action.type === 'run') {
    if (!state.batches.includes(action.batch) || !isSeed(action.seed)) return state;
    if (totalOf(state.device) < 1) return state;
    const counts = tally(state.device, action.seed, action.batch);
    const results = state.batches
      .map((batch) =>
        batch === action.batch ? { batch, counts } : state.results.find((r) => r.batch === batch),
      )
      .filter((r): r is { batch: number; counts: typeof counts } => r !== undefined);
    return { ...state, results, runs: state.runs + 1 };
  }
  const device = editDevice(state.device, action);
  if (device === undefined || device === null || !state.editable) return state;
  return { ...state, device, edits: state.edits + 1, results: [], runs: 0 };
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
    case 'words':
      return reduceWords(state, action);
    case 'spinner':
      return reduceSpinner(state, action);
    case 'simulate':
      return reduceSimulate(state, action);
  }
}
