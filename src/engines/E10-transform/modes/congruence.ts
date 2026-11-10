/**
 * `congruence` 모드: 움직이는 도형을 밀고·뒤집고·돌려 고정 도형에 포갠다.
 *
 * 겹침은 꼭짓점 집합이 정확히 같다는 `samePolygon`으로, 합동 여부는
 * `congruentPolygons`로 판정한다(Observation에만). 대응 표시는 학생이 실제로
 * 겹친 뒤에만 만든다.
 */
import { congruentPolygons, gp, polygonArea, samePolygon } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { clamp } from '../../../core/engine-sdk';
import { applyMovesUpTo, appendMove, centerLabelAt, clampCenter } from '../moves';
import { orientPoints } from '../orientation';
import { isCongruencePresetId, presetPoints } from '../polygons';
import { isOrientationValue, safeInteger } from '../square';
import type {
  CongruenceConfig,
  CongruenceSettings,
  CongruenceState,
  Move,
  Orientation,
  Pt,
  SquareFigure,
  TransformAction,
} from '../types';

const DEFAULT_GRID = 12;
const DEFAULT_FIXED_AT: Pt = [7, 2];
const DEFAULT_MOVING_AT: Pt = [1, 6];

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

function readAt(value: unknown, fallback: Pt, grid: number): Pt {
  if (!Array.isArray(value) || value.length < 2) return fallback;
  const x = value[0];
  const y = value[1];
  if (typeof x !== 'number' || typeof y !== 'number') return fallback;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  return [clamp(Math.round(x), 0, grid), clamp(Math.round(y), 0, grid)];
}

function readPointsRef(value: unknown): readonly Pt[] | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  const points = record['points'];
  if (!Array.isArray(points) || points.length < 3) return null;
  const result: Pt[] = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const x = point[0];
    const y = point[1];
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
    result.push([x, y]);
  }
  return result;
}

function readShape(value: unknown, fallback: readonly Pt[]): readonly Pt[] {
  const custom = readPointsRef(value);
  if (custom) return custom;
  if (typeof value === 'string' && isCongruencePresetId(value)) return presetPoints(value);
  return fallback;
}

function readOrientation(value: unknown): Orientation {
  return typeof value === 'string' && isOrientationValue(value) ? value : 'cw90';
}

function settingsFor(config: CongruenceConfig): CongruenceSettings {
  const grid = integer(config.grid, DEFAULT_GRID, 8, 14);
  const fallback = presetPoints('quad-a');
  const fixedBase = readShape(config.fixed, fallback);
  const movingBase = readShape(config.moving, fallback);
  const fixedOrientation = readOrientation(config.fixedOrientation);
  const fixed = orientPoints(
    fixedBase,
    fixedOrientation,
    readAt(config.fixedAt, DEFAULT_FIXED_AT, grid),
  );
  const movingStart = orientPoints(
    movingBase,
    'id',
    readAt(config.movingAt, DEFAULT_MOVING_AT, grid),
  );
  return {
    grid,
    fixed,
    fixedOrientation,
    movingStart,
    showCorrespondence: config.showCorrespondence === 'never' ? 'never' : 'after-overlap',
    pairSides: config.pairSides === true,
  };
}

export function createCongruenceState(config: CongruenceConfig): CongruenceState {
  const settings = settingsFor(config);
  return {
    mode: 'congruence',
    fixed: settings.fixed,
    movingStart: settings.movingStart,
    moves: [],
    center: 0,
    correspondence: null,
    everOverlapped: false,
    sidePairs: [],
    settings,
  };
}

export function currentMoving(state: CongruenceState): SquareFigure {
  return applyMovesUpTo({ outline: state.movingStart, cells: [] }, state.moves, state.moves.length);
}

export function movingBeforeMove(state: CongruenceState, index: number): SquareFigure {
  return applyMovesUpTo({ outline: state.movingStart, cells: [] }, state.moves, index);
}

function pointsInGrid(points: readonly Pt[], grid: number): boolean {
  return points.every(
    (point) =>
      Number.isSafeInteger(point[0]) &&
      Number.isSafeInteger(point[1]) &&
      point[0] >= 0 &&
      point[1] >= 0 &&
      point[0] <= grid &&
      point[1] <= grid,
  );
}

function asGPoints(points: readonly Pt[]): GPoint[] {
  return points.map((point) => gp(point[0], point[1]));
}

function keyOf(point: Pt): string {
  return `${point[0]},${point[1]}`;
}

function correspondenceOf(moving: readonly Pt[], fixed: readonly Pt[]): number[] | null {
  const lookup = new Map<string, number>();
  fixed.forEach((point, index) => lookup.set(keyOf(point), index));
  const result: number[] = [];
  const used = new Set<number>();
  for (const point of moving) {
    const index = lookup.get(keyOf(point));
    if (index === undefined || used.has(index)) return null;
    used.add(index);
    result.push(index);
  }
  return result;
}

function withOverlapCheck(state: CongruenceState, nextMoves: readonly Move[]): CongruenceState {
  const next: CongruenceState = { ...state, moves: nextMoves };
  const moving = currentMoving(next);
  if (!pointsInGrid(moving.outline, state.settings.grid)) return state;
  if (!samePolygon(asGPoints(moving.outline), asGPoints(state.fixed))) return next;
  const correspondence = correspondenceOf(moving.outline, state.fixed);
  if (!correspondence) return next;
  return { ...next, correspondence, everOverlapped: true };
}

export function reduceCongruence(state: CongruenceState, action: TransformAction): CongruenceState {
  switch (action.type) {
    case 'slide': {
      if (!Number.isSafeInteger(action.dx) || !Number.isSafeInteger(action.dy)) return state;
      if (action.dx === 0 && action.dy === 0) return state;
      return withOverlapCheck(
        state,
        appendMove(state.moves, { kind: 'slide', dx: action.dx, dy: action.dy }),
      );
    }
    case 'flip': {
      if (
        action.side !== 'up' &&
        action.side !== 'down' &&
        action.side !== 'left' &&
        action.side !== 'right'
      ) {
        return state;
      }
      return withOverlapCheck(state, appendMove(state.moves, { kind: 'flip', side: action.side }));
    }
    case 'turn': {
      if (action.angle !== 90 && action.angle !== 180 && action.angle !== 270) return state;
      if (action.direction !== 'cw' && action.direction !== 'ccw') return state;
      if (!Array.isArray(action.center)) return state;
      let center: Pt;
      try {
        center = [
          safeInteger(action.center[0], 'center.x'),
          safeInteger(action.center[1], 'center.y'),
        ];
      } catch {
        return state;
      }
      const before = currentMoving(state);
      if (!before.outline.some((point) => point[0] === center[0] && point[1] === center[1]))
        return state;
      return withOverlapCheck(
        state,
        appendMove(state.moves, {
          kind: 'turn',
          direction: action.direction,
          angle: action.angle,
          center,
        }),
      );
    }
    case 'select-center': {
      if (!Number.isInteger(action.index)) return state;
      const count = state.movingStart.length;
      if (count === 0) return state;
      return { ...state, center: clampCenter(action.index, state.movingStart) };
    }
    case 'undo-move': {
      if (state.moves.length === 0) return state;
      return { ...state, moves: state.moves.slice(0, -1) };
    }
    case 'reset-moving': {
      if (state.moves.length === 0) return state;
      return { ...state, moves: [], center: 0 };
    }
    case 'pair-sides': {
      const movingCount = state.movingStart.length;
      const fixedCount = state.fixed.length;
      if (
        !Number.isInteger(action.moving) ||
        !Number.isInteger(action.fixed) ||
        action.moving < 0 ||
        action.fixed < 0 ||
        action.moving >= movingCount ||
        action.fixed >= fixedCount
      ) {
        return state;
      }
      const filtered = state.sidePairs.filter(
        ([moving, fixed]) => moving !== action.moving && fixed !== action.fixed,
      );
      return { ...state, sidePairs: [...filtered, [action.moving, action.fixed]] };
    }
    case 'unpair': {
      if (!state.sidePairs.some(([moving]) => moving === action.moving)) return state;
      return {
        ...state,
        sidePairs: state.sidePairs.filter(([moving]) => moving !== action.moving),
      };
    }
    default:
      return state;
  }
}

function sidePairsCorrect(
  state: CongruenceState,
  correspondence: readonly number[] | null,
): boolean {
  if (!correspondence) return false;
  const count = correspondence.length;
  if (count === 0 || state.sidePairs.length !== count) return false;
  for (const [moving, fixed] of state.sidePairs) {
    if (moving < 0 || moving >= count || fixed < 0 || fixed >= count) return false;
    const first = correspondence[moving];
    const second = correspondence[(moving + 1) % count];
    const targetFirst = fixed;
    const targetSecond = (fixed + 1) % count;
    if (first === undefined || second === undefined) return false;
    const forward = first === targetFirst && second === targetSecond;
    const backward = first === targetSecond && second === targetFirst;
    if (!forward && !backward) return false;
  }
  return true;
}

function moveObservation(move: Move, before: SquareFigure): JsonValue {
  switch (move.kind) {
    case 'slide':
      return { kind: 'slide', dx: move.dx, dy: move.dy };
    case 'flip':
      return { kind: 'flip', side: move.side };
    case 'turn':
      return {
        kind: 'turn',
        direction: move.direction,
        angle: move.angle,
        center: [move.center[0], move.center[1]],
        centerLabel: centerLabelAt(before, move.center),
      };
  }
}

export function observeCongruence(state: CongruenceState): Observation {
  const moving = currentMoving(state);
  const overlapped = samePolygon(asGPoints(moving.outline), asGPoints(state.fixed));
  const kinds = new Set<string>();
  for (const move of state.moves) kinds.add(move.kind);
  return {
    mode: state.mode,
    overlapped,
    everOverlapped: state.everOverlapped,
    congruent: congruentPolygons(asGPoints(moving.outline), asGPoints(state.fixed)),
    moves: state.moves.map((move, index) => moveObservation(move, movingBeforeMove(state, index))),
    kindsUsed: [...kinds].sort(),
    correspondence: state.correspondence ? [...state.correspondence] : null,
    sidePairs: state.sidePairs.map((pair) => [pair[0], pair[1]]),
    sidePairsCorrect: sidePairsCorrect(state, state.correspondence),
    fixedArea: polygonArea(asGPoints(state.fixed)).toString(),
    movingArea: polygonArea(asGPoints(moving.outline)).toString(),
  };
}
