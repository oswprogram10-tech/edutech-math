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

/** 캔버스를 4개의 자릿값 띠로 나눈다(높은 자리부터). */
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
  const bands = bandsFor(region);
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
  const band = bandsFor(region).find((candidate) => candidate.column === columnOf(value));
  if (!band) return { x: region.x + region.width / 2, y: region.y + region.height / 2 };
  return slotPoint(band, value, slotIndexInBand(state.blocks, band, value));
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
export function arrangeByPlace(blocks: readonly BaseTenBlock[], rect: Rect): BaseTenBlock[] {
  const bands = bandsFor(rect);
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
