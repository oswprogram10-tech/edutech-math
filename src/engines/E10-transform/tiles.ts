/**
 * T105 쪽매맞춤 타일. 정사각 계열은 6×6칸 타일과 18×18칸 틀, 삼각 계열은
 * 줄 0..5·줄마다 8칸(U·D 96개) 틀을 쓴다.
 *
 * 타일 하나는 정확히 단위 칸(정사각 칸 또는 단위 삼각형)의 합집합이므로
 * 빈틈·겹침을 래스터 근사 없이 정확히 센다.
 */
import { Rational } from '../../core/math';
import type { Move, Pt, SquareFigure } from './types';
import { applySquareMove } from './square';
import { applyTriMove, decodeTriCell, triCellKey } from './tri';
import type { TriFigure } from './tri';

export type TessTile = 'square' | 'triangle' | 'hexagon' | 'pentagon-regular' | 'custom';
export type TessBaseTile = Exclude<TessTile, 'custom'>;
export type TileFamily = 'square' | 'tri' | 'free';

export const SQUARE_TILE = 6;
export const SQUARE_FRAME = 18;
export const SQUARE_EXTENT = 6;
export const TRI_FRAME_ROWS = 6;
export const TRI_FRAME_WIDTH = 8;
export const TRI_EXTENT = 2;

export interface TileStamp {
  readonly outline: readonly Pt[];
  readonly cells: readonly Pt[];
}

export interface TessellationStats {
  readonly frameCells: number;
  readonly covered: number;
  readonly overlapCells: number;
  readonly gapCells: number;
  readonly coverage: string;
}

export function tileFamily(tile: TessTile): TileFamily {
  if (tile === 'square' || tile === 'custom') return 'square';
  if (tile === 'triangle' || tile === 'hexagon') return 'tri';
  return 'free';
}

export function isTessBaseTile(value: string): value is TessBaseTile {
  return (
    value === 'square' ||
    value === 'triangle' ||
    value === 'hexagon' ||
    value === 'pentagon-regular'
  );
}

export function isTessTile(value: string): value is TessTile {
  return isTessBaseTile(value) || value === 'custom';
}

export function squareOutline(): Pt[] {
  return [
    [0, 0],
    [SQUARE_TILE, 0],
    [SQUARE_TILE, SQUARE_TILE],
    [0, SQUARE_TILE],
  ];
}

export function initialCustomCells(): Pt[] {
  const cells: Pt[] = [];
  for (let y = 0; y < SQUARE_TILE; y += 1) {
    for (let x = 0; x < SQUARE_TILE; x += 1) cells.push([x, y]);
  }
  return cells;
}

export function tileStamp(tile: TessTile, customCells: readonly Pt[]): TileStamp {
  switch (tile) {
    case 'square': {
      const cells: Pt[] = [];
      for (let y = 0; y < SQUARE_TILE; y += 1) {
        for (let x = 0; x < SQUARE_TILE; x += 1) cells.push([x, y]);
      }
      return { outline: squareOutline(), cells };
    }
    case 'custom':
      return { outline: squareOutline(), cells: customCells.map((cell) => [cell[0], cell[1]]) };
    case 'triangle':
      return {
        outline: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        cells: [[1, 1]],
      };
    case 'hexagon':
      return { outline: hexagonOutline(1, 1), cells: hexagonTriCells(1, 1) };
    case 'pentagon-regular':
      return { outline: [], cells: [] };
  }
}

function hexagonOutline(a: number, b: number): Pt[] {
  return [
    [a + 1, b],
    [a, b + 1],
    [a - 1, b + 1],
    [a - 1, b],
    [a, b - 1],
    [a + 1, b - 1],
  ];
}

function hexagonTriCells(a: number, b: number): Pt[] {
  const cx = 3 * a;
  const cy = 3 * b;
  const offsets: readonly Pt[] = [
    [1, 1],
    [-2, 1],
    [1, -2],
    [-1, 2],
    [2, -1],
    [-1, -1],
  ];
  return offsets.map(([dx, dy]) => [cx + dx, cy + dy]);
}

export function applyStampMove(tile: TessTile, stamp: TileStamp, move: Move): TileStamp {
  if (tileFamily(tile) === 'free') return stamp;
  if (tileFamily(tile) === 'square') {
    const figure: SquareFigure = { outline: stamp.outline, cells: stamp.cells };
    const next = applySquareMove(figure, move);
    return { outline: next.outline, cells: next.cells };
  }
  const figure: TriFigure = { outline: stamp.outline, tris: stamp.cells };
  const next = applyTriMove(figure, move);
  return { outline: next.outline, cells: next.tris };
}

export function squareStampCells(stamp: TileStamp): readonly Pt[] {
  return stamp.cells;
}

/** 18×18 틀의 단위 칸 키. */
export function squareFrameKeys(): Set<string> {
  const keys = new Set<string>();
  for (let y = 0; y < SQUARE_FRAME; y += 1) {
    for (let x = 0; x < SQUARE_FRAME; x += 1) keys.add(`${x},${y}`);
  }
  return keys;
}

/** 삼각 틀의 단위 삼각형 키(U·D 96개). */
export function triangleFrameKeys(): Set<string> {
  const keys = new Set<string>();
  for (let b = 0; b < TRI_FRAME_ROWS; b += 1) {
    const a0 = -Math.floor(b / 2);
    for (let index = 0; index < TRI_FRAME_WIDTH; index += 1) {
      const a = a0 + index;
      keys.add(`U${a},${b}`);
      keys.add(`D${a},${b}`);
    }
  }
  return keys;
}

function keyOf(tile: TessTile, cell: Pt): string {
  return tileFamily(tile) === 'tri' ? triCellKey(cell) : `${cell[0]},${cell[1]}`;
}

/**
 * 놓인 타일 전체로 틀의 빈틈·겹침·덮은 칸을 센다. 타일이 없으면 현재 타일
 * 계열의 틀을 쓴다. 정오각형(자유)은 틀 칸이 0개다.
 */
export function tessellationStats(
  placed: readonly { readonly tile: TessTile; readonly cells: readonly Pt[] }[],
  fallbackTile: TessTile,
): TessellationStats {
  const family = placed[0]?.tile ? tileFamily(placed[0].tile) : tileFamily(fallbackTile);
  if (family === 'free') {
    return { frameCells: 0, covered: 0, overlapCells: 0, gapCells: 0, coverage: '0' };
  }
  const frame = family === 'square' ? squareFrameKeys() : triangleFrameKeys();
  const counts = new Map<string, number>();
  for (const tile of placed) {
    if (tileFamily(tile.tile) !== family) continue;
    for (const cell of tile.cells) {
      const key = keyOf(tile.tile, cell);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let covered = 0;
  let overlap = 0;
  let gap = 0;
  for (const key of frame) {
    const count = counts.get(key) ?? 0;
    if (count === 0) gap += 1;
    else {
      covered += 1;
      if (count >= 2) overlap += 1;
    }
  }
  const frameCells = frame.size;
  const coverage = frameCells === 0 ? '0' : Rational.of(covered, frameCells).toString();
  return { frameCells, covered, overlapCells: overlap, gapCells: gap, coverage };
}

/** 트리플 키가 틀 안의 단위 삼각형인지. */
export function triCellInFrame(cell: Pt): boolean {
  const decoded = decodeTriCell(cell);
  if (!decoded) return false;
  if (decoded.b < 0 || decoded.b >= TRI_FRAME_ROWS) return false;
  const a0 = -Math.floor(decoded.b / 2);
  return decoded.a >= a0 && decoded.a < a0 + TRI_FRAME_WIDTH;
}

function key(cell: Pt): string {
  return `${cell[0]},${cell[1]}`;
}

function isConnected(cells: readonly Pt[]): boolean {
  if (cells.length === 0) return false;
  const set = new Set(cells.map(key));
  const start = cells[0];
  if (!start) return false;
  const queue: Pt[] = [start];
  const seen = new Set<string>([key(start)]);
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const neighbours: readonly Pt[] = [
      [current[0] + 1, current[1]],
      [current[0] - 1, current[1]],
      [current[0], current[1] + 1],
      [current[0], current[1] - 1],
    ];
    for (const neighbour of neighbours) {
      const neighbourKey = key(neighbour);
      if (!set.has(neighbourKey) || seen.has(neighbourKey)) continue;
      seen.add(neighbourKey);
      queue.push(neighbour);
    }
  }
  return seen.size === set.size;
}

/**
 * 변 깎기 `toggle-notch`. 왼쪽 띠 `x∈{0,1}, y∈{2..5}`, 위쪽 띠
 * `y∈{0,1}, x∈{2..5}`만 고칠 수 있고, 안쪽 칸은 바깥 칸이 먼저 빠져 있어야
 * 뺄 수 있다. 결과가 변으로 이어지지 않으면 `null`(무시)이다.
 */
export function toggleCustomCell(customCells: readonly Pt[], cell: Pt): Pt[] | null {
  const [x, y] = cell;
  const leftBand = (x === 0 || x === 1) && y >= 2 && y <= 5;
  const topBand = (y === 0 || y === 1) && x >= 2 && x <= 5;
  if (!leftBand && !topBand) return null;

  const set = new Set(customCells.map(key));
  const present = set.has(key(cell));
  const partner: Pt = leftBand ? [x + 6, y] : [x, y + 6];

  if (present) {
    if (leftBand && x === 1 && set.has(key([0, y]))) return null;
    if (topBand && y === 1 && set.has(key([x, 0]))) return null;
    set.delete(key(cell));
    set.add(key(partner));
  } else {
    if (leftBand && x === 0 && !set.has(key([1, y]))) return null;
    if (topBand && y === 0 && !set.has(key([x, 1]))) return null;
    set.add(key(cell));
    set.delete(key(partner));
  }

  const next: Pt[] = [];
  for (const item of customCells) {
    if (set.has(key(item))) next.push([item[0], item[1]]);
  }
  for (const item of set) {
    const [cx, cy] = item.split(',').map(Number);
    if (typeof cx === 'number' && typeof cy === 'number') {
      if (!next.some((candidate) => key(candidate) === item)) next.push([cx, cy]);
    }
  }
  return isConnected(next) ? next : null;
}
