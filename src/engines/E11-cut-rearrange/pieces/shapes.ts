/**
 * formula-derive 도형과 slice 다각형 설정 정규화.
 *
 * 모든 꼭짓점은 격자 단위 유리수다. 도형은 판 (2, 2)에 놓는다(카드 결정 5).
 */
import { Rational, gp, isConvexPolygon, polygonArea, simplifyPolygon } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { fromG } from '../rpoint';
import type { RPoint } from '../rpoint';
import { BOARD_COLS, BOARD_ROWS } from '../types';
import type { FormulaShape, FormulaShapeType } from './types';

export const DEFAULT_PARALLELOGRAM: FormulaShape = {
  type: 'parallelogram',
  base: 6,
  height: 4,
  skew: 2,
};

export const DEFAULT_TRIANGLE: FormulaShape = { type: 'triangle', base: 6, height: 4, apex: 2 };
export const DEFAULT_TRAPEZOID: FormulaShape = {
  type: 'trapezoid',
  top: 3,
  bottom: 5,
  height: 4,
  offset: 1,
};
export const DEFAULT_RHOMBUS: FormulaShape = { type: 'rhombus', diagonals: [6, 8] };

export const DEFAULT_SHAPE = DEFAULT_PARALLELOGRAM;

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Readonly<Record<string, unknown>>;
}

export function normalizeFormulaShape(value: unknown): FormulaShape {
  const record = recordOf(value);
  if (!record) return DEFAULT_SHAPE;
  const type = record['type'];
  if (type === 'triangle') {
    const base = integer(record['base'], 6, 1, 12);
    const height = integer(record['height'], 4, 1, 12);
    const apex = Math.min(base, integer(record['apex'], 2, 0, 12));
    return { type: 'triangle', base, height, apex };
  }
  if (type === 'trapezoid') {
    return {
      type: 'trapezoid',
      top: integer(record['top'], 3, 1, 12),
      bottom: integer(record['bottom'], 5, 1, 12),
      height: integer(record['height'], 4, 1, 12),
      offset: integer(record['offset'], 1, 1, 12),
    };
  }
  if (type === 'rhombus') {
    const diagonals = record['diagonals'];
    if (Array.isArray(diagonals) && diagonals.length >= 2) {
      return {
        type: 'rhombus',
        diagonals: [integer(diagonals[0], 6, 1, 12), integer(diagonals[1], 8, 1, 12)],
      };
    }
    return DEFAULT_RHOMBUS;
  }
  if (type === 'parallelogram') {
    const base = integer(record['base'], 6, 1, 12);
    const height = integer(record['height'], 4, 1, 12);
    const skew = Math.min(base, integer(record['skew'], 2, 0, 12));
    return { type: 'parallelogram', base, height, skew };
  }
  return DEFAULT_SHAPE;
}

export function formulaShapeType(shape: FormulaShape): FormulaShapeType {
  return shape.type;
}

/** 도형을 판 (2, 2)에 놓은 꼭짓점. */
export function formulaPolygon(shape: FormulaShape): RPoint[] {
  const offsetX = 2;
  const offsetY = 2;
  const at = (x: number, y: number): GPoint => gp(x + offsetX, y + offsetY);
  switch (shape.type) {
    case 'parallelogram':
      return [
        at(shape.skew, 0),
        at(shape.skew + shape.base, 0),
        at(shape.base, shape.height),
        at(0, shape.height),
      ].map(fromG);
    case 'triangle':
      return [at(0, shape.height), at(shape.base, shape.height), at(shape.apex, 0)].map(fromG);
    case 'trapezoid':
      return [
        at(shape.offset, 0),
        at(shape.offset + shape.top, 0),
        at(shape.bottom, shape.height),
        at(0, shape.height),
      ].map(fromG);
    case 'rhombus': {
      const [p, q] = shape.diagonals;
      const shiftX = Rational.of(offsetX);
      const shiftY = Rational.of(offsetY);
      const point = (x: Rational, y: Rational): GPoint => ({
        x: x.add(shiftX),
        y: y.add(shiftY),
      });
      return [
        point(Rational.of(p, 2), Rational.of(0)),
        point(Rational.of(p), Rational.of(q, 2)),
        point(Rational.of(p, 2), Rational.of(q)),
        point(Rational.of(0), Rational.of(q, 2)),
      ].map(fromG);
    }
    default:
      return [];
  }
}

/** slice 설정의 정수 격자 다각형 목록. 하나라도 어기면 null(기본값을 쓴다). */
export function sanitizePolygons(value: unknown): RPoint[][] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > 16) return null;
  const result: RPoint[][] = [];
  for (const candidate of value) {
    if (!Array.isArray(candidate) || candidate.length < 3) return null;
    const points: GPoint[] = [];
    for (const vertex of candidate) {
      if (!Array.isArray(vertex) || vertex.length < 2) return null;
      const x = vertex[0];
      const y = vertex[1];
      if (typeof x !== 'number' || typeof y !== 'number') return null;
      if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
      if (x < 0 || x > BOARD_COLS || y < 0 || y > BOARD_ROWS) return null;
      points.push(gp(x, y));
    }
    const simplified = simplifyPolygon(points);
    if (simplified.length < 3) return null;
    if (!isConvexPolygon(points)) return null;
    if (polygonArea(points).isZero()) return null;
    result.push(simplified.map(fromG));
  }
  return result;
}

export function defaultSlicePolygons(): RPoint[][] {
  return [formulaPolygon(DEFAULT_SHAPE)];
}
