/**
 * E20 bar-model 막대 배치(논리 1000×600). 화면과 오버레이가 같은 좌표를 쓰도록 순수 함수로 둔다.
 * 위에 전체 막대(모든 칸의 합), 아래에 사람마다 한 줄. 모든 줄이 같은 칸 크기다. 화면 좌표만 number.
 */
import type { BarSettings } from './types';

export const BAR_X = 170;
export const BAR_W = 700;
export const BAR_MAX_CELL = 100;
export const TOTAL_BAR = { y: 66, h: 44 };
export const ROW_FIRST_Y = 168;
export const ROW_H = 64;
export const ROW_STEP = 104;

export interface BarCell {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface BarRow {
  readonly part: number;
  readonly name: string;
  readonly terms: number;
  readonly y: number;
  readonly cells: readonly BarCell[];
  /** 줄 끝(오른쪽) x. */
  readonly end: number;
}

export interface BarLayout {
  readonly cellW: number;
  readonly sum: number;
  readonly total: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly totalCells: readonly BarCell[];
  readonly rows: readonly BarRow[];
}

export function barLayout(settings: Pick<BarSettings, 'ratio' | 'parts'>): BarLayout {
  const sum = settings.ratio.reduce((a, b) => a + b, 0);
  const cellW = Math.min(BAR_MAX_CELL, BAR_W / sum);
  const width = cellW * sum;
  const x0 = BAR_X;
  const totalCells = Array.from({ length: sum }, (_, i) => ({
    x: x0 + i * cellW,
    y: TOTAL_BAR.y,
    w: cellW,
    h: TOTAL_BAR.h,
  }));
  const rows = settings.ratio.map((terms, part): BarRow => {
    const y = ROW_FIRST_Y + part * ROW_STEP;
    return {
      part,
      name: settings.parts[part] ?? '',
      terms,
      y,
      cells: Array.from({ length: terms }, (_, i) => ({
        x: x0 + i * cellW,
        y,
        w: cellW,
        h: ROW_H,
      })),
      end: x0 + terms * cellW,
    };
  });
  return {
    cellW,
    sum,
    total: { x: x0, y: TOTAL_BAR.y, w: width, h: TOTAL_BAR.h },
    totalCells,
    rows,
  };
}
