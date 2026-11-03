/**
 * E04 화면 배치. View·overlay·E2E가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 좌표는 모두 논리 좌표(1000×600)다.
 */
import type { SplitOrientation } from './types';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ArrayRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly cell: number;
}

const ARRAY_CENTER_X = 430;
const ARRAY_TOP = 120;
const ARRAY_MAX_WIDTH = 660;
const ARRAY_MAX_HEIGHT = 400;

export function arrayRect(rows: number, cols: number, maxRows: number, maxCols: number): ArrayRect {
  const cell = Math.max(
    14,
    Math.min(
      52,
      Math.floor(ARRAY_MAX_WIDTH / Math.max(1, maxCols)),
      Math.floor(ARRAY_MAX_HEIGHT / Math.max(1, maxRows)),
    ),
  );
  const width = Math.max(0, cols) * cell;
  const height = Math.max(0, rows) * cell;
  return {
    x: Math.round(ARRAY_CENTER_X - width / 2),
    y: ARRAY_TOP,
    width,
    height,
    cell,
  };
}

export function cellCenter(rect: ArrayRect, row: number, col: number): Point {
  return {
    x: Math.round(rect.x + (col + 0.5) * rect.cell),
    y: Math.round(rect.y + (row + 0.5) * rect.cell),
  };
}

/** 배열 오른쪽 아래 손잡이 위치(끌어서 행·열 정하기). */
export function resizeHandle(rect: ArrayRect): Point {
  return { x: rect.x + rect.width, y: rect.y + rect.height };
}

export function rowsFromPoint(rect: ArrayRect, point: Point, maxRows: number): number {
  const raw = Math.round((point.y - rect.y) / rect.cell);
  return Math.max(0, Math.min(maxRows, raw));
}

export function colsFromPoint(rect: ArrayRect, point: Point, maxCols: number): number {
  const raw = Math.round((point.x - rect.x) / rect.cell);
  return Math.max(0, Math.min(maxCols, raw));
}

/** 분할선이 놓일 자리(행 사이·열 사이 정수). 범위를 벗어나면 null. */
export function splitAtFromPoint(
  rect: ArrayRect,
  point: Point,
  orientation: SplitOrientation,
  count: number,
): number | null {
  const raw =
    orientation === 'cols'
      ? Math.round((point.x - rect.x) / rect.cell)
      : Math.round((point.y - rect.y) / rect.cell);
  if (raw < 1 || raw > count - 1) return null;
  return raw;
}

/** 분할선의 화면 위치(선분). */
export function splitSegment(
  rect: ArrayRect,
  orientation: SplitOrientation,
  at: number,
): { x1: number; y1: number; x2: number; y2: number } {
  if (orientation === 'cols') {
    const x = rect.x + at * rect.cell;
    return { x1: x, y1: rect.y, x2: x, y2: rect.y + rect.height };
  }
  const y = rect.y + at * rect.cell;
  return { x1: rect.x, y1: y, x2: rect.x + rect.width, y2: y };
}

export interface AreaRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const AREA_TOP = 140;
const AREA_MAX_WIDTH = 720;
const AREA_MAX_HEIGHT = 340;
const AREA_MIN_HEIGHT = 70;

export function areaRect(a: number, b: number): AreaRect {
  const safeA = Math.max(1, a);
  const safeB = Math.max(1, b);
  const width = Math.round(Math.min(AREA_MAX_WIDTH, Math.max(160, safeA * 30)));
  const height = Math.round(Math.min(AREA_MAX_HEIGHT, Math.max(AREA_MIN_HEIGHT, safeB * 60)));
  return { x: Math.round(470 - width / 2), y: AREA_TOP, width, height };
}

/** a변 위치(0..a)를 화면 x로. */
export function areaX(rect: AreaRect, a: number, at: number): number {
  return rect.x + (rect.width * at) / Math.max(1, a);
}

/** b변 위치(0..b)를 화면 y로. */
export function areaY(rect: AreaRect, b: number, at: number): number {
  return rect.y + (rect.height * at) / Math.max(1, b);
}

export function areaSplitAtFromPoint(
  rect: AreaRect,
  point: Point,
  side: 'a' | 'b',
  count: number,
): number | null {
  const raw =
    side === 'a'
      ? Math.round(((point.x - rect.x) / Math.max(1, rect.width)) * count)
      : Math.round(((point.y - rect.y) / Math.max(1, rect.height)) * count);
  if (raw < 1 || raw > count - 1) return null;
  return raw;
}

export interface TableRect {
  readonly x: number;
  readonly y: number;
  readonly cell: number;
  readonly header: number;
  readonly start: number;
  readonly rows: number;
  readonly cols: number;
}

export function tableRect(rows: number, cols: number, includeZero: boolean): TableRect {
  const start = includeZero ? 0 : 1;
  const rowCount = Math.max(1, rows - start + 1);
  const colCount = Math.max(1, cols - start + 1);
  const cell = Math.max(20, Math.min(46, Math.floor(520 / colCount), Math.floor(380 / rowCount)));
  const header = Math.round(cell * 0.9);
  const width = header + colCount * cell;
  const height = header + rowCount * cell;
  return {
    x: Math.round(470 - width / 2),
    y: Math.round((600 - height) / 2),
    cell,
    header,
    start,
    rows,
    cols,
  };
}

export function tableCellRect(
  rect: TableRect,
  r: number,
  c: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x + rect.header + (c - rect.start) * rect.cell,
    y: rect.y + rect.header + (r - rect.start) * rect.cell,
    width: rect.cell,
    height: rect.cell,
  };
}

export function tableCenter(rect: TableRect, r: number, c: number): Point {
  const cell = tableCellRect(rect, r, c);
  return { x: Math.round(cell.x + cell.width / 2), y: Math.round(cell.y + cell.height / 2) };
}

/** 대각선(1,1)…(n,n) 위치. 접기 힌트에 쓴다. */
export function diagonalSegment(rect: TableRect): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const start = rect.start;
  const first = tableCenter(rect, start, start);
  const lastCell = Math.min(rect.rows, rect.cols);
  const last = tableCenter(rect, lastCell, lastCell);
  return { x1: first.x, y1: first.y, x2: last.x, y2: last.y };
}

export interface PieceRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rows: number;
  readonly cols: number;
  readonly sign: 1 | -1;
}

/** split 배열의 조각 사각형(빼는 줄은 배열 아래에 그린다). */
export function splitPieceRects(
  rect: ArrayRect,
  rows: number,
  cols: number,
  rowBounds: readonly number[],
  colBounds: readonly number[],
  extendedRows: number,
): PieceRect[] {
  const result: PieceRect[] = [];
  for (let rowIndex = 0; rowIndex < rowBounds.length - 1; rowIndex += 1) {
    const rowStart = rowBounds[rowIndex] ?? 0;
    const rowEnd = rowBounds[rowIndex + 1] ?? rows;
    for (let colIndex = 0; colIndex < colBounds.length - 1; colIndex += 1) {
      const colStart = colBounds[colIndex] ?? 0;
      const colEnd = colBounds[colIndex + 1] ?? cols;
      result.push({
        x: rect.x + colStart * rect.cell,
        y: rect.y + rowStart * rect.cell,
        width: (colEnd - colStart) * rect.cell,
        height: (rowEnd - rowStart) * rect.cell,
        rows: rowEnd - rowStart,
        cols: colEnd - colStart,
        sign: 1,
      });
    }
  }

  const extra = Math.max(0, extendedRows);
  if (extra > 0) {
    const extendedTop = rect.y + rows * rect.cell;
    for (let colIndex = 0; colIndex < colBounds.length - 1; colIndex += 1) {
      const colStart = colBounds[colIndex] ?? 0;
      const colEnd = colBounds[colIndex + 1] ?? cols;
      result.push({
        x: rect.x + colStart * rect.cell,
        y: extendedTop,
        width: (colEnd - colStart) * rect.cell,
        height: extra * rect.cell,
        rows: extra,
        cols: colEnd - colStart,
        sign: -1,
      });
    }
  }
  return result;
}

export function areaPieceRects(
  rect: AreaRect,
  a: number,
  b: number,
  splitsA: readonly number[],
  splitsB: readonly number[],
): PieceRect[] {
  const widthBounds = [0, ...[...splitsA].sort((x, y) => x - y), a];
  const heightBounds = [0, ...[...splitsB].sort((x, y) => x - y), b];
  const result: PieceRect[] = [];
  for (let rowIndex = 0; rowIndex < heightBounds.length - 1; rowIndex += 1) {
    const top = heightBounds[rowIndex] ?? 0;
    const bottom = heightBounds[rowIndex + 1] ?? b;
    for (let colIndex = 0; colIndex < widthBounds.length - 1; colIndex += 1) {
      const left = widthBounds[colIndex] ?? 0;
      const right = widthBounds[colIndex + 1] ?? a;
      result.push({
        x: areaX(rect, a, left),
        y: areaY(rect, b, top),
        width: areaX(rect, a, right) - areaX(rect, a, left),
        height: areaY(rect, b, bottom) - areaY(rect, b, top),
        rows: bottom - top,
        cols: right - left,
        sign: 1,
      });
    }
  }
  return result;
}
