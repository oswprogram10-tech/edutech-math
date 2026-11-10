/**
 * angle-gather의 순수 reducer.
 *
 * 모양 단계에서는 꼭짓점을 정수 못으로만 옮긴다. 자르기 단계에서는 각 조각을
 * 모으고 0°/180°로만 돌린다. 각도 값은 계산하지 않고 부채꼴의 방향만 본다.
 */
import { gp, isConvexPolygon, polygonArea } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { fanState } from './fan';
import type {
  AngleGatherAction,
  AngleGatherConfig,
  AngleGatherState,
  AngleGatherSettings,
  Corner,
  Peg,
} from './types';

const PEG_MAX = 12;

export const DEFAULT_TRIANGLE: readonly Peg[] = [
  [1, 10],
  [10, 10],
  [4, 3],
];

export const DEFAULT_QUADRILATERAL: readonly Peg[] = [
  [1, 10],
  [10, 11],
  [9, 3],
  [3, 2],
];

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Readonly<Record<string, unknown>>;
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function pegOf(value: unknown): Peg | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = value[0];
  const y = value[1];
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 0 || x > PEG_MAX || y < 0 || y > PEG_MAX) return null;
  return [x, y];
}

function pointsOf(vertices: readonly Peg[]): GPoint[] {
  return vertices.map((peg) => gp(peg[0], peg[1]));
}

function validVertices(vertices: readonly Peg[], shape: 'triangle' | 'quadrilateral'): boolean {
  const count = shape === 'triangle' ? 3 : 4;
  if (vertices.length !== count) return false;
  for (let first = 0; first < vertices.length; first += 1) {
    const a = vertices[first];
    if (!a) return false;
    for (let second = first + 1; second < vertices.length; second += 1) {
      const b = vertices[second];
      if (b && a[0] === b[0] && a[1] === b[1]) return false;
    }
  }
  const points = pointsOf(vertices);
  if (polygonArea(points).isZero()) return false;
  return isConvexPolygon(points);
}

function sanitizeVertices(value: unknown, shape: 'triangle' | 'quadrilateral'): readonly Peg[] {
  if (!Array.isArray(value)) return shape === 'triangle' ? DEFAULT_TRIANGLE : DEFAULT_QUADRILATERAL;
  const vertices: Peg[] = [];
  for (const item of value) {
    const peg = pegOf(item);
    if (!peg) return shape === 'triangle' ? DEFAULT_TRIANGLE : DEFAULT_QUADRILATERAL;
    vertices.push(peg);
  }
  if (!validVertices(vertices, shape)) {
    return shape === 'triangle' ? DEFAULT_TRIANGLE : DEFAULT_QUADRILATERAL;
  }
  return vertices;
}

function settingsOf(config: AngleGatherConfig): AngleGatherSettings {
  const shape: 'triangle' | 'quadrilateral' =
    config.shape === 'quadrilateral' ? 'quadrilateral' : 'triangle';
  return {
    shape,
    deformable: typeof config.deformable === 'boolean' ? config.deformable : true,
    showSum: config.showSum === 'after-gather' ? 'after-gather' : 'never',
    repeatTrials: integer(config.repeatTrials, 1, 1, 5),
  };
}

export function createAngleGatherState(config: unknown): AngleGatherState {
  const record = (recordOf(config) ?? {}) as AngleGatherConfig;
  const settings = settingsOf(record);
  return {
    mode: 'angle-gather',
    vertices: sanitizeVertices(record.vertices, settings.shape),
    phase: 'shape',
    corners: [],
    recorded: false,
    trials: [],
    settings,
  };
}

/** 지금 `to`로 옮겨도 되는지. View가 "모양이 찌그러져요" 문구를 띄울 때도 쓴다. */
export function vertexMoveAllowed(state: AngleGatherState, index: number, to: Peg): boolean {
  if (state.phase !== 'shape' || !state.settings.deformable) return false;
  const target = pegOf(to);
  if (!target) return false;
  if (index < 0 || index >= state.vertices.length) return false;
  for (let position = 0; position < state.vertices.length; position += 1) {
    if (position === index) continue;
    const other = state.vertices[position];
    if (other && other[0] === target[0] && other[1] === target[1]) return false;
  }
  const next = state.vertices.map((peg, position) => (position === index ? target : peg));
  const points = pointsOf(next);
  if (polygonArea(points).isZero()) return false;
  return isConvexPolygon(points);
}

function recordIfComplete(state: AngleGatherState): AngleGatherState {
  const fan = fanState(state);
  if (fan !== 'straight' && fan !== 'full') return state;
  if (state.recorded) return state;
  const sum: 180 | 360 = fan === 'straight' ? 180 : 360;
  const trial = {
    vertices: state.vertices.map((peg) => [peg[0], peg[1]] as Peg),
    sum,
  };
  return {
    ...state,
    recorded: true,
    trials: state.trials.length >= 10 ? state.trials : [...state.trials, trial],
  };
}

function updateCorner(
  state: AngleGatherState,
  index: number,
  update: (corner: Corner) => Corner,
): AngleGatherState {
  if (state.phase !== 'cut') return state;
  if (!state.corners.some((corner) => corner.index === index)) return state;
  return {
    ...state,
    corners: state.corners.map((corner) => (corner.index === index ? update(corner) : corner)),
  };
}

export function reduceAngleGather(
  state: AngleGatherState,
  action: AngleGatherAction,
): AngleGatherState {
  switch (action.type) {
    case 'move-vertex': {
      if (!vertexMoveAllowed(state, action.index, action.to)) return state;
      const current = state.vertices[action.index];
      if (current && current[0] === action.to[0] && current[1] === action.to[1]) return state;
      return {
        ...state,
        vertices: state.vertices.map((peg, position) =>
          position === action.index ? ([action.to[0], action.to[1]] as Peg) : peg,
        ),
      };
    }

    case 'cut-corners': {
      if (state.phase === 'cut') return state;
      return {
        ...state,
        phase: 'cut',
        recorded: false,
        corners: state.vertices.map((_, index) => ({
          index,
          gathered: false,
          turned: false,
        })),
      };
    }

    case 'gather-corner': {
      const next = updateCorner(state, action.index, (corner) => ({
        ...corner,
        gathered: true,
        turned: action.turned === true,
      }));
      return next === state ? state : recordIfComplete(next);
    }

    case 'ungather-corner': {
      return updateCorner(state, action.index, (corner) => ({ ...corner, gathered: false }));
    }

    case 'turn-corner': {
      return updateCorner(state, action.index, (corner) =>
        corner.gathered ? { ...corner, turned: !corner.turned } : corner,
      );
    }

    case 'new-trial': {
      return {
        ...state,
        phase: 'shape',
        corners: [],
        recorded: false,
      };
    }

    default:
      return state;
  }
}
