/**
 * E10 도형 프리셋.
 *
 * 세 도형 모두 대칭이 하나도 없어서 8가지 방향이 모두 다르다. `outline`은
 * 화면에서 시계 방향이고 0번이 점 ㄱ(A)이다. `at`은 도형 상자의 왼쪽 위다.
 */
import { assertPt, translateFigure } from './square';
import type { Cell, Pt, ShapeId, SquareFigure } from './types';

interface Preset {
  readonly outline: readonly Pt[];
  readonly cells: readonly Cell[];
}

export const SHAPES: Readonly<Record<ShapeId, Preset>> = {
  'flag-L': {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [0, 3],
    ],
    outline: [
      [0, 0],
      [3, 0],
      [3, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 4],
      [0, 4],
    ],
  },
  L4: {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    outline: [
      [0, 0],
      [1, 0],
      [1, 2],
      [2, 2],
      [2, 3],
      [0, 3],
    ],
  },
  F5: {
    cells: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    outline: [
      [1, 0],
      [3, 0],
      [3, 1],
      [2, 1],
      [2, 3],
      [1, 3],
      [1, 2],
      [0, 2],
      [0, 1],
      [1, 1],
    ],
  },
};

export const SHAPE_IDS: readonly ShapeId[] = ['flag-L', 'L4', 'F5'];

export function isShapeId(value: string): value is ShapeId {
  return value === 'flag-L' || value === 'L4' || value === 'F5';
}

/** 프리셋 좌표에 `at`을 그대로 더한다. */
export function presetFigure(shape: ShapeId, at: Pt): SquareFigure {
  const origin = assertPt(at, 'at');
  const preset = SHAPES[shape];
  return translateFigure({ outline: preset.outline, cells: preset.cells }, origin[0], origin[1]);
}
