/**
 * E09 기하판의 순수 reducer.
 *
 * - 무작위·시간을 쓰지 않는다(모든 상태는 Action 목록으로 재생된다).
 * - reduce는 config를 받지 않으므로 필요한 설정은 `state.settings`에 복사한다.
 * - 수학 값은 저장하지 않는다. 넓이·각 판정은 `observe.ts`가 `core/math/geometry`로 계산한다.
 */
import { clamp } from '../../core/engine-sdk';
import { createClassifyState, reduceClassify } from './modes/classify/reduce';
import type { ClassifyConfig } from './modes/classify/types';
import { createDragTestState, reduceDragTest } from './modes/drag-test/reduce';
import type { DragTestConfig } from './modes/drag-test/types';
import type {
  BandBoardState,
  ConstructConfig,
  ConstructSettings,
  ConstructState,
  ConstructTool,
  GeoAction,
  GeoAngle,
  GeoBand,
  GeoConfig,
  GeoMode,
  GeoObject,
  GeoObjectKind,
  GeoNamedPoint,
  GeoState,
  GeoboardConfig,
  GeoboardSettings,
  GeoboardState,
  Peg,
} from './types';
import {
  DEFAULT_CONSTRUCT_GRID,
  DEFAULT_CONSTRUCT_TOOLS,
  DEFAULT_GEOBOARD_GRID,
  DEFAULT_MAX_SHAPES,
  MAX_GRID,
  MIN_GRID,
} from './types';

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

export function samePeg(a: Peg, b: Peg): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Action·설정에서 온 좌표를 격자 안 정수 쌍으로 만든다. 범위를 벗어나면 null. */
export function sanitizePeg(value: unknown, cols: number, rows: number): Peg | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = value[0];
  const y = value[1];
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const i = Math.round(x);
  const j = Math.round(y);
  if (i < 0 || i >= cols || j < 0 || j >= rows) return null;
  return [i, j];
}

function pegList(value: unknown, cols: number, rows: number): Peg[] {
  if (!Array.isArray(value)) return [];
  const result: Peg[] = [];
  for (const item of value) {
    const peg = sanitizePeg(item, cols, rows);
    if (!peg) continue;
    const last = result[result.length - 1];
    if (last && samePeg(last, peg)) continue;
    result.push(peg);
  }
  if (result.length > 1) {
    const first = result[0];
    const last = result[result.length - 1];
    if (first && last && samePeg(first, last)) result.pop();
  }
  return result;
}

export function inferMode(config: GeoConfig): GeoMode {
  const declared = (config as { readonly mode?: string }).mode;
  if (
    declared === 'geoboard' ||
    declared === 'construct' ||
    declared === 'classify' ||
    declared === 'drag-test'
  ) {
    return declared;
  }
  const candidate = config as ConstructConfig;
  if (
    candidate.tools !== undefined ||
    candidate.points !== undefined ||
    candidate.targets !== undefined ||
    candidate.showExtension !== undefined ||
    candidate.given !== undefined ||
    candidate.angles !== undefined
  ) {
    return 'construct';
  }
  return 'geoboard';
}

function geoboardSettings(config: GeoboardConfig): GeoboardSettings {
  const raw = Array.isArray(config.grid) ? config.grid : DEFAULT_GEOBOARD_GRID;
  const cols = integer(raw[0], DEFAULT_GEOBOARD_GRID[0], MIN_GRID, MAX_GRID);
  const rows = integer(raw[1], DEFAULT_GEOBOARD_GRID[1], MIN_GRID, MAX_GRID);
  return {
    grid: [cols, rows],
    // 'after-submit'은 실행기가 제출 결과를 알려 주지 않으므로 'never'로 본다.
    showCounts: config.showCounts === 'always' ? 'always' : 'never',
    maxShapes: integer(config.maxShapes, DEFAULT_MAX_SHAPES, 1, 8),
  };
}

const OBJECT_KINDS: readonly GeoObjectKind[] = ['segment', 'ray', 'line'];
const TOOLS: readonly ConstructTool[] = ['segment', 'ray', 'line', 'set-square'];

function objectsOf(
  value: unknown,
  cols: number,
  rows: number,
  fallbackPrefix: string,
): GeoObject[] {
  if (!Array.isArray(value)) return [];
  const result: GeoObject[] = [];
  value.forEach((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return;
    const record = item as Readonly<Record<string, unknown>>;
    const kind = record['kind'];
    if (typeof kind !== 'string' || !OBJECT_KINDS.includes(kind as GeoObjectKind)) return;
    const from = sanitizePeg(record['from'], cols, rows);
    const to = sanitizePeg(record['to'], cols, rows);
    if (!from || !to || samePeg(from, to)) return;
    const rawId = record['id'];
    const id =
      typeof rawId === 'string' && rawId.length > 0 ? rawId : `${fallbackPrefix}${index + 1}`;
    result.push({ id, kind: kind as GeoObjectKind, from, to });
  });
  return result;
}

function pointsOf(value: unknown, cols: number, rows: number): GeoNamedPoint[] {
  if (!Array.isArray(value)) return [];
  const result: GeoNamedPoint[] = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Readonly<Record<string, unknown>>;
    const label = record['label'];
    const at = sanitizePeg(record['at'], cols, rows);
    if (typeof label !== 'string' || label.length === 0 || !at) continue;
    result.push({ label, at });
  }
  return result;
}

function targetsOf(value: unknown, cols: number, rows: number): Peg[] {
  if (!Array.isArray(value)) return [];
  const result: Peg[] = [];
  for (const item of value) {
    const peg = sanitizePeg(item, cols, rows);
    if (peg) result.push(peg);
  }
  return result;
}

function anglesOf(value: unknown, cols: number, rows: number): GeoAngle[] {
  if (!Array.isArray(value)) return [];
  const result: GeoAngle[] = [];
  value.forEach((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return;
    const record = item as Readonly<Record<string, unknown>>;
    const vertex = sanitizePeg(record['vertex'], cols, rows);
    const a = sanitizePeg(record['a'], cols, rows);
    const b = sanitizePeg(record['b'], cols, rows);
    if (!vertex || !a || !b) return;
    const rawId = record['id'];
    const id = typeof rawId === 'string' && rawId.length > 0 ? rawId : `angle-${index + 1}`;
    result.push({ id, vertex, a, b });
  });
  return result;
}

function toolsOf(config: ConstructConfig): ConstructTool[] {
  const raw = Array.isArray(config.tools) ? config.tools : DEFAULT_CONSTRUCT_TOOLS;
  const result: ConstructTool[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tool = item as ConstructTool;
    if (TOOLS.includes(tool) && !result.includes(tool)) result.push(tool);
  }
  return result.length > 0 ? result : [...DEFAULT_CONSTRUCT_TOOLS];
}

function constructSettings(config: ConstructConfig): ConstructSettings {
  const grid = integer(config.grid, DEFAULT_CONSTRUCT_GRID, 5, MAX_GRID);
  return {
    grid,
    tools: toolsOf(config),
    points: pointsOf(config.points, grid, grid),
    targets: targetsOf(config.targets, grid, grid),
    showExtension: config.showExtension === true,
    given: objectsOf(config.given, grid, grid, 'given-'),
    angles: anglesOf(config.angles, grid, grid),
  };
}

export function createInitialState(config: GeoConfig): GeoState {
  const mode = inferMode(config);
  if (mode === 'classify') {
    return createClassifyState(config as ClassifyConfig);
  }
  if (mode === 'drag-test') {
    return createDragTestState(config as DragTestConfig);
  }
  if (mode === 'construct') {
    const settings = constructSettings(config as ConstructConfig);
    return {
      mode: 'construct',
      tool: settings.tools[0] ?? 'segment',
      pendingStart: null,
      // given은 화면에 미리 그린 선일 뿐, 학생이 만든 객체로 세지 않는다.
      objects: [],
      squareOn: null,
      marked: [],
      nextId: 1,
      settings,
    };
  }

  const settings = geoboardSettings(config as GeoboardConfig);
  const [cols, rows] = settings.grid;
  const shapes = Array.isArray((config as GeoboardConfig).shapes)
    ? ((config as GeoboardConfig).shapes ?? [])
    : [];
  const bands: GeoBand[] = [];
  for (const shape of shapes) {
    if (bands.length >= settings.maxShapes) break;
    const pegs = pegList(shape, cols, rows);
    if (pegs.length < 3) continue;
    bands.push({ id: `b${bands.length + 1}`, pegs, closed: true });
  }
  return {
    mode: 'geoboard',
    bands,
    activeBand: null,
    nextId: bands.length + 1,
    settings,
  };
}

function bandById(state: GeoboardState, id: string | null): GeoBand | null {
  if (id === null) return null;
  return state.bands.find((band) => band.id === id) ?? null;
}

function replaceBand(state: GeoboardState, next: GeoBand): GeoboardState {
  return {
    ...state,
    bands: state.bands.map((band) => (band.id === next.id ? next : band)),
  };
}

function reduceGeoboard(state: GeoboardState, action: GeoAction): GeoState {
  const [cols, rows] = state.settings.grid;
  switch (action.type) {
    case 'start-band': {
      if (state.activeBand !== null) return state;
      if (state.bands.length >= state.settings.maxShapes) return state;
      const peg = sanitizePeg(action.peg, cols, rows);
      if (!peg) return state;
      const id = `b${state.nextId}`;
      return {
        ...state,
        bands: [...state.bands, { id, pegs: [peg], closed: false }],
        activeBand: id,
        nextId: state.nextId + 1,
      };
    }
    case 'add-peg': {
      const active = bandById(state, state.activeBand);
      if (!active || active.closed) return state;
      const peg = sanitizePeg(action.peg, cols, rows);
      if (!peg) return state;
      const first = active.pegs[0];
      if (first && active.pegs.length >= 3 && samePeg(first, peg)) {
        return {
          ...state,
          activeBand: null,
          bands: state.bands.map((band) =>
            band.id === active.id ? { ...band, closed: true } : band,
          ),
        };
      }
      const last = active.pegs[active.pegs.length - 1];
      if (last && samePeg(last, peg)) return state;
      return replaceBand(state, { ...active, pegs: [...active.pegs, peg] });
    }
    case 'close-band': {
      const active = bandById(state, state.activeBand);
      if (!active || active.closed) return state;
      const pegs = [...active.pegs];
      const first = pegs[0];
      const last = pegs[pegs.length - 1];
      if (first && last && pegs.length > 1 && samePeg(first, last)) pegs.pop();
      if (pegs.length < 3) return state;
      return {
        ...state,
        activeBand: null,
        bands: state.bands.map((band) =>
          band.id === active.id ? { ...band, pegs, closed: true } : band,
        ),
      };
    }
    case 'undo-peg': {
      const active = bandById(state, state.activeBand);
      if (!active || active.closed) return state;
      const pegs = active.pegs.slice(0, -1);
      if (pegs.length === 0) {
        return {
          ...state,
          bands: state.bands.filter((band) => band.id !== active.id),
          activeBand: null,
        };
      }
      return replaceBand(state, { ...active, pegs });
    }
    case 'delete-band': {
      if (!state.bands.some((band) => band.id === action.id)) return state;
      return {
        ...state,
        bands: state.bands.filter((band) => band.id !== action.id),
        activeBand: state.activeBand === action.id ? null : state.activeBand,
      };
    }
    case 'move-peg': {
      const band = bandById(state, action.band);
      if (!band || !band.closed) return state;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= band.pegs.length) {
        return state;
      }
      const peg = sanitizePeg(action.peg, cols, rows);
      const current = band.pegs[action.index];
      if (!peg || !current || samePeg(current, peg)) return state;
      const pegs = band.pegs.map((item, index) => (index === action.index ? peg : item));
      return replaceBand(state, { ...band, pegs });
    }
    default:
      return state;
  }
}

/**
 * 고무줄 Action만 처리하는 공통 reducer. geoboard와 classify가 같이 쓴다.
 * 모드별 추가 필드(`squareOn` 등)는 그대로 보존한다.
 */
export function reduceBands<S extends BandBoardState>(state: S, action: GeoAction): S {
  const next = reduceGeoboard(state as unknown as GeoboardState, action);
  if ((next as unknown) === (state as unknown)) return state;
  return { ...state, ...next } as S;
}

function reduceConstruct(state: ConstructState, action: GeoAction): GeoState {
  const { grid } = state.settings;
  switch (action.type) {
    case 'select-tool': {
      if (!state.settings.tools.includes(action.tool)) return state;
      if (state.tool === action.tool) return state;
      return { ...state, tool: action.tool };
    }
    case 'pick': {
      if (state.tool === 'set-square') return state;
      const at = sanitizePeg(action.at, grid, grid);
      if (!at) return state;
      if (state.pendingStart === null) {
        return { ...state, pendingStart: at };
      }
      if (samePeg(state.pendingStart, at)) return state;
      const kind: GeoObjectKind = state.tool;
      const object: GeoObject = {
        id: `o${state.nextId}`,
        kind,
        from: state.pendingStart,
        to: at,
      };
      return {
        ...state,
        pendingStart: null,
        objects: [...state.objects, object],
        nextId: state.nextId + 1,
      };
    }
    case 'remove-object': {
      if (!state.objects.some((object) => object.id === action.id)) return state;
      return { ...state, objects: state.objects.filter((object) => object.id !== action.id) };
    }
    case 'place-square': {
      if (!state.settings.angles.some((angle) => angle.id === action.angle)) return state;
      if (state.squareOn === action.angle) return state;
      return { ...state, squareOn: action.angle };
    }
    case 'remove-square': {
      if (state.squareOn === null) return state;
      return { ...state, squareOn: null };
    }
    case 'toggle-mark': {
      if (!state.settings.angles.some((angle) => angle.id === action.angle)) return state;
      const marked = state.marked.includes(action.angle)
        ? state.marked.filter((id) => id !== action.angle)
        : [...state.marked, action.angle];
      return { ...state, marked };
    }
    default:
      return state;
  }
}

export function reduce(state: GeoState, action: GeoAction): GeoState {
  if (state.mode === 'geoboard') return reduceGeoboard(state, action) as GeoboardState;
  if (state.mode === 'classify') return reduceClassify(state, action);
  if (state.mode === 'drag-test') return reduceDragTest(state, action);
  return reduceConstruct(state, action) as ConstructState;
}

/** 고무줄 id로 찾는다. View·overlay가 쓴다. */
export function findBand(state: BandBoardState, id: string | null): GeoBand | null {
  if (id === null) return null;
  return state.bands.find((band) => band.id === id) ?? null;
}

export function closedBands(state: BandBoardState): GeoBand[] {
  return state.bands.filter((band) => band.closed);
}
