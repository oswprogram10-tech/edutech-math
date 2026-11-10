/**
 * `point-symmetry` 모드: 압정을 꽂고 180° 돌려 점대칭의 중심을 찾는다.
 *
 * 압정은 두 배 좌표 정수로 둔다(반 칸 단위). 수학 판정은 `pin/2`을
 * `Rational`로 만들어 정확히 한다. 정오각형은 변 수가 홀수라 어떤 중심에서도
 * 점대칭이 아니다(정리, 근사 없음).
 */
import { polygonPointSymmetric, gp, Rational } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { POLYGONS, isPointPresetId } from '../polygons';
import type { PointPresetId } from '../polygons';
import type {
  PointSymmetryConfig,
  PointSymmetrySettings,
  PointSymmetryState,
  PointTask,
  Pt,
  Side,
  TransformAction,
} from '../types';

const DEFAULT_SHAPES: readonly PointPresetId[] = [
  'parallelogram',
  'letter-S',
  'letter-N',
  'regular-pentagon',
];

const DEFAULT_CENTER: Pt = [8, 8];

const DEFAULT_HALF: readonly Pt[] = [
  [2, 2],
  [4, 2],
  [6, 4],
  [6, 6],
];

/** 두 배 좌표의 점판 범위. 점판은 0..9이므로 두 배 좌표는 0..18이다. */
export const PIN_LIMIT = 18;

function readPoint(value: unknown): Pt | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = value[0];
  const y = value[1];
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  return [x, y];
}

function readShapes(value: unknown): readonly PointPresetId[] {
  if (!Array.isArray(value)) return [...DEFAULT_SHAPES];
  const result: PointPresetId[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isPointPresetId(item)) continue;
    if (!result.includes(item)) result.push(item);
  }
  return result.length > 0 ? result : [...DEFAULT_SHAPES];
}

function readPin(value: unknown): Pt | null {
  const point = readPoint(value);
  if (!point) return null;
  if (point[0] < 0 || point[0] > PIN_LIMIT || point[1] < 0 || point[1] > PIN_LIMIT) return null;
  return point;
}

function readHalf(value: unknown): readonly Pt[] {
  if (!Array.isArray(value)) return DEFAULT_HALF;
  const result: Pt[] = [];
  for (const item of value) {
    const point = readPoint(item);
    if (!point) continue;
    if (point[0] < 0 || point[0] > 9 || point[1] < 0 || point[1] > 9) continue;
    result.push(point);
  }
  return result.length >= 2 ? result : DEFAULT_HALF;
}

function settingsOf(config: PointSymmetryConfig): PointSymmetrySettings {
  const task: PointTask = config.task === 'complete' ? 'complete' : 'pin';
  return {
    task,
    shapes: readShapes(config.shapes),
    pinAnywhere: config.pinAnywhere !== false,
    showArcs: config.showArcs !== false,
    center: readPin(config.center) ?? DEFAULT_CENTER,
    half: readHalf(config.half),
  };
}

export function createPointSymmetryState(config: PointSymmetryConfig): PointSymmetryState {
  const settings = settingsOf(config);
  return {
    mode: 'point-symmetry',
    task: settings.task,
    shapeIndex: 0,
    pin: null,
    turned: false,
    flipped: null,
    tries: [],
    centerFound: [],
    flipUsed: false,
    vertices: [],
    settings,
  };
}

export function currentPointShape(state: PointSymmetryState): PointPresetId {
  return state.settings.shapes[state.shapeIndex] ?? state.settings.shapes[0] ?? 'parallelogram';
}

/** 두 배 좌표 압정을 유리수 중심으로. */
export function pinCenter(pin: Pt): GPoint {
  return { x: Rational.of(pin[0], 2), y: Rational.of(pin[1], 2) };
}

function shapePoints(shape: PointPresetId): GPoint[] {
  return POLYGONS[shape].points.map((point) => gp(point[0], point[1]));
}

/** 지금 도형이 지금 압정에서 점대칭으로 겹치는지. 돌리기 전에는 거짓이다. */
export function pointOverlaps(state: PointSymmetryState): boolean {
  if (!state.pin || !state.turned) return false;
  const shape = currentPointShape(state);
  if (shape === 'regular-pentagon') return false;
  return polygonPointSymmetric(shapePoints(shape), pinCenter(state.pin));
}

export function isPointComplete(state: PointSymmetryState): boolean {
  const half = state.settings.half;
  const first = state.vertices[0];
  const last = state.vertices[state.vertices.length - 1];
  const startPoint = half[half.length - 1];
  const endPoint = half[0];
  if (!first || !last || !startPoint || !endPoint) return false;
  return (
    first[0] === startPoint[0] &&
    first[1] === startPoint[1] &&
    last[0] === endPoint[0] &&
    last[1] === endPoint[1]
  );
}

export function completedPointVertices(state: PointSymmetryState): Pt[] {
  const combined: Pt[] = [...state.settings.half, ...state.vertices];
  return combined.filter((point, index) => {
    const previous = combined[index - 1];
    return !previous || previous[0] !== point[0] || previous[1] !== point[1];
  });
}

function asGPoint(point: Pt): GPoint {
  return gp(point[0], point[1]);
}

export function reducePointSymmetry(
  state: PointSymmetryState,
  action: TransformAction,
): PointSymmetryState {
  switch (action.type) {
    case 'select-shape': {
      if (!Number.isInteger(action.index)) return state;
      if (action.index < 0 || action.index >= state.settings.shapes.length) return state;
      return {
        ...state,
        shapeIndex: action.index,
        pin: null,
        turned: false,
        flipped: null,
        vertices: [],
      };
    }
    case 'place-pin': {
      const point = readPin(action.at);
      if (!point) return state;
      if (!state.settings.pinAnywhere && (point[0] % 2 !== 0 || point[1] % 2 !== 0)) return state;
      return { ...state, pin: point, turned: false, flipped: null };
    }
    case 'turn-180': {
      if (!state.pin) return state;
      const next: PointSymmetryState = { ...state, turned: true, flipped: null };
      const shape = currentPointShape(next);
      const overlaps =
        shape !== 'regular-pentagon' &&
        polygonPointSymmetric(shapePoints(shape), pinCenter(next.pin as Pt));
      const pin = next.pin as Pt;
      const tries = [...next.tries, { shape, pin: [pin[0], pin[1]] as Pt, overlaps }];
      const centerFound =
        overlaps && !next.centerFound.includes(shape)
          ? [...next.centerFound, shape]
          : next.centerFound;
      return { ...next, tries, centerFound };
    }
    case 'flip': {
      const side: Side | null =
        action.side === 'up' ||
        action.side === 'down' ||
        action.side === 'left' ||
        action.side === 'right'
          ? action.side
          : null;
      if (!side) return state;
      return { ...state, flipped: side, turned: false, flipUsed: true };
    }
    case 'reset-turn': {
      if (!state.turned && !state.flipped) return state;
      return { ...state, turned: false, flipped: null };
    }
    case 'add-vertex': {
      if (state.settings.task !== 'complete') return state;
      const at = readPoint(action.at);
      if (!at || at[0] < 0 || at[0] > 9 || at[1] < 0 || at[1] > 9) return state;
      if (isPointComplete(state)) return state;
      const half = state.settings.half;
      const startPoint = half[half.length - 1];
      const endPoint = half[0];
      if (state.vertices.length === 0) {
        if (!startPoint || at[0] !== startPoint[0] || at[1] !== startPoint[1]) return state;
        return { ...state, vertices: [at] };
      }
      if (endPoint && at[0] === endPoint[0] && at[1] === endPoint[1]) {
        return { ...state, vertices: [...state.vertices, at] };
      }
      const last = state.vertices[state.vertices.length - 1];
      if (last && last[0] === at[0] && last[1] === at[1]) return state;
      return { ...state, vertices: [...state.vertices, at] };
    }
    case 'undo-vertex': {
      if (state.vertices.length === 0) return state;
      return { ...state, vertices: state.vertices.slice(0, -1) };
    }
    default:
      return state;
  }
}

function triesObservation(state: PointSymmetryState): JsonValue[] {
  return state.tries.map((attempt) => ({
    shape: attempt.shape,
    pin: [attempt.pin[0], attempt.pin[1]],
    overlaps: attempt.overlaps,
  }));
}

export function observePointSymmetry(state: PointSymmetryState): Observation {
  if (state.task === 'complete') {
    const closed = isPointComplete(state);
    const combined = completedPointVertices(state);
    const symmetric =
      closed && combined.length >= 3
        ? polygonPointSymmetric(combined.map(asGPoint), pinCenter(state.settings.center))
        : false;
    return {
      mode: state.mode,
      task: state.task,
      closed,
      symmetric,
    };
  }

  const shape = currentPointShape(state);
  const overlap = pointOverlaps(state);
  return {
    mode: state.mode,
    task: state.task,
    shape,
    pin: state.pin ? [state.pin[0], state.pin[1]] : null,
    turned: state.turned,
    overlaps: overlap,
    centerFound: [...state.centerFound],
    flipUsed: state.flipUsed,
    tries: triesObservation(state),
  };
}
