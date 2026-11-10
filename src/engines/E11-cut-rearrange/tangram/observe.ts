/**
 * tangram 관찰. 채움·겹침·삐져나옴은 모두 `Surd` 정확 계산이다.
 * 조각 이름·실루엣 정답 배치·외곽 kind는 학생 화면에 쓰지 않는다.
 */
import type { Observation } from '../../../core/engine-sdk';
import type { OutlineKind } from '../pieces/types';
import { kindDefinition, pieceArea, pieceVertices, setD } from './pieces';
import { silhouettePartPolygons } from './silhouettes';
import type { SPoint } from './surd-geometry';
import {
  sClipConvex,
  sConvexHull,
  sCross,
  sDistance2,
  sDot,
  sPolygonArea,
  sVSub,
} from './surd-geometry';
import type { Surd } from './surd';
import { sCompare, sFromJson, sInt, sIsZero, sMul, sToNumber } from './surd';
import type { TangramPiece, TangramState } from './types';

export interface TangramAnalysis {
  readonly polygons: ReadonlyMap<string, readonly SPoint[]>;
  readonly parts: readonly (readonly SPoint[])[];
  readonly silhouetteArea: Surd;
  readonly inside: ReadonlyMap<string, Surd>;
  readonly filled: boolean;
  readonly overlap: boolean;
  readonly sticksOut: boolean;
  readonly fillPercent: number;
}

function pointOf(piece: TangramPiece, d: ReturnType<typeof setD>): SPoint | null {
  try {
    return {
      x: sFromJson(piece.at[0], d),
      y: sFromJson(piece.at[1], d),
    };
  } catch {
    return null;
  }
}

export function tangramPiecePolygons(state: TangramState): ReadonlyMap<string, readonly SPoint[]> {
  const d = setD(state.settings.pieceSet);
  const result = new Map<string, readonly SPoint[]>();
  for (const piece of state.pieces) {
    const at = pointOf(piece, d);
    if (!at) continue;
    result.set(
      piece.id,
      pieceVertices(
        state.settings.pieceSet,
        piece.kind,
        at,
        piece.rot,
        piece.flip,
        state.settings.rotationStep,
      ),
    );
  }
  return result;
}

export function analyzeTangram(state: TangramState): TangramAnalysis {
  const polygons = tangramPiecePolygons(state);
  const parts = silhouettePartPolygons(state.settings.pieceSet, state.settings.silhouette);
  const d = setD(state.settings.pieceSet);
  let silhouetteArea = sInt(0, d);
  for (const part of parts) {
    const area = sPolygonArea(part);
    silhouetteArea = {
      a: silhouetteArea.a.add(area.a),
      b: silhouetteArea.b.add(area.b),
      d,
    };
  }

  const insideMap = new Map<string, Surd>();
  for (const piece of state.pieces) {
    const polygon = polygons.get(piece.id);
    if (!polygon) continue;
    let inside = sInt(0, d);
    for (const part of parts) {
      const clipped = sClipConvex(polygon, part);
      if (clipped.length >= 3) {
        const area = sPolygonArea(clipped);
        inside = { a: inside.a.add(area.a), b: inside.b.add(area.b), d };
      }
    }
    insideMap.set(piece.id, inside);
  }

  let overlap = false;
  const touching = state.pieces.filter((piece) => {
    const inside = insideMap.get(piece.id);
    return inside !== undefined && sCompare(inside, sInt(0, d)) > 0;
  });
  for (let first = 0; first < touching.length && !overlap; first += 1) {
    const a = touching[first];
    if (!a) continue;
    const polygonA = polygons.get(a.id);
    if (!polygonA) continue;
    for (let second = first + 1; second < touching.length; second += 1) {
      const b = touching[second];
      if (!b) continue;
      const polygonB = polygons.get(b.id);
      if (!polygonB) continue;
      const clipped = sClipConvex(polygonA, polygonB);
      if (clipped.length >= 3 && sCompare(sPolygonArea(clipped), sInt(0, d)) > 0) {
        overlap = true;
        break;
      }
    }
  }

  let sticksOut = false;
  for (const piece of state.pieces) {
    const inside = insideMap.get(piece.id);
    if (!inside || sCompare(inside, sInt(0, d)) <= 0) continue;
    const area = pieceArea(state.settings.pieceSet, piece.kind);
    if (!area) continue;
    if (sCompare(inside, area) < 0) {
      sticksOut = true;
      break;
    }
  }

  let totalInside = sInt(0, d);
  for (const piece of state.pieces) {
    const inside = insideMap.get(piece.id);
    if (!inside) continue;
    totalInside = { a: totalInside.a.add(inside.a), b: totalInside.b.add(inside.b), d };
  }

  const filled =
    parts.length > 0 && !overlap && !sticksOut && sCompare(totalInside, silhouetteArea) === 0;

  let fillPercent = 0;
  if (parts.length > 0) {
    for (let percent = 0; percent <= 100; percent += 1) {
      if (sCompare(sMul(silhouetteArea, sInt(percent, d)), sMul(totalInside, sInt(100, d))) <= 0) {
        fillPercent = percent;
      }
    }
  }

  return {
    polygons,
    parts,
    silhouetteArea,
    inside: insideMap,
    filled,
    overlap,
    sticksOut,
    fillPercent,
  };
}

function classification(points: readonly SPoint[]): OutlineKind {
  if (points.length === 3) return 'triangle';
  if (points.length !== 4) return 'polygon';
  const [a, b, c, d] = points;
  if (!a || !b || !c || !d) return 'polygon';
  const first = sVSub(b, a);
  const second = sVSub(c, b);
  const third = sVSub(d, c);
  const fourth = sVSub(a, d);
  const firstPair = sIsZero(sCross(first, third));
  const secondPair = sIsZero(sCross(second, fourth));
  if (firstPair && secondPair) {
    const right = sIsZero(sDot(first, second));
    const firstLength = sDistance2(a, b);
    const sameLengths =
      sCompare(firstLength, sDistance2(b, c)) === 0 &&
      sCompare(firstLength, sDistance2(c, d)) === 0 &&
      sCompare(firstLength, sDistance2(d, a)) === 0;
    if (right) return sameLengths ? 'square' : 'rectangle';
    return sameLengths ? 'rhombus' : 'parallelogram';
  }
  if (firstPair || secondPair) return 'trapezoid';
  return 'quadrilateral';
}

export interface TangramOutline {
  readonly kind: OutlineKind;
  readonly vertices: number;
}

export function tangramOutline(
  state: TangramState,
  analysis = analyzeTangram(state),
): TangramOutline | null {
  if (state.pieces.length === 0) return null;
  const d = setD(state.settings.pieceSet);
  const all: SPoint[] = [];
  let total = sInt(0, d);
  for (const piece of state.pieces) {
    const polygon = analysis.polygons.get(piece.id);
    if (!polygon || polygon.length < 3) continue;
    all.push(...polygon);
    const area = sPolygonArea(polygon);
    total = { a: total.a.add(area.a), b: total.b.add(area.b), d };
  }
  if (all.length < 3) return null;
  for (let first = 0; first < state.pieces.length; first += 1) {
    const a = state.pieces[first];
    if (!a) continue;
    const polygonA = analysis.polygons.get(a.id);
    if (!polygonA) continue;
    for (let second = first + 1; second < state.pieces.length; second += 1) {
      const b = state.pieces[second];
      if (!b) continue;
      const polygonB = analysis.polygons.get(b.id);
      if (!polygonB) continue;
      const clipped = sClipConvex(polygonA, polygonB);
      if (clipped.length >= 3 && sCompare(sPolygonArea(clipped), sInt(0, d)) > 0) return null;
    }
  }
  const hull = sConvexHull(all);
  if (hull.length < 3) return null;
  const hullArea = sPolygonArea(hull);
  if (sCompare(hullArea, total) !== 0) return null;
  return { kind: classification(hull), vertices: hull.length };
}

function degreesOf(piece: TangramPiece, step: number): number {
  return (((piece.rot * step) % 360) + 360) % 360;
}

export function observeTangram(state: TangramState): Observation {
  const analysis = analyzeTangram(state);
  const outline = tangramOutline(state, analysis);
  const selected = [...state.selected].sort();
  const selectedCorners = selected
    .map((id) => state.pieces.find((piece) => piece.id === id))
    .filter((piece): piece is TangramPiece => piece !== undefined)
    .map((piece) => kindDefinition(state.settings.pieceSet, piece.kind)?.corners ?? 0)
    .sort((a, b) => a - b);

  return {
    mode: 'tangram',
    pieceSet: state.settings.pieceSet,
    silhouette: state.settings.silhouette,
    pieceCount: state.pieces.length,
    pieces: state.pieces.map((piece) => {
      const inside = analysis.inside.get(piece.id);
      const onSilhouette = inside !== undefined && sCompare(inside, sInt(0, state.settings.d)) > 0;
      return {
        id: piece.id,
        kind: piece.kind,
        corners: kindDefinition(state.settings.pieceSet, piece.kind)?.corners ?? 0,
        rot: degreesOf(piece, state.settings.rotationStep),
        flip: piece.flip,
        onSilhouette,
      };
    }),
    filled: analysis.filled,
    overlap: analysis.overlap,
    sticksOut: analysis.sticksOut,
    fillPercent: analysis.fillPercent,
    usedPieces: state.pieces.filter((piece) => {
      const inside = analysis.inside.get(piece.id);
      return inside !== undefined && sCompare(inside, sInt(0, state.settings.d)) > 0;
    }).length,
    outline: outline
      ? {
          kind: outline.kind,
          vertices: outline.vertices,
          area: null,
          width: null,
          height: null,
          base: null,
        }
      : null,
    selected,
    selectedCorners,
  };
}

/** 화면 좌표 변환용. 판정에는 쓰지 않는다. */
export function analysisNumberArea(area: Surd): number {
  return sToNumber(area);
}
