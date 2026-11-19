/**
 * E15 표 변형 판의 논리 좌표(화면 좌표라 number). CalcTableView와 cell-diff 오버레이가 같이 쓴다.
 *
 * 격자는 머리 줄·머리 칸을 포함해 `(rows + 1) × (cols + 1)`칸이다.
 * 머리 칸 (0, 0)은 연산 기호, 열 머리는 윗줄, 행 머리는 왼쪽 열이다.
 */
import type { TableGrid } from './calc-table';

/** 칸 한 변의 논리 길이. 화면 배율의 최소는 targetSize / CELL이다. */
export const CELL = 64;
export const PAD = 12;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TableLayout {
  readonly width: number;
  readonly height: number;
}

export function tableLayout(grid: Pick<TableGrid, 'rows' | 'cols'>): TableLayout {
  return {
    width: PAD * 2 + (grid.cols + 1) * CELL,
    height: PAD * 2 + (grid.rows + 1) * CELL,
  };
}

/** 몸통 칸 (row, col)의 상자. */
export function bodyRect(row: number, col: number): Rect {
  return { x: PAD + (col + 1) * CELL, y: PAD + (row + 1) * CELL, w: CELL, h: CELL };
}

/** 윗줄의 열 머리 칸. */
export function colHeadRect(col: number): Rect {
  return { x: PAD + (col + 1) * CELL, y: PAD, w: CELL, h: CELL };
}

/** 왼쪽 열의 행 머리 칸. */
export function rowHeadRect(row: number): Rect {
  return { x: PAD, y: PAD + (row + 1) * CELL, w: CELL, h: CELL };
}

export function cornerRect(): Rect {
  return { x: PAD, y: PAD, w: CELL, h: CELL };
}

export function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}
