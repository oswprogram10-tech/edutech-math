/**
 * E12 `prism-pyramid` 모드 상태 초기화·리듀서(순수 함수).
 */
import { clamp } from '../../../core/engine-sdk';
import type {
  PrismAction,
  PrismConfig,
  PrismHandle,
  PrismMarkedState,
  PrismOrientation,
  PrismSettings,
  PrismState,
  PrismTableCol,
  PrismTableRow,
  PrismTop,
  SolidAction,
  XrayTool,
} from '../types';
import {
  PRISM_DEFAULT_HANDLES,
  PRISM_DEFAULT_TOOLS,
  PRISM_DEFAULT_VIEW,
  PRISM_MAX_HEIGHT,
  PRISM_MAX_SIDES,
  PRISM_MAX_TABLE_ROWS,
  PRISM_MIN_SIDES,
} from '../types';
import { normalizeView, type XrayViewAngle } from '../xray/geometry';
import { buildPrismModel, prismElementIds, prismKind } from './geometry';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    console.warn(`E12 prism-pyramid: ${name}=${value} 범위 밖이라 ${min}~${max}로 자릅니다.`);
  }
  return clamp(rounded, min, max);
}

function sanitizeSidesRange(raw: unknown): { readonly min: number; readonly max: number } {
  if (typeof raw === 'number') {
    const n = clampInt(raw, PRISM_MIN_SIDES, PRISM_MIN_SIDES, PRISM_MAX_SIDES, 'baseSides');
    return { min: n, max: n };
  }
  if (isRecord(raw)) {
    const min = clampInt(
      raw['min'],
      PRISM_MIN_SIDES,
      PRISM_MIN_SIDES,
      PRISM_MAX_SIDES,
      'baseSides.min',
    );
    let max = clampInt(
      raw['max'],
      PRISM_MAX_SIDES,
      PRISM_MIN_SIDES,
      PRISM_MAX_SIDES,
      'baseSides.max',
    );
    if (max < min) {
      console.warn('E12 prism-pyramid: baseSides.max가 min보다 작아 min으로 맞춥니다.');
      max = min;
    }
    return { min, max };
  }
  return { min: PRISM_MIN_SIDES, max: PRISM_MAX_SIDES };
}

function sanitizeHandles(raw: unknown): readonly PrismHandle[] {
  if (!Array.isArray(raw)) return PRISM_DEFAULT_HANDLES;
  const out: PrismHandle[] = [];
  for (const item of raw) {
    if ((item === 'extrude' || item === 'apex') && !out.includes(item)) out.push(item);
  }
  return out;
}

function sanitizeTools(raw: unknown): readonly XrayTool[] {
  if (!Array.isArray(raw)) return PRISM_DEFAULT_TOOLS;
  const out: XrayTool[] = [];
  for (const item of raw) {
    if ((item === 'face' || item === 'edge' || item === 'vertex') && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

function sanitizeOrientation(raw: unknown): PrismOrientation {
  if (raw === 'lying') return 'lying';
  if (raw !== undefined && raw !== 'upright') {
    console.warn(
      `E12 prism-pyramid: 알 수 없는 orientation(${String(raw)})은 upright로 처리합니다.`,
    );
  }
  return 'upright';
}

function sanitizeView(raw: unknown): XrayViewAngle {
  if (!isRecord(raw)) return PRISM_DEFAULT_VIEW;
  const yaw = typeof raw['yaw'] === 'number' && Number.isFinite(raw['yaw']) ? raw['yaw'] : 30;
  const pitch =
    typeof raw['pitch'] === 'number' && Number.isFinite(raw['pitch']) ? raw['pitch'] : 30;
  if (pitch < -75 || pitch > 75) {
    console.warn(`E12 prism-pyramid: view.pitch=${pitch} 범위 밖이라 -75~75로 자릅니다.`);
  }
  return normalizeView({ yaw, pitch });
}

function buildPrismSettings(config: PrismConfig): PrismSettings {
  const range = sanitizeSidesRange(config.baseSides);
  return {
    sidesMin: range.min,
    sidesMax: range.max,
    handles: sanitizeHandles(config.handles),
    orientation: sanitizeOrientation(config.orientation),
    counterTable: config.counterTable === true,
    showName: config.showName !== false,
    rotate: config.rotate !== false,
    view: sanitizeView(config.view),
    xray: config.xray === true,
    xrayToggle: config.xrayToggle !== false,
    tools: sanitizeTools(config.tools),
  };
}

export function createPrismState(config: PrismConfig): PrismState {
  const settings = buildPrismSettings(config);
  const initial: Readonly<Record<string, unknown>> = isRecord(config.initial) ? config.initial : {};
  const sides = clamp(
    clampInt(
      initial['sides'],
      settings.sidesMin,
      PRISM_MIN_SIDES,
      PRISM_MAX_SIDES,
      'initial.sides',
    ),
    settings.sidesMin,
    settings.sidesMax,
  );
  const height = clampInt(initial['height'], 0, 0, PRISM_MAX_HEIGHT, 'initial.height');
  const top: PrismTop = initial['top'] === 'apex' ? 'apex' : 'flat';
  return {
    mode: 'prism-pyramid',
    settings,
    sides,
    height,
    top,
    view: settings.view,
    xray: settings.xray,
    xrayUsed: false,
    tool: settings.tools[0] ?? null,
    marked: { faces: [], edges: [], vertices: [] },
    apexPlayed: false,
    table: [],
  };
}

const NO_MARKS: PrismMarkedState = { faces: [], edges: [], vertices: [] };

function hasAnyMark(marked: PrismMarkedState): boolean {
  return marked.faces.length > 0 || marked.edges.length > 0 || marked.vertices.length > 0;
}

function clearedMarks(state: PrismState): PrismState {
  return hasAnyMark(state.marked) ? { ...state, marked: NO_MARKS } : state;
}

function toggleInOrder(list: readonly string[], id: string, order: readonly string[]): string[] {
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  const set = new Set(next);
  return order.filter((x) => set.has(x));
}

const PRISM_ACTION_TYPES: readonly string[] = [
  'set-view',
  'rotate-view',
  'toggle-xray',
  'set-tool',
  'toggle-mark',
  'clear-marks',
  'set-sides',
  'set-height',
  'set-top',
  'add-table-row',
  'set-table-cell',
  'remove-table-row',
];

/** 다른 모드 전용 Action(`add`, `fold` …)은 걸러 낸다. `set-height`는 cubes 모양이면 거른다. */
function isPrismAction(action: SolidAction): action is PrismAction {
  if (!PRISM_ACTION_TYPES.includes(action.type)) return false;
  if (action.type === 'set-height') return !('x' in action);
  return true;
}

export function reducePrism(state: PrismState, action: SolidAction): PrismState {
  if (!isPrismAction(action)) return state;
  const { settings } = state;
  const kind = prismKind({ n: state.sides, height: state.height, top: state.top });

  switch (action.type) {
    case 'set-view': {
      if (!settings.rotate) return state;
      const next = normalizeView({ yaw: action.yaw, pitch: action.pitch });
      if (next.yaw === state.view.yaw && next.pitch === state.view.pitch) return state;
      return { ...state, view: next };
    }

    case 'rotate-view': {
      if (!settings.rotate) return state;
      const dYaw = Number.isFinite(action.dYaw) ? action.dYaw : 0;
      const dPitch = Number.isFinite(action.dPitch) ? action.dPitch : 0;
      const next = normalizeView({
        yaw: state.view.yaw + dYaw,
        pitch: state.view.pitch + dPitch,
      });
      if (next.yaw === state.view.yaw && next.pitch === state.view.pitch) return state;
      return { ...state, view: next };
    }

    case 'toggle-xray': {
      if (!settings.xrayToggle) return state;
      const next = !state.xray;
      return { ...state, xray: next, xrayUsed: state.xrayUsed || next };
    }

    case 'set-tool': {
      if (action.tool === 'query') return state;
      if (!settings.tools.includes(action.tool) || state.tool === action.tool) return state;
      return { ...state, tool: action.tool };
    }

    case 'set-sides': {
      if (settings.sidesMin === settings.sidesMax) return state;
      const n = action.n;
      if (!Number.isInteger(n) || n < settings.sidesMin || n > settings.sidesMax) return state;
      if (n === state.sides) return state;
      return { ...clearedMarks(state), sides: n };
    }

    case 'set-height': {
      if (!settings.handles.includes('extrude')) return state;
      const h = action.h;
      if (!Number.isInteger(h) || h < 0 || h > PRISM_MAX_HEIGHT) return state;
      if (h === state.height) return state;
      const next = { ...state, height: h };
      return h === 0 ? clearedMarks(next) : next;
    }

    case 'set-top': {
      if (!settings.handles.includes('apex')) return state;
      if (action.top !== 'flat' && action.top !== 'apex') return state;
      if (action.top === state.top) return state;
      return {
        ...clearedMarks(state),
        top: action.top,
        apexPlayed: state.apexPlayed || action.top === 'apex',
      };
    }

    case 'toggle-mark': {
      if (kind === 'base') return state;
      if (!settings.tools.includes(action.kind)) return state;
      const ids = prismElementIds(kind, state.sides);
      if (action.kind === 'face') {
        if (!ids.faces.includes(action.id)) return state;
        return {
          ...state,
          marked: {
            ...state.marked,
            faces: toggleInOrder(state.marked.faces, action.id, ids.faces),
          },
        };
      }
      if (action.kind === 'edge') {
        if (!ids.edges.includes(action.id)) return state;
        return {
          ...state,
          marked: {
            ...state.marked,
            edges: toggleInOrder(state.marked.edges, action.id, ids.edges),
          },
        };
      }
      if (!ids.vertices.includes(action.id)) return state;
      return {
        ...state,
        marked: {
          ...state.marked,
          vertices: toggleInOrder(state.marked.vertices, action.id, ids.vertices),
        },
      };
    }

    case 'clear-marks':
      return clearedMarks(state);

    case 'add-table-row': {
      if (!settings.counterTable) return state;
      if (kind !== 'prism' && kind !== 'pyramid') return state;
      if (state.table.length >= PRISM_MAX_TABLE_ROWS) return state;
      if (state.table.some((r) => r.kind === kind && r.n === state.sides)) return state;
      const row: PrismTableRow = { kind, n: state.sides, faces: null, edges: null, vertices: null };
      return { ...state, table: [...state.table, row] };
    }

    case 'set-table-cell': {
      if (!settings.counterTable) return state;
      const col: PrismTableCol = action.col;
      if (col !== 'faces' && col !== 'edges' && col !== 'vertices') return state;
      if (!Number.isInteger(action.row) || action.row < 0 || action.row >= state.table.length) {
        return state;
      }
      const value = action.value;
      if (value !== null && (!Number.isInteger(value) || value < 0 || value > 99)) return state;
      const current = state.table[action.row];
      if (!current || current[col] === value) return state;
      return {
        ...state,
        table: state.table.map((r, i) => (i === action.row ? { ...r, [col]: value } : r)),
      };
    }

    case 'remove-table-row': {
      if (!settings.counterTable) return state;
      if (!Number.isInteger(action.row) || action.row < 0 || action.row >= state.table.length) {
        return state;
      }
      return { ...state, table: state.table.filter((_, i) => i !== action.row) };
    }

    default:
      return state;
  }
}

/** 화면과 테스트가 쓰는 지금 입체 모델. */
export function currentPrismModel(state: PrismState) {
  return buildPrismModel(
    { n: state.sides, height: state.height, top: state.top },
    state.settings.orientation,
  );
}
