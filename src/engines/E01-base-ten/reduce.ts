/**
 * E01 수 모형의 순수 reducer.
 *
 * - 무작위는 `createInitialState`에서 seed로 한 번만 쓴다(되감기·미러링에서 같은 그림).
 * - 모든 상태 변경은 Action 하나로 기록되고, 같은 Action 목록은 같은 상태를 재생한다.
 * - reduce는 config를 받지 않으므로 필요한 설정은 `state.settings`에 복사해 둔다.
 */
import { Rational } from '../../core/math';
import { clamp } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import {
  arrangeByPlace,
  arrangeOnPlate,
  bandsForState,
  blockValuesForNumber,
  defaultDropPoint,
  DIVIDE_PILE,
  dividePlateRects,
  fanPoints,
  findFreePoint,
  inRect,
  regionFor,
  scatteredPoint,
  slotIndexInBand,
  slotPoint,
  snapToColumns,
  WORK_FULL,
  zoneAt,
} from './layout';
import { BLOCK_VALUES, CHART_NAME_COLUMN, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type {
  BaseTenAction,
  BaseTenBlock,
  BaseTenConfig,
  BaseTenSettings,
  BaseTenState,
  BaseTenMode,
  BigNumberState,
  BlockValue,
  ChartFill,
  ChartName,
  Interpretation,
  StartSpec,
  Zone,
} from './types';
import {
  canTake,
  columnOf,
  columnsOf,
  countsForColumn,
  countsFromValue,
  placeValueOf,
  rationalValueOf,
  totalBlockValue,
} from './value';

const MAX_VALUE = 9999;
const MAX_BLOCKS = 400;

function integer(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

function normalizeAllowed(
  values: readonly BlockValue[] | undefined,
  interpretation: Interpretation,
): BlockValue[] {
  const source = values ?? [1, 10, 100];
  const kept = source.filter((value) => BLOCK_VALUES.includes(value));
  let unique = [...new Set(kept)].sort((a, b) => a - b);
  if (interpretation === 'decimal') unique = unique.filter((value) => value !== 1000);
  return unique.length > 0 ? unique : [1, 10, 100];
}

export function inferMode(config: BaseTenConfig): BaseTenMode {
  if (config.mode !== undefined) return config.mode;
  if (config.reverse !== undefined || config.slicer !== undefined) return 'big-number';
  if (config.dividend !== undefined || config.divisor !== undefined) return 'divide';
  if (
    config.op !== undefined ||
    config.a !== undefined ||
    config.b !== undefined ||
    config.constraint !== undefined ||
    config.regroupAllowed !== undefined
  ) {
    return 'add-sub';
  }
  if (
    config.columns !== undefined ||
    config.digits !== undefined ||
    config.bidirectional !== undefined
  ) {
    return 'place-chart';
  }
  return 'count';
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

function chartColumnsOf(config: BaseTenConfig, mode: BaseTenMode): number[] {
  const fromNames = (config.chart ?? [])
    .map((name) => CHART_NAME_COLUMN[name as ChartName])
    .filter((column): column is number => column !== undefined);
  if (fromNames.length > 0) {
    return [...new Set(fromNames)].sort((a, b) => b - a);
  }
  const explicit = (config.columns ?? []).filter(
    (column) => Number.isInteger(column) && column >= -2 && column <= 3,
  );
  if (explicit.length > 0) {
    return [...new Set(explicit)].sort((a, b) => b - a);
  }
  if (mode === 'place-chart') {
    const digits = config.digits ?? [];
    return columnsOf(digits.length >= 2 ? Math.min(4, digits.length) : 2);
  }
  if (mode === 'decimal') return [0, -1, -2];
  return [];
}

function settingsOf(config: BaseTenConfig, mode: BaseTenMode): BaseTenSettings {
  const maxValue = integer(config.maxValue, MAX_VALUE, 1, MAX_VALUE);
  const interpretation: Interpretation =
    mode === 'decimal' ? 'decimal' : (config.interpretation ?? 'whole');
  const chartColumns = chartColumnsOf(config, mode);
  const chartFill: ChartFill =
    chartColumns.length > 0 ? (config.chartFill ?? 'student') : 'student';
  const divisor = integer(config.divisor, 2, 2, 9);
  return {
    allowedBlocks: normalizeAllowed(config.allowedBlocks, interpretation),
    maxValue,
    snapColumns: config.snapColumns ?? mode === 'add-sub',
    lasso: config.lasso ?? true,
    chartFill,
    chartColumns,
    bidirectional: config.bidirectional ?? true,
    op: config.op ?? 'add',
    a: integer(config.a, 0, 0, MAX_VALUE),
    b: integer(config.b, 0, 0, MAX_VALUE),
    constraint: config.constraint ?? 'none',
    regroupAllowed: config.regroupAllowed ?? true,
    digits: (config.digits ?? []).filter(
      (digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9,
    ),
    render: config.render ?? 'auto',
    icon: config.icon ?? null,
    interpretation,
    plates: integer(config.plates, divisor, 1, 9),
    divisor,
    rewindCheck: config.rewindCheck ?? false,
  };
}

interface BlockDraft {
  readonly value: BlockValue;
  readonly zone?: Zone;
}

function draftsFromCounts(counts: {
  readonly thousands: number;
  readonly hundreds: number;
  readonly tens: number;
  readonly ones: number;
}): BlockDraft[] {
  const drafts: BlockDraft[] = [];
  for (const [value, count] of [
    [1000, counts.thousands],
    [100, counts.hundreds],
    [10, counts.tens],
    [1, counts.ones],
  ] as const) {
    for (let index = 0; index < count; index += 1) drafts.push({ value });
  }
  return drafts;
}

function draftsFromStart(
  start: StartSpec | undefined,
  interpretation: Interpretation,
): BlockDraft[] {
  if (!start) return [];
  if (typeof start.value === 'string') {
    const counts = countsFromValue(start.value, interpretation);
    return counts === null ? [] : draftsFromCounts(counts);
  }
  const drafts: BlockDraft[] = [];
  const add = (value: BlockValue, count: number | undefined) => {
    const safe = integer(count, 0, 0, MAX_BLOCKS);
    for (let index = 0; index < safe; index += 1) drafts.push({ value });
  };
  add(1000, start.thousands);
  add(100, start.hundreds);
  add(10, start.tens);
  add(1, start.ones);
  return drafts;
}

function sanitizeBigValue(text: string | undefined): string {
  if (text === undefined) return '';
  const digits = text.replace(/[^0-9]/g, '').slice(0, 16);
  return digits.replace(/^0+(?=\d)/, '');
}

function autoCutsOf(length: number): number[] {
  const cuts: number[] = [];
  for (let position = 4; position < length; position += 4) cuts.push(position);
  return cuts;
}

function bigNumberStateOf(config: BaseTenConfig, mode: BaseTenMode): BigNumberState | null {
  if (mode !== 'big-number') return null;
  const reverse = config.reverse !== undefined;
  const value = reverse ? '' : sanitizeBigValue(config.value);
  return {
    value,
    cuts: reverse || config.slicer !== 'auto' ? [] : autoCutsOf(value.length),
    expanded: null,
    selected: null,
    built: Array.from({ length: 16 }, () => null),
  };
}

function buildBlocks(
  drafts: readonly BlockDraft[],
  startId: number,
): { blocks: BaseTenBlock[]; nextId: number } {
  let nextId = startId;
  const blocks = drafts.map((draft) => {
    const block: BaseTenBlock = {
      id: `b${nextId}`,
      value: draft.value,
      x: 500,
      y: 300,
      ...(draft.zone === undefined ? {} : { zone: draft.zone }),
    };
    nextId += 1;
    return block;
  });
  return { blocks, nextId };
}

function initialBlocks(
  mode: BaseTenMode,
  config: BaseTenConfig,
  settings: BaseTenSettings,
): { blocks: BaseTenBlock[]; nextId: number } {
  if (mode === 'big-number') return { blocks: [], nextId: 1 };

  if (mode === 'divide') {
    const source = config.dividend === undefined ? '0' : String(config.dividend);
    const counts = countsFromValue(source, settings.interpretation);
    const built = buildBlocks(counts === null ? [] : draftsFromCounts(counts), 1);
    return {
      blocks: arrangeByPlace({ settings }, built.blocks, DIVIDE_PILE),
      nextId: built.nextId,
    };
  }

  if (mode === 'add-sub') {
    const aDrafts = blockValuesForNumber(settings.a).map<BlockDraft>((entry) => ({
      value: entry.value,
      zone: 'a',
    }));
    const bDrafts =
      settings.op === 'add'
        ? blockValuesForNumber(settings.b).map<BlockDraft>((entry) => ({
            value: entry.value,
            zone: 'b',
          }))
        : [];
    const a = buildBlocks(aDrafts, 1);
    const b = buildBlocks(bDrafts, a.nextId);
    const arrangedA = arrangeByPlace({ settings }, a.blocks, regionFor({ mode, settings }, 'a'));
    const arrangedB = arrangeByPlace({ settings }, b.blocks, regionFor({ mode, settings }, 'b'));
    return { blocks: [...arrangedA, ...arrangedB], nextId: b.nextId };
  }

  const start = config.start;
  const built = buildBlocks(draftsFromStart(start, settings.interpretation), 1);
  const region = settings.snapColumns ? regionFor({ mode, settings }) : WORK_FULL;
  let blocks = arrangeByPlace({ settings }, built.blocks, region);

  if (start?.scattered === true) {
    const random = seededRandom(start.seed ?? 1);
    let onesIndex = 0;
    blocks = blocks.map((block) => {
      if (block.value !== 1) return block;
      const point = scatteredPoint(random, onesIndex, region);
      onesIndex += 1;
      return { ...block, x: point.x, y: point.y };
    });
  }

  return { blocks, nextId: built.nextId };
}

export function createInitialState(config: BaseTenConfig): BaseTenState {
  const mode = inferMode(config);
  const settings = settingsOf(config, mode);
  const { blocks, nextId } = initialBlocks(mode, config, settings);
  const chart = settings.chartColumns.length > 0 ? settings.chartColumns.map(() => null) : null;

  const base: BaseTenState = {
    mode,
    blocks,
    chart,
    digitPlacements: settings.digits.map(() => -1),
    log: [],
    lastAttempt: null,
    reachedHundred: false,
    nextId,
    settings,
    bigNumber: bigNumberStateOf(config, mode),
    divide: mode === 'divide' ? { plates: settings.plates, rewound: false } : null,
  };

  return {
    ...base,
    reachedHundred: rationalValueOf(base).compareTo(Rational.of(100)) >= 0,
  };
}

// ─────────────────────────────────────────────────────────────
// 상태 갱신 도우미
// ─────────────────────────────────────────────────────────────

function clampPoint(point: Point): Point {
  return {
    x: clamp(Math.round(point.x), 0, LOGICAL_WIDTH),
    y: clamp(Math.round(point.y), 0, LOGICAL_HEIGHT),
  };
}

/** place-chart 양방향: 블록 개수를 칸 숫자로 다시 쓴다(10 이상도 그대로). */
function syncChart(state: BaseTenState): BaseTenState {
  if (state.mode !== 'place-chart' || !state.settings.bidirectional || state.chart === null) {
    return state;
  }
  const chart = state.settings.chartColumns.map((column) => String(countsForColumn(state, column)));
  const same =
    chart.length === state.chart.length &&
    chart.every((cell, index) => state.chart?.[index] === cell);
  return same ? state : { ...state, chart };
}

function withBlocks(
  state: BaseTenState,
  blocks: readonly BaseTenBlock[],
  patch: Partial<
    Pick<BaseTenState, 'nextId' | 'log' | 'lastAttempt' | 'digitPlacements' | 'chart'>
  > = {},
): BaseTenState {
  const next: BaseTenState = {
    ...state,
    ...patch,
    blocks,
  };
  return syncChart({
    ...next,
    reachedHundred: next.reachedHundred || rationalValueOf(next).compareTo(Rational.of(100)) >= 0,
  });
}

function blockOf(state: BaseTenState, id: string): BaseTenBlock | undefined {
  return state.blocks.find((block) => block.id === id);
}

// ─────────────────────────────────────────────────────────────
// reduce
// ─────────────────────────────────────────────────────────────

export function reduce(state: BaseTenState, action: BaseTenAction): BaseTenState {
  switch (action.type) {
    case 'add':
      return addBlock(state, action.value, { x: action.x, y: action.y });
    case 'move':
      return moveBlock(state, action.id, { x: action.x, y: action.y });
    case 'remove':
      return removeBlock(state, action.id);
    case 'lasso-group':
      return lassoGroup(state, action.ids);
    case 'group-tens':
      return groupTens(state, action.value);
    case 'break':
      return breakBlock(state, action.id);
    case 'set-digit':
      return setDigit(state, action.column, action.digit);
    case 'place-digit':
      return placeDigit(state, action.index, action.column);
    // ── big-number ────────────────────────────────────────────
    case 'cut':
      return cutNumber(state, action.position);
    case 'uncut':
      return uncutNumber(state, action.position);
    case 'expand':
      return expandGroup(state, action.group);
    case 'select-digit':
      return selectDigit(state, action.position);
    case 'place-card':
      return placeCard(state, action.cell, action.digit);
    case 'clear-cell':
      return clearCell(state, action.cell);
    // ── divide ────────────────────────────────────────────────
    case 'deal-block':
      return dealBlock(state, action.id, action.plate);
    case 'return-block':
      return returnBlock(state, action.id);
    case 'deal-round':
      return dealRound(state, action.value);
    case 'rewind':
      return rewindDivide(state);
    default:
      return state;
  }
}

function addBlock(state: BaseTenState, value: BlockValue, point: Point): BaseTenState {
  if (state.mode === 'big-number' || state.mode === 'divide') return state;
  if (!state.settings.allowedBlocks.includes(value)) return state;
  if (totalBlockValue(state) + value > state.settings.maxValue) return state;
  if (state.blocks.length >= MAX_BLOCKS) return state;

  const zone = zoneAt(point, state);
  const target: Point =
    zone === 'take' && state.settings.op === 'sub' ? defaultDropPoint(state, value) : point;
  const effectiveZone = zone === 'take' && state.settings.op === 'sub' ? 'a' : zone;
  const snapped = clampPoint(snapToColumns(state, value, target, effectiveZone));
  const block: BaseTenBlock = {
    id: `b${state.nextId}`,
    value,
    x: snapped.x,
    y: snapped.y,
    ...(effectiveZone === undefined ? {} : { zone: effectiveZone }),
  };
  return withBlocks(state, [...state.blocks, block], {
    nextId: state.nextId + 1,
    lastAttempt: null,
  });
}

function moveBlock(state: BaseTenState, id: string, point: Point): BaseTenState {
  if (state.mode === 'big-number' || state.mode === 'divide') return state;
  const block = blockOf(state, id);
  if (!block) return state;

  const zone = zoneAt(point, state);
  if (zone === 'take' && !canTake(state, block.value, block.id)) return state;

  const snapped = clampPoint(snapToColumns(state, block.value, point, zone, block.id));
  if (snapped.x === block.x && snapped.y === block.y && zone === block.zone) return state;

  const blocks = state.blocks.map((item) =>
    item.id === id
      ? {
          ...item,
          x: snapped.x,
          y: snapped.y,
          ...(zone === undefined ? { zone: undefined } : { zone }),
        }
      : item,
  );
  return withBlocks(state, blocks, { lastAttempt: null });
}

function removeBlock(state: BaseTenState, id: string): BaseTenState {
  if (state.mode === 'big-number' || state.mode === 'divide') return state;
  if (!blockOf(state, id)) return state;
  return withBlocks(
    state,
    state.blocks.filter((block) => block.id !== id),
    { lastAttempt: null },
  );
}

function lassoGroup(state: BaseTenState, ids: readonly string[]): BaseTenState {
  if (state.mode === 'big-number' || state.mode === 'divide') return state;
  const unique = [...new Set(ids)];
  if (unique.length === 0) return state;

  const found = unique
    .map((id) => blockOf(state, id))
    .filter((block): block is BaseTenBlock => block !== undefined);
  if (found.length !== unique.length) return state;

  const value = found[0]?.value;
  const same = value !== undefined && found.every((block) => block.value === value);
  const forbidden =
    value === 1000 || (state.settings.interpretation === 'decimal' && value === 100);

  if (unique.length !== 10 || !same || value === undefined || forbidden) {
    return {
      ...state,
      lastAttempt: {
        count: unique.length,
        value: same && value !== undefined ? value : null,
        ok: false,
      },
    };
  }

  return performGroup(state, found, value);
}

function groupTens(state: BaseTenState, requested?: BlockValue): BaseTenState {
  if (state.mode === 'big-number' || state.mode === 'divide') return state;
  const candidates = BLOCK_VALUES.filter(
    (value) =>
      value !== 1000 &&
      !(state.settings.interpretation === 'decimal' && value === 100) &&
      state.blocks.filter((block) => block.value === value).length >= 10,
  );
  if (candidates.length === 0) return state;

  const value =
    requested !== undefined && candidates.includes(requested) ? requested : candidates[0];
  if (value === undefined) return state;

  const found = state.blocks.filter((block) => block.value === value).slice(0, 10);
  if (found.length < 10) return state;
  return performGroup(state, found, value);
}

function performGroup(
  state: BaseTenState,
  found: readonly BaseTenBlock[],
  value: BlockValue,
): BaseTenState {
  const ids = new Set(found.map((block) => block.id));
  const remaining = state.blocks.filter((block) => !ids.has(block.id));
  const zones = new Set(
    found.map((block) => block.zone).filter((zone): zone is Zone => zone !== undefined),
  );
  const zone = zones.size === 1 ? [...zones][0] : undefined;
  const higher = (value * 10) as BlockValue;

  let point: Point = {
    x: Math.round(found.reduce((sum, block) => sum + block.x, 0) / found.length),
    y: Math.round(found.reduce((sum, block) => sum + block.y, 0) / found.length),
  };
  if (zone !== undefined && state.settings.snapColumns) {
    const region = regionFor(state, zone);
    const band = bandsForState(state, region).find(
      (candidate) => candidate.column === columnOf(higher),
    );
    if (band) {
      point = slotPoint(band, higher, slotIndexInBand(remaining, band, higher));
    }
  }
  // 같은 값 블록과 겹치지 않는 가장 가까운 자리로 밀어 낸다(무게중심은 그대로 출발점).
  point = findFreePoint(
    remaining,
    higher,
    point,
    zone === undefined ? {} : { bounds: regionFor(state, zone) },
  );

  const merged: BaseTenBlock = {
    id: `b${state.nextId}`,
    value: higher,
    x: clamp(Math.round(point.x), 0, LOGICAL_WIDTH),
    y: clamp(Math.round(point.y), 0, LOGICAL_HEIGHT),
    ...(zone === undefined ? {} : { zone }),
  };

  return withBlocks(state, [...remaining, merged], {
    nextId: state.nextId + 1,
    log: [...state.log, { kind: 'group', from: value }],
    lastAttempt: null,
  });
}

function breakBlock(state: BaseTenState, id: string): BaseTenState {
  if (state.mode === 'big-number') return state;
  const block = blockOf(state, id);
  if (!block || block.value === 1) return state;
  if (state.mode === 'divide' && block.plate !== undefined) return state;
  if (state.mode === 'add-sub' && !state.settings.regroupAllowed) return state;

  const lower = (block.value / 10) as BlockValue;
  const remaining = state.blocks.filter((item) => item.id !== block.id);
  const bounds = block.zone === undefined ? undefined : regionFor(state, block.zone);
  const desired = fanPoints({ x: block.x, y: block.y }, lower);
  let nextId = state.nextId;
  const created: BaseTenBlock[] = [];
  for (const point of desired) {
    // 이미 놓인 블록과 앞서 만든 조각 모두와 겹치지 않는 자리를 고른다.
    const free = findFreePoint(
      [...remaining, ...created],
      lower,
      point,
      bounds === undefined ? {} : { bounds },
    );
    created.push({
      id: `b${nextId}`,
      value: lower,
      x: free.x,
      y: free.y,
      ...(block.zone === undefined ? {} : { zone: block.zone }),
    });
    nextId += 1;
  }

  return withBlocks(state, [...remaining, ...created], {
    nextId,
    log: [...state.log, { kind: 'break', from: block.value }],
    lastAttempt: null,
  });
}

function setDigit(state: BaseTenState, column: number, digit: number | null): BaseTenState {
  if (state.chart === null) return state;
  if (state.settings.chartFill === 'auto') return state;
  const index = state.settings.chartColumns.indexOf(column);
  if (index < 0) return state;

  let text: string | null;
  if (digit === null) {
    text = null;
  } else {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return state;
    text = String(digit);
  }

  if (state.chart[index] === text) return state;
  const chart = state.chart.map((cell, cellIndex) => (cellIndex === index ? text : cell));
  return { ...state, chart };
}

function placeDigit(state: BaseTenState, index: number, column: number): BaseTenState {
  if (state.mode !== 'place-chart') return state;
  const digit = state.settings.digits[index];
  if (digit === undefined) return state;
  if (!state.settings.chartColumns.includes(column)) return state;
  const place = placeValueOf(column);
  if (place === null) return state;

  const previousColumn = state.digitPlacements[index] ?? -1;
  const previousPlace = previousColumn >= 0 ? placeValueOf(previousColumn) : null;

  const placements = state.settings.digits.map((_, cardIndex) => {
    if (cardIndex === index) return column;
    const current = state.digitPlacements[cardIndex] ?? -1;
    return current === column ? -1 : current;
  });

  let blocks = state.blocks.filter(
    (block) => block.value !== place && block.value !== previousPlace,
  );
  let nextId = state.nextId;
  if (digit > 0) {
    const region = regionFor(state);
    const band = bandsForState(state, region).find((candidate) => candidate.column === column);
    const created = Array.from({ length: digit }, () => {
      const piece: BaseTenBlock = {
        id: `b${nextId}`,
        value: place,
        x: 500,
        y: 300,
      };
      nextId += 1;
      return piece;
    });
    blocks = [
      ...blocks,
      ...created.map((piece, slot) => {
        if (!band) return piece;
        const point = slotPoint(band, place, slot);
        return { ...piece, x: point.x, y: point.y };
      }),
    ];
  }

  const chart = state.chart?.map((cell, cellIndex) =>
    state.settings.chartColumns[cellIndex] === column ? String(digit) : cell,
  );

  return withBlocks(state, blocks, {
    nextId,
    digitPlacements: placements,
    lastAttempt: null,
    ...(chart === undefined ? {} : { chart }),
  });
}

// ─────────────────────────────────────────────────────────────
// big-number
// ─────────────────────────────────────────────────────────────

function bigOf(state: BaseTenState): BigNumberState | null {
  return state.mode === 'big-number' ? state.bigNumber : null;
}

function cutNumber(state: BaseTenState, position: number): BaseTenState {
  const big = bigOf(state);
  if (!big) return state;
  if (!Number.isInteger(position) || position < 1 || position >= big.value.length) return state;
  if (big.cuts.includes(position)) return state;
  const cuts = [...big.cuts, position].sort((a, b) => a - b);
  return { ...state, bigNumber: { ...big, cuts } };
}

function uncutNumber(state: BaseTenState, position: number): BaseTenState {
  const big = bigOf(state);
  if (!big || !big.cuts.includes(position)) return state;
  return { ...state, bigNumber: { ...big, cuts: big.cuts.filter((cut) => cut !== position) } };
}

function expandGroup(state: BaseTenState, group: number): BaseTenState {
  const big = bigOf(state);
  if (!big) return state;
  const groups = Math.max(1, Math.ceil(big.value.length / 4));
  if (!Number.isInteger(group) || group < 0 || group >= groups) return state;
  return { ...state, bigNumber: { ...big, expanded: big.expanded === group ? null : group } };
}

function selectDigit(state: BaseTenState, position: number): BaseTenState {
  const big = bigOf(state);
  if (!big) return state;
  if (!Number.isInteger(position) || position < 0 || position >= big.value.length) return state;
  return { ...state, bigNumber: { ...big, selected: position } };
}

function placeCard(state: BaseTenState, cell: number, digit: number): BaseTenState {
  const big = bigOf(state);
  if (!big) return state;
  if (!Number.isInteger(cell) || cell < 0 || cell > 15) return state;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return state;
  const built = big.built.map((current, index) => (index === cell ? digit : current));
  return { ...state, bigNumber: { ...big, built } };
}

function clearCell(state: BaseTenState, cell: number): BaseTenState {
  const big = bigOf(state);
  if (!big || !Number.isInteger(cell) || cell < 0 || cell > 15) return state;
  if (big.built[cell] === null) return state;
  const built = big.built.map((current, index) => (index === cell ? null : current));
  return { ...state, bigNumber: { ...big, built } };
}

// ─────────────────────────────────────────────────────────────
// divide
// ─────────────────────────────────────────────────────────────

function blockWithoutPlate(block: BaseTenBlock, point: Point): BaseTenBlock {
  return {
    id: block.id,
    value: block.value,
    x: point.x,
    y: point.y,
    ...(block.zone === undefined ? {} : { zone: block.zone }),
  };
}

function pilePoint(
  state: BaseTenState,
  pileBlocks: readonly BaseTenBlock[],
  value: BlockValue,
): Point {
  const band = bandsForState(state, DIVIDE_PILE).find(
    (candidate) => candidate.column === columnOf(value),
  );
  if (!band) return { x: DIVIDE_PILE.x + DIVIDE_PILE.width / 2, y: DIVIDE_PILE.y + 40 };
  return slotPoint(band, value, slotIndexInBand(pileBlocks, band, value));
}

/** 접시에 놓인 블록만 접시 안에서 다시 줄 맞춘다(무더기 블록은 그대로). */
function withDivideLayout(state: BaseTenState, blocks: readonly BaseTenBlock[]): BaseTenState {
  const plates = state.divide?.plates ?? 1;
  const rects = dividePlateRects(plates);
  const pile: BaseTenBlock[] = [];
  const plated: BaseTenBlock[] = [];
  for (const block of blocks) {
    if (block.plate === undefined) {
      pile.push(block);
      continue;
    }
    const rect = rects[block.plate];
    if (rect === undefined) {
      pile.push(blockWithoutPlate(block, { x: block.x, y: block.y }));
      continue;
    }
    plated.push(block);
  }
  const arranged: BaseTenBlock[] = [];
  for (let plate = 0; plate < plates; plate += 1) {
    const rect = rects[plate];
    if (!rect) continue;
    arranged.push(
      ...arrangeOnPlate(
        rect,
        plated.filter((block) => block.plate === plate),
      ),
    );
  }
  return withBlocks(state, [...pile, ...arranged], { lastAttempt: null });
}

function dealBlock(state: BaseTenState, id: string, plate: number): BaseTenState {
  if (state.mode !== 'divide' || !state.divide) return state;
  if (!Number.isInteger(plate) || plate < 0 || plate >= state.divide.plates) return state;
  const block = blockOf(state, id);
  if (!block || block.plate === plate) return state;
  const blocks = state.blocks.map((item) => (item.id === id ? { ...item, plate } : item));
  return withDivideLayout({ ...state, divide: { ...state.divide, rewound: false } }, blocks);
}

function returnBlock(state: BaseTenState, id: string): BaseTenState {
  if (state.mode !== 'divide' || !state.divide) return state;
  const block = blockOf(state, id);
  if (!block || block.plate === undefined) return state;
  const pile = state.blocks.filter((item) => item.plate === undefined);
  const point = pilePoint(state, pile, block.value);
  const blocks = state.blocks.map((item) =>
    item.id === id ? blockWithoutPlate(item, point) : item,
  );
  return withDivideLayout({ ...state, divide: { ...state.divide, rewound: false } }, blocks);
}

/** "○ 한 바퀴"를 지금 누를 수 있는가. */
export function canDealRound(state: BaseTenState, value: BlockValue): boolean {
  if (state.mode !== 'divide' || !state.divide) return false;
  return (
    state.blocks.filter((block) => block.plate === undefined && block.value === value).length >=
    state.divide.plates
  );
}

function dealRound(state: BaseTenState, value: BlockValue): BaseTenState {
  if (!canDealRound(state, value) || !state.divide) return state;
  const chosen = state.blocks
    .filter((block) => block.plate === undefined && block.value === value)
    .slice(0, state.divide.plates);
  const plateOf = new Map(chosen.map((block, index) => [block.id, index] as const));
  const blocks = state.blocks.map((block) => {
    const plate = plateOf.get(block.id);
    return plate === undefined ? block : { ...block, plate };
  });
  return withDivideLayout({ ...state, divide: { ...state.divide, rewound: false } }, blocks);
}

function rewindDivide(state: BaseTenState): BaseTenState {
  if (state.mode !== 'divide' || !state.divide) return state;
  if (!state.blocks.some((block) => block.plate !== undefined)) return state;
  const returned = state.blocks.map((block) =>
    blockWithoutPlate(block, { x: block.x, y: block.y }),
  );
  const blocks = arrangeByPlace(state, returned, DIVIDE_PILE);
  return withBlocks({ ...state, divide: { ...state.divide, rewound: true } }, blocks, {
    log: [...state.log, { kind: 'rewind' }],
    lastAttempt: null,
  });
}

// ─────────────────────────────────────────────────────────────
// 테스트·View가 함께 쓰는 계산
// ─────────────────────────────────────────────────────────────

function logValuesOf(state: BaseTenState, kind: 'group' | 'break'): BlockValue[] {
  return state.log
    .filter((entry) => entry.kind === kind)
    .map((entry) => entry.from)
    .filter((value): value is BlockValue => value !== undefined);
}

export function groupedFrom(state: BaseTenState): number[] {
  return logValuesOf(state, 'group');
}

export function brokenFrom(state: BaseTenState): number[] {
  return logValuesOf(state, 'break');
}

/** "10개 묶기" 버튼을 지금 누를 수 있는가. */
export function canGroupTens(state: BaseTenState): boolean {
  if (state.mode === 'big-number' || state.mode === 'divide') return false;
  return BLOCK_VALUES.some(
    (value) =>
      value !== 1000 &&
      !(state.settings.interpretation === 'decimal' && value === 100) &&
      state.blocks.filter((block) => block.value === value).length >= 10,
  );
}

/** 상자에서 놓을 기본 자리(테스트용). */
export function dropPointFor(state: BaseTenState, value: BlockValue): Point {
  return defaultDropPoint(state, value);
}

/** 자석 스냅을 거친 뒤의 자리(테스트용). */
export function snappedPoint(
  state: BaseTenState,
  value: BlockValue,
  point: Point,
  zone?: Zone,
): Point {
  return snapToColumns(state, value, point, zone);
}

/** 점이 어느 구역인지(테스트용). */
export function zoneForPoint(state: BaseTenState, point: Point): Zone | undefined {
  if (state.mode !== 'add-sub') return undefined;
  return zoneAt(point, state);
}

/** 두 구역 사각형이 겹치는지 확인할 때 쓴다(테스트용). */
export function pointInside(
  point: Point,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return inRect(point, rect);
}
