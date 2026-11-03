/**
 * E02 순수 reducer.
 *
 * - 무작위는 `createInitialState`에서 seed로 한 번만 쓴다(되감기·미러링에서 같은 그림).
 * - 같은 Action 목록은 언제나 같은 상태를 만든다.
 * - 좌표는 논리 좌표 정수만 저장한다.
 */
import { clamp } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import { summonPoint } from './layout';
import { FRAME_COLS, FRAME_ROWS, LOGICAL_HEIGHT, LOGICAL_WIDTH, splitKey } from './types';
import type {
  BridgeState,
  BubblePairsState,
  CounterColor,
  CountersAction,
  CountersConfig,
  CountersState,
  CounterMode,
  FlashState,
  FrameCounter,
  MeasureOutCounter,
  MeasureOutState,
  PairingState,
  PartWholeState,
  PlateCounter,
  RekenrekState,
  ShareState,
  SummonState,
  TenFrameState,
} from './types';

const MAX_CELLS = FRAME_COLS * FRAME_ROWS;

function integer(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

export function inferMode(config: CountersConfig): CounterMode {
  if (config.mode !== undefined) return config.mode;
  if (
    config.variant !== undefined ||
    config.bubbles !== undefined ||
    config.gap !== undefined ||
    config.target !== undefined ||
    config.rods !== undefined ||
    config.maxRods !== undefined ||
    config.tenMarker !== undefined
  ) {
    return 'part-whole';
  }
  if (config.rows !== undefined || config.skipBy !== undefined || config.colorBreak !== undefined) {
    return 'rekenrek';
  }
  if (
    config.predictFirst !== undefined ||
    config.labels !== undefined ||
    config.groupSize !== undefined ||
    config.groupSizeChoices !== undefined ||
    config.showRemainder !== undefined ||
    config.sentenceTemplate !== undefined
  ) {
    return config.groupSize !== undefined ||
      config.groupSizeChoices !== undefined ||
      config.showRemainder !== undefined ||
      config.sentenceTemplate !== undefined
      ? 'measure-out'
      : 'pairing';
  }
  if (
    config.count !== undefined ||
    config.range !== undefined ||
    config.layout !== undefined ||
    config.displayMs !== undefined
  ) {
    return 'flash';
  }
  if (
    config.frames !== undefined ||
    config.prefill !== undefined ||
    config.left !== undefined ||
    config.right !== undefined ||
    config.trayCount !== undefined ||
    config.swipeFill !== undefined ||
    config.showBond === 'never' ||
    config.showBond === 'after-move'
  ) {
    return 'ten-frame';
  }
  if (typeof config.groups === 'number') return 'share';
  if (
    config.total !== undefined ||
    Array.isArray(config.groups) ||
    config.parts !== undefined ||
    config.gesture !== undefined ||
    config.scene !== undefined ||
    config.showBond === 'none' ||
    config.showBond === 'structure' ||
    config.showBond === 'numbers'
  ) {
    return 'part-whole';
  }
  return 'summon';
}

/** seed 기반 결정적 난수. reduce에서는 쓰지 않는다. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillFirstFrame(count: number, frame: number, color: CounterColor): FrameCounter[] {
  const safe = Math.min(MAX_CELLS, Math.max(0, Math.trunc(count)));
  return Array.from({ length: safe }, (_, cell) => ({
    id: `f${frame}-${cell + 1}`,
    color,
    frame,
    cell,
    tray: -1,
  }));
}

function createSummon(config: CountersConfig): SummonState {
  const max = integer(config.max, 10, 0, 100);
  const start = integer(config.start, 0, 0, max);
  return {
    mode: 'summon',
    counters: Array.from({ length: start }, (_, index) => ({
      id: `s${index + 1}`,
      ...summonPoint(index),
      color: 'blue' as const,
    })),
    max,
    nextId: start + 1,
  };
}

function createTenFrame(config: CountersConfig): TenFrameState {
  const frames = config.frames === 2 ? 2 : 1;
  const prefill = integer(config.prefill, 0, 0, MAX_CELLS);
  const left = integer(config.left, prefill, 0, MAX_CELLS);
  const right = integer(config.right, 0, 0, MAX_CELLS);
  const trayCount = integer(config.trayCount, 10, 0, 20);

  const counters: FrameCounter[] = [];
  if (frames === 2) {
    counters.push(...fillFirstFrame(left, 0, 'red'));
    counters.push(...fillFirstFrame(right, 1, 'red'));
  } else {
    counters.push(...fillFirstFrame(prefill, 0, 'red'));
  }
  for (let index = 0; index < trayCount; index += 1) {
    counters.push({
      id: `t${index + 1}`,
      color: config.fillColor ?? 'blue',
      frame: null,
      cell: null,
      tray: index,
    });
  }

  return {
    mode: 'ten-frame',
    frames,
    counters,
    swipeFill: config.swipeFill ?? true,
    removable: config.removable ?? true,
    moves: 0,
    madeTenFirst: false,
    removals: [],
    bond: null,
  };
}

function createPartWhole(config: CountersConfig): PartWholeState {
  const plates = integer(config.parts, 2, 1, 6);
  const counts = Array.from({ length: plates }, () => 0);
  const scene = config.scene;

  if (scene && scene.kind === 'compare') {
    counts[0] = Math.max(0, Math.trunc(scene.numbers[0]));
    if (plates > 1) counts[1] = Math.max(0, Math.trunc(scene.numbers[1]));
  } else if (Array.isArray(config.groups)) {
    config.groups.slice(0, plates).forEach((value, index) => {
      counts[index] = Math.max(0, Math.trunc(value));
    });
  } else {
    counts[0] = integer(config.total, 5, 0, 100);
  }

  const counters: PlateCounter[] = [];
  let nextId = 1;
  counts.forEach((count, plate) => {
    for (let slot = 0; slot < count; slot += 1) {
      counters.push({ id: `p${nextId}`, plate, slot });
      nextId += 1;
    }
  });

  return {
    mode: 'part-whole',
    plates,
    counters,
    recorded: [],
    pairs: [],
    nextId,
  };
}

function createFlash(config: CountersConfig): FlashState {
  const displayMs = integer(config.displayMs, 1500, 500, 3000);
  const layout = config.layout ?? 'ten-frame';
  const seed = integer(config.seed, 1, 0, 2_147_483_647);
  const random = seededRandom(seed);

  let chosen: number;
  if (config.count !== undefined) {
    chosen = integer(config.count, 5, 0, 10);
  } else if (config.range !== undefined) {
    const low = integer(config.range[0], 1, 0, 10);
    const high = integer(config.range[1], 10, low, 10);
    chosen = low + Math.floor(random() * (high - low + 1));
  } else {
    chosen = 5;
  }

  let points: Point[];
  if (layout === 'random') {
    const slots: Point[] = [];
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        slots.push({
          x: 300 + column * 90 + Math.round((random() - 0.5) * 30),
          y: 230 + row * 120 + Math.round((random() - 0.5) * 30),
        });
      }
    }
    // 같은 seed면 같은 순서로 섞인다.
    for (let index = slots.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(random() * (index + 1));
      const current = slots[index];
      const other = slots[pick];
      if (current && other) {
        slots[index] = other;
        slots[pick] = current;
      }
    }
    points = slots.slice(0, chosen);
  } else {
    points = Array.from({ length: chosen }, (_, index) => {
      const table = {
        dice: 'dice',
        'ten-frame': 'ten-frame',
        fingers: 'fingers',
        random: 'random',
      } as const;
      return flashPosition(table[layout], index);
    });
  }

  return {
    mode: 'flash',
    phase: 'ready',
    chosen,
    shown: null,
    layout,
    displayMs,
    points,
  };
}

function flashPosition(layout: 'dice' | 'ten-frame' | 'fingers' | 'random', index: number): Point {
  // layout.ts를 순환 import 없이 쓰기 위해 여기서 같은 식을 쓴다.
  if (layout === 'ten-frame') {
    return {
      x: (LOGICAL_WIDTH - 340) / 2 + (index % 5) * 68 + 32,
      y: 120 + Math.floor(index / 5) * 68 + 32,
    };
  }
  if (layout === 'fingers') {
    return { x: 330 + Math.floor(index / 5) * 300 + (index % 5) * 46, y: 260 };
  }
  if (layout === 'dice') {
    if (index < 6) {
      return { x: 380 + (index % 3) * 80, y: 280 + Math.floor(index / 3) * 80 };
    }
    const local = index - 6;
    return { x: 340 + (local % 5) * 80, y: 260 + Math.floor(local / 5) * 80 };
  }
  return { x: 110 + (index % 10) * 66, y: 190 + Math.floor(index / 10) * 92 };
}

function createRekenrek(config: CountersConfig): RekenrekState {
  const rows = integer(config.rows, 2, 1, 10);
  return {
    mode: 'rekenrek',
    rows,
    left: Array.from({ length: rows }, () => 0),
    history: [],
    reached: [],
    fullRowPushes: 0,
    moves: 0,
  };
}

function createPairing(config: CountersConfig): PairingState {
  const count = integer(config.count, 12, 1, 20);
  const predictFirst = config.predictFirst !== false;
  return {
    mode: 'pairing',
    count,
    predictFirst,
    phase: predictFirst ? 'predict' : 'ready',
    prediction: null,
  };
}

function createShare(config: CountersConfig): ShareState {
  const groups = integer(typeof config.groups === 'number' ? config.groups : undefined, 2, 2, 6);
  const total = integer(config.total, 12, 0, 100);
  return {
    mode: 'share',
    groups,
    pile: total,
    plates: Array.from({ length: groups }, () => 0),
    rounds: 0,
  };
}

function measureOutPoint(index: number): Point {
  const column = index % 20;
  const row = Math.floor(index / 20);
  return { x: 66 + column * 44, y: 150 + row * 58 };
}

function createMeasureOut(config: CountersConfig): MeasureOutState {
  const raw = Array.isArray(config.groupSizeChoices)
    ? config.groupSizeChoices
        .filter((size) => Number.isFinite(size) && size >= 1 && size <= 10)
        .map((size) => Math.trunc(size))
    : [];
  const choices = [...new Set(raw)].sort((a, b) => a - b);
  const fixed = integer(config.groupSize, 2, 1, 10);
  const groupSize = choices.length > 0 ? null : fixed;
  const total = integer(config.total, 12, 0, 100);
  const random = seededRandom(integer(config.seed, 1, 0, 2_147_483_647));
  const counters: MeasureOutCounter[] = Array.from({ length: total }, (_, index) => {
    const point = measureOutPoint(index);
    return {
      id: `m${index + 1}`,
      x: point.x + Math.round((random() - 0.5) * 12),
      y: point.y + Math.round((random() - 0.5) * 10),
      bag: null,
    };
  });
  return {
    mode: 'measure-out',
    groupSize,
    choices,
    counters,
    bagCount: 0,
    lastAttempt: null,
  };
}

const DEFAULT_BUBBLES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 3, 7, 5];

function createBubblePairs(config: CountersConfig): BubblePairsState {
  const target = integer(config.target, 10, 2, 20);
  const pickUpTo = config.pickUpTo === 3 ? 3 : 2;
  const source = (config.bubbles ?? DEFAULT_BUBBLES)
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 9)
    .slice(0, 24);
  const random = seededRandom(integer(config.seed, 1, 0, 2_147_483_647));
  const shuffled = [...source];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const other = shuffled[swap];
    if (current === undefined || other === undefined) continue;
    shuffled[index] = other;
    shuffled[swap] = current;
  }
  const bubbles = shuffled.map((value, index) => ({
    id: `b${index + 1}`,
    value: Math.trunc(value),
    popped: false,
  }));
  return {
    mode: 'part-whole',
    variant: 'bubble-pairs',
    target,
    pickUpTo,
    bubbles,
    selected: [],
    lastMiss: null,
    pops: [],
    streak: 0,
    bestStreak: 0,
    misses: 0,
  };
}

function createBridge(config: CountersConfig): BridgeState {
  const gap = integer(config.gap, 10, 2, 20);
  const rawRods = Array.isArray(config.rods)
    ? config.rods.filter((length) => Number.isFinite(length) && length >= 1 && length <= 9)
    : [];
  const rods =
    rawRods.length > 0
      ? rawRods.map((length) => Math.trunc(length)).sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const maxRods = integer(config.maxRods, 2, 1, 5);
  const preset = (config.preset ?? [])
    .filter((length) => rods.includes(length))
    .slice(0, maxRods)
    .map((length) => Math.trunc(length));
  return {
    mode: 'part-whole',
    variant: 'bridge',
    gap,
    rods,
    maxRods,
    presetCount: preset.length,
    presetLocked: config.presetLocked === true,
    placed: preset,
    recorded: [],
  };
}

export function createInitialState(config: CountersConfig): CountersState {
  if (inferMode(config) === 'part-whole' && config.variant === 'bubble-pairs') {
    return createBubblePairs(config);
  }
  if (inferMode(config) === 'part-whole' && config.variant === 'bridge') {
    return createBridge(config);
  }
  switch (inferMode(config)) {
    case 'summon':
      return createSummon(config);
    case 'ten-frame':
      return createTenFrame(config);
    case 'part-whole':
      return createPartWhole(config);
    case 'flash':
      return createFlash(config);
    case 'rekenrek':
      return createRekenrek(config);
    case 'pairing':
      return createPairing(config);
    case 'share':
      return createShare(config);
    case 'measure-out':
      return createMeasureOut(config);
  }
}

// ─────────────────────────────────────────────────────────────
// 관찰용 계산(observe·events가 함께 쓴다)
// ─────────────────────────────────────────────────────────────

export function totalOf(state: CountersState): number {
  switch (state.mode) {
    case 'summon':
      return state.counters.length;
    case 'ten-frame':
      return state.counters.filter((counter) => counter.frame !== null).length;
    case 'part-whole':
      if ('variant' in state) {
        return state.variant === 'bridge'
          ? state.placed.reduce((sum, length) => sum + length, 0)
          : state.bubbles.filter((bubble) => !bubble.popped).length;
      }
      return state.counters.length;
    case 'flash':
      return state.phase === 'ready' ? 0 : state.chosen;
    case 'rekenrek':
      return state.left.reduce((sum, count) => sum + count, 0);
    case 'pairing':
      return state.count;
    case 'share':
      return state.pile + state.plates.reduce((sum, count) => sum + count, 0);
    case 'measure-out':
      return state.counters.length;
  }
}

// ─────────────────────────────────────────────────────────────
// 새 모드의 관찰용 계산
// ─────────────────────────────────────────────────────────────

export function rekenrekTotalOf(state: RekenrekState): number {
  return state.left.reduce((sum, count) => sum + count, 0);
}

export function pairingPairsOf(state: PairingState): number | null {
  return state.phase === 'paired' ? Math.floor(state.count / 2) : null;
}

export function pairingLeftoverOf(state: PairingState): number | null {
  return state.phase === 'paired' ? state.count % 2 : null;
}

export function shareEqualOf(state: ShareState): boolean {
  return state.plates.every((count) => count === state.plates[0]);
}

export function measureOutLooseOf(state: MeasureOutState): number {
  return state.counters.filter((counter) => counter.bag === null).length;
}

export function bubbleValuesOf(state: BubblePairsState): number[] {
  return state.bubbles.filter((bubble) => !bubble.popped).map((bubble) => bubble.value);
}

export function bubbleAllHitTarget(state: BubblePairsState): boolean {
  return (
    state.pops.length > 0 &&
    state.pops.every((values) => values.reduce((a, b) => a + b, 0) === state.target)
  );
}

export function bridgeSumOf(state: BridgeState): number {
  return state.placed.reduce((sum, length) => sum + length, 0);
}

export function frameFillOf(state: TenFrameState): number[] {
  return Array.from(
    { length: state.frames },
    (_, frame) => state.counters.filter((counter) => counter.frame === frame).length,
  );
}

export function platesOf(state: PartWholeState): number[] {
  return Array.from(
    { length: state.plates },
    (_, plate) => state.counters.filter((counter) => counter.plate === plate).length,
  );
}

export function unpairedOf(state: PartWholeState): number {
  return Math.max(0, state.counters.length - state.pairs.length * 2);
}

export function distinctSplitsOf(state: PartWholeState): number {
  return new Set(state.recorded.map(([a, b]) => splitKey(a, b))).size;
}

export function subtractStrategyOf(state: TenFrameState): 'from-ten' | 'sequential' | null {
  const first = state.removals[0];
  if (!first) return null;
  return first.full ? 'from-ten' : 'sequential';
}

/** 프레임이 가득 찼는지. */
export function isFull(state: TenFrameState, frame: number): boolean {
  return state.counters.filter((counter) => counter.frame === frame).length === MAX_CELLS;
}

function reflowSummon(counters: SummonState['counters']): SummonState['counters'] {
  return counters.map((counter, index) => ({ ...counter, ...summonPoint(index) }));
}

function withMadeTen(prev: TenFrameState, next: TenFrameState): TenFrameState {
  if (next.madeTenFirst) return next;
  // 다른 프레임을 비운 적이 없고, 이번 Action으로 처음 가득 찬 프레임이 생겼을 때만.
  if (next.removals.length > 0) return next;
  for (let frame = 0; frame < next.frames; frame += 1) {
    const before = prev.counters.filter((counter) => counter.frame === frame).length;
    const after = next.counters.filter((counter) => counter.frame === frame).length;
    if (before < MAX_CELLS && after === MAX_CELLS) {
      return { ...next, madeTenFirst: true };
    }
  }
  return next;
}

export function reduce(state: CountersState, action: CountersAction): CountersState {
  switch (state.mode) {
    case 'summon':
      return reduceSummon(state, action);
    case 'ten-frame':
      return reduceTenFrame(state, action);
    case 'part-whole':
      if ('variant' in state) {
        return state.variant === 'bridge'
          ? reduceBridge(state, action)
          : reduceBubble(state, action);
      }
      return reducePartWhole(state, action);
    case 'flash':
      return reduceFlash(state, action);
    case 'rekenrek':
      return reduceRekenrek(state, action);
    case 'pairing':
      return reducePairing(state, action);
    case 'share':
      return reduceShare(state, action);
    case 'measure-out':
      return reduceMeasureOut(state, action);
  }
}

function reduceSummon(state: SummonState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'summon': {
      const total = state.counters.length;
      const take = Math.max(0, Math.min(Math.trunc(action.count), state.max - total));
      if (take <= 0) return state;
      const counters = [...state.counters];
      let nextId = state.nextId;
      for (let index = 0; index < take; index += 1) {
        counters.push({
          id: `s${nextId}`,
          ...summonPoint(counters.length),
          color: 'blue',
        });
        nextId += 1;
      }
      return { ...state, counters: reflowSummon(counters), nextId };
    }

    case 'remove': {
      const counters = state.counters.filter((counter) => counter.id !== action.id);
      if (counters.length === state.counters.length) return state;
      return { ...state, counters: reflowSummon(counters) };
    }

    case 'move': {
      if (!state.counters.some((counter) => counter.id === action.id)) return state;
      const x = clamp(Math.round(action.x), 0, LOGICAL_WIDTH);
      const y = clamp(Math.round(action.y), 0, LOGICAL_HEIGHT);
      return {
        ...state,
        counters: state.counters.map((counter) =>
          counter.id === action.id ? { ...counter, x, y } : counter,
        ),
      };
    }

    default:
      return state;
  }
}

function reduceTenFrame(state: TenFrameState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'place': {
      const counter = state.counters.find((item) => item.id === action.id);
      if (!counter) return state;
      if (action.frame < 0 || action.frame >= state.frames) return state;
      if (action.cell < 0 || action.cell >= MAX_CELLS) return state;
      const occupied = state.counters.some(
        (item) =>
          item.id !== counter.id && item.frame === action.frame && item.cell === action.cell,
      );
      if (occupied) return state;
      if (counter.frame === action.frame && counter.cell === action.cell) return state;
      const next: TenFrameState = {
        ...state,
        counters: state.counters.map((item) =>
          item.id === counter.id ? { ...item, frame: action.frame, cell: action.cell } : item,
        ),
        bond: null,
      };
      return withMadeTen(state, next);
    }

    case 'take-out': {
      if (!state.removable) return state;
      const counter = state.counters.find((item) => item.id === action.id);
      if (!counter || counter.frame === null) return state;
      const wasFull = isFull(state, counter.frame);
      const next: TenFrameState = {
        ...state,
        counters: state.counters.map((item) =>
          item.id === counter.id ? { ...item, frame: null, cell: null } : item,
        ),
        removals: [...state.removals, { frame: counter.frame, full: wasFull }],
        bond: null,
      };
      return next;
    }

    case 'swipe-fill': {
      if (!state.swipeFill) return state;
      if (action.from === action.to) return state;
      if (action.from < 0 || action.from >= state.frames) return state;
      if (action.to < 0 || action.to >= state.frames) return state;

      const source = state.counters
        .filter((counter) => counter.frame === action.from)
        .sort((a, b) => (a.cell ?? 0) - (b.cell ?? 0));
      const filled = new Set(
        state.counters
          .filter((counter) => counter.frame === action.to)
          .map((counter) => counter.cell),
      );
      const empty: number[] = [];
      for (let cell = 0; cell < MAX_CELLS; cell += 1) {
        if (!filled.has(cell)) empty.push(cell);
      }
      const moveCount = Math.min(source.length, empty.length);
      if (moveCount === 0) return state;

      const moving = source.slice(0, moveCount);
      const target = new Map<string, number>();
      moving.forEach((counter, index) => {
        const cell = empty[index];
        if (cell !== undefined) target.set(counter.id, cell);
      });

      const next: TenFrameState = {
        ...state,
        counters: state.counters.map((counter) => {
          const cell = target.get(counter.id);
          return cell === undefined ? counter : { ...counter, frame: action.to, cell };
        }),
        moves: state.moves + 1,
        bond: [source.length, moveCount, source.length - moveCount],
      };
      return withMadeTen(state, next);
    }

    default:
      return state;
  }
}

function reducePartWhole(state: PartWholeState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'move-to-plate': {
      if (action.plate < 0 || action.plate >= state.plates) return state;
      const counter = state.counters.find((item) => item.id === action.id);
      if (!counter || counter.plate === action.plate) return state;
      const slot = state.counters.filter((item) => item.plate === action.plate).length;
      return {
        ...state,
        counters: state.counters.map((item) =>
          item.id === counter.id ? { ...item, plate: action.plate, slot } : item,
        ),
      };
    }

    case 'merge': {
      if (action.from === action.to) return state;
      if (action.from < 0 || action.from >= state.plates) return state;
      if (action.to < 0 || action.to >= state.plates) return state;
      const moving = state.counters
        .filter((counter) => counter.plate === action.from)
        .sort((a, b) => a.slot - b.slot);
      if (moving.length === 0) return state;
      const base = state.counters.filter((counter) => counter.plate === action.to).length;
      const order = new Map<string, number>();
      moving.forEach((counter, index) => order.set(counter.id, base + index));
      return {
        ...state,
        counters: state.counters.map((counter) => {
          const slot = order.get(counter.id);
          return slot === undefined ? counter : { ...counter, plate: action.to, slot };
        }),
      };
    }

    case 'set-split': {
      if (action.plate < 0 || action.plate >= state.plates) return state;
      const target = action.plate + 1 < state.plates ? action.plate + 1 : action.plate - 1;
      if (target < 0 || target >= state.plates) return state;

      // 두 접시의 셈돌을 이어 붙인 순서에서 앞의 `left`개를 이 접시에 남긴다.
      // 왼쪽 몫을 늘리면 반대 접시에서 한 개씩 되돌아온다.
      const source = state.counters
        .filter((counter) => counter.plate === action.plate)
        .sort((a, b) => a.slot - b.slot);
      const other = state.counters
        .filter((counter) => counter.plate === target)
        .sort((a, b) => a.slot - b.slot);
      const total = source.length + other.length;
      if (total === 0) return state;
      const left = clamp(Math.trunc(action.left), 0, total);
      if (left === source.length) return state;

      const order = new Map<string, { plate: number; slot: number }>();
      [...source, ...other].forEach((counter, index) => {
        order.set(
          counter.id,
          index < left
            ? { plate: action.plate, slot: index }
            : { plate: target, slot: index - left },
        );
      });
      return {
        ...state,
        counters: state.counters.map((counter) => {
          const next = order.get(counter.id);
          return next ? { ...counter, ...next } : counter;
        }),
      };
    }

    case 'record-split': {
      const counts = platesOf(state);
      const a = counts[0] ?? 0;
      const b = counts[1] ?? 0;
      const key = splitKey(a, b);
      const exists = state.recorded.some(([x, y]) => splitKey(x, y) === key);
      if (exists) return state;
      return { ...state, recorded: [...state.recorded, [Math.min(a, b), Math.max(a, b)]] };
    }

    case 'pair': {
      if (action.a === action.b) return state;
      const first = state.counters.find((counter) => counter.id === action.a);
      const second = state.counters.find((counter) => counter.id === action.b);
      if (!first || !second) return state;
      if (first.plate === second.plate) return state;
      const used = new Set(state.pairs.flat());
      if (used.has(action.a) || used.has(action.b)) return state;
      return { ...state, pairs: [...state.pairs, [action.a, action.b]] };
    }

    default:
      return state;
  }
}

function reduceFlash(state: FlashState, action: CountersAction): CountersState {
  if (action.type === 'show') {
    if (state.phase !== 'ready') return state;
    return { ...state, phase: 'showing', shown: state.chosen };
  }
  if (action.type === 'hide') {
    if (state.phase !== 'showing') return state;
    return { ...state, phase: 'hidden' };
  }
  return state;
}

function reduceRekenrek(state: RekenrekState, action: CountersAction): CountersState {
  if (action.type !== 'push' && action.type !== 'pull') return state;
  const current = state.left[action.row];
  if (current === undefined) return state;
  const count = Math.max(0, Math.trunc(action.count));
  if (count === 0) return state;
  const next =
    action.type === 'push' ? Math.min(10, current + count) : Math.max(0, current - count);
  if (next === current) return state;
  const left = state.left.map((value, row) => (row === action.row ? next : value));
  const total = left.reduce((sum, value) => sum + value, 0);
  const moved = Math.abs(next - current);
  return {
    ...state,
    left,
    history: [...state.history, total],
    reached: state.reached.includes(total) ? state.reached : [...state.reached, total],
    fullRowPushes: state.fullRowPushes + (action.type === 'push' && moved === 10 ? 1 : 0),
    moves: state.moves + 1,
  };
}

function reducePairing(state: PairingState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'predict': {
      if (state.phase !== 'predict') return state;
      if (action.choice !== 0 && action.choice !== 1) return state;
      return { ...state, prediction: action.choice, phase: 'ready' };
    }
    case 'make-pairs':
      return state.phase === 'ready' ? { ...state, phase: 'paired' } : state;
    case 'reset-pairs':
      return state.phase === 'paired' || state.phase === 'predict'
        ? { ...state, phase: 'ready' }
        : state;
    default:
      return state;
  }
}

function reduceShare(state: ShareState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'deal': {
      if (action.plate < 0 || action.plate >= state.groups) return state;
      if (state.pile <= 0) return state;
      return {
        ...state,
        pile: state.pile - 1,
        plates: state.plates.map((count, plate) => (plate === action.plate ? count + 1 : count)),
      };
    }
    case 'take-back': {
      if (action.plate < 0 || action.plate >= state.groups) return state;
      if ((state.plates[action.plate] ?? 0) <= 0) return state;
      return {
        ...state,
        pile: state.pile + 1,
        plates: state.plates.map((count, plate) => (plate === action.plate ? count - 1 : count)),
      };
    }
    case 'deal-round': {
      if (state.pile < state.groups) return state;
      return {
        ...state,
        pile: state.pile - state.groups,
        plates: state.plates.map((count) => count + 1),
        rounds: state.rounds + 1,
      };
    }
    default:
      return state;
  }
}

function reduceMeasureOut(state: MeasureOutState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'choose-size': {
      if (!state.choices.includes(action.size)) return state;
      if (state.groupSize === action.size) return state;
      return {
        ...state,
        groupSize: action.size,
        bagCount: 0,
        lastAttempt: null,
        counters: state.counters.map((counter) => ({ ...counter, bag: null })),
      };
    }
    case 'bag': {
      if (state.groupSize === null) return state;
      const ids = new Set(action.ids);
      const eligible = state.counters.filter(
        (counter) => counter.bag === null && ids.has(counter.id),
      );
      if (eligible.length === 0) return state;
      if (eligible.length !== state.groupSize) {
        return { ...state, lastAttempt: { count: eligible.length, ok: false } };
      }
      const bag = state.bagCount;
      const picked = new Set(eligible.map((counter) => counter.id));
      return {
        ...state,
        bagCount: bag + 1,
        lastAttempt: null,
        counters: state.counters.map((counter) =>
          picked.has(counter.id) ? { ...counter, bag } : counter,
        ),
      };
    }
    case 'bag-next': {
      if (state.groupSize === null) return state;
      const loose = state.counters.filter((counter) => counter.bag === null);
      if (loose.length < state.groupSize) return state;
      const picked = new Set(loose.slice(0, state.groupSize).map((counter) => counter.id));
      const bag = state.bagCount;
      return {
        ...state,
        bagCount: bag + 1,
        lastAttempt: null,
        counters: state.counters.map((counter) =>
          picked.has(counter.id) ? { ...counter, bag } : counter,
        ),
      };
    }
    case 'unbag': {
      if (action.bag < 0 || action.bag >= state.bagCount) return state;
      if (!state.counters.some((counter) => counter.bag === action.bag)) return state;
      return {
        ...state,
        bagCount: state.bagCount - 1,
        lastAttempt: null,
        counters: state.counters.map((counter) => {
          if (counter.bag === action.bag) return { ...counter, bag: null };
          if (counter.bag !== null && counter.bag > action.bag) {
            return { ...counter, bag: counter.bag - 1 };
          }
          return counter;
        }),
      };
    }
    default:
      return state;
  }
}

function reduceBubble(state: BubblePairsState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'pick': {
      const bubble = state.bubbles.find((item) => item.id === action.id);
      if (!bubble || bubble.popped) return state;
      if (state.selected.includes(action.id)) return state;
      const selected = [...state.selected, action.id];
      const chosen = selected
        .map((id) => state.bubbles.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => item !== undefined);
      const sum = chosen.reduce((total, item) => total + item.value, 0);
      if (sum === state.target) {
        const ids = new Set(selected);
        const streak = state.streak + 1;
        return {
          ...state,
          bubbles: state.bubbles.map((item) =>
            ids.has(item.id) ? { ...item, popped: true } : item,
          ),
          selected: [],
          lastMiss: null,
          pops: [...state.pops, chosen.map((item) => item.value)],
          streak,
          bestStreak: Math.max(state.bestStreak, streak),
        };
      }
      if (sum > state.target || selected.length >= state.pickUpTo) {
        return {
          ...state,
          selected: [],
          lastMiss: { ids: selected, sum },
          streak: 0,
          misses: state.misses + 1,
        };
      }
      return { ...state, selected, lastMiss: null };
    }
    case 'unpick': {
      if (!state.selected.includes(action.id)) return state;
      return { ...state, selected: state.selected.filter((id) => id !== action.id) };
    }
    default:
      return state;
  }
}

function reduceBridge(state: BridgeState, action: CountersAction): CountersState {
  switch (action.type) {
    case 'place-rod': {
      if (!state.rods.includes(action.length)) return state;
      if (state.placed.length >= state.maxRods) return state;
      const total = state.rods.filter((length) => length === action.length).length;
      const used = state.placed.filter((length) => length === action.length).length;
      if (used >= total) return state;
      return { ...state, placed: [...state.placed, action.length] };
    }
    case 'remove-rod': {
      if (action.index < 0 || action.index >= state.placed.length) return state;
      if (state.presetLocked && action.index < state.presetCount) return state;
      return { ...state, placed: state.placed.filter((_, index) => index !== action.index) };
    }
    case 'record-bridge': {
      const sum = state.placed.reduce((total, length) => total + length, 0);
      if (sum !== state.gap) return state;
      const sorted = [...state.placed].sort((a, b) => a - b);
      const key = sorted.join(',');
      if (state.recorded.some((entry) => entry.join(',') === key)) return state;
      return { ...state, recorded: [...state.recorded, sorted] };
    }
    default:
      return state;
  }
}
