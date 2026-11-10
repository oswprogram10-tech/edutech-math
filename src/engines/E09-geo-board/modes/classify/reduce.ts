/** classify 모드의 순수 reducer. 고무줄 Action은 geoboard와 같은 `reduceBands`를 쓴다. */
import { clamp } from '../../../../core/engine-sdk';
import { isSimplePolygon } from '../../../../core/math';
import type { GPoint } from '../../../../core/math';
import { gp } from '../../../../core/math';
import { reduceBands, samePeg, sanitizePeg } from '../../reduce';
import { DEFAULT_GEOBOARD_GRID, DEFAULT_MAX_SHAPES, MAX_GRID, MIN_GRID } from '../../types';
import type { GeoAction, GeoBand, Peg } from '../../types';
import type {
  ClassifyAction,
  ClassifyConfig,
  ClassifyProperty,
  ClassifySettings,
  ClassifyState,
  ClassifyTool,
} from './types';

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

const PROPERTIES: readonly ClassifyProperty[] = [
  'rightAngles',
  'parallelSides',
  'equalSides',
  'angles',
];

function propertiesOf(config: ClassifyConfig): ClassifyProperty[] {
  if (!Array.isArray(config.showProperties)) return [];
  const result: ClassifyProperty[] = [];
  for (const item of config.showProperties) {
    if (typeof item !== 'string') continue;
    const property = item as ClassifyProperty;
    if (PROPERTIES.includes(property) && !result.includes(property)) result.push(property);
  }
  return result;
}

function toolsOf(config: ClassifyConfig): ClassifyTool[] {
  const tools: ClassifyTool[] = ['geoboard-band'];
  if (Array.isArray(config.tools) && config.tools.includes('set-square')) tools.push('set-square');
  return tools;
}

export function classifySettings(config: ClassifyConfig): ClassifySettings {
  const rawGrid = Array.isArray(config.grid) ? config.grid : DEFAULT_GEOBOARD_GRID;
  const cols = integer(rawGrid[0], DEFAULT_GEOBOARD_GRID[0], MIN_GRID, MAX_GRID);
  const rows = integer(rawGrid[1], DEFAULT_GEOBOARD_GRID[1], MIN_GRID, MAX_GRID);
  return {
    grid: [cols, rows],
    maxShapes: integer(config.maxShapes, DEFAULT_MAX_SHAPES, 1, 8),
    showCounts: 'never',
    tools: toolsOf(config),
    showProperties: propertiesOf(config),
  };
}

function pegsOf(value: unknown, cols: number, rows: number): Peg[] {
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

function bandsOf(config: ClassifyConfig, settings: ClassifySettings): GeoBand[] {
  const [cols, rows] = settings.grid;
  const shapes = Array.isArray(config.shapes) ? config.shapes : [];
  const bands: GeoBand[] = [];
  for (const shape of shapes) {
    if (bands.length >= settings.maxShapes) break;
    const pegs = pegsOf(shape, cols, rows);
    if (pegs.length < 3) continue;
    bands.push({ id: `b${bands.length + 1}`, pegs, closed: true });
  }
  return bands;
}

export function createClassifyState(config: ClassifyConfig): ClassifyState {
  const settings = classifySettings(config);
  const bands = bandsOf(config, settings);
  return {
    mode: 'classify',
    bands,
    activeBand: null,
    nextId: bands.length + 1,
    squareOn: null,
    settings,
  };
}

function pointsOf(pegs: readonly Peg[]): GPoint[] {
  return pegs.map((peg) => gp(peg[0], peg[1]));
}

function bandById(state: ClassifyState, id: string | null): GeoBand | null {
  if (id === null) return null;
  return state.bands.find((band) => band.id === id) ?? null;
}

const BAND_ACTIONS: readonly GeoAction['type'][] = [
  'start-band',
  'add-peg',
  'close-band',
  'undo-peg',
  'delete-band',
  'move-peg',
];

export function reduceClassify(state: ClassifyState, action: GeoAction): ClassifyState {
  if (BAND_ACTIONS.includes(action.type)) {
    const next = reduceBands(state, action);
    if (next === state) return state;
    if (action.type === 'delete-band' && state.squareOn?.band === action.id) {
      return { ...next, squareOn: null };
    }
    if (action.type === 'move-peg' && state.squareOn?.band === action.band) {
      return { ...next, squareOn: null };
    }
    return next;
  }

  switch (action.type) {
    case 'place-square-at': {
      const band = bandById(state, action.band);
      if (!band || !band.closed) return state;
      if (!Number.isInteger(action.index) || action.index < 0) return state;
      if (action.index >= band.pegs.length) return state;
      const points = pointsOf(band.pegs);
      if (!isSimplePolygon(points)) return state;
      const same = state.squareOn?.band === action.band && state.squareOn.index === action.index;
      return { ...state, squareOn: same ? null : { band: action.band, index: action.index } };
    }
    case 'remove-square': {
      return state.squareOn === null ? state : { ...state, squareOn: null };
    }
    default:
      return state;
  }
}

export type { ClassifyAction };
