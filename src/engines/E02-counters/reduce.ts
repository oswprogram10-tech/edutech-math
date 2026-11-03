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
  CounterColor,
  CountersAction,
  CountersConfig,
  CountersState,
  CounterMode,
  FlashState,
  FrameCounter,
  PartWholeState,
  PlateCounter,
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
    config.showBond !== undefined
  ) {
    return 'ten-frame';
  }
  if (
    config.total !== undefined ||
    config.groups !== undefined ||
    config.parts !== undefined ||
    config.gesture !== undefined ||
    config.scene !== undefined
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
  } else if (config.groups !== undefined) {
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

export function createInitialState(config: CountersConfig): CountersState {
  switch (inferMode(config)) {
    case 'summon':
      return createSummon(config);
    case 'ten-frame':
      return createTenFrame(config);
    case 'part-whole':
      return createPartWhole(config);
    case 'flash':
      return createFlash(config);
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
      return state.counters.length;
    case 'flash':
      return state.phase === 'ready' ? 0 : state.chosen;
  }
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
      return reducePartWhole(state, action);
    case 'flash':
      return reduceFlash(state, action);
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
