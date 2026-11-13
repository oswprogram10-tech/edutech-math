/**
 * 2D 등각 무대와 3D 무대가 함께 쓰는 쌓기나무 색상·강조 칸 판정(순수 함수).
 */
import type { CubeColor, CubeItem, FocusCell } from '../types';

export interface CubePaletteEntry {
  readonly top: string;
  readonly front: string;
  readonly right: string;
  readonly mark: string;
}

export const CUBE_INK = '#1d2330';
export const FOCUS_STROKE = '#e8872e';

export const CUBE_PALETTE: Readonly<Record<CubeColor, CubePaletteEntry>> = {
  plain: { top: '#f6ebd8', front: '#e4cda7', right: '#cca978', mark: '#1d2330' },
  red: { top: '#fca5a5', front: '#ef4444', right: '#b91c1c', mark: '#7f1d1d' },
  blue: { top: '#93c5fd', front: '#3b82f6', right: '#1d4ed8', mark: '#1e3a8a' },
  yellow: { top: '#fde68a', front: '#f59e0b', right: '#b45309', mark: '#78350f' },
  green: { top: '#86efac', front: '#22c55e', right: '#15803d', mark: '#14532d' },
};

/** 투영 뷰에서 고른 칸(`focus`)에 이 쌓기나무가 포함되는지 확인한다. */
export function matchesFocus(
  cube: Pick<CubeItem, 'x' | 'y' | 'z'>,
  focus: FocusCell | null,
  rows: number,
  maxHeight: number,
): boolean {
  if (!focus) return false;
  if (focus.view === 'top') {
    const targetY = rows - 1 - focus.row;
    return cube.x === focus.col && cube.y === targetY;
  }
  if (focus.view === 'front') {
    const targetZ = maxHeight - 1 - focus.row;
    return cube.x === focus.col && cube.z === targetZ;
  }
  const targetZ = maxHeight - 1 - focus.row;
  return cube.y === focus.col && cube.z === targetZ;
}

export function isTopFloorFocused(
  x: number,
  y: number,
  focus: FocusCell | null,
  rows: number,
): boolean {
  return Boolean(focus && focus.view === 'top' && focus.col === x && focus.row === rows - 1 - y);
}
