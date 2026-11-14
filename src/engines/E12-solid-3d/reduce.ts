/**
 * E12 3D 입체 순수 reducer.
 *
 * - 쌓기 규칙(공중에 뜨지 않음): 칸 `(x, y)`마다 z = 0 … h-1이 빈틈없이 이어지고,
 *   빼기는 그 칸의 맨 위(locked가 아닌 경우)만 뺀다.
 * - `cubes`는 늘 `(x, y, z)` 사전순으로 정렬되어 있다.
 * - 입력 상태를 절대 변경하지 않는다.
 */
import { clamp } from '../../core/engine-sdk';
import {
  DEFAULT_GRID,
  DEFAULT_MAX_HEIGHT,
  DEFAULT_VIEWS,
  MAX_GRID_DIM,
  MIN_GRID_DIM,
} from './types';
import type {
  CubeColor,
  CubeCoord,
  CubeItem,
  CubesConfig,
  CubesSettings,
  CubesState,
  FocusCell,
  LayerPanelMode,
  LayersSettings,
  NumberGridSettings,
  PaintedViewsState,
  ProjectionView,
  ReferenceShapeConfig,
  ReferenceViewsConfig,
  SolidAction,
  SolidConfig,
  SolidState,
  ViewTurn,
} from './types';
import { columnHeight, projectionSize, sortCubes } from './voxel';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function intClamped(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

function validColor(value: unknown): CubeColor {
  if (
    value === 'plain' ||
    value === 'red' ||
    value === 'blue' ||
    value === 'yellow' ||
    value === 'green'
  ) {
    return value;
  }
  return 'plain';
}

function sanitizeViews(
  value: unknown,
  fallback: readonly ProjectionView[],
): readonly ProjectionView[] {
  if (!Array.isArray(value)) return fallback;
  const result: ProjectionView[] = [];
  for (const item of value) {
    if ((item === 'top' || item === 'front' || item === 'side') && !result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

function zeroMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function sanitizeSizedIntMatrix(
  value: unknown,
  expectedRows: number,
  expectedCols: number,
  maxValue: number,
): number[][] | null {
  if (!Array.isArray(value) || value.length !== expectedRows) return null;
  const rows: number[][] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== expectedCols) return null;
    const nums: number[] = [];
    for (const cell of row) {
      if (typeof cell !== 'number' || !Number.isFinite(cell)) return null;
      nums.push(clamp(Math.round(cell), 0, maxValue));
    }
    rows.push(nums);
  }
  return rows;
}

function sanitizeNumberGrid(
  value: unknown,
  cols: number,
  rows: number,
  maxHeight: number,
): NumberGridSettings | null {
  if (!isRecord(value)) return null;
  const mode = value['mode'];
  if (mode !== 'input' && mode !== 'drive' && mode !== 'given') return null;
  if (mode === 'given') {
    const given = sanitizeSizedIntMatrix(value['given'], rows, cols, maxHeight);
    if (!given) return null;
    return { mode, given };
  }
  return { mode };
}

function sanitizeLayers(
  value: unknown,
  cols: number,
  rows: number,
  maxHeight: number,
): LayersSettings {
  if (!isRecord(value)) return { slider: false, panel: 'off' };
  const slider = value['slider'] === true;
  const rawPanel = value['panel'];
  const panel: LayerPanelMode =
    rawPanel === 'live' || rawPanel === 'paint' || rawPanel === 'given' ? rawPanel : 'off';
  if (panel === 'given') {
    const rawGiven = value['given'];
    if (!Array.isArray(rawGiven) || rawGiven.length !== maxHeight) {
      return { slider, panel: 'off' };
    }
    const layers: number[][][] = [];
    for (const layer of rawGiven) {
      const mat = sanitizeSizedIntMatrix(layer, rows, cols, 1);
      if (!mat) return { slider, panel: 'off' };
      layers.push(mat.map((row) => row.map((cell) => (cell > 0 ? 1 : 0))));
    }
    return { slider, panel: 'given', given: layers };
  }
  return { slider, panel };
}

function makeInitialPainted(
  paintViews: readonly ProjectionView[],
  cols: number,
  rows: number,
  maxHeight: number,
): PaintedViewsState | null {
  if (paintViews.length === 0) return null;
  const result: {
    top?: number[][];
    front?: number[][];
    side?: number[][];
  } = {};
  for (const view of paintViews) {
    const [vRows, vCols] = projectionSize(view, [cols, rows], maxHeight);
    result[view] = zeroMatrix(vRows, vCols);
  }
  return result;
}

function sanitizeMatrix(value: unknown): readonly (readonly number[])[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rows: number[][] = [];
  let width = -1;
  for (const row of value) {
    if (!Array.isArray(row) || row.length === 0) return null;
    if (width === -1) width = row.length;
    if (row.length !== width) return null;
    const nums: number[] = [];
    for (const cell of row) {
      if (typeof cell !== 'number' || !Number.isFinite(cell)) return null;
      nums.push(cell > 0 ? 1 : 0);
    }
    rows.push(nums);
  }
  return rows;
}

function sanitizeReference(value: unknown): ReferenceShapeConfig | null {
  if (!isRecord(value) || !Array.isArray(value['cubes'])) return null;
  const cubes: CubeCoord[] = [];
  for (const item of value['cubes']) {
    if (!Array.isArray(item) || item.length < 3) continue;
    const [x, y, z] = item;
    if (
      typeof x === 'number' &&
      typeof y === 'number' &&
      typeof z === 'number' &&
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      Number.isInteger(z) &&
      x >= 0 &&
      y >= 0 &&
      z >= 0
    ) {
      cubes.push([x, y, z]);
    }
  }
  return { cubes };
}

function sanitizeReferenceViews(value: unknown): ReferenceViewsConfig | null {
  if (!isRecord(value)) return null;
  const top = sanitizeMatrix(value['top']);
  const front = sanitizeMatrix(value['front']);
  const side = sanitizeMatrix(value['side']);
  if (!top && !front && !side) return null;
  // assertSerializable은 undefined 속성을 허용하지 않으므로 있는 키만 넣는다.
  const result: {
    top?: readonly (readonly number[])[];
    front?: readonly (readonly number[])[];
    side?: readonly (readonly number[])[];
  } = {};
  if (top) result.top = top;
  if (front) result.front = front;
  if (side) result.side = side;
  return result;
}

function devWarn(message: string): void {
  if (import.meta.env?.DEV) {
    console.warn(message);
  }
}

function sanitizeInitialCubes(
  rawInitial: unknown,
  cols: number,
  rows: number,
  maxHeight: number,
  colorHints: boolean,
): CubeItem[] {
  if (!Array.isArray(rawInitial)) return [];

  const byCol = new Map<string, Map<number, CubeItem>>();
  for (const entry of rawInitial) {
    if (!isRecord(entry) || !Array.isArray(entry['at']) || entry['at'].length < 3) {
      devWarn('E12 initial: 잘못된 쌓기나무 항목을 건너뛰었습니다.');
      continue;
    }
    const [x, y, z] = entry['at'];
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof z !== 'number' ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(z) ||
      x < 0 ||
      x >= cols ||
      y < 0 ||
      y >= rows ||
      z < 0 ||
      z >= maxHeight
    ) {
      devWarn(`E12 initial: 격자 범위를 벗어난 쌓기나무를 버렸습니다: ${String(entry['at'])}`);
      continue;
    }
    const key = `${x},${y}`;
    const colMap = byCol.get(key) ?? new Map<number, CubeItem>();
    if (colMap.has(z)) {
      devWarn(`E12 initial: 같은 위치(${x},${y},${z})의 중복 쌓기나무를 건너뛰었습니다.`);
      continue;
    }
    colMap.set(z, {
      x,
      y,
      z,
      color: colorHints ? validColor(entry['color']) : 'plain',
      locked: entry['locked'] === true,
    });
    byCol.set(key, colMap);
  }

  const kept: CubeItem[] = [];
  for (const colMap of byCol.values()) {
    const zs = [...colMap.keys()].sort((a, b) => a - b);
    let expectedZ = 0;
    for (const z of zs) {
      const item = colMap.get(z);
      if (!item) continue;
      if (z !== expectedZ) {
        devWarn(`E12 initial: 공중에 뜬 쌓기나무(${item.x},${item.y},${item.z})를 버렸습니다.`);
        continue;
      }
      kept.push(item);
      expectedZ += 1;
    }
  }

  return sortCubes(kept);
}

function buildSettings(config: CubesConfig): CubesSettings {
  const rawGrid = Array.isArray(config.grid) ? config.grid : DEFAULT_GRID;
  const cols = intClamped(rawGrid[0], DEFAULT_GRID[0], MIN_GRID_DIM, MAX_GRID_DIM);
  const rows = intClamped(rawGrid[1], DEFAULT_GRID[1], MIN_GRID_DIM, MAX_GRID_DIM);
  const maxHeight = intClamped(config.maxHeight, DEFAULT_MAX_HEIGHT, MIN_GRID_DIM, MAX_GRID_DIM);
  const volume = cols * rows * maxHeight;
  const maxCubes =
    typeof config.maxCubes === 'number' && Number.isFinite(config.maxCubes)
      ? Math.max(1, Math.round(config.maxCubes))
      : volume;

  const rotationLocked = config.rotationLocked === true;
  const editable = config.editable !== false;
  const stage = config.stage === '3d' || config.stage === 'isometric' ? config.stage : 'auto';

  return {
    grid: [cols, rows],
    maxHeight,
    maxCubes,
    colorHints: config.colorHints !== false,
    views: sanitizeViews(config.views, DEFAULT_VIEWS),
    sideDirection: 'right',
    frontMarker: config.frontMarker !== false,
    translucentToggle: config.translucentToggle !== false,
    rotationLocked,
    editable,
    stage,
    reference: sanitizeReference(config.reference),
    referenceViews: sanitizeReferenceViews(config.referenceViews),
    numberGrid: sanitizeNumberGrid(config.numberGrid, cols, rows, maxHeight),
    layers: sanitizeLayers(config.layers, cols, rows, maxHeight),
    paintViews: sanitizeViews(config.paintViews, []),
    stageHidden: config.stageHidden === true,
  };
}

function isValidFocus(cell: FocusCell, settings: CubesSettings): boolean {
  const [cols, rows] = settings.grid;
  const { maxHeight } = settings;
  if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col)) return false;
  if (cell.row < 0 || cell.col < 0) return false;
  if (cell.view === 'top') return cell.row < rows && cell.col < cols;
  if (cell.view === 'front') return cell.row < maxHeight && cell.col < cols;
  if (cell.view === 'side') return cell.row < maxHeight && cell.col < rows;
  return false;
}

export function createInitialState(config: SolidConfig = {}): CubesState {
  const settings = buildSettings(config);
  const [cols, rows] = settings.grid;
  const cubes = sanitizeInitialCubes(
    config.initial,
    cols,
    rows,
    settings.maxHeight,
    settings.colorHints,
  );

  return {
    mode: 'cubes',
    settings,
    cubes,
    viewTurn: 0,
    translucent: false,
    tool: 'add',
    cursor: [0, 0],
    focus: null,
    numbers: settings.numberGrid?.mode === 'input' ? zeroMatrix(rows, cols) : null,
    numberCursor: [0, 0],
    layerFocus: null,
    layerPaint:
      settings.layers.panel === 'paint'
        ? Array.from({ length: settings.maxHeight }, () => zeroMatrix(rows, cols))
        : null,
    painted: makeInitialPainted(settings.paintViews, cols, rows, settings.maxHeight),
  };
}

export function reduce(state: SolidState, action: SolidAction): SolidState {
  const { settings } = state;
  const [cols, rows] = settings.grid;

  switch (action.type) {
    case 'add': {
      if (!settings.editable) return state;
      const { x, y } = action;
      if (!Number.isInteger(x) || !Number.isInteger(y)) return state;
      if (x < 0 || x >= cols || y < 0 || y >= rows) return state;
      if (state.cubes.length >= settings.maxCubes) return state;
      const height = columnHeight(state.cubes, x, y);
      if (height >= settings.maxHeight) return state;
      const added: CubeItem = { x, y, z: height, color: 'plain', locked: false };
      return {
        ...state,
        cubes: sortCubes([...state.cubes, added]),
      };
    }

    case 'remove': {
      if (!settings.editable) return state;
      const { x, y } = action;
      if (!Number.isInteger(x) || !Number.isInteger(y)) return state;
      if (x < 0 || x >= cols || y < 0 || y >= rows) return state;
      const height = columnHeight(state.cubes, x, y);
      if (height <= 0) return state;
      const topZ = height - 1;
      const topCube = state.cubes.find((c) => c.x === x && c.y === y && c.z === topZ);
      if (!topCube || topCube.locked) return state;
      return {
        ...state,
        cubes: state.cubes.filter((c) => !(c.x === x && c.y === y && c.z === topZ)),
      };
    }

    case 'select-tool': {
      if (!settings.editable) return state;
      if (action.tool !== 'add' && action.tool !== 'remove') return state;
      if (state.tool === action.tool) return state;
      return { ...state, tool: action.tool };
    }

    case 'move-cursor': {
      if (!settings.editable) return state;
      const [rawX, rawY] = action.to;
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return state;
      const nx = clamp(Math.round(rawX), 0, cols - 1);
      const ny = clamp(Math.round(rawY), 0, rows - 1);
      if (nx === state.cursor[0] && ny === state.cursor[1]) return state;
      return { ...state, cursor: [nx, ny] };
    }

    case 'turn': {
      if (settings.rotationLocked) return state;
      const delta = action.dir === 'right' ? 1 : 3;
      const nextTurn = ((state.viewTurn + delta) % 4) as ViewTurn;
      return { ...state, viewTurn: nextTurn };
    }

    case 'set-translucent': {
      const on = Boolean(action.on);
      if (state.translucent === on) return state;
      return { ...state, translucent: on };
    }

    case 'focus-cell': {
      if (action.cell === null) {
        return state.focus === null ? state : { ...state, focus: null };
      }
      if (!isValidFocus(action.cell, settings)) return state;
      return {
        ...state,
        focus: { view: action.cell.view, row: action.cell.row, col: action.cell.col },
      };
    }

    case 'set-number': {
      if (settings.numberGrid?.mode !== 'input' || !state.numbers) return state;
      const { row, col, value } = action;
      if (!Number.isInteger(row) || !Number.isInteger(col)) return state;
      if (row < 0 || row >= rows || col < 0 || col >= cols) return state;
      if (typeof value !== 'number' || !Number.isFinite(value)) return state;
      const nextVal = clamp(Math.round(value), 0, settings.maxHeight);
      if (state.numbers[row]?.[col] === nextVal) return state;
      const nextNumbers = state.numbers.map((r, rIdx) =>
        rIdx === row ? r.map((cell, cIdx) => (cIdx === col ? nextVal : cell)) : r,
      );
      return { ...state, numbers: nextNumbers };
    }

    case 'move-number-cursor': {
      const mode = settings.numberGrid?.mode;
      if (mode !== 'input' && mode !== 'drive') return state;
      const [rawRow, rawCol] = action.to;
      if (!Number.isFinite(rawRow) || !Number.isFinite(rawCol)) return state;
      const nr = clamp(Math.round(rawRow), 0, rows - 1);
      const nc = clamp(Math.round(rawCol), 0, cols - 1);
      if (nr === state.numberCursor[0] && nc === state.numberCursor[1]) return state;
      return { ...state, numberCursor: [nr, nc] };
    }

    case 'set-height': {
      if (!settings.editable) return state;
      const { x, y, h } = action;
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isFinite(h)) return state;
      if (x < 0 || x >= cols || y < 0 || y >= rows) return state;
      const targetH = Math.round(h);
      if (targetH < 0 || targetH > settings.maxHeight) return state;
      const currentH = columnHeight(state.cubes, x, y);
      if (targetH === currentH) return state;
      let lockedFloor = 0;
      for (const cube of state.cubes) {
        if (cube.x === x && cube.y === y && cube.locked && cube.z + 1 > lockedFloor) {
          lockedFloor = cube.z + 1;
        }
      }
      if (targetH < lockedFloor) return state;
      const nextCount = state.cubes.length - currentH + targetH;
      if (nextCount > settings.maxCubes) return state;
      if (targetH > currentH) {
        const added: CubeItem[] = [];
        for (let z = currentH; z < targetH; z += 1) {
          added.push({ x, y, z, color: 'plain', locked: false });
        }
        return { ...state, cubes: sortCubes([...state.cubes, ...added]) };
      }
      return {
        ...state,
        cubes: state.cubes.filter((c) => !(c.x === x && c.y === y && c.z >= targetH)),
      };
    }

    case 'focus-layer': {
      if (action.layer === null) {
        return state.layerFocus === null ? state : { ...state, layerFocus: null };
      }
      if (
        !Number.isInteger(action.layer) ||
        action.layer < 1 ||
        action.layer > settings.maxHeight
      ) {
        return state;
      }
      if (state.layerFocus === action.layer) return state;
      return { ...state, layerFocus: action.layer };
    }

    case 'toggle-layer-cell': {
      if (!state.layerPaint) return state;
      const { layer, row, col } = action;
      if (!Number.isInteger(layer) || layer < 1 || layer > settings.maxHeight) return state;
      if (!Number.isInteger(row) || row < 0 || row >= rows) return state;
      if (!Number.isInteger(col) || col < 0 || col >= cols) return state;
      const layerIdx = layer - 1;
      const nextLayerPaint = state.layerPaint.map((grid, idx) =>
        idx === layerIdx
          ? grid.map((r, rIdx) =>
              rIdx === row ? r.map((cell, cIdx) => (cIdx === col ? (cell > 0 ? 0 : 1) : cell)) : r,
            )
          : grid,
      );
      return { ...state, layerPaint: nextLayerPaint };
    }

    case 'clear-layer-paint': {
      if (!state.layerPaint) return state;
      const hasAny = state.layerPaint.some((grid) => grid.some((row) => row.some((c) => c > 0)));
      if (!hasAny) return state;
      return {
        ...state,
        layerPaint: Array.from({ length: settings.maxHeight }, () => zeroMatrix(rows, cols)),
      };
    }

    case 'toggle-paint-cell': {
      if (!state.painted) return state;
      const { view, row, col } = action;
      const target = state.painted[view];
      if (!target) return state;
      const [vRows, vCols] = projectionSize(view, [cols, rows], settings.maxHeight);
      if (!Number.isInteger(row) || !Number.isInteger(col)) return state;
      if (row < 0 || row >= vRows || col < 0 || col >= vCols) return state;
      const nextMatrix = target.map((r, rIdx) =>
        rIdx === row ? r.map((cell, cIdx) => (cIdx === col ? (cell > 0 ? 0 : 1) : cell)) : r,
      );
      return {
        ...state,
        painted: { ...state.painted, [view]: nextMatrix },
      };
    }

    case 'clear-paint': {
      if (!state.painted) return state;
      const target = state.painted[action.view];
      if (!target) return state;
      const hasAny = target.some((row) => row.some((c) => c > 0));
      if (!hasAny) return state;
      const [vRows, vCols] = projectionSize(action.view, [cols, rows], settings.maxHeight);
      return {
        ...state,
        painted: { ...state.painted, [action.view]: zeroMatrix(vRows, vCols) },
      };
    }

    case 'clear': {
      if (!settings.editable) return state;
      // 각 칸에서 가장 높은 locked 쌓기나무 이하만 남겨 공중에 뜨지 않게 한다.
      const highestLocked = new Map<string, number>();
      for (const cube of state.cubes) {
        if (!cube.locked) continue;
        const key = `${cube.x},${cube.y}`;
        const prev = highestLocked.get(key) ?? -1;
        if (cube.z > prev) highestLocked.set(key, cube.z);
      }
      const remaining = state.cubes.filter((cube) => {
        const limit = highestLocked.get(`${cube.x},${cube.y}`);
        return limit !== undefined && cube.z <= limit;
      });
      if (remaining.length === state.cubes.length) return state;
      return { ...state, cubes: remaining };
    }
  }
}
