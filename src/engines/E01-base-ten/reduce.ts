/**
 * E01 수 모형의 순수 reducer.
 *
 * - 무작위는 `createInitialState`에서 seed로 한 번만 쓴다(되감기·미러링에서 같은 그림).
 * - 모든 상태 변경은 Action 하나로 기록되고, 같은 Action 목록은 같은 상태를 재생한다.
 * - reduce는 config를 받지 않으므로 필요한 설정은 `state.settings`에 복사해 둔다.
 */
import { clamp } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import {
  arrangeByPlace,
  bandsFor,
  blockValuesForNumber,
  defaultDropPoint,
  fanPoints,
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
  BlockValue,
  ChartFill,
  ChartName,
  StartSpec,
  Zone,
} from './types';
import {
  canTake,
  columnOf,
  columnsOf,
  countsForColumn,
  placeValueOf,
  totalBlockValue,
  valueOf,
} from './value';

const MAX_VALUE = 9999;
const MAX_BLOCKS = 400;

function integer(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

function normalizeAllowed(values: readonly BlockValue[] | undefined): BlockValue[] {
  const source = values ?? [1, 10, 100];
  const kept = source.filter((value) => BLOCK_VALUES.includes(value));
  const unique = [...new Set(kept)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [1, 10, 100];
}

export function inferMode(config: BaseTenConfig): BaseTenMode {
  if (config.mode !== undefined) return config.mode;
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
    (column) => Number.isInteger(column) && column >= 0 && column <= 3,
  );
  if (explicit.length > 0) {
    return [...new Set(explicit)].sort((a, b) => b - a);
  }
  if (mode === 'place-chart') {
    const digits = config.digits ?? [];
    return columnsOf(digits.length >= 2 ? Math.min(4, digits.length) : 2);
  }
  return [];
}

function settingsOf(config: BaseTenConfig, mode: BaseTenMode): BaseTenSettings {
  const maxValue = integer(config.maxValue, MAX_VALUE, 1, MAX_VALUE);
  const chartColumns = chartColumnsOf(config, mode);
  const chartFill: ChartFill =
    chartColumns.length > 0 ? (config.chartFill ?? 'student') : 'student';
  return {
    allowedBlocks: normalizeAllowed(config.allowedBlocks),
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
  };
}

interface BlockDraft {
  readonly value: BlockValue;
  readonly zone?: Zone;
}

function draftsFromStart(start: StartSpec | undefined): BlockDraft[] {
  if (!start) return [];
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
    const arrangedA = arrangeByPlace(a.blocks, regionFor({ mode, settings }, 'a'));
    const arrangedB = arrangeByPlace(b.blocks, regionFor({ mode, settings }, 'b'));
    return { blocks: [...arrangedA, ...arrangedB], nextId: b.nextId };
  }

  const start = config.start;
  const built = buildBlocks(draftsFromStart(start), 1);
  const region = settings.snapColumns ? regionFor({ mode, settings }) : WORK_FULL;
  let blocks = arrangeByPlace(built.blocks, region);

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
  };

  return {
    ...base,
    reachedHundred: Math.max(0, valueOf(base)) >= 100,
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
    reachedHundred: next.reachedHundred || Math.max(0, valueOf(next)) >= 100,
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
    default:
      return state;
  }
}

function addBlock(state: BaseTenState, value: BlockValue, point: Point): BaseTenState {
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
  if (!blockOf(state, id)) return state;
  return withBlocks(
    state,
    state.blocks.filter((block) => block.id !== id),
    { lastAttempt: null },
  );
}

function lassoGroup(state: BaseTenState, ids: readonly string[]): BaseTenState {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return state;

  const found = unique
    .map((id) => blockOf(state, id))
    .filter((block): block is BaseTenBlock => block !== undefined);
  if (found.length !== unique.length) return state;

  const value = found[0]?.value;
  const same = value !== undefined && found.every((block) => block.value === value);

  if (unique.length !== 10 || !same || value === undefined || value === 1000) {
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
  const candidates = BLOCK_VALUES.filter(
    (value) => value !== 1000 && state.blocks.filter((block) => block.value === value).length >= 10,
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
    const band = bandsFor(region).find((candidate) => candidate.column === columnOf(higher));
    if (band) {
      point = slotPoint(band, higher, slotIndexInBand(state.blocks, band, higher));
    }
  }

  const merged: BaseTenBlock = {
    id: `b${state.nextId}`,
    value: higher,
    x: clamp(Math.round(point.x), 0, LOGICAL_WIDTH),
    y: clamp(Math.round(point.y), 0, LOGICAL_HEIGHT),
    ...(zone === undefined ? {} : { zone }),
  };

  return withBlocks(state, [...state.blocks.filter((block) => !ids.has(block.id)), merged], {
    nextId: state.nextId + 1,
    log: [...state.log, { kind: 'group', from: value }],
    lastAttempt: null,
  });
}

function breakBlock(state: BaseTenState, id: string): BaseTenState {
  const block = blockOf(state, id);
  if (!block || block.value === 1) return state;
  if (state.mode === 'add-sub' && !state.settings.regroupAllowed) return state;

  const lower = (block.value / 10) as BlockValue;
  const points = fanPoints({ x: block.x, y: block.y }, lower);
  let nextId = state.nextId;
  const created = points.map((point) => {
    const piece: BaseTenBlock = {
      id: `b${nextId}`,
      value: lower,
      x: point.x,
      y: point.y,
      ...(block.zone === undefined ? {} : { zone: block.zone }),
    };
    nextId += 1;
    return piece;
  });

  return withBlocks(state, [...state.blocks.filter((item) => item.id !== block.id), ...created], {
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
    const band = bandsFor(region).find((candidate) => candidate.column === column);
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
// 테스트·View가 함께 쓰는 계산
// ─────────────────────────────────────────────────────────────

export function groupedFrom(state: BaseTenState): number[] {
  return state.log.filter((entry) => entry.kind === 'group').map((entry) => entry.from);
}

export function brokenFrom(state: BaseTenState): number[] {
  return state.log.filter((entry) => entry.kind === 'break').map((entry) => entry.from);
}

/** "10개 묶기" 버튼을 지금 누를 수 있는가. */
export function canGroupTens(state: BaseTenState): boolean {
  return BLOCK_VALUES.some(
    (value) => value !== 1000 && state.blocks.filter((block) => block.value === value).length >= 10,
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
