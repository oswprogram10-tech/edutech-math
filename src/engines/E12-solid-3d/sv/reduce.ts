/**
 * E12 `surface-volume` 모드 상태 초기화·리듀서(순수 함수).
 *
 * 넓이·부피·개수는 상태에 저장하지 않는다(관찰에서 계산한다).
 */
import { clamp } from '../../../core/engine-sdk';
import type {
  SolidAction,
  SurfaceVolumeConfig,
  SvAction,
  SvLogRow,
  SvSettings,
  SvState,
  SvStepId,
} from '../types';
import { normalizeView, type XrayViewAngle } from '../xray/geometry';
import { divisors, isSvFaceId, sameBox, SV_FACE_IDS } from './geometry';

export const SV_MAX_LOG_ROWS = 12;
export const SV_MAX_SURFACE_INPUT = 9999;
export const SV_DEFAULT_VIEW: XrayViewAngle = { yaw: 30, pitch: 30 };
export const SV_ALL_STEPS: readonly SvStepId[] = ['rotate', 'unfold', 'paint', 'fill-voxels'];
const IGNORED_STEPS: readonly string[] = ['surface-expr', 'volume-expr'];

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
    console.warn(`E12 surface-volume: ${name}=${value} 범위 밖이라 ${min}~${max}로 자릅니다.`);
  }
  return clamp(rounded, min, max);
}

function sanitizeSteps(raw: unknown): readonly SvStepId[] {
  if (!Array.isArray(raw)) return SV_ALL_STEPS;
  const out: SvStepId[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if ((SV_ALL_STEPS as readonly string[]).includes(item)) {
      const step = item as SvStepId;
      if (!out.includes(step)) out.push(step);
    } else if (!IGNORED_STEPS.includes(item)) {
      console.warn(`E12 surface-volume: 알 수 없는 단계(${item})는 무시합니다.`);
    }
  }
  return out.length > 0 ? out : SV_ALL_STEPS;
}

function buildSettings(config: SurfaceVolumeConfig): SvSettings {
  const variant = config.variant === 'fixed-volume' ? 'fixed-volume' : 'steps';
  if (
    config.variant !== undefined &&
    config.variant !== 'steps' &&
    config.variant !== 'fixed-volume'
  ) {
    console.warn(
      `E12 surface-volume: 알 수 없는 variant(${String(config.variant)})는 steps로 처리합니다.`,
    );
  }
  const solidRaw = isRecord(config.solid) ? config.solid : {};
  const volume = clampInt(config.volume, 24, 2, 64, 'volume');
  const solid =
    variant === 'fixed-volume'
      ? { w: 1, d: 1, h: volume }
      : {
          w: clampInt(solidRaw['w'], 4, 1, 6, 'solid.w'),
          d: clampInt(solidRaw['d'], 3, 1, 6, 'solid.d'),
          h: clampInt(solidRaw['h'], 2, 1, 6, 'solid.h'),
        };
  return {
    variant,
    solid,
    steps: sanitizeSteps(config.steps),
    layerFill: config.layerFill !== false,
    pairColors: config.pairColors !== false,
    volume,
    log: config.log !== false,
  };
}

export function createSvState(config: SurfaceVolumeConfig): SvState {
  const settings = buildSettings(config);
  const start =
    typeof config.startStep === 'string' &&
    (settings.steps as readonly string[]).includes(config.startStep)
      ? (config.startStep as SvStepId)
      : (settings.steps[0] ?? 'rotate');
  const { w, d, h } = settings.solid;
  return {
    mode: 'surface-volume',
    settings,
    step: settings.variant === 'steps' ? start : 'rotate',
    view: SV_DEFAULT_VIEW,
    unfolded: false,
    painted: [],
    filled: [],
    layer: 0,
    dims: [w, d, h],
    logRows: [],
  };
}

// ---------------------------------------------------------------- 도우미

type Cube = readonly [number, number, number];

function sortCubes(cubes: readonly Cube[]): Cube[] {
  return [...cubes].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
}

export function hasCube(filled: readonly Cube[], x: number, y: number, z: number): boolean {
  return filled.some((c) => c[0] === x && c[1] === y && c[2] === z);
}

/** 아래부터 가득 찬 층 수. */
export function fullLayerCount(filled: readonly Cube[], w: number, d: number, h: number): number {
  let count = 0;
  for (let z = 0; z < h; z += 1) {
    const inLayer = filled.filter((c) => c[2] === z).length;
    if (inLayer === w * d) count += 1;
    else break;
  }
  return count;
}

const SV_ACTION_TYPES: readonly string[] = [
  'set-view',
  'rotate-view',
  'go-step',
  'toggle-unfold',
  'paint-face',
  'clear-paint',
  'place-cube',
  'remove-cube',
  'fill-layer',
  'set-layer',
  'clear-cubes',
  'set-dims',
  'add-log-row',
  'set-log-surface',
  'remove-log-row',
];

/** 다른 모드 전용 Action은 걸러 낸다. `clear-paint`는 cubes 모양(`view`가 있음)이면 거른다. */
function isSvAction(action: SolidAction): action is SvAction {
  if (!SV_ACTION_TYPES.includes(action.type)) return false;
  if (action.type === 'clear-paint') return !('view' in action);
  return true;
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function reduceSv(state: SvState, action: SolidAction): SvState {
  if (!isSvAction(action)) return state;
  const { settings } = state;
  const [w, d, h] = state.dims;
  const stepsVariant = settings.variant === 'steps';

  switch (action.type) {
    case 'set-view': {
      const next = normalizeView({ yaw: action.yaw, pitch: action.pitch });
      if (next.yaw === state.view.yaw && next.pitch === state.view.pitch) return state;
      return { ...state, view: next };
    }

    case 'rotate-view': {
      const dYaw = Number.isFinite(action.dYaw) ? action.dYaw : 0;
      const dPitch = Number.isFinite(action.dPitch) ? action.dPitch : 0;
      const next = normalizeView({
        yaw: state.view.yaw + dYaw,
        pitch: state.view.pitch + dPitch,
      });
      if (next.yaw === state.view.yaw && next.pitch === state.view.pitch) return state;
      return { ...state, view: next };
    }

    case 'go-step': {
      if (!stepsVariant) return state;
      if (!settings.steps.includes(action.step) || action.step === state.step) return state;
      return { ...state, step: action.step };
    }

    case 'toggle-unfold': {
      if (!stepsVariant) return state;
      if (state.step !== 'unfold' && state.step !== 'paint') return state;
      return { ...state, unfolded: !state.unfolded };
    }

    case 'paint-face': {
      if (!stepsVariant || state.step !== 'paint' || !state.unfolded) return state;
      if (!isSvFaceId(action.face)) return state;
      const set = new Set<string>(state.painted);
      if (set.has(action.face)) set.delete(action.face);
      else set.add(action.face);
      return { ...state, painted: SV_FACE_IDS.filter((f) => set.has(f)) };
    }

    case 'clear-paint': {
      if (!stepsVariant || state.painted.length === 0) return state;
      return { ...state, painted: [] };
    }

    case 'place-cube': {
      if (!stepsVariant || state.step !== 'fill-voxels') return state;
      const { x, y } = action;
      if (!inRange(x, 0, w - 1) || !inRange(y, 0, d - 1)) return state;
      const z = state.layer;
      if (hasCube(state.filled, x, y, z)) return state;
      if (z > 0 && !hasCube(state.filled, x, y, z - 1)) return state;
      return { ...state, filled: sortCubes([...state.filled, [x, y, z]]) };
    }

    case 'remove-cube': {
      if (!stepsVariant || state.step !== 'fill-voxels') return state;
      const { x, y } = action;
      if (!inRange(x, 0, w - 1) || !inRange(y, 0, d - 1)) return state;
      const z = state.layer;
      if (!hasCube(state.filled, x, y, z)) return state;
      if (hasCube(state.filled, x, y, z + 1)) return state;
      return {
        ...state,
        filled: state.filled.filter((c) => !(c[0] === x && c[1] === y && c[2] === z)),
      };
    }

    case 'fill-layer': {
      if (!stepsVariant || state.step !== 'fill-voxels' || !settings.layerFill) return state;
      const z = state.layer;
      if (z > 0 && fullLayerCount(state.filled, w, d, h) < z) return state;
      const added: Cube[] = [];
      for (let x = 0; x < w; x += 1) {
        for (let y = 0; y < d; y += 1) {
          if (!hasCube(state.filled, x, y, z)) added.push([x, y, z]);
        }
      }
      if (added.length === 0) return state;
      return {
        ...state,
        filled: sortCubes([...state.filled, ...added]),
        layer: Math.min(z + 1, h - 1),
      };
    }

    case 'set-layer': {
      if (!stepsVariant || state.step !== 'fill-voxels') return state;
      if (!inRange(action.layer, 0, h - 1) || action.layer === state.layer) return state;
      return { ...state, layer: action.layer };
    }

    case 'clear-cubes': {
      if (!stepsVariant) return state;
      if (state.filled.length === 0 && state.layer === 0) return state;
      return { ...state, filled: [], layer: 0 };
    }

    case 'set-dims': {
      if (stepsVariant) return state;
      const v = settings.volume;
      if (!inRange(action.w, 1, v) || !inRange(action.d, 1, v)) return state;
      if (v % action.w !== 0) return state;
      const rest = v / action.w;
      if (rest % action.d !== 0) return state;
      const nextH = rest / action.d;
      if (nextH < 1 || nextH > 64) return state;
      if (action.w === w && action.d === d) return state;
      return { ...state, dims: [action.w, action.d, nextH] };
    }

    case 'add-log-row': {
      if (stepsVariant || !settings.log) return state;
      if (state.logRows.length >= SV_MAX_LOG_ROWS) return state;
      if (state.logRows.some((r) => sameBox([r.w, r.d, r.h], [w, d, h]))) return state;
      const row: SvLogRow = { w, d, h, surface: null };
      return { ...state, logRows: [...state.logRows, row] };
    }

    case 'set-log-surface': {
      if (stepsVariant || !settings.log) return state;
      if (!inRange(action.row, 0, state.logRows.length - 1)) return state;
      const value = action.value;
      if (value !== null && !inRange(value, 0, SV_MAX_SURFACE_INPUT)) return state;
      const current = state.logRows[action.row];
      if (!current || current.surface === value) return state;
      return {
        ...state,
        logRows: state.logRows.map((r, i) => (i === action.row ? { ...r, surface: value } : r)),
      };
    }

    case 'remove-log-row': {
      if (stepsVariant || !settings.log) return state;
      if (!inRange(action.row, 0, state.logRows.length - 1)) return state;
      return { ...state, logRows: state.logRows.filter((_, i) => i !== action.row) };
    }

    default:
      return state;
  }
}

/** 화면이 쓰는 가로 고르기 후보(V의 약수). */
export function widthChoices(volume: number): readonly number[] {
  return divisors(volume);
}

/** 화면이 쓰는 세로 고르기 후보(V/w의 약수). */
export function depthChoices(volume: number, w: number): readonly number[] {
  return volume % w === 0 ? divisors(volume / w) : [];
}
