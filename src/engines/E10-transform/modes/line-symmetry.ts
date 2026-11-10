/**
 * `line-symmetry` 모드: 대칭축 찾기·데칼코마니·반쪽 완성하기.
 *
 * 판정은 `src/core/math/geometry.ts`의 정확한 기하 도우미만 쓴다. 접은 그림은
 * 화면 계산이며, 학생이 접기 전에는 축의 정답·개수를 그리지 않는다.
 */
import { gp, lineKey, orientation, polygonMirrorSymmetric } from '../../../core/math';
import type { GPoint, PlaneMetric } from '../../../core/math';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { POLYGONS, isLinePresetId } from '../polygons';
import type { LinePresetId } from '../polygons';
import type {
  DecalDot,
  FoldRecord,
  LineSymmetryConfig,
  LineSymmetrySettings,
  LineSymmetryState,
  LineTask,
  Pt,
  TransformAction,
} from '../types';

const DEFAULT_SHAPES: readonly LinePresetId[] = [
  'rectangle',
  'parallelogram',
  'regular-hexagon',
  'isosceles-trapezoid',
];

const DEFAULT_AXIS: readonly [Pt, Pt] = [
  [4, 0],
  [4, 8],
];

const DEFAULT_HALF: readonly Pt[] = [
  [4, 1],
  [2, 2],
  [1, 5],
  [3, 7],
  [4, 7],
];

/** 점판의 점 하나가 범위 안인지. 삼각 점판은 줄과 축 좌표로 본다. */
export function linePointOnBoard(shape: LinePresetId, point: Pt): boolean {
  const [a, b] = point;
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return false;
  if (POLYGONS[shape].board !== 'tri') return a >= 0 && b >= 0 && a <= 8 && b <= 8;
  if (b < 0 || b > 6) return false;
  const start = -Math.floor(b / 2);
  return a >= start && a <= start + 8;
}

function readPoint(value: unknown): Pt | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = value[0];
  const y = value[1];
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  return [x, y];
}

function readHalf(value: unknown): readonly Pt[] {
  if (!Array.isArray(value)) return DEFAULT_HALF;
  const result: Pt[] = [];
  for (const item of value) {
    const point = readPoint(item);
    if (!point) continue;
    if (point[0] < 0 || point[0] > 8 || point[1] < 0 || point[1] > 8) continue;
    result.push(point);
  }
  return result.length >= 2 ? result : DEFAULT_HALF;
}

function readAxis(value: unknown): readonly [Pt, Pt] {
  if (!Array.isArray(value) || value.length < 2) return DEFAULT_AXIS;
  const from = readPoint(value[0]);
  const to = readPoint(value[1]);
  if (!from || !to) return DEFAULT_AXIS;
  return [from, to];
}

function readShapes(value: unknown): readonly LinePresetId[] {
  if (!Array.isArray(value)) return [...DEFAULT_SHAPES];
  const result: LinePresetId[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isLinePresetId(item)) continue;
    if (!result.includes(item)) result.push(item);
  }
  return result.length > 0 ? result : [...DEFAULT_SHAPES];
}

function settingsOf(config: LineSymmetryConfig): LineSymmetrySettings {
  const task: LineTask =
    config.task === 'decalcomania' || config.task === 'complete' ? config.task : 'find-axis';
  return {
    task,
    shapes: readShapes(config.shapes),
    allowDrawAxis: config.allowDrawAxis !== false,
    foldPreview: config.foldPreview !== false,
    axis: readAxis(config.axis),
    half: readHalf(config.half),
  };
}

export function createLineSymmetryState(config: LineSymmetryConfig): LineSymmetryState {
  const settings = settingsOf(config);
  return {
    mode: 'line-symmetry',
    task: settings.task,
    shapeIndex: 0,
    pending: null,
    axis: null,
    folds: [],
    showing: null,
    dots: [],
    folded: false,
    vertices: [],
    settings,
  };
}

/** 지금 도형 프리셋 id. */
export function currentLineShape(state: LineSymmetryState): LinePresetId {
  return state.settings.shapes[state.shapeIndex] ?? state.settings.shapes[0] ?? 'rectangle';
}

function asGPoint(point: Pt): GPoint {
  return gp(point[0], point[1]);
}

function axisPairs(state: LineSymmetryState): [Pt, Pt] | null {
  if (!state.axis) return null;
  return [state.axis[0], state.axis[1]];
}

function isOnSegment(point: Pt, a: Pt, b: Pt): boolean {
  const p = asGPoint(point);
  if (orientation(asGPoint(a), asGPoint(b), p) !== 0) return false;
  const minX = Math.min(a[0], b[0]);
  const maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]);
  const maxY = Math.max(a[1], b[1]);
  return point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY;
}

/** 축 위에 서로 이웃하지 않은 꼭짓점 둘이 있는지. 대각선 접기 감지에 쓴다. */
function isDiagonalAxis(shape: LinePresetId, a: Pt, b: Pt): boolean {
  const points = POLYGONS[shape].points;
  const onAxis: number[] = [];
  points.forEach((point, index) => {
    if (isOnSegment(point, a, b)) onAxis.push(index);
  });
  const count = points.length;
  for (let left = 0; left < onAxis.length; left += 1) {
    for (let right = left + 1; right < onAxis.length; right += 1) {
      const first = onAxis[left];
      const second = onAxis[right];
      if (first === undefined || second === undefined) continue;
      const adjacent = (first + 1) % count === second || (second + 1) % count === first;
      if (!adjacent) return true;
    }
  }
  return false;
}

function foldRecord(state: LineSymmetryState): FoldRecord | null {
  const axis = axisPairs(state);
  if (!axis) return null;
  const shape = currentLineShape(state);
  const preset = POLYGONS[shape];
  const metric: PlaneMetric = preset.metric;
  const ok = polygonMirrorSymmetric(
    preset.points.map(asGPoint),
    asGPoint(axis[0]),
    asGPoint(axis[1]),
    metric,
  );
  return {
    shape,
    from: axis[0],
    to: axis[1],
    ok,
    diagonal: isDiagonalAxis(shape, axis[0], axis[1]),
    key: lineKey(asGPoint(axis[0]), asGPoint(axis[1])),
  };
}

/** complete 과제의 학생 경로와 반쪽을 합친 꼭짓점. 이어진 중복은 지운다. */
export function completedVertices(state: LineSymmetryState): Pt[] {
  const combined: Pt[] = [...state.settings.half, ...state.vertices];
  return combined.filter((point, index) => {
    const previous = combined[index - 1];
    return !previous || previous[0] !== point[0] || previous[1] !== point[1];
  });
}

export function isLineComplete(state: LineSymmetryState): boolean {
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

export function reduceLineSymmetry(
  state: LineSymmetryState,
  action: TransformAction,
): LineSymmetryState {
  switch (action.type) {
    case 'select-shape': {
      if (!Number.isInteger(action.index)) return state;
      if (action.index < 0 || action.index >= state.settings.shapes.length) return state;
      return { ...state, shapeIndex: action.index, pending: null, axis: null, showing: null };
    }
    case 'pick-point': {
      const shape = currentLineShape(state);
      const at = readPoint(action.at);
      if (!at || !linePointOnBoard(shape, at)) return state;
      if (state.axis) {
        return { ...state, axis: null, showing: null, pending: at };
      }
      if (!state.pending) return { ...state, pending: at };
      if (state.pending[0] === at[0] && state.pending[1] === at[1]) return state;
      return { ...state, pending: null, axis: [state.pending, at] };
    }
    case 'clear-axis':
      if (!state.axis && !state.pending && state.showing === null) return state;
      return { ...state, axis: null, pending: null, showing: null };
    case 'fold': {
      if (state.settings.task !== 'find-axis') return state;
      if (!state.settings.allowDrawAxis) return state;
      const record = foldRecord(state);
      if (!record) return state;
      const folds = [...state.folds, record];
      return { ...state, folds, showing: folds.length - 1 };
    }
    case 'unfold': {
      if (state.showing === null) return state;
      return { ...state, showing: null };
    }
    case 'add-dot': {
      if (state.settings.task !== 'decalcomania') return state;
      const at = readPoint(action.at);
      if (!at) return state;
      if (at[0] < 0 || at[0] > 4 || at[1] < 0 || at[1] > 6) return state;
      if (action.mark !== 0 && action.mark !== 1 && action.mark !== 2 && action.mark !== 3) {
        return state;
      }
      const dot: DecalDot = { at, mark: action.mark };
      const dots = state.dots.filter(
        (candidate) => candidate.at[0] !== at[0] || candidate.at[1] !== at[1],
      );
      return { ...state, dots: [...dots, dot], folded: false };
    }
    case 'remove-dot': {
      const at = readPoint(action.at);
      if (!at) return state;
      const dots = state.dots.filter(
        (candidate) => candidate.at[0] !== at[0] || candidate.at[1] !== at[1],
      );
      if (dots.length === state.dots.length) return state;
      return { ...state, dots };
    }
    case 'fold-paper': {
      if (state.settings.task !== 'decalcomania' || state.folded) return state;
      return { ...state, folded: true };
    }
    case 'unfold-paper': {
      if (!state.folded) return state;
      return { ...state, folded: false };
    }
    case 'add-vertex': {
      if (state.settings.task !== 'complete') return state;
      const at = readPoint(action.at);
      if (!at || !linePointOnBoard('rectangle', at)) return state;
      if (isLineComplete(state)) return state;
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

function foldObservation(record: FoldRecord): JsonValue {
  return {
    shape: record.shape,
    from: [record.from[0], record.from[1]],
    to: [record.to[0], record.to[1]],
    ok: record.ok,
    diagonal: record.diagonal,
    key: record.key,
  };
}

export function observeLineSymmetry(state: LineSymmetryState): Observation {
  if (state.task === 'decalcomania') {
    return {
      mode: state.mode,
      task: state.task,
      dots: state.dots.map((dot) => ({
        at: [dot.at[0], dot.at[1]],
        mark: dot.mark,
      })),
      folded: state.folded,
    };
  }
  if (state.task === 'complete') {
    const closed = isLineComplete(state);
    const combined = completedVertices(state);
    const axis = state.settings.axis;
    const symmetric =
      closed && combined.length >= 3
        ? polygonMirrorSymmetric(
            combined.map(asGPoint),
            asGPoint(axis[0]),
            asGPoint(axis[1]),
            'euclid',
          )
        : false;
    return {
      mode: state.mode,
      task: state.task,
      closed,
      symmetric,
    };
  }

  const shapeIds = state.settings.shapes;
  const summary = shapeIds.map((id) => {
    const own = state.folds.filter((fold) => fold.shape === id);
    const keys = new Set(own.filter((fold) => fold.ok).map((fold) => fold.key));
    return {
      id,
      axesFound: keys.size,
      folds: own.length,
      diagonalTried: own.some((fold) => fold.diagonal),
    };
  });
  const showingFold =
    state.showing !== null ? state.folds[state.showing] : state.folds[state.folds.length - 1];
  return {
    mode: state.mode,
    task: state.task,
    shape: currentLineShape(state),
    shapes: summary,
    lastFold: showingFold ? { ok: showingFold.ok, diagonal: showingFold.diagonal } : null,
    folds: state.folds.map(foldObservation),
    axis: state.axis
      ? [
          [state.axis[0][0], state.axis[0][1]],
          [state.axis[1][0], state.axis[1][1]],
        ]
      : null,
    pending: state.pending ? [state.pending[0], state.pending[1]] : null,
  };
}
