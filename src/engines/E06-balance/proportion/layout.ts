/**
 * proportion 화면 배치(논리 좌표 1000×600). Board와 오버레이가 같은 계산을 쓴다.
 * 저울 뼈대(가로대·접시)와 기울기는 equation과 같은 layout.ts 상수·함수를 쓴다.
 */
import type { Rational } from '../../../core/math';
import { PAN_CENTER, PAN_SURFACE_Y } from '../layout';
import type { GridDims, ProportionReading } from './read';

/** 식 줄(네 항)의 높이와 각 항·기호의 가운데 x. */
export const EQ_Y = 98;
export const TERM_X = [290, 410, 590, 710] as const;
export const COLON_X = [350, 650] as const;
export const EQUALS_X = 500;
export const TERM_BOX = { width: 84, height: 58 } as const;
/** 결과 글 높이(proportion은 식 줄을 위해 equation보다 조금 위). */
export const RESULT_Y = 32;

/** 칸 하나의 최소·최대 크기(논리px). */
export const MIN_CELL = 4;
export const MAX_CELL = 36;

export interface Area {
  readonly width: number;
  readonly height: number;
}

/** 저울(scale) 접시 위 격자가 들어갈 칸. 가로대(y=170) 밑에서 접시까지. */
export const SCALE_AREA: Area = { width: 260, height: 180 };
/** 격자 두 개를 나란히 놓는 판(grid look). */
export const GRID_AREA: Area = { width: 360, height: 270 };
export const GRID_CENTER = { left: 270, right: 730 } as const;
export const GRID_BOTTOM = 440;
export const SIGN_POS = { x: 500, y: 320 } as const;

export function countOf(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

export interface GridBox {
  /** 가로·세로 칸 수. */
  readonly w: number;
  readonly h: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly unit: number;
}

/** 두 격자가 같은 칸 크기를 쓰도록 가장 큰 변이 칸에 맞는 한 칸의 크기. 4~36논리px. */
export function cellUnit(dims: readonly GridDims[], area: Area): number {
  let maxW = 1;
  let maxH = 1;
  for (const grid of dims) {
    if (grid.w !== null && grid.h !== null) {
      maxW = Math.max(maxW, countOf(grid.w));
      maxH = Math.max(maxH, countOf(grid.h));
    }
  }
  return Math.min(MAX_CELL, Math.max(MIN_CELL, Math.min(area.width / maxW, area.height / maxH)));
}

/** 가운데 x, 아래 y에 맞춘 격자 상자. 가로·세로를 모르면 null. */
export function gridBox(
  dims: GridDims,
  unit: number,
  centerX: number,
  bottomY: number,
): GridBox | null {
  if (dims.w === null || dims.h === null) return null;
  const w = countOf(dims.w);
  const h = countOf(dims.h);
  return {
    w,
    h,
    unit,
    width: w * unit,
    height: h * unit,
    x: centerX - (w * unit) / 2,
    y: bottomY - h * unit,
  };
}

export interface PlateLayout {
  readonly name: 'left' | 'right';
  readonly dims: GridDims;
  readonly box: GridBox | null;
  readonly centerX: number;
  readonly bottomY: number;
}

export function platesOf(reading: ProportionReading, look: 'scale' | 'grid'): PlateLayout[] {
  const scale = look === 'scale';
  const area = scale ? SCALE_AREA : GRID_AREA;
  const unit = cellUnit([reading.leftDims, reading.rightDims], area);
  const bottomY = scale ? PAN_SURFACE_Y - 2 : GRID_BOTTOM;
  const centers = scale ? PAN_CENTER : GRID_CENTER;
  return (['left', 'right'] as const).map((name) => {
    const dims = name === 'left' ? reading.leftDims : reading.rightDims;
    return {
      name,
      dims,
      box: gridBox(dims, unit, centers[name], bottomY),
      centerX: centers[name],
      bottomY,
    };
  });
}

/** 겹친 그림(area-diff)이 들어갈 칸: 판 가운데. */
export const DIFF_PANEL = { x: 340, y: 190, width: 320, height: 290 } as const;
export const DIFF_AREA: Area = { width: 280, height: 220 };
export const DIFF_BOTTOM = 450;
export const DIFF_CENTER_X = 500;

export interface DiffRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 두 격자를 왼쪽 아래 모서리에 맞춰 겹쳤을 때 한쪽에만 있는 칸의 직사각형 조각들. */
export function diffPieces(
  mine: { readonly w: number; readonly h: number },
  other: { readonly w: number; readonly h: number },
  unit: number,
  originX: number,
  originY: number,
): DiffRect[] {
  const pieces: DiffRect[] = [];
  const commonW = Math.min(mine.w, other.w);
  const commonH = Math.min(mine.h, other.h);
  // 오른쪽 띠: 공통 가로 밖, 내 전체 높이
  if (mine.w > commonW) {
    pieces.push({
      x: originX + commonW * unit,
      y: originY - mine.h * unit,
      width: (mine.w - commonW) * unit,
      height: mine.h * unit,
    });
  }
  // 위쪽 띠: 공통 가로 안, 공통 높이 위
  if (mine.h > commonH) {
    pieces.push({
      x: originX,
      y: originY - mine.h * unit,
      width: commonW * unit,
      height: (mine.h - commonH) * unit,
    });
  }
  return pieces;
}
