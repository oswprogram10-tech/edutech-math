/**
 * tangram의 순수 reducer. 조각의 자리·돌리기·뒤집기는 모두 `Surd` 정확 계산이다.
 * 판 밖으로 나가는 Action은 무시한다.
 */
import {
  defaultRotationStep,
  isKindOf,
  kindDefinition,
  orientedBase,
  pieceDefinitions,
  setD,
} from './pieces';
import type { PieceKind, PieceSet } from './pieces';
import { silhouetteIds } from './silhouettes';
import { sAdd, sCompare, sFromJson, sInt, sSub, sToJson } from './surd';
import type { SurdD } from './surd';
import type { SPoint } from './surd-geometry';
import { sAverage, sRotate } from './surd-geometry';
import { assignTraySlots, tangramKindsForConfig } from './tray';
import type {
  TangramAction,
  TangramConfig,
  TangramPiece,
  TangramSettings,
  TangramState,
  SPointJson,
} from './types';

const BOARD_MAX_X = 28;
const BOARD_MAX_Y = 18;
const MAX_PATTERN_PIECES = 24;

function pieceSetOf(value: unknown): PieceSet {
  return value === 'pattern-blocks' ? 'pattern-blocks' : 'tangram';
}

function snapTolerance(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 24;
  return Math.max(8, Math.min(48, value));
}

function rotationStepOf(value: unknown, set: PieceSet): number {
  const allowed = set === 'tangram' ? [45, 90] : [30, 60, 90];
  if (typeof value === 'number' && allowed.includes(value)) return value;
  return defaultRotationStep(set);
}

function silhouetteIdOf(value: unknown, set: PieceSet): string {
  const ids = silhouetteIds(set);
  if (value === 'none') return 'none';
  if (typeof value === 'string' && ids.includes(value)) return value;
  return 'house';
}

function settingsOf(config: TangramConfig): TangramSettings {
  const pieceSet = pieceSetOf(config.pieceSet);
  return {
    pieceSet,
    silhouette: silhouetteIdOf(config.silhouette, pieceSet),
    snapTolerancePx: snapTolerance(config.snapTolerancePx),
    rotationStep: rotationStepOf(config.rotationStep, pieceSet),
    showPieceOutlines:
      config.showPieceOutlines === true || config.showPieceOutlines === 'first-task-only',
    allowFlip: config.allowFlip !== false,
    selectMode: config.selectMode === true,
    d: setD(pieceSet),
  };
}

function turnsOf(step: number): number {
  return Math.max(1, Math.round(360 / step));
}

function normalizeRot(value: unknown, step: number): number {
  const turns = turnsOf(step);
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return ((Math.trunc(value) % turns) + turns) % turns;
}

function jsonOf(point: SPoint, d: SurdD): SPointJson {
  return [sToJson({ ...point.x, d }), sToJson({ ...point.y, d })];
}

function pointOf(json: SPointJson, d: SurdD): SPoint | null {
  try {
    return {
      x: sFromJson(json[0], d),
      y: sFromJson(json[1], d),
    };
  } catch {
    return null;
  }
}

function withinBoard(points: readonly SPoint[]): boolean {
  return points.every(
    (point) =>
      sCompare(point.x, sInt(0, point.x.d)) >= 0 &&
      sCompare(point.x, sInt(BOARD_MAX_X, point.x.d)) <= 0 &&
      sCompare(point.y, sInt(0, point.y.d)) >= 0 &&
      sCompare(point.y, sInt(BOARD_MAX_Y, point.y.d)) <= 0,
  );
}

/** 설정 `pieces`를 조각 목록으로. 패턴 블록은 무시하고 빈 판에서 시작한다. */
function initialPieces(config: TangramConfig, settings: TangramSettings): TangramPiece[] {
  if (settings.pieceSet === 'pattern-blocks') return [];
  const configured = Array.isArray(config.pieces) ? config.pieces : [];
  const kinds = tangramKindsForConfig(configured);
  const slots = assignTraySlots(settings.pieceSet, kinds);
  return slots.map((slot, index) => {
    const item = configured[index];
    const object = typeof item === 'object' && item !== null ? item : null;
    const kind = object?.kind ?? (typeof item === 'string' ? item : slot.kind);
    const validKind: PieceKind = isKindOf(settings.pieceSet, kind)
      ? kind
      : (slot.kind as PieceKind);
    return {
      id: `p${index + 1}`,
      kind: validKind,
      rot: normalizeRot(object?.rot, settings.rotationStep),
      flip: object?.flip === true,
      at: jsonOf(slot.at, settings.d),
    } satisfies TangramPiece;
  });
}

export function createTangramState(config: TangramConfig): TangramState {
  const settings = settingsOf(config);
  const pieces = initialPieces(config, settings);
  return {
    mode: 'tangram',
    pieces,
    selected: [],
    nextId: pieces.length + 1,
    settings,
  };
}

function replacePiece(state: TangramState, next: TangramPiece): TangramState {
  return {
    ...state,
    pieces: state.pieces.map((piece) => (piece.id === next.id ? next : piece)),
  };
}

function verticesOf(piece: TangramPiece, settings: TangramSettings): SPoint[] {
  const d = settings.d;
  const at = pointOf(piece.at, d);
  if (!at) return [];
  const def = kindDefinition(settings.pieceSet, piece.kind);
  if (!def) return [];
  return orientedBase(def, piece.rot, piece.flip, settings.rotationStep).map((point) => ({
    x: sAdd(point.x, at.x),
    y: sAdd(point.y, at.y),
  }));
}

function placePiece(
  state: TangramState,
  action: Extract<TangramAction, { type: 'place-piece' }>,
): TangramState {
  const piece = state.pieces.find((candidate) => candidate.id === action.piece);
  if (!piece) return state;
  const at = pointOf(action.at, state.settings.d);
  if (!at) return state;
  const next: TangramPiece = { ...piece, at: jsonOf(at, state.settings.d) };
  if (!withinBoard(verticesOf(next, state.settings))) return state;
  return replacePiece(state, next);
}

function turnPiece(
  state: TangramState,
  action: Extract<TangramAction, { type: 'turn-piece' }>,
): TangramState {
  const piece = state.pieces.find((candidate) => candidate.id === action.piece);
  if (!piece) return state;
  const def = kindDefinition(state.settings.pieceSet, piece.kind);
  const at = pointOf(piece.at, state.settings.d);
  if (!def || !at) return state;
  const step = state.settings.rotationStep;
  const turns = turnsOf(step);
  const current = verticesOf(piece, state.settings);
  const center = sAverage(current);
  const c0 = sAverage(orientedBase(def, 0, piece.flip, step));
  const rot = (piece.rot + 1) % turns;
  const offset = sRotate(c0, rot, step);
  const nextAt = { x: sSub(center.x, offset.x), y: sSub(center.y, offset.y) };
  const next: TangramPiece = { ...piece, rot, at: jsonOf(nextAt, state.settings.d) };
  if (!withinBoard(verticesOf(next, state.settings))) return state;
  return replacePiece(state, next);
}

function flipPiece(
  state: TangramState,
  action: Extract<TangramAction, { type: 'flip-piece' }>,
): TangramState {
  if (!state.settings.allowFlip) return state;
  const piece = state.pieces.find((candidate) => candidate.id === action.piece);
  if (!piece) return state;
  const def = kindDefinition(state.settings.pieceSet, piece.kind);
  const at = pointOf(piece.at, state.settings.d);
  if (!def || !at) return state;
  const step = state.settings.rotationStep;
  const turns = turnsOf(step);
  const center = sAverage(verticesOf(piece, state.settings));
  const flip = !piece.flip;
  const rot = (((turns - piece.rot) % turns) + turns) % turns;
  const c0 = sAverage(orientedBase(def, 0, flip, step));
  const offset = sRotate(c0, rot, step);
  const nextAt = { x: sSub(center.x, offset.x), y: sSub(center.y, offset.y) };
  const next: TangramPiece = { ...piece, rot, flip, at: jsonOf(nextAt, state.settings.d) };
  if (!withinBoard(verticesOf(next, state.settings))) return state;
  return replacePiece(state, next);
}

function addPiece(
  state: TangramState,
  action: Extract<TangramAction, { type: 'add-piece' }>,
): TangramState {
  if (state.settings.pieceSet !== 'pattern-blocks') return state;
  if (state.pieces.length >= MAX_PATTERN_PIECES) return state;
  if (!isKindOf('pattern-blocks', action.kind)) return state;
  const at = pointOf(action.at, state.settings.d);
  if (!at) return state;
  const piece: TangramPiece = {
    id: `p${state.nextId}`,
    kind: action.kind,
    rot: 0,
    flip: false,
    at: jsonOf(at, state.settings.d),
  };
  if (!withinBoard(verticesOf(piece, state.settings))) return state;
  return {
    ...state,
    pieces: [...state.pieces, piece],
    nextId: state.nextId + 1,
  };
}

function removePiece(
  state: TangramState,
  action: Extract<TangramAction, { type: 'remove-piece' }>,
): TangramState {
  if (state.settings.pieceSet !== 'pattern-blocks') return state;
  if (!state.pieces.some((piece) => piece.id === action.piece)) return state;
  return {
    ...state,
    pieces: state.pieces.filter((piece) => piece.id !== action.piece),
    selected: state.selected.filter((id) => id !== action.piece),
  };
}

function toggleSelect(
  state: TangramState,
  action: Extract<TangramAction, { type: 'toggle-select' }>,
): TangramState {
  if (!state.settings.selectMode) return state;
  if (!state.pieces.some((piece) => piece.id === action.piece)) return state;
  const selected = state.selected.includes(action.piece)
    ? state.selected.filter((id) => id !== action.piece)
    : [...state.selected, action.piece];
  return { ...state, selected };
}

export function reduceTangram(state: TangramState, action: TangramAction): TangramState {
  switch (action.type) {
    case 'place-piece':
      return placePiece(state, action);
    case 'turn-piece':
      return turnPiece(state, action);
    case 'flip-piece':
      return flipPiece(state, action);
    case 'add-piece':
      return addPiece(state, action);
    case 'remove-piece':
      return removePiece(state, action);
    case 'toggle-select':
      return toggleSelect(state, action);
    default:
      return state;
  }
}

export function tangramPieceKinds(state: TangramState): string[] {
  return state.pieces.map((piece) => piece.kind);
}

export function tangramSetDefinitionCount(set: PieceSet): number {
  return pieceDefinitions(set).length;
}

export const TANGRAM_MAX_PATTERN_PIECES = MAX_PATTERN_PIECES;
