/**
 * slice·formula-derive의 순수 reducer.
 *
 * 자르기·옮기기·돌리기·경첩은 모두 정확한 유리수 계산이다. 조각이 판 밖으로
 * 나가는 Action은 무시한다. 도구가 설정에 없으면 그 Action도 무시한다.
 */
import { Rational, pointReflect, rotate90About, splitPolygonByChord } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { averageOfRPoints, fromG, parseRPoint, sameRPoint, toG } from '../rpoint';
import type { RPoint } from '../rpoint';
import { BOARD_COLS, BOARD_ROWS } from '../types';
import { hingeCandidates } from './candidates';
import {
  defaultSlicePolygons,
  formulaPolygon,
  normalizeFormulaShape,
  sanitizePolygons,
} from './shapes';
import {
  DEFAULT_PARALLELOGRAM,
  DEFAULT_RHOMBUS,
  DEFAULT_TRAPEZOID,
  DEFAULT_TRIANGLE,
} from './shapes';
import type {
  FormulaDeriveConfig,
  FormulaShape,
  Piece,
  PieceTool,
  PiecesAction,
  PiecesSettings,
  PiecesState,
  SliceConfig,
} from './types';

const MAX_PIECES = 16;
const SLICE_TOOLS: readonly PieceTool[] = ['scissors', 'rotate90'];
const FORMULA_TOOLS: readonly PieceTool[] = ['scissors', 'hinge180', 'duplicate', 'rotate90'];

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function toolsOf(value: unknown, defaults: readonly PieceTool[]): PieceTool[] {
  if (!Array.isArray(value)) return [...defaults];
  const result: PieceTool[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tool = item as PieceTool;
    if (!defaults.includes(tool)) continue;
    if (!result.includes(tool)) result.push(tool);
  }
  return result;
}

function gridSetting(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return 1;
  return value === 0 ? 0 : 1;
}

function addTool(used: readonly PieceTool[], tool: PieceTool): PieceTool[] {
  if (used.includes(tool)) return [...used];
  return [...used, tool].sort();
}

function withinBoard(points: readonly GPoint[]): boolean {
  const zero = Rational.of(0);
  const maxX = Rational.of(BOARD_COLS);
  const maxY = Rational.of(BOARD_ROWS);
  return points.every(
    (point) =>
      point.x.compareTo(zero) >= 0 &&
      point.x.compareTo(maxX) <= 0 &&
      point.y.compareTo(zero) >= 0 &&
      point.y.compareTo(maxY) <= 0,
  );
}

function movedVertices(piece: Piece, by: GPoint): RPoint[] {
  return piece.vertices.map((vertex) => {
    const point = toG(vertex);
    return fromG({ x: point.x.add(by.x), y: point.y.add(by.y) });
  });
}

function replacePiece(state: PiecesState, next: Piece): PiecesState {
  return {
    ...state,
    pieces: state.pieces.map((piece) => (piece.id === next.id ? next : piece)),
  };
}

function sliceSettings(config: SliceConfig): PiecesSettings {
  const polygons = sanitizePolygons(config.polygons) ?? defaultSlicePolygons();
  return {
    tools: toolsOf(config.tools, SLICE_TOOLS),
    grid: gridSetting(config.grid),
    maxCopies: 0,
    unitCover: 'never',
    shapeType: 'polygon',
    initial: polygons.map((polygon) => polygon.map((point) => [point[0], point[1]] as RPoint)),
  };
}

function formulaSettings(config: FormulaDeriveConfig): PiecesSettings {
  const shape = normalizeFormulaShape(config.shape);
  const polygon = formulaPolygon(shape);
  return {
    tools: toolsOf(config.tools, FORMULA_TOOLS),
    grid: gridSetting(config.grid),
    maxCopies: integer(config.maxCopies, 1, 0, 3),
    unitCover: config.unitCover === 'after-assemble' ? 'after-assemble' : 'never',
    shapeType: shape.type,
    initial: [polygon],
  };
}

function polygonOf(settings: PiecesSettings): RPoint[][] {
  return settings.initial.map((polygon) => polygon.map((point) => [point[0], point[1]] as RPoint));
}

export function createPiecesState(mode: 'slice' | 'formula-derive', config: unknown): PiecesState {
  const record = (config ?? {}) as SliceConfig & FormulaDeriveConfig;
  const settings = mode === 'slice' ? sliceSettings(record) : formulaSettings(record);
  const polygons = polygonOf(settings);
  const pieces: Piece[] = polygons.map((vertices, index) => ({
    id: `p${index + 1}`,
    vertices,
    copy: false,
  }));
  return {
    mode,
    pieces,
    nextId: pieces.length + 1,
    cuts: 0,
    copies: 0,
    used: [],
    lastHinge: null,
    settings,
  };
}

/** formula-derive 설정의 기본 도형 목록(테스트가 같은 기본값을 확인할 때 쓴다). */
export function defaultFormulaShapes(): FormulaShape[] {
  return [DEFAULT_PARALLELOGRAM, DEFAULT_TRIANGLE, DEFAULT_TRAPEZOID, DEFAULT_RHOMBUS];
}

function cutPiece(state: PiecesState, action: Extract<PiecesAction, { type: 'cut' }>): PiecesState {
  if (!state.settings.tools.includes('scissors')) return state;
  if (state.pieces.length >= MAX_PIECES) return state;
  const index = state.pieces.findIndex((piece) => piece.id === action.piece);
  const piece = state.pieces[index];
  if (!piece) return state;
  const from = parseRPoint(action.from);
  const to = parseRPoint(action.to);
  if (!from || !to) return state;
  const split = splitPolygonByChord(piece.vertices.map(toG), toG(from), toG(to));
  if (!split) return state;

  const first: Piece = {
    id: `p${state.nextId}`,
    vertices: split[0].map(fromG),
    copy: piece.copy,
  };
  const second: Piece = {
    id: `p${state.nextId + 1}`,
    vertices: split[1].map(fromG),
    copy: piece.copy,
  };
  const firstCenter = averageOfRPoints(first.vertices);
  const secondCenter = averageOfRPoints(second.vertices);
  const ordered =
    firstCenter.x.compareTo(secondCenter.x) < 0 ||
    (firstCenter.x.equals(secondCenter.x) && firstCenter.y.compareTo(secondCenter.y) < 0)
      ? [first, second]
      : [second, first];

  const pieces = [...state.pieces.slice(0, index), ...ordered, ...state.pieces.slice(index + 1)];
  return {
    ...state,
    pieces,
    nextId: state.nextId + 2,
    cuts: state.cuts + 1,
    used: addTool(state.used, 'scissors'),
  };
}

function movePiece(
  state: PiecesState,
  action: Extract<PiecesAction, { type: 'move-piece' }>,
): PiecesState {
  const piece = state.pieces.find((candidate) => candidate.id === action.piece);
  if (!piece) return state;
  const by = parseRPoint(action.by);
  if (!by) return state;
  const vector = toG(by);
  if (vector.x.isZero() && vector.y.isZero()) return state;
  const vertices = movedVertices(piece, vector);
  if (!withinBoard(vertices.map(toG))) return state;
  return {
    ...replacePiece(state, { ...piece, vertices }),
    used: addTool(state.used, 'move'),
  };
}

function rotatePiece(
  state: PiecesState,
  action: Extract<PiecesAction, { type: 'rotate-piece' }>,
): PiecesState {
  if (!state.settings.tools.includes('rotate90')) return state;
  if (action.turns !== 1 && action.turns !== -1) return state;
  const piece = state.pieces.find((candidate) => candidate.id === action.piece);
  if (!piece) return state;
  const center = averageOfRPoints(piece.vertices);
  const vertices = piece.vertices.map((vertex) =>
    fromG(rotate90About(toG(vertex), center, action.turns)),
  );
  if (!withinBoard(vertices.map(toG))) return state;
  return {
    ...replacePiece(state, { ...piece, vertices }),
    used: addTool(state.used, 'rotate90'),
  };
}

function hingePiece(
  state: PiecesState,
  action: Extract<PiecesAction, { type: 'hinge' }>,
): PiecesState {
  if (!state.settings.tools.includes('hinge180')) return state;
  const piece = state.pieces.find((candidate) => candidate.id === action.piece);
  if (!piece) return state;
  const at = parseRPoint(action.at);
  if (!at) return state;
  const allowed = hingeCandidates(piece).some((candidate) => sameRPoint(candidate, at));
  if (!allowed) return state;
  const center = toG(at);
  const vertices = piece.vertices.map((vertex) => fromG(pointReflect(toG(vertex), center)));
  if (!withinBoard(vertices.map(toG))) return state;
  return {
    ...replacePiece(state, { ...piece, vertices }),
    used: addTool(state.used, 'hinge180'),
    lastHinge: { piece: piece.id, at },
  };
}

function duplicatePiece(
  state: PiecesState,
  action: Extract<PiecesAction, { type: 'duplicate' }>,
): PiecesState {
  if (!state.settings.tools.includes('duplicate')) return state;
  if (state.copies >= state.settings.maxCopies) return state;
  if (state.pieces.length >= MAX_PIECES) return state;
  const piece = state.pieces.find((candidate) => candidate.id === action.piece);
  if (!piece) return state;

  const points = piece.vertices.map(toG);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const firstX = xs[0];
  const firstY = ys[0];
  if (!firstX || !firstY) return state;
  const minX = xs.reduce((best, value) => (value.compareTo(best) < 0 ? value : best), firstX);
  const maxX = xs.reduce((best, value) => (value.compareTo(best) > 0 ? value : best), firstX);
  const minY = ys.reduce((best, value) => (value.compareTo(best) < 0 ? value : best), firstY);
  const maxY = ys.reduce((best, value) => (value.compareTo(best) > 0 ? value : best), firstY);
  const width = maxX.sub(minX);
  const height = maxY.sub(minY);
  const right = { x: width.add(Rational.of(2)), y: Rational.of(0) };
  const down = { x: Rational.of(0), y: height.add(Rational.of(2)) };

  let vertices = movedVertices(piece, right);
  if (!withinBoard(vertices.map(toG))) vertices = movedVertices(piece, down);
  if (!withinBoard(vertices.map(toG))) return state;

  const copy: Piece = { id: `p${state.nextId}`, vertices, copy: true };
  return {
    ...state,
    pieces: [...state.pieces, copy],
    nextId: state.nextId + 1,
    copies: state.copies + 1,
    used: addTool(state.used, 'duplicate'),
  };
}

export function reducePieces(state: PiecesState, action: PiecesAction): PiecesState {
  switch (action.type) {
    case 'cut':
      return cutPiece(state, action);
    case 'move-piece':
      return movePiece(state, action);
    case 'rotate-piece':
      return rotatePiece(state, action);
    case 'hinge':
      return hingePiece(state, action);
    case 'duplicate':
      return duplicatePiece(state, action);
    default:
      return state;
  }
}
