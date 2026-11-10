/**
 * `predict` 모드: 결과 자리를 먼저 칠하고 확인하면 도형이 실제로 움직여 겹친다.
 *
 * 결과 도형은 상태에 두지 않는다. `observe`와 확인 뒤 화면에서만 계산한다.
 * 확인 전에는 결과 자리·결과 테두리·잔상·호를 어떤 방식으로도 그리지 않는다.
 */
import { clamp } from '../../../core/engine-sdk';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { applyMovesUpTo, centerLabelAt, resolveMoveSpecs } from '../moves';
import { orientationOf } from '../orientation';
import { sameCellSet, sortedCells } from '../square';
import { isShapeId, presetFigure } from '../shapes';
import type {
  Cell,
  Move,
  MoveSpec,
  PredictConfig,
  PredictSettings,
  PredictState,
  Pt,
  SquareFigure,
  TransformAction,
} from '../types';
import { DEFAULT_AT, DEFAULT_GRID, DEFAULT_SHAPE, MAX_GRID, MIN_GRID } from '../types';

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

const DEFAULT_OPERATION: MoveSpec = { type: 'slide', direction: 'right', cells: 3 };

function operationsOf(config: PredictConfig, start: SquareFigure): readonly Move[] {
  const raw = config.operation;
  const specs: MoveSpec[] = Array.isArray(raw)
    ? (raw.slice(0, 3) as MoveSpec[])
    : raw === undefined
      ? [DEFAULT_OPERATION]
      : [raw as MoveSpec];
  const chosen = specs.length > 0 ? specs : [DEFAULT_OPERATION];
  try {
    return resolveMoveSpecs(start, chosen);
  } catch {
    return resolveMoveSpecs(start, [DEFAULT_OPERATION]);
  }
}

function settingsOf(config: PredictConfig, grid: number): PredictSettings {
  const shape =
    typeof config.shape === 'string' && isShapeId(config.shape) ? config.shape : DEFAULT_SHAPE;
  return {
    shape,
    grid,
    at: readAt(config.at, DEFAULT_AT, grid),
    ghost: config.ghost !== false,
    arcTrail: config.arcTrail !== false,
    labels: config.labels !== false,
    showOperation: config.showOperation !== false,
  };
}

export function createPredictState(config: PredictConfig): PredictState {
  const grid = integer(config.grid, DEFAULT_GRID, MIN_GRID, MAX_GRID);
  const shape =
    typeof config.shape === 'string' && isShapeId(config.shape) ? config.shape : DEFAULT_SHAPE;
  const at = readAt(config.at, DEFAULT_AT, grid);
  const start = presetFigure(shape, at);
  return {
    mode: 'predict',
    start,
    operations: operationsOf(config, start),
    painted: [],
    confirmed: false,
    attempts: 0,
    settings: settingsOf(config, grid),
  };
}

export function figureAfterOperations(state: PredictState, count: number): SquareFigure {
  return applyMovesUpTo(state.start, state.operations, count);
}

export function resultFigure(state: PredictState): SquareFigure {
  return figureAfterOperations(state, state.operations.length);
}

function sanitizeCell(value: Cell, grid: number): Cell | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const i = value[0];
  const j = value[1];
  if (typeof i !== 'number' || typeof j !== 'number') return null;
  if (!Number.isInteger(i) || !Number.isInteger(j)) return null;
  if (i < 0 || j < 0 || i >= grid || j >= grid) return null;
  return [i, j];
}

function paintCells(state: PredictState, cells: readonly Cell[], value: boolean): PredictState {
  const grid = state.settings.grid;
  const found = new Map<string, Cell>();
  for (const cell of state.painted) found.set(`${cell[0]},${cell[1]}`, cell);
  for (const raw of cells) {
    const cell = sanitizeCell(raw, grid);
    if (!cell) continue;
    const key = `${cell[0]},${cell[1]}`;
    if (value) found.set(key, cell);
    else found.delete(key);
  }
  return { ...state, painted: sortedCells([...found.values()]) };
}

export function reducePredict(state: PredictState, action: TransformAction): PredictState {
  switch (action.type) {
    case 'toggle-cell': {
      if (state.confirmed) return state;
      const cell = sanitizeCell(action.cell, state.settings.grid);
      if (!cell) return state;
      const exists = state.painted.some(
        (candidate) => candidate[0] === cell[0] && candidate[1] === cell[1],
      );
      return paintCells(state, [cell], !exists);
    }
    case 'paint': {
      if (state.confirmed) return state;
      if (!Array.isArray(action.cells)) return state;
      return paintCells(state, action.cells, action.value === true);
    }
    case 'clear-paint': {
      if (state.confirmed) return state;
      if (state.painted.length === 0) return state;
      return { ...state, painted: [] };
    }
    case 'confirm': {
      if (state.confirmed) return state;
      if (state.painted.length === 0) return state;
      return { ...state, confirmed: true, attempts: state.attempts + 1 };
    }
    case 'retry': {
      if (!state.confirmed && state.painted.length === 0) return state;
      return { ...state, confirmed: false, painted: [] };
    }
    default:
      return state;
  }
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

export function observePredict(state: PredictState): Observation {
  const result = resultFigure(state);
  const operations = state.operations.map((move, index) =>
    moveObservation(move, applyMovesUpTo(state.start, state.operations, index)),
  );
  const painted = sortedCells(state.painted);
  const matches = sameCellSet(result.cells, state.painted);
  const paintedOrientation = orientationOf(state.start.cells, state.painted);
  const expectedOrientation = orientationOf(state.start.cells, result.cells) ?? 'id';
  return {
    mode: state.mode,
    operations,
    painted: painted.map((cell) => `${cell[0]},${cell[1]}`),
    paintedCount: painted.length,
    confirmed: state.confirmed,
    attempts: state.attempts,
    matches,
    paintedOrientation,
    expectedOrientation,
    offsetOnly:
      paintedOrientation !== null && paintedOrientation === expectedOrientation && !matches,
  };
}
