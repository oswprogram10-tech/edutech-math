/**
 * `slide-flip-turn` 모드: 밀기·뒤집기·돌리기를 직접 해 보고 잔상·호로 확인한다.
 *
 * 상태에는 이동 기록만 둔다. 지금 도형은 시작 도형에 앞선 이동을 차례로 적용해
 * 계산한다(JSON 직렬화 가능 상태 유지).
 */
import { clamp } from '../../../core/engine-sdk';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { centerIndexAt, centerLabelAt, applyMovesUpTo, appendMove } from '../moves';
import { orientCells, orientationOf } from '../orientation';
import { isOrientationValue, inGrid, safeInteger, sameCellSet, sortedCells } from '../square';
import { isShapeId, presetFigure } from '../shapes';
import type {
  Cell,
  Move,
  Pt,
  SlideFlipTurnConfig,
  SlideFlipTurnSettings,
  SlideFlipTurnState,
  SquareFigure,
  TransformAction,
} from '../types';
import {
  DEFAULT_AT,
  DEFAULT_GRID,
  DEFAULT_SHAPE,
  MAX_GRID,
  MIN_GRID,
  MOVE_KINDS,
  SIDES,
  TURN_ANGLES,
} from '../types';

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
  return [clamp(Math.round(x), 0, grid - 1), clamp(Math.round(y), 0, grid - 1)];
}

function readTarget(value: unknown, start: SquareFigure, grid: number): readonly Cell[] | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  const orientation = record['orientation'];
  if (typeof orientation !== 'string' || !isOrientationValue(orientation)) return null;
  const at = readAt(record['at'], [0, 0], grid);
  return orientCells(start.cells, orientation, at);
}

function readAllowed(value: unknown): readonly ('slide' | 'flip' | 'turn')[] {
  if (!Array.isArray(value)) return [...MOVE_KINDS];
  const result: ('slide' | 'flip' | 'turn')[] = [];
  for (const item of value) {
    if (item !== 'slide' && item !== 'flip' && item !== 'turn') continue;
    if (!result.includes(item)) result.push(item);
  }
  return result.length > 0 ? result : [...MOVE_KINDS];
}

function readTurnAngles(value: unknown): readonly (90 | 180 | 270)[] {
  if (!Array.isArray(value)) return [...TURN_ANGLES];
  const result: (90 | 180 | 270)[] = [];
  for (const item of value) {
    if (item !== 90 && item !== 180 && item !== 270) continue;
    if (!result.includes(item)) result.push(item);
  }
  return result.length > 0 ? result : [...TURN_ANGLES];
}

function settingsOf(config: SlideFlipTurnConfig, start: SquareFigure): SlideFlipTurnSettings {
  const grid = integer(config.grid, DEFAULT_GRID, MIN_GRID, MAX_GRID);
  const shape =
    typeof config.shape === 'string' && isShapeId(config.shape) ? config.shape : DEFAULT_SHAPE;
  return {
    shape,
    grid,
    at: readAt(config.at, DEFAULT_AT, grid),
    ghost: config.ghost !== false,
    arcTrail: config.arcTrail !== false,
    labels: config.labels !== false,
    allowed: readAllowed(config.allowed),
    turnAngles: readTurnAngles(config.turnAngles),
    target: readTarget(config.target, start, grid),
  };
}

export function createSlideFlipTurnState(config: SlideFlipTurnConfig): SlideFlipTurnState {
  const grid = integer(config.grid, DEFAULT_GRID, MIN_GRID, MAX_GRID);
  const shape =
    typeof config.shape === 'string' && isShapeId(config.shape) ? config.shape : DEFAULT_SHAPE;
  const at = readAt(config.at, DEFAULT_AT, grid);
  const start = presetFigure(shape, at);
  return {
    mode: 'slide-flip-turn',
    start,
    moves: [],
    center: 0,
    lastBlocked: false,
    blockedCount: 0,
    settings: settingsOf({ ...config, grid, shape, at }, start),
  };
}

/** 지금 도형. 상태에 따로 두지 않는다. */
export function currentFigure(state: SlideFlipTurnState): SquareFigure {
  return applyMovesUpTo(state.start, state.moves, state.moves.length);
}

/** 이동 `index` 직전 도형. */
export function figureBeforeMove(state: SlideFlipTurnState, index: number): SquareFigure {
  return applyMovesUpTo(state.start, state.moves, index);
}

function commitMove(state: SlideFlipTurnState, move: Move): SlideFlipTurnState {
  const moves = appendMove(state.moves, move);
  const next = applyMovesUpTo(state.start, moves, moves.length);
  if (!inGrid(next, state.settings.grid)) {
    return { ...state, lastBlocked: true, blockedCount: state.blockedCount + 1 };
  }
  return { ...state, moves, lastBlocked: false };
}

export function reduceSlideFlipTurn(
  state: SlideFlipTurnState,
  action: TransformAction,
): SlideFlipTurnState {
  switch (action.type) {
    case 'slide': {
      if (!state.settings.allowed.includes('slide')) return state;
      if (!Number.isSafeInteger(action.dx) || !Number.isSafeInteger(action.dy)) return state;
      if (action.dx === 0 && action.dy === 0) return { ...state, lastBlocked: false };
      return commitMove(state, { kind: 'slide', dx: action.dx, dy: action.dy });
    }
    case 'flip': {
      if (!state.settings.allowed.includes('flip')) return state;
      if (!SIDES.includes(action.side)) return state;
      return commitMove(state, { kind: 'flip', side: action.side });
    }
    case 'turn': {
      if (!state.settings.allowed.includes('turn')) return state;
      if (!state.settings.turnAngles.includes(action.angle)) return state;
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
      const before = currentFigure(state);
      if (centerIndexAt(before, center) === null) return state;
      return commitMove(state, {
        kind: 'turn',
        direction: action.direction,
        angle: action.angle,
        center,
      });
    }
    case 'select-center': {
      if (!Number.isInteger(action.index)) return state;
      if (action.index < 0 || action.index >= currentFigure(state).outline.length) return state;
      return { ...state, center: action.index, lastBlocked: false };
    }
    case 'undo-move': {
      return {
        ...state,
        moves: state.moves.slice(0, -1),
        lastBlocked: false,
      };
    }
    case 'reset': {
      return {
        ...state,
        moves: [],
        center: 0,
        lastBlocked: false,
        blockedCount: 0,
      };
    }
    default:
      return state;
  }
}

function boundsOf(cells: readonly Cell[]): { readonly minI: number; readonly minJ: number } {
  let minI = Number.POSITIVE_INFINITY;
  let minJ = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    if (cell[0] < minI) minI = cell[0];
    if (cell[1] < minJ) minJ = cell[1];
  }
  return { minI, minJ };
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

export function observeSlideFlipTurn(state: SlideFlipTurnState): Observation {
  const figure = currentFigure(state);
  const cells = sortedCells(figure.cells).map((cell) => `${cell[0]},${cell[1]}`);
  const { minI, minJ } = boundsOf(figure.cells);
  const moves = state.moves.map((move, index) =>
    moveObservation(move, applyMovesUpTo(state.start, state.moves, index)),
  );
  const kinds = new Set<string>();
  for (const move of state.moves) kinds.add(move.kind);
  const target = state.settings.target;
  return {
    mode: state.mode,
    cells,
    at: [minI, minJ],
    orientation: orientationOf(state.start.cells, figure.cells) ?? 'id',
    moves,
    moveCount: state.moves.length,
    kindsUsed: [...kinds].sort(),
    hasTarget: target !== null,
    atTarget: target !== null && sameCellSet(target, figure.cells),
    blockedCount: state.blockedCount,
  };
}
