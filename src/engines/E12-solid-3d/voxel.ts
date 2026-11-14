/**
 * E12 쌓기나무 투영·정규화·연결성·회전 계산(순수 함수).
 *
 * 좌표 규칙:
 * - x: 오른쪽 (0 = 왼쪽 끝)
 * - y: 뒤쪽 (0 = 맨 앞 줄)
 * - z: 위쪽 (0 = 바닥 층)
 *
 * 투영 행렬 규칙 (docs/04-units/g6s2.md A2·A3과 동일):
 * - heightMap / topView: rows × cols, 행 0 = 맨 뒤(rows - 1), 마지막 행 = 맨 앞(0)
 * - frontView: maxHeight × cols, 행 0 = 맨 위(maxHeight - 1), 마지막 행 = 바닥(0)
 * - sideView(오른쪽): maxHeight × rows, 행 0 = 맨 위, 열 0 = 맨 앞(y = 0)
 */
import type { CubeCoord, CubeItem, ProjectionView, ViewTurn } from './types';

export interface HasCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function compareCoords(a: HasCoord, b: HasCoord): number {
  if (a.x !== b.x) return a.x - b.x;
  if (a.y !== b.y) return a.y - b.y;
  return a.z - b.z;
}

export function sortCubes<T extends HasCoord>(cubes: readonly T[]): T[] {
  return [...cubes].sort(compareCoords);
}

/** 칸 `(x, y)`에 빈틈없이 쌓인 높이를 구한다(중복 제외). */
export function columnHeight(cubes: readonly HasCoord[], x: number, y: number): number {
  let maxZ = -1;
  for (const cube of cubes) {
    if (cube.x === x && cube.y === y && cube.z > maxZ) {
      maxZ = cube.z;
    }
  }
  return maxZ + 1;
}

/** 어떤 칸이든 z = 0부터 빈틈없이 이어지지 않거나 음수/중복 좌표가 있으면 true. */
export function hasFloatingCubes(cubes: readonly HasCoord[]): boolean {
  const byCol = new Map<string, number[]>();
  for (const cube of cubes) {
    if (
      !Number.isInteger(cube.x) ||
      !Number.isInteger(cube.y) ||
      !Number.isInteger(cube.z) ||
      cube.x < 0 ||
      cube.y < 0 ||
      cube.z < 0
    ) {
      return true;
    }
    const key = `${cube.x},${cube.y}`;
    const list = byCol.get(key) ?? [];
    list.push(cube.z);
    byCol.set(key, list);
  }
  for (const zs of byCol.values()) {
    zs.sort((a, b) => a - b);
    for (let i = 0; i < zs.length; i += 1) {
      if (zs[i] !== i) return true;
    }
  }
  return false;
}

export function heightMap(cubes: readonly HasCoord[], grid: readonly [number, number]): number[][] {
  const [cols, rows] = grid;
  const map: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (const cube of cubes) {
    if (cube.x < 0 || cube.x >= cols || cube.y < 0 || cube.y >= rows || cube.z < 0) continue;
    const row = rows - 1 - cube.y;
    const current = map[row]?.[cube.x] ?? 0;
    if (cube.z + 1 > current) {
      const targetRow = map[row];
      if (targetRow) targetRow[cube.x] = cube.z + 1;
    }
  }
  return map;
}

export function topView(cubes: readonly HasCoord[], grid: readonly [number, number]): number[][] {
  return heightMap(cubes, grid).map((row) => row.map((h) => (h > 0 ? 1 : 0)));
}

export function frontView(
  cubes: readonly HasCoord[],
  grid: readonly [number, number],
  maxHeight: number,
): number[][] {
  const [cols] = grid;
  const matrix: number[][] = Array.from({ length: maxHeight }, () => Array<number>(cols).fill(0));
  for (const cube of cubes) {
    if (cube.x < 0 || cube.x >= cols || cube.z < 0 || cube.z >= maxHeight) continue;
    const row = maxHeight - 1 - cube.z;
    const targetRow = matrix[row];
    if (targetRow) targetRow[cube.x] = 1;
  }
  return matrix;
}

export function sideView(
  cubes: readonly HasCoord[],
  grid: readonly [number, number],
  maxHeight: number,
): number[][] {
  const [, rows] = grid;
  const matrix: number[][] = Array.from({ length: maxHeight }, () => Array<number>(rows).fill(0));
  for (const cube of cubes) {
    if (cube.y < 0 || cube.y >= rows || cube.z < 0 || cube.z >= maxHeight) continue;
    const row = maxHeight - 1 - cube.z;
    const targetRow = matrix[row];
    if (targetRow) targetRow[cube.y] = 1;
  }
  return matrix;
}

/** 투영 방향별 행렬 크기 `[rows, cols]`를 돌려준다. */
export function projectionSize(
  view: ProjectionView,
  grid: readonly [number, number],
  maxHeight: number,
): readonly [number, number] {
  const [cols, rows] = grid;
  switch (view) {
    case 'top':
      return [rows, cols];
    case 'front':
      return [maxHeight, cols];
    case 'side':
      return [maxHeight, rows];
  }
}

interface CellEntry {
  readonly bottomRow: number;
  readonly col: number;
  readonly value: number;
}

function extractCells(matrix: readonly (readonly number[])[], nonZeroOnly = true): CellEntry[] {
  const rows = matrix.length;
  const entries: CellEntry[] = [];
  for (let r = 0; r < rows; r += 1) {
    const row = matrix[r];
    if (!row) continue;
    const bottomRow = rows - 1 - r;
    for (let c = 0; c < row.length; c += 1) {
      const val = row[c] ?? 0;
      if (nonZeroOnly ? val > 0 : val !== 0) {
        entries.push({ bottomRow, col: c, value: val });
      }
    }
  }
  return entries;
}

function shiftEntries(
  entries: readonly CellEntry[],
  shiftCol: boolean,
  shiftRow: boolean,
): CellEntry[] {
  if (entries.length === 0) return [];
  const minCol = shiftCol ? Math.min(...entries.map((e) => e.col)) : 0;
  const minRow = shiftRow ? Math.min(...entries.map((e) => e.bottomRow)) : 0;
  return entries.map((e) => ({
    bottomRow: e.bottomRow - minRow,
    col: e.col - minCol,
    value: e.value,
  }));
}

/**
 * 두 투영 행렬에서 1인 칸을 (아래에서부터 행, 왼쪽에서부터 열) 집합으로 비교한다.
 * `shift`가 true면 열 최솟값을 0으로 민다. `shiftRows`가 true면 행 최솟값도 0으로 민다(top 전용).
 */
export function sameCells(
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
  shift = true,
  shiftRows = false,
): boolean {
  const aCells = shiftEntries(extractCells(a), shift, shift && shiftRows);
  const bCells = shiftEntries(extractCells(b), shift, shift && shiftRows);
  if (aCells.length !== bCells.length) return false;
  const aSet = new Set(aCells.map((e) => `${e.bottomRow},${e.col}`));
  if (aSet.size !== bCells.length) return false;
  return bCells.every((e) => aSet.has(`${e.bottomRow},${e.col}`));
}

/** 0이 아닌 칸의 높이까지 비교한다(위에서 본 모양과 같은 행·열 시프트 규칙). */
export function sameHeights(
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
  shift = true,
): boolean {
  const aCells = shiftEntries(extractCells(a), shift, shift);
  const bCells = shiftEntries(extractCells(b), shift, shift);
  if (aCells.length !== bCells.length) return false;
  const aSet = new Set(aCells.map((e) => `${e.bottomRow},${e.col}:${e.value}`));
  if (aSet.size !== bCells.length) return false;
  return bCells.every((e) => aSet.has(`${e.bottomRow},${e.col}:${e.value}`));
}

function toCoord(cube: HasCoord | CubeCoord): CubeCoord {
  return 'x' in cube ? [cube.x, cube.y, cube.z] : [cube[0], cube[1], cube[2]];
}

function shiftCoordsXY(coords: readonly CubeCoord[]): CubeCoord[] {
  if (coords.length === 0) return [];
  const minX = Math.min(...coords.map(([x]) => x));
  const minY = Math.min(...coords.map(([, y]) => y));
  const shifted = coords.map(([x, y, z]): CubeCoord => [x - minX, y - minY, z]);
  shifted.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  });
  return shifted;
}

function compareCoordLists(a: readonly CubeCoord[], b: readonly CubeCoord[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const ca = a[i];
    const cb = b[i];
    if (!ca || !cb) break;
    if (ca[0] !== cb[0]) return ca[0] - cb[0];
    if (ca[1] !== cb[1]) return ca[1] - cb[1];
    if (ca[2] !== cb[2]) return ca[2] - cb[2];
  }
  return a.length - b.length;
}

/**
 * x·y 최솟값을 0으로 민 정렬 좌표 목록을 돌려준다.
 * `rotate: true`면 위에서 보아 90°씩 네 방향으로 돌린 것 가운데 사전순으로 가장 작은 것을 돌려준다.
 */
export function normalizeCubes(
  cubes: readonly (HasCoord | CubeCoord)[],
  rotate = false,
): CubeCoord[] {
  const base = cubes.map(toCoord);
  if (base.length === 0) return [];
  if (!rotate) return shiftCoordsXY(base);

  let best = shiftCoordsXY(base);
  let current = base;
  for (let turn = 1; turn < 4; turn += 1) {
    current = current.map(([x, y, z]): CubeCoord => [-y, x, z]);
    const candidate = shiftCoordsXY(current);
    if (compareCoordLists(candidate, best) < 0) {
      best = candidate;
    }
  }
  return best;
}

/** 면으로 맞닿은 쌓기나무끼리 모두 이어져 있는지 검사한다(0개·1개는 true). */
export function isConnected(cubes: readonly (HasCoord | CubeCoord)[]): boolean {
  const coords = cubes.map(toCoord);
  const keys = new Set<string>();
  const unique: CubeCoord[] = [];
  for (const coord of coords) {
    const key = `${coord[0]},${coord[1]},${coord[2]}`;
    if (!keys.has(key)) {
      keys.add(key);
      unique.push(coord);
    }
  }
  if (unique.length <= 1) return true;

  const visited = new Set<string>();
  const first = unique[0];
  if (!first) return true;
  const queue: CubeCoord[] = [first];
  visited.add(`${first[0]},${first[1]},${first[2]}`);

  const dirs: readonly CubeCoord[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (!current) continue;
    const [x, y, z] = current;
    for (const [dx, dy, dz] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const key = `${nx},${ny},${nz}`;
      if (keys.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push([nx, ny, nz]);
      }
    }
  }

  return visited.size === unique.length;
}

/**
 * 평면 칸 `(x, y)`를 위에서 보아 시계 반대 방향으로 90°씩 `turn`번 돌린 `(rx, ry)`를 구한다.
 * `turn`이 홀수면 격자 크기는 `[rows, cols]`가 된다.
 */
export function rotateCell(
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
      return [rows - 1 - y, x];
    case 2:
      return [cols - 1 - x, rows - 1 - y];
    case 3:
      return [y, cols - 1 - x];
  }
}

/** `rotateCell`의 역변환: 돌린 화면 칸 `(rx, ry)`를 상태 좌표 `(x, y)`로 되돌린다. */
export function unrotateCell(
  rx: number,
  ry: number,
  cols: number,
  rows: number,
  turn: ViewTurn,
): readonly [number, number] {
  switch (turn) {
    case 0:
      return [rx, ry];
    case 1:
      return [ry, rows - 1 - rx];
    case 2:
      return [cols - 1 - rx, rows - 1 - ry];
    case 3:
      return [cols - 1 - ry, rx];
  }
}

export function rotatedGridSize(
  cols: number,
  rows: number,
  turn: ViewTurn,
): readonly [number, number] {
  return turn % 2 === 0 ? [cols, rows] : [rows, cols];
}

/**
 * 현재 시선 방향(`viewTurn`)에서 보이는 세 면(+z, -ry, +rx) 쪽 이웃 칸 셋에 모두
 * 쌓기나무가 있어 완전히 가려진 쌓기나무의 상태 좌표 목록을 구한다(정수 계산).
 */
export function findHiddenCubes(
  cubes: readonly (HasCoord | CubeItem)[],
  cols: number,
  rows: number,
  turn: ViewTurn,
): CubeCoord[] {
  const occupied = new Set<string>();
  const rotatedList = cubes.map((cube) => {
    const [rx, ry] = rotateCell(cube.x, cube.y, cols, rows, turn);
    occupied.add(`${rx},${ry},${cube.z}`);
    return { cube, rx, ry };
  });

  const hidden: CubeCoord[] = [];
  for (const { cube, rx, ry } of rotatedList) {
    const hasTop = occupied.has(`${rx},${ry},${cube.z + 1}`);
    const hasFront = occupied.has(`${rx},${ry - 1},${cube.z}`);
    const hasRight = occupied.has(`${rx + 1},${ry},${cube.z}`);
    if (hasTop && hasFront && hasRight) {
      hidden.push([cube.x, cube.y, cube.z]);
    }
  }
  return hidden;
}

/**
 * 쌓기나무 목록을 `maxHeight`장의 층별 0/1 행렬(`top` 방향: 0행=뒷줄, 마지막 행=앞줄)로 만든다.
 */
export function layerMatrices(
  cubes: readonly HasCoord[],
  grid: readonly [number, number],
  maxHeight: number,
): number[][][] {
  const [cols, rows] = grid;
  const layers: number[][][] = [];
  for (let z = 0; z < maxHeight; z += 1) {
    layers.push(Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)));
  }
  for (const cube of cubes) {
    if (cube.z < 0 || cube.z >= maxHeight) continue;
    if (cube.x < 0 || cube.x >= cols || cube.y < 0 || cube.y >= rows) continue;
    const layer = layers[cube.z];
    const row = layer?.[rows - 1 - cube.y];
    if (row) row[cube.x] = 1;
  }
  return layers;
}

/** 두 정수 행렬이 크기와 각 칸 값까지 모두 같은지 검사한다. */
export function sameIntMatrix(
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r += 1) {
    const rowA = a[r];
    const rowB = b[r];
    if (!rowA || !rowB || rowA.length !== rowB.length) return false;
    for (let c = 0; c < rowA.length; c += 1) {
      if (rowA[c] !== rowB[c]) return false;
    }
  }
  return true;
}

/** 행렬의 각 행을 좌우(열 순서)로 뒤집은 복사본을 돌려준다. */
export function flipMatrixCols(matrix: readonly (readonly number[])[]): number[][] {
  return matrix.map((row) => [...row].reverse());
}

function layersToCoords(layers: readonly (readonly (readonly number[])[])[]): CubeCoord[] {
  const coords: CubeCoord[] = [];
  for (let z = 0; z < layers.length; z += 1) {
    const layer = layers[z];
    if (!layer) continue;
    const rows = layer.length;
    for (let r = 0; r < rows; r += 1) {
      const row = layer[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c += 1) {
        if ((row[c] ?? 0) > 0) {
          coords.push([c, rows - 1 - r, z]);
        }
      }
    }
  }
  return coords;
}

function sortCoords(coords: readonly CubeCoord[]): CubeCoord[] {
  return [...coords].sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  });
}

/**
 * 현재 쌓기나무의 층별 그림이 목표 `targetLayers`와 같은지 검사한다.
 * `shift`가 true면 x·y 평행이동을 허용하고 층 번호(z)는 그대로 맞춘다.
 */
export function layersMatchShape(
  cubes: readonly (HasCoord | CubeCoord)[],
  targetLayers: readonly (readonly (readonly number[])[])[],
  grid: readonly [number, number],
  maxHeight: number,
  shift = true,
): boolean {
  const actualCoords = cubes.map(toCoord);
  const targetCoords = layersToCoords(targetLayers);
  if (actualCoords.length !== targetCoords.length) return false;
  if (shift) {
    const a = shiftCoordsXY(actualCoords);
    const b = shiftCoordsXY(targetCoords);
    return a.length === b.length && compareCoordLists(a, b) === 0;
  }
  // shift=false: 각 층의 크기가 grid와 같아야 칸 단위 비교가 유효하다.
  const [, rows] = grid;
  const [cols] = grid;
  for (let z = 0; z < targetLayers.length; z += 1) {
    const layer = targetLayers[z];
    if (!layer) continue;
    if (z >= maxHeight || layer.length !== rows || layer.some((row) => row.length !== cols)) {
      return false;
    }
  }
  const a = sortCoords(actualCoords);
  const b = sortCoords(targetCoords);
  return a.length === b.length && compareCoordLists(a, b) === 0;
}
