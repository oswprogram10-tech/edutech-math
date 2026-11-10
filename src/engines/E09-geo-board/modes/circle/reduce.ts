/** circle 모드의 순수 reducer. 반 칸 단위는 정수로만 저장한다. */
import { clamp } from '../../../../core/engine-sdk';
import { DEFAULT_CIRCLE_GRID, MAX_CIRCLE_GRID, MIN_CIRCLE_GRID } from '../../types';
import type { GeoAction, Peg } from '../../types';
import type {
  CircleAction,
  CircleConfig,
  CirclePattern,
  CircleScene,
  CircleSettings,
  CircleState,
  CircleTool,
} from './types';

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

/** 0.5 단위 값을 반 칸 단위 정수로. 0.5 단위가 아니면 버림. */
function half(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const scaled = Math.floor(value * 2 + 1e-9);
  return clamp(scaled, min, max);
}

/** 반 칸 단위 정수를 0.5 단위로. 설정이 이미 반 칸 단위면 그대로 쓴다. */
function halfInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clamp(Math.round(value), min, max);
}

function sceneOf(value: unknown): CircleScene {
  return value === 'playground' ? 'playground' : 'plain';
}

function maxRadius(grid: number): number {
  return Math.floor((grid - 1) / 2);
}

function ropeList(config: CircleConfig, current: number, max: number): number[] {
  if (!Array.isArray(config.ropeLengths)) return [current];
  const result: number[] = [];
  for (const item of config.ropeLengths) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue;
    const length = clamp(Math.round(item), 1, max);
    if (!result.includes(length)) result.push(length);
  }
  if (result.length === 0) return [current];
  return result;
}

function patternOf(
  config: CircleConfig,
  settings: Omit<CircleSettings, 'targetPattern'>,
): CirclePattern[] {
  const raw = config.targetPattern;
  const maxHalf = (settings.grid - 1) * 2;
  if (raw === 'three-circles-in-row') {
    const radius = clamp(settings.radius ?? 3, 1, maxRadius(settings.grid));
    const centerHalf = settings.grid - 1;
    const radiusHalf = radius * 2;
    return [
      { center: [centerHalf - radiusHalf, centerHalf], radius: radiusHalf },
      { center: [centerHalf, centerHalf], radius: radiusHalf },
      { center: [centerHalf + radiusHalf, centerHalf], radius: radiusHalf },
    ];
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const circles = (raw as { readonly circles?: unknown }).circles;
  if (!Array.isArray(circles)) return [];
  const result: CirclePattern[] = [];
  for (const item of circles) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Readonly<Record<string, unknown>>;
    const center = record['center'];
    if (!Array.isArray(center) || center.length < 2) continue;
    const x = half(center[0], 0, maxHalf);
    const y = half(center[1], 0, maxHalf);
    const radius = half(record['radius'], 1, maxHalf);
    if (x === null || y === null || radius === null) continue;
    result.push({ center: [x, y], radius });
  }
  return result;
}

export function circleSettings(config: CircleConfig): CircleSettings {
  const grid = integer(config.grid, DEFAULT_CIRCLE_GRID, MIN_CIRCLE_GRID, MAX_CIRCLE_GRID);
  const max = maxRadius(grid);
  const fallbackStake = Math.floor((grid - 1) / 2);
  const stake = Array.isArray(config.stake)
    ? ([
        integer(config.stake[0], fallbackStake, 0, grid - 1),
        integer(config.stake[1], fallbackStake, 0, grid - 1),
      ] as const)
    : ([fallbackStake, fallbackStake] as const);
  const rawRope = integer(config.ropeLength, Math.min(3, max), 1, max);
  const ropeLengths = ropeList(config, rawRope, max);
  const ropeLength = ropeLengths.includes(rawRope) ? rawRope : (ropeLengths[0] ?? 1);
  const radius =
    typeof config.radius === 'number' && Number.isFinite(config.radius)
      ? integer(config.radius, 1, 1, max)
      : null;
  const base: Omit<CircleSettings, 'targetPattern'> = {
    grid,
    scene: sceneOf(config.scene),
    stake: [stake[0], stake[1]],
    ropeLength,
    ropeLengths,
    traceDots: config.traceDots !== false,
    measureTool: config.measureTool === true,
    radius,
    chordExplorer: config.chordExplorer === true,
    snapDiameter: config.snapDiameter === true,
    compass: {
      enabled: config.compass?.enabled === true,
      gridSnap: config.compass?.gridSnap === 0.5 ? 0.5 : 1,
    },
  };
  return { ...base, targetPattern: patternOf(config, base) };
}

export function circleTools(settings: CircleSettings): CircleTool[] {
  const tools: CircleTool[] = ['rope'];
  if (settings.measureTool) tools.push('radius');
  if (settings.chordExplorer) tools.push('chord');
  if (settings.compass.enabled) tools.push('compass');
  return tools;
}

export function createCircleState(config: CircleConfig): CircleState {
  const settings = circleSettings(config);
  const tools = circleTools(settings);
  const centerHalf = settings.grid - 1;
  return {
    mode: 'circle',
    tool: tools[0] ?? 'rope',
    ropeLength: settings.ropeLength,
    traces: {},
    radii: [],
    measured: [],
    chord: null,
    compass: { center: [centerHalf, centerHalf], width: 2 },
    circles: [],
    nextId: 1,
    settings,
  };
}

function sanitizeSector(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const sector = Math.round(value);
  if (sector < 0 || sector > 71) return null;
  return sector;
}

function sanitizePos(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const pos = Math.round(value);
  if (pos < 0 || pos > 47) return null;
  return pos;
}

function traceList(state: CircleState, length: number): readonly number[] {
  return state.traces[String(length)] ?? [];
}

function snapChord(pos: number, other: number, enabled: boolean): number {
  if (!enabled) return pos;
  const target = (other + 24) % 48;
  const raw = Math.abs(pos - target);
  return Math.min(raw, 48 - raw) <= 2 ? target : pos;
}

function snapToStep(value: number, step: number, min: number, max: number): number {
  return clamp(Math.round(value / step) * step, min, max);
}

function sameCompass(a: CircleState['compass'], b: CircleState['compass']): boolean {
  return a.center[0] === b.center[0] && a.center[1] === b.center[1] && a.width === b.width;
}

function sameCircle(
  a: { readonly center: Peg; readonly radius: number },
  b: { readonly center: Peg; readonly radius: number },
): boolean {
  return a.center[0] === b.center[0] && a.center[1] === b.center[1] && a.radius === b.radius;
}

export function reduceCircle(state: CircleState, action: GeoAction): CircleState {
  switch (action.type) {
    case 'select-circle-tool': {
      if (!circleTools(state.settings).includes(action.tool)) return state;
      if (state.tool === action.tool) return state;
      return { ...state, tool: action.tool };
    }

    case 'set-rope': {
      if (!Number.isInteger(action.length)) return state;
      if (!state.settings.ropeLengths.includes(action.length)) return state;
      if (state.ropeLength === action.length) return state;
      return { ...state, ropeLength: action.length };
    }

    case 'trace': {
      const sector = sanitizeSector(action.sector);
      if (sector === null) return state;
      const key = String(state.ropeLength);
      const current = traceList(state, state.ropeLength);
      if (current.includes(sector)) return state;
      return {
        ...state,
        traces: { ...state.traces, [key]: [...current, sector].sort((a, b) => a - b) },
      };
    }

    case 'clear-trace': {
      const key = String(state.ropeLength);
      if (traceList(state, state.ropeLength).length === 0) return state;
      return { ...state, traces: { ...state.traces, [key]: [] } };
    }

    case 'add-radius': {
      const pos = sanitizePos(action.pos);
      if (pos === null || state.radii.includes(pos)) return state;
      return { ...state, radii: [...state.radii, pos] };
    }

    case 'measure-radius': {
      if (!state.settings.measureTool) return state;
      const pos = sanitizePos(action.pos);
      if (pos === null || !state.radii.includes(pos) || state.measured.includes(pos)) return state;
      return { ...state, measured: [...state.measured, pos] };
    }

    case 'set-chord': {
      if (!state.settings.chordExplorer) return state;
      if (action.end !== 0 && action.end !== 1) return state;
      const pos = sanitizePos(action.pos);
      if (pos === null) return state;
      const base = state.chord ?? ([0, 17] as const);
      if (action.end === 0) {
        const next = snapChord(pos, base[1], state.settings.snapDiameter);
        if (next === base[0]) return state;
        return { ...state, chord: [next, base[1]] };
      }
      const next = snapChord(pos, base[0], state.settings.snapDiameter);
      if (next === base[1]) return state;
      return { ...state, chord: [base[0], next] };
    }

    case 'set-compass': {
      if (!state.settings.compass.enabled) return state;
      const step = state.settings.compass.gridSnap * 2;
      const maxHalf = (state.settings.grid - 1) * 2;
      let center = state.compass.center;
      if (action.center !== undefined) {
        if (!Array.isArray(action.center) || action.center.length < 2) return state;
        const x = halfInt(action.center[0], 0, maxHalf);
        const y = halfInt(action.center[1], 0, maxHalf);
        if (x === null || y === null) return state;
        center = [snapToStep(x, step, 0, maxHalf), snapToStep(y, step, 0, maxHalf)];
      }
      let width = state.compass.width;
      if (action.width !== undefined) {
        const raw = halfInt(action.width, 1, maxHalf);
        if (raw === null) return state;
        width = Math.max(step, snapToStep(raw, step, step, maxHalf));
      }
      const next = { center, width };
      if (sameCompass(state.compass, next)) return state;
      return { ...state, compass: next };
    }

    case 'draw-circle': {
      if (!state.settings.compass.enabled) return state;
      if (state.compass.width <= 0) return state;
      if (state.circles.length >= 8) return state;
      const candidate = {
        center: state.compass.center,
        radius: state.compass.width,
      };
      if (state.circles.some((circle) => sameCircle(circle, candidate))) return state;
      const id = `c${state.nextId}`;
      return {
        ...state,
        circles: [...state.circles, { id, ...candidate }],
        nextId: state.nextId + 1,
      };
    }

    case 'remove-circle': {
      if (!state.circles.some((circle) => circle.id === action.id)) return state;
      return { ...state, circles: state.circles.filter((circle) => circle.id !== action.id) };
    }

    default:
      return state;
  }
}

export type { CircleAction };
