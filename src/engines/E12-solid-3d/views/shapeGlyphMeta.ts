/** E12 `shapes-sort` 물건 그림의 색·크기·좌표 상수(컴포넌트 아님). */
import type { ShapeColor, ShapeKind, ShapePose, ShapeSize } from '../shapes/rules';

export interface Palette {
  readonly main: string;
  readonly light: string;
  readonly dark: string;
}

export const SHAPE_PALETTE: Readonly<Record<ShapeColor, Palette>> = {
  red: { main: '#e0524a', light: '#f29a94', dark: '#b3342d' },
  blue: { main: '#3b7dd8', light: '#8db6ee', dark: '#2459a6' },
  yellow: { main: '#f2c230', light: '#f9e08a', dark: '#c79a10' },
  green: { main: '#4aa564', light: '#92d1a4', dark: '#2f7a45' },
};

export const GLYPH_BOX = 64;
export const GLYPH_BOTTOM = 58;
export const GLYPH_CENTER_X = 32;

/** 큰 것은 1, 작은 것은 0.72배로 그린다(바닥 가운데 기준). */
export function sizeScale(size: ShapeSize): number {
  return size === 'large' ? 1 : 0.72;
}

/** 굴릴 때 도는 중심(그림 안쪽 좌표). */
export function spinCenter(kind: ShapeKind, pose: ShapePose): { x: number; y: number } {
  if (kind === 'sphere') return { x: 32, y: 34 };
  if (kind === 'cylinder' && pose === 'lying') return { x: 32, y: 41 };
  return { x: 32, y: 34 };
}
