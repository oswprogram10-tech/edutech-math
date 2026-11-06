/**
 * E01 화면 배치. View·overlay·reduce(자석 스냅)가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 좌표는 모두 논리 좌표(1000×600)다.
 */
import type { Point } from '../../core/engine-sdk';
import { BLOCK_VALUES, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { BaseTenBlock, BaseTenState, BlockValue, Zone } from './types';
import { columnOf } from './value';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Band {
  readonly column: number;
  readonly x: number;
  readonly width: number;
  readonly y: number;
  readonly height: number;
}

export const TOOLBOX_RECT: Rect = { x: 16, y: 12, width: 404, height: 84 };
export const TRASH_RECT: Rect = { x: 868, y: 16, width: 116, height: 72 };

export const WORK_FULL: Rect = { x: 16, y: 110, width: 968, height: 474 };
export const WORK: Rect = { x: 16, y: 110, width: 968, height: 304 };
export const STRIP: Rect = { x: 16, y: 424, width: 968, height: 160 };

export const ADD_A: Rect = { x: 16, y: 110, width: 468, height: 216 };
export const ADD_B: Rect = { x: 516, y: 110, width: 468, height: 216 };
export const ADD_SUM: Rect = { x: 16, y: 336, width: 968, height: 248 };

export const SUB_A: Rect = { x: 16, y: 110, width: 474, height: 474 };
export const SUB_TAKE: Rect = { x: 510, y: 110, width: 474, height: 474 };

// ── divide (T043) ───────────────────────────────────────────
/** 나눗셈에서 아직 접시에 나누지 않은 블록을 두는 위쪽 무더기. */
export const DIVIDE_PILE: Rect = { x: 16, y: 110, width: 968, height: 180 };
export const DIVIDE_PLATE_AREA: Rect = { x: 16, y: 306, width: 968, height: 278 };

export function dividePlateRects(count: number): Rect[] {
  const safe = Math.max(1, Math.min(9, Math.trunc(count)));
  const columns = Math.min(safe, 4);
  const rows = Math.ceil(safe / columns);
  const gap = 10;
  const width = (DIVIDE_PLATE_AREA.width - gap * (columns - 1)) / columns;
  const height = (DIVIDE_PLATE_AREA.height - gap * (rows - 1)) / rows;
  return Array.from({ length: safe }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: DIVIDE_PLATE_AREA.x + column * (width + gap),
      y: DIVIDE_PLATE_AREA.y + row * (height + gap),
      width,
      height,
    };
  });
}

export function dividePlateAt(point: Point, count: number): number | null {
  const rects = dividePlateRects(count);
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (rect && inRect(point, rect)) return index;
  }
  return null;
}

/** 접시 이름표가 차지하는 위쪽 높이. 블록은 이 아래에서 시작한다. */
export const PLATE_LABEL_CLEARANCE = 30;

/**
 * 접시 하나 안에 블록을 자릿값별로 줄 맞춰 놓는다.
 * 큰 블록부터 위에서 아래로, 같은 값은 가로로 채운다.
 */
export function arrangeOnPlate(rect: Rect, blocks: readonly BaseTenBlock[]): BaseTenBlock[] {
  const ordered = [...blocks].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
  const result: BaseTenBlock[] = [];
  let cursorY = rect.y + PLATE_LABEL_CLEARANCE;
  for (const value of [1000, 100, 10, 1] as BlockValue[]) {
    const group = ordered.filter((block) => block.value === value);
    if (group.length === 0) continue;
    const size = blockSize(value);
    const perRow = Math.max(1, Math.floor((rect.width - 10) / (size.width + 6)));
    const rows = Math.ceil(group.length / perRow);
    group.forEach((block, index) => {
      const column = index % perRow;
      const row = Math.floor(index / perRow);
      const maxX = rect.x + rect.width - size.width / 2 - 4;
      const minX = rect.x + size.width / 2 + 4;
      const x = rect.x + rect.width / 2 + (column - (perRow - 1) / 2) * (size.width + 6);
      const y = cursorY + size.height / 2 + row * (size.height + 6);
      result.push({
        ...block,
        x: Math.round(Math.max(minX, Math.min(maxX, x))),
        y: Math.round(
          Math.max(
            rect.y + PLATE_LABEL_CLEARANCE + size.height / 2,
            Math.min(rect.y + rect.height - size.height / 2, y),
          ),
        ),
      });
    });
    cursorY += rows * (size.height + 6) + 4;
  }
  return result;
}

// ── big-number (T043) ───────────────────────────────────────
export const BIG_STRIP: Rect = { x: 40, y: 150, width: 920, height: 150 };
export const BIG_REVERSE_GRID: Rect = { x: 70, y: 110, width: 860, height: 260 };

export function bigDigitWidth(length: number): number {
  const safe = Math.max(1, length);
  return Math.min(64, Math.max(26, (BIG_STRIP.width - (safe - 1) * 10) / safe));
}

export function bigDigitRects(length: number): Rect[] {
  const safe = Math.max(1, length);
  const width = bigDigitWidth(safe);
  const gap = 10;
  const total = safe * width + (safe - 1) * gap;
  const startX = BIG_STRIP.x + (BIG_STRIP.width - total) / 2;
  const height = 96;
  const y = BIG_STRIP.y + (BIG_STRIP.height - height) / 2;
  return Array.from({ length: safe }, (_, index) => ({
    x: startX + index * (width + gap),
    y,
    width,
    height,
  }));
}

/** 숫자 사이 틈(오른쪽에서 센 자릿수 위치). */
export function bigGapRects(length: number): { readonly position: number; readonly rect: Rect }[] {
  const rects = bigDigitRects(length);
  const gaps: { position: number; rect: Rect }[] = [];
  for (let index = 0; index < rects.length - 1; index += 1) {
    const left = rects[index];
    const right = rects[index + 1];
    if (!left || !right) continue;
    gaps.push({
      position: rects.length - 1 - index,
      rect: {
        x: left.x + left.width,
        y: BIG_STRIP.y,
        width: right.x - (left.x + left.width),
        height: BIG_STRIP.height,
      },
    });
  }
  return gaps;
}

export function reverseCellRect(cell: number): Rect {
  const group = Math.floor(cell / 4);
  const place = cell % 4;
  const gap = 12;
  const width = (BIG_REVERSE_GRID.width - gap * 3) / 4;
  const height = (BIG_REVERSE_GRID.height - gap * 3) / 4;
  return {
    x: BIG_REVERSE_GRID.x + group * (width + gap),
    y: BIG_REVERSE_GRID.y + place * (height + gap),
    width,
    height,
  };
}

export function inRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function expandRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/** 블록 상자의 값 하나가 차지하는 자리. */
export function boxSlotRect(index: number, count: number): Rect {
  const gap = 8;
  const safeCount = Math.max(1, count);
  const width = (TOOLBOX_RECT.width - 16 - gap * (safeCount - 1)) / safeCount;
  return {
    x: TOOLBOX_RECT.x + 8 + index * (width + gap),
    y: TOOLBOX_RECT.y + 8,
    width,
    height: TOOLBOX_RECT.height - 16,
  };
}

export interface BlockSize {
  readonly width: number;
  readonly height: number;
}

export function blockSize(value: BlockValue): BlockSize {
  switch (value) {
    case 1:
      return { width: 28, height: 28 };
    case 10:
      return { width: 28, height: 100 };
    case 100:
      return { width: 100, height: 100 };
    case 1000:
      return { width: 112, height: 112 };
  }
}

export function blockRect(block: {
  readonly value: BlockValue;
  readonly x: number;
  readonly y: number;
}): Rect {
  const size = blockSize(block.value);
  return {
    x: block.x - size.width / 2,
    y: block.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

/** 같은 값 블록 열 개 자리. 실제 블록 자리를 그대로 쓰고, 모자라면 그 줄 간격으로 이어 그린다. */
export function tenOutlineRects(state: BaseTenState, value: BlockValue): Rect[] {
  const slots = 10;
  const size = blockSize(value);
  const anchors = state.blocks
    .filter((block) => block.value === value)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, slots)
    .map((block) => blockRect(block));

  if (anchors.length === 0) {
    // 블록이 없을 때만 판 가운데에 옛 격자로 열 자리를 보여 준다.
    const stepX = size.width + 26;
    const stepY = size.height + 22;
    const originX = LOGICAL_WIDTH / 2 - (4 * stepX) / 2;
    return Array.from({ length: slots }, (_, index) => ({
      x: originX + (index % 5) * stepX - size.width / 2,
      y: 250 + Math.floor(index / 5) * stepY - size.height / 2,
      width: size.width,
      height: size.height,
    }));
  }

  const rects = [...anchors];
  const stepX = rowStepOf(rects, size) ?? size.width + 22;
  const stepY = columnStepOf(rects, size) ?? size.height + 22;
  const first = anchors[0] as Rect;
  while (rects.length < slots) {
    const last = rects[rects.length - 1] as Rect;
    let x = last.x + stepX;
    let y = last.y;
    if (x + size.width > LOGICAL_WIDTH - 8) {
      x = first.x;
      y = Math.min(LOGICAL_HEIGHT - size.height - 8, last.y + stepY);
    }
    rects.push({ x, y, width: size.width, height: size.height });
  }
  return rects;
}

function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

/** 실제 블록을 가로 줄로 묶는다(세로로 흩어진 흔들림은 같은 줄로 본다). */
function rowsOfRects(rects: readonly Rect[], size: BlockSize): Rect[][] {
  const rows: Rect[][] = [];
  const tolerance = Math.max(size.height, 20);
  for (const rect of [...rects].sort((a, b) => a.y - b.y)) {
    const row = rows.find((candidate) => Math.abs((candidate[0] as Rect).y - rect.y) <= tolerance);
    if (row) row.push(rect);
    else rows.push([rect]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

/** 같은 줄에서 이웃한 블록 사이의 가로 간격. */
function rowStepOf(rects: readonly Rect[], size: BlockSize): number | null {
  const diffs: number[] = [];
  for (const row of rowsOfRects(rects, size)) {
    for (let index = 1; index < row.length; index += 1) {
      const diff = (row[index] as Rect).x - (row[index - 1] as Rect).x;
      if (diff > 1) diffs.push(diff);
    }
  }
  return medianOf(diffs);
}

/** 이웃한 두 줄 사이의 세로 간격. */
function columnStepOf(rects: readonly Rect[], size: BlockSize): number | null {
  const rows = rowsOfRects(rects, size);
  const diffs: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const current = rows[index]?.[0];
    const previous = rows[index - 1]?.[0];
    if (!current || !previous) continue;
    const diff = current.y - previous.y;
    if (diff > 1) diffs.push(diff);
  }
  return medianOf(diffs);
}

/** 캔버스를 4개의 자릿값 띠로 나눈다(높은 자리부터, whole 기준). */
export function bandsFor(rect: Rect): Band[] {
  const width = rect.width / 4;
  return [3, 2, 1, 0].map((column, index) => ({
    column,
    x: rect.x + index * width,
    width,
    y: rect.y,
    height: rect.height,
  }));
}

/** 블록 모양 띠. decimal은 판(100)·막대(10)·낱개(1) 세 띠만 쓴다. */
export function shapeColumnsFor(state: Pick<BaseTenState, 'settings'>): number[] {
  return state.settings.interpretation === 'decimal' ? [2, 1, 0] : [3, 2, 1, 0];
}

export function bandsForState(state: Pick<BaseTenState, 'settings'>, rect: Rect): Band[] {
  const columns = shapeColumnsFor(state);
  const width = rect.width / columns.length;
  return columns.map((column, index) => ({
    column,
    x: rect.x + index * width,
    width,
    y: rect.y,
    height: rect.height,
  }));
}

function rowCapacity(band: Band, value: BlockValue): number {
  const size = blockSize(value);
  return Math.max(1, Math.floor((band.width - 8) / (size.width + 8)));
}

/** 띠 안에서 index번째 블록의 중심. */
export function slotPoint(band: Band, value: BlockValue, index: number): Point {
  const size = blockSize(value);
  const perRow = rowCapacity(band, value);
  const column = index % perRow;
  const row = Math.floor(index / perRow);
  const stepX = size.width + 8;
  const stepY = size.height + 6;
  const x = band.x + band.width / 2 + (column - (perRow - 1) / 2) * stepX;
  const maxY = band.y + band.height - size.height / 2 - 4;
  const y = Math.min(maxY, band.y + 6 + size.height / 2 + row * stepY);
  return { x: Math.round(x), y: Math.round(y) };
}

/** 같은 자리 띠에 이미 있는 블록 수. `excludeId`는 옮기는 블록 자신이다. */
export function slotIndexInBand(
  blocks: readonly BaseTenBlock[],
  band: Band,
  value: BlockValue,
  excludeId?: string,
): number {
  return blocks.filter((block) => {
    if (block.id === excludeId) return false;
    if (block.value !== value) return false;
    if (block.y < band.y - 2 || block.y > band.y + band.height + 2) return false;
    return block.x >= band.x && block.x <= band.x + band.width;
  }).length;
}

export function regionFor(state: Pick<BaseTenState, 'mode' | 'settings'>, zone?: Zone): Rect {
  if (state.mode === 'divide') return DIVIDE_PILE;
  if (state.mode === 'add-sub') {
    if (state.settings.op === 'add') {
      switch (zone) {
        case 'a':
          return ADD_A;
        case 'b':
          return ADD_B;
        case 'sum':
          return ADD_SUM;
        default:
          return ADD_SUM;
      }
    }
    switch (zone) {
      case 'a':
        return SUB_A;
      case 'take':
        return SUB_TAKE;
      default:
        return SUB_A;
    }
  }
  if (state.settings.snapColumns) return STRIP;
  return WORK_FULL;
}

/** 점이 들어 있는 add-sub 구역. 그 밖이면 undefined. */
export function zoneAt(point: Point, state: BaseTenState): Zone | undefined {
  if (state.mode !== 'add-sub') return undefined;
  if (state.settings.op === 'add') {
    if (inRect(point, ADD_A)) return 'a';
    if (inRect(point, ADD_B)) return 'b';
    if (inRect(point, ADD_SUM)) return 'sum';
    return undefined;
  }
  if (inRect(point, SUB_A)) return 'a';
  if (inRect(point, SUB_TAKE)) return 'take';
  return undefined;
}

/** 자석 스냅: 자기 자리 띠 근처에 놓았을 때만 그 띠의 다음 칸으로 붙인다. */
export function snapToColumns(
  state: BaseTenState,
  value: BlockValue,
  point: Point,
  zone: Zone | undefined,
  excludeId?: string,
): Point {
  if (!state.settings.snapColumns) return point;
  const region = regionFor(state, zone);
  if (!inRect(point, expandRect(region, 24))) return point;
  const bands = bandsForState(state, region);
  const ownColumn = columnOf(value);
  const own = bands.find((band) => band.column === ownColumn);
  if (!own) return point;

  let nearest = bands[0] as Band;
  for (const band of bands) {
    const center = band.x + band.width / 2;
    const nearestCenter = nearest.x + nearest.width / 2;
    if (Math.abs(point.x - center) < Math.abs(point.x - nearestCenter)) nearest = band;
  }
  if (nearest.column !== ownColumn) return point;

  const index = slotIndexInBand(state.blocks, own, value, excludeId);
  return slotPoint(own, value, index);
}

/** 상자에서 새 블록을 놓을 기본 자리. */
export function defaultDropPoint(state: BaseTenState, value: BlockValue): Point {
  const zone = state.mode === 'add-sub' ? (state.settings.op === 'add' ? 'sum' : 'a') : undefined;
  const region = regionFor(state, zone);
  const band = bandsForState(state, region).find(
    (candidate) => candidate.column === columnOf(value),
  );
  if (!band) return { x: region.x + region.width / 2, y: region.y + region.height / 2 };
  return slotPoint(band, value, slotIndexInBand(state.blocks, band, value));
}

/**
 * 두 사각형이 `margin`보다 가까이 있는가(즉 margin만큼의 틈도 확보하지 못했는가).
 * margin 0이면 실제로 겹치는지만 본다.
 */
export function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

/** value 블록을 point에 놓았을 때의 사각형. */
function rectAt(value: BlockValue, point: Point): Rect {
  const size = blockSize(value);
  return {
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

/**
 * 새 블록을 `desired`(무게중심 등)에서 가장 가까우면서 이미 있는 블록과 겹치지 않는 자리에 놓는다.
 * 같은 값 블록이 옆으로 나란히 놓이도록 가로 칸을 먼저 살핀다. 항상 캔버스(또는 bounds) 안이다.
 */
export function findFreePoint(
  blocks: readonly BaseTenBlock[],
  value: BlockValue,
  desired: Point,
  options: { readonly margin?: number; readonly bounds?: Rect } = {},
): Point {
  const margin = options.margin ?? 4;
  const bounds = options.bounds ?? {
    x: 0,
    y: 0,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
  };
  const size = blockSize(value);
  const clampX = (x: number): number =>
    Math.round(
      Math.max(bounds.x + size.width / 2, Math.min(bounds.x + bounds.width - size.width / 2, x)),
    );
  const clampY = (y: number): number =>
    Math.round(
      Math.max(bounds.y + size.height / 2, Math.min(bounds.y + bounds.height - size.height / 2, y)),
    );

  const stepX = size.width + margin;
  const stepY = size.height + margin;
  const offsets: { readonly ix: number; readonly iy: number }[] = [{ ix: 0, iy: 0 }];
  const maxRing = 24;
  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (let ix = -ring; ix <= ring; ix += 1) {
      for (let iy = -ring; iy <= ring; iy += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iy)) !== ring) continue;
        offsets.push({ ix, iy });
      }
    }
  }
  offsets.sort(
    (a, b) =>
      a.ix * a.ix + a.iy * a.iy - (b.ix * b.ix + b.iy * b.iy) ||
      Math.abs(a.iy) - Math.abs(b.iy) ||
      a.ix - b.ix,
  );

  for (const offset of offsets) {
    const point = {
      x: clampX(desired.x + offset.ix * stepX),
      y: clampY(desired.y + offset.iy * stepY),
    };
    const rect = rectAt(value, point);
    const clash = blocks.some((block) => rectsOverlap(rect, blockRect(block), margin));
    if (!clash) return point;
  }
  return { x: clampX(desired.x), y: clampY(desired.y) };
}

/** 풀린 블록 10개를 원래 블록 둘레에 부채꼴로 놓는다. */
export function fanPoints(center: Point, value: BlockValue): Point[] {
  const size = blockSize(value);
  const radius = Math.max(70, size.width * 0.9);
  return Array.from({ length: 10 }, (_, index) => {
    const angle = Math.PI * (0.15 + (index / 9) * 0.7);
    const x = center.x + Math.cos(angle) * radius * 1.6;
    const y = center.y + Math.sin(angle) * radius + size.height * 0.35;
    return {
      x: Math.round(Math.max(20, Math.min(LOGICAL_WIDTH - 20, x))),
      y: Math.round(Math.max(130, Math.min(LOGICAL_HEIGHT - 20, y))),
    };
  });
}

/** 흩어진 낱개 자리. createInitialState에서만 seed 난수를 쓴다. */
export function scatteredPoint(random: () => number, index: number, rect: Rect): Point {
  const columns = 10;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const stepX = (rect.width - 80) / (columns - 1);
  return {
    x: Math.round(rect.x + 40 + column * stepX + (random() - 0.5) * 22),
    y: Math.round(rect.y + 46 + row * 66 + (random() - 0.5) * 22),
  };
}

/** 처음 블록을 자리별 띠에 줄 맞춰 놓는다. */
export function arrangeByPlace(
  state: Pick<BaseTenState, 'settings'>,
  blocks: readonly BaseTenBlock[],
  rect: Rect,
): BaseTenBlock[] {
  const bands = bandsForState(state, rect);
  const counters = new Map<number, number>();
  return blocks.map((block) => {
    const column = columnOf(block.value);
    const band = bands.find((candidate) => candidate.column === column);
    if (!band) return block;
    const index = counters.get(column) ?? 0;
    counters.set(column, index + 1);
    const point = slotPoint(band, block.value, index);
    return { ...block, x: point.x, y: point.y };
  });
}

/** add-sub의 b 수를 블록으로 만들지 않고, b의 각 자리 숫자만 쓴다. */
export function blockValuesForNumber(number: number): { value: BlockValue; column: number }[] {
  const safe = Math.max(0, Math.trunc(number));
  const result: { value: BlockValue; column: number }[] = [];
  for (const value of BLOCK_VALUES) {
    const column = columnOf(value);
    const digit = Math.floor(safe / value) % 10;
    for (let index = 0; index < digit; index += 1) result.push({ value, column });
  }
  return result;
}
