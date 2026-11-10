/**
 * 조각들의 외곽(합집합의 볼록 껍질)과 가장 좁은 도형 이름.
 *
 * 겹침이 없고 모든 꼭짓점의 볼록 껍질 넓이가 조각 넓이 합과 같을 때만 외곽이 있다.
 * 그때 합집합 = 볼록 껍질이다. 정답 노출 금지: 이 값은 Observation에만 쓴다.
 */
import {
  Rational,
  clipConvexPolygon,
  convexHull,
  cross,
  dist2,
  dot,
  gp,
  polygonArea,
  simplifyPolygon,
  vsub,
} from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { toG } from '../rpoint';
import type { OutlineKind, Piece, PiecesSettings, PiecesState } from './types';

export interface PieceOutline {
  readonly kind: OutlineKind;
  readonly vertices: number;
  readonly area: string;
  readonly width: string;
  readonly height: string;
  readonly base: string | null;
}

export function piecePoints(piece: Piece): GPoint[] {
  return piece.vertices.map(toG);
}

export function piecesTotalArea(pieces: readonly Piece[]): Rational {
  let total = Rational.of(0);
  for (const piece of pieces) total = total.add(polygonArea(piecePoints(piece)));
  return total;
}

export function originalArea(settings: PiecesSettings): Rational {
  let total = Rational.of(0);
  for (const polygon of settings.initial) {
    total = total.add(polygonArea(polygon.map(toG)));
  }
  return total;
}

export function piecesOverlap(pieces: readonly Piece[]): boolean {
  for (let first = 0; first < pieces.length; first += 1) {
    const a = pieces[first];
    if (!a) continue;
    for (let second = first + 1; second < pieces.length; second += 1) {
      const b = pieces[second];
      if (!b) continue;
      const intersection = clipConvexPolygon(piecePoints(a), piecePoints(b));
      if (intersection.length >= 3 && !polygonArea(intersection).isZero()) return true;
    }
  }
  return false;
}

export function piecesHull(pieces: readonly Piece[]): GPoint[] {
  const points: GPoint[] = [];
  for (const piece of pieces) points.push(...piecePoints(piece));
  return convexHull(points);
}

function classification(points: readonly GPoint[]): OutlineKind {
  const polygon = simplifyPolygon(points);
  if (polygon.length === 3) return 'triangle';
  if (polygon.length !== 4) return 'polygon';
  const [a, b, c, d] = polygon;
  if (!a || !b || !c || !d) return 'polygon';
  const first = vsub(b, a);
  const second = vsub(c, b);
  const third = vsub(d, c);
  const fourth = vsub(a, d);
  const firstPair = cross(first, third).isZero();
  const secondPair = cross(second, fourth).isZero();
  if (firstPair && secondPair) {
    const right = dot(first, second).isZero();
    const firstLength = dist2(a, b);
    const sameLengths =
      firstLength.equals(dist2(b, c)) &&
      firstLength.equals(dist2(c, d)) &&
      firstLength.equals(dist2(d, a));
    if (right) return sameLengths ? 'square' : 'rectangle';
    return sameLengths ? 'rhombus' : 'parallelogram';
  }
  if (firstPair || secondPair) return 'trapezoid';
  return 'quadrilateral';
}

function boundingSize(points: readonly GPoint[]): { width: string; height: string } {
  let minX = points[0]?.x ?? gp(0, 0).x;
  let maxX = minX;
  let minY = points[0]?.y ?? gp(0, 0).y;
  let maxY = minY;
  for (const point of points) {
    if (point.x.compareTo(minX) < 0) minX = point.x;
    if (point.x.compareTo(maxX) > 0) maxX = point.x;
    if (point.y.compareTo(minY) < 0) minY = point.y;
    if (point.y.compareTo(maxY) > 0) maxY = point.y;
  }
  return { width: maxX.sub(minX).toString(), height: maxY.sub(minY).toString() };
}

function baseLength(points: readonly GPoint[]): string | null {
  let bestY: Rational | null = null;
  let bestLength: Rational | null = null;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;
    if (!a.y.equals(b.y)) continue;
    const length = b.x.sub(a.x).abs();
    if (bestY === null || a.y.compareTo(bestY) > 0) {
      bestY = a.y;
      bestLength = length;
    } else if (a.y.equals(bestY) && bestLength !== null) {
      if (length.compareTo(bestLength) > 0) bestLength = length;
    }
  }
  return bestLength === null ? null : bestLength.toString();
}

export function outlineOfPieces(state: PiecesState): PieceOutline | null {
  if (state.pieces.length === 0) return null;
  if (piecesOverlap(state.pieces)) return null;
  const hull = piecesHull(state.pieces);
  if (hull.length < 3) return null;
  const total = piecesTotalArea(state.pieces);
  const hullArea = polygonArea(hull);
  if (hullArea.isZero() || !hullArea.equals(total)) return null;
  const size = boundingSize(hull);
  return {
    kind: classification(hull),
    vertices: simplifyPolygon(hull).length,
    area: hullArea.toString(),
    width: size.width,
    height: size.height,
    base: baseLength(hull),
  };
}

export interface UnitCoverBox {
  readonly minX: Rational;
  readonly minY: Rational;
  readonly maxX: Rational;
  readonly maxY: Rational;
}

/**
 * 단위넓이 격자를 그릴 수 있는 외곽 상자. 외곽이 수평·수직 변의
 * 직사각형/정사각형이고 가로·세로가 정수일 때만 돌려준다(카드 결정 13).
 */
export function unitCoverBox(state: PiecesState): UnitCoverBox | null {
  const outline = outlineOfPieces(state);
  if (!outline || (outline.kind !== 'rectangle' && outline.kind !== 'square')) return null;
  const hull = piecesHull(state.pieces);
  if (hull.length < 4) return null;
  for (let index = 0; index < hull.length; index += 1) {
    const a = hull[index];
    const b = hull[(index + 1) % hull.length];
    if (!a || !b) return null;
    if (!a.x.equals(b.x) && !a.y.equals(b.y)) return null;
  }
  const size = boundingSize(hull);
  if (!Rational.parse(size.width).isInteger() || !Rational.parse(size.height).isInteger()) {
    return null;
  }
  const xs = hull.map((point) => point.x);
  const ys = hull.map((point) => point.y);
  const firstX = xs[0];
  const firstY = ys[0];
  if (!firstX || !firstY) return null;
  const minX = xs.reduce((best, value) => (value.compareTo(best) < 0 ? value : best), firstX);
  const maxX = xs.reduce((best, value) => (value.compareTo(best) > 0 ? value : best), firstX);
  const minY = ys.reduce((best, value) => (value.compareTo(best) < 0 ? value : best), firstY);
  const maxY = ys.reduce((best, value) => (value.compareTo(best) > 0 ? value : best), firstY);
  return { minX, minY, maxX, maxY };
}
