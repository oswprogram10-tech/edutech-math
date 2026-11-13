/**
 * E12 등각(아이소메트릭) 2D 좌표·viewBox·화가 알고리즘 정렬(순수 함수).
 *
 * 화면 투영식:
 *   sx = (rx + ry) * (√3 / 2) * s
 *   sy = ((rx - ry) / 2 - z) * s
 * (앞-오른쪽-위에서 본 모습: 윗면 +z, 앞면 -ry, 오른쪽 면 +rx가 보인다.)
 */
import type { Point } from '../../core/engine-sdk';
import type { CubeCoord, ViewTurn } from './types';
import type { HasCoord } from './voxel';
import { rotateCell, rotatedGridSize, unrotateCell } from './voxel';

export const CUBE_UNIT = 60;
const COS30 = Math.sqrt(3) / 2;

export interface StageLayout {
  readonly unit: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly viewBox: {
    readonly width: number;
    readonly height: number;
  };
}

export interface CubeFaces {
  readonly top: readonly [Point, Point, Point, Point];
  readonly front: readonly [Point, Point, Point, Point];
  readonly right: readonly [Point, Point, Point, Point];
  readonly outline: readonly Point[];
}

export interface ColumnEntry {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

export function rawIsoPoint(rx: number, ry: number, z: number, unit = CUBE_UNIT): Point {
  return {
    x: (rx + ry) * COS30 * unit,
    y: ((rx - ry) / 2 - z) * unit,
  };
}

/**
 * 격자 크기·최대 높이로부터 네 방향 회전 모두를 담는 고정 viewBox를 계산한다.
 * 돌려도 무대 크기가 변하지 않는다.
 */
export function computeStageLayout(
  cols: number,
  rows: number,
  maxHeight: number,
  unit = CUBE_UNIT,
): StageLayout {
  const maxDim = Math.max(cols, rows);
  const minRawX = 0;
  const maxRawX = (cols + rows) * COS30 * unit;
  const minRawY = (-maxDim / 2 - maxHeight) * unit;
  const maxRawY = (maxDim / 2) * unit;

  const padX = unit * 0.28;
  const padTop = unit * 0.28;
  const padBottom = unit * 0.42;

  const offsetX = -minRawX + padX;
  const offsetY = -minRawY + padTop;

  return {
    unit,
    offsetX,
    offsetY,
    viewBox: {
      width: Math.ceil(maxRawX - minRawX + padX * 2),
      height: Math.ceil(maxRawY - minRawY + padTop + padBottom),
    },
  };
}

/** 작은 "보기" 그림용 타이트한 등각 viewBox(`viewTurn = 0` 기준). */
export function computeReferenceLayout(cubes: readonly CubeCoord[], unit = 36): StageLayout {
  if (cubes.length === 0) {
    return computeStageLayout(3, 3, 2, unit);
  }
  const maxX = Math.max(...cubes.map(([x]) => x)) + 1;
  const maxY = Math.max(...cubes.map(([, y]) => y)) + 1;
  const maxZ = Math.max(...cubes.map(([, , z]) => z)) + 1;

  const minRawX = 0;
  const maxRawX = (maxX + maxY) * COS30 * unit;
  const minRawY = (-maxY / 2 - maxZ) * unit;
  const maxRawY = (maxX / 2) * unit;

  const pad = unit * 0.3;
  return {
    unit,
    offsetX: -minRawX + pad,
    offsetY: -minRawY + pad,
    viewBox: {
      width: Math.ceil(maxRawX - minRawX + pad * 2),
      height: Math.ceil(maxRawY - minRawY + pad * 2),
    },
  };
}

export function projectPoint(layout: StageLayout, rx: number, ry: number, z: number): Point {
  const raw = rawIsoPoint(rx, ry, z, layout.unit);
  return {
    x: raw.x + layout.offsetX,
    y: raw.y + layout.offsetY,
  };
}

/** 연속 상태 좌표 `(x, y, z)`를 현재 `viewTurn`으로 돌려 화면 좌표로 바꾼다. */
export function rotateContinuous(
  x: number,
  y: number,
  cols: number,
  rows: number,
  turn: ViewTurn,
): readonly [number, number] {
  switch (turn) {
    case 0:
      return [x, y];
    case 1:
      return [rows - y, x];
    case 2:
      return [cols - x, rows - y];
    case 3:
      return [y, cols - x];
  }
}

export function floorDiamond(
  layout: StageLayout,
  rx: number,
  ry: number,
): readonly [Point, Point, Point, Point] {
  return [
    projectPoint(layout, rx, ry, 0),
    projectPoint(layout, rx + 1, ry, 0),
    projectPoint(layout, rx + 1, ry + 1, 0),
    projectPoint(layout, rx, ry + 1, 0),
  ];
}

export function cubeFaces(layout: StageLayout, rx: number, ry: number, z: number): CubeFaces {
  const p000 = projectPoint(layout, rx, ry, z);
  const p100 = projectPoint(layout, rx + 1, ry, z);
  const p110 = projectPoint(layout, rx + 1, ry + 1, z);
  const p001 = projectPoint(layout, rx, ry, z + 1);
  const p101 = projectPoint(layout, rx + 1, ry, z + 1);
  const p111 = projectPoint(layout, rx + 1, ry + 1, z + 1);
  const p011 = projectPoint(layout, rx, ry + 1, z + 1);

  return {
    top: [p001, p101, p111, p011],
    front: [p000, p100, p101, p001],
    right: [p100, p110, p111, p101],
    outline: [p001, p011, p111, p110, p100, p000],
  };
}

export function pointsAttr(points: readonly Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/**
 * 화가 알고리즘 정렬: `rx - ry + z` 오름차순(멀리 있는 것 먼저).
 * 같은 값끼리는 화면에서 겹치지 않으므로 `rx + ry`, `z`로만 결정론적 순서를 둔다.
 */
export function sortCubesForPainter<T extends HasCoord>(
  cubes: readonly T[],
  cols: number,
  rows: number,
  turn: ViewTurn,
): { readonly cube: T; readonly rx: number; readonly ry: number; readonly depth: number }[] {
  const mapped = cubes.map((cube) => {
    const [rx, ry] = rotateCell(cube.x, cube.y, cols, rows, turn);
    return { cube, rx, ry, depth: rx - ry + cube.z };
  });
  mapped.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    const sumDiff = a.rx + a.ry - (b.rx + b.ry);
    if (sumDiff !== 0) return sumDiff;
    return a.cube.z - b.cube.z;
  });
  return mapped;
}

/** 기둥 단위 화가 정렬: `rx - ry` 오름차순, `rx + ry` 오름차순. */
export function sortColumnsForPainter(cols: number, rows: number, turn: ViewTurn): ColumnEntry[] {
  const list: ColumnEntry[] = [];
  for (let x = 0; x < cols; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      const [rx, ry] = rotateCell(x, y, cols, rows, turn);
      list.push({ x, y, rx, ry });
    }
  }
  list.sort((a, b) => {
    const depthDiff = a.rx - a.ry - (b.rx - b.ry);
    if (depthDiff !== 0) return depthDiff;
    return a.rx + a.ry - (b.rx + b.ry);
  });
  return list;
}

/** 바닥 y = 0 앞쪽 가장자리 바깥에 놓을 "앞" 글자와 화살표 좌표. */
export function frontMarkerGeometry(
  layout: StageLayout,
  cols: number,
  rows: number,
  turn: ViewTurn,
): {
  readonly text: Point;
  readonly arrowFrom: Point;
  readonly arrowTo: Point;
} {
  const [textRx, textRy] = rotateContinuous(cols / 2, -0.52, cols, rows, turn);
  const [fromRx, fromRy] = rotateContinuous(cols / 2, -0.34, cols, rows, turn);
  const [toRx, toRy] = rotateContinuous(cols / 2, -0.06, cols, rows, turn);
  return {
    text: projectPoint(layout, textRx, textRy, 0),
    arrowFrom: projectPoint(layout, fromRx, fromRy, 0),
    arrowTo: projectPoint(layout, toRx, toRy, 0),
  };
}

/** 화면 방향키 `(ArrowUp/Down/Left/Right)`를 현재 회전 `turn`에 맞춰 한 칸 옮긴 상태 좌표로 바꾼다. */
export function stepCursorInScreen(
  cursor: readonly [number, number],
  cols: number,
  rows: number,
  turn: ViewTurn,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
): readonly [number, number] {
  const [rCols, rRows] = rotatedGridSize(cols, rows, turn);
  const [rx, ry] = rotateCell(cursor[0], cursor[1], cols, rows, turn);
  let nextRx = rx;
  let nextRy = ry;
  if (key === 'ArrowRight') nextRx = Math.min(rCols - 1, rx + 1);
  if (key === 'ArrowLeft') nextRx = Math.max(0, rx - 1);
  if (key === 'ArrowUp') nextRy = Math.min(rRows - 1, ry + 1);
  if (key === 'ArrowDown') nextRy = Math.max(0, ry - 1);
  return unrotateCell(nextRx, nextRy, cols, rows, turn);
}
