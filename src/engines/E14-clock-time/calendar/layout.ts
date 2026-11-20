/**
 * E14 calendar 판 좌표(논리 1000×600). 본 판과 plus-seven 오버레이가 같은 식을 쓴다.
 * 7열 격자. 줄 높이 88이라 최소 배율 0.6에서도 칸이 48px 이상이다.
 */

export const GRID = {
  left: 80,
  colW: 120,
  headerY: 12,
  headerH: 44,
  top: 64,
  rowH: 88,
  inset: 4,
} as const;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function cellRect(col: number, row: number): Rect {
  return {
    x: GRID.left + col * GRID.colW + GRID.inset,
    y: GRID.top + row * GRID.rowH + GRID.inset,
    w: GRID.colW - GRID.inset * 2,
    h: GRID.rowH - GRID.inset * 2,
  };
}

/** 논리 좌표가 놓인 칸(달 밖인지는 따지지 않는다). 격자 밖이면 null. */
export function cellAt(
  x: number,
  y: number,
): { readonly col: number; readonly row: number } | null {
  const col = Math.floor((x - GRID.left) / GRID.colW);
  const row = Math.floor((y - GRID.top) / GRID.rowH);
  if (col < 0 || col > 6 || row < 0 || row > 5) return null;
  return { col, row };
}

export interface ArrowShape {
  readonly x: number;
  readonly y1: number;
  readonly y2: number;
  readonly labelX: number;
  readonly labelY: number;
}

/** (열, 위쪽 줄)에서 아래 줄 칸으로 가는 +7 화살표의 좌표. */
export function arrowShape(col: number, row: number): ArrowShape {
  const upper = cellRect(col, row);
  const lower = cellRect(col, row + 1);
  const x = upper.x + upper.w / 2 - 22;
  const y1 = upper.y + upper.h - 9;
  const y2 = lower.y + 9;
  return { x, y1, y2, labelX: x + 12, labelY: (y1 + y2) / 2 + 7 };
}
