/**
 * slice·formula-derive의 관찰 결과.
 *
 * 넓이는 모두 Rational 문자열이다. 겹침·외곽·도구 목록은 판정과 교사 기록용이며
 * 학생 화면에는 쓰지 않는다(정답 노출 금지).
 */
import type { Observation } from '../../../core/engine-sdk';
import { Rational, polygonArea, simplifyPolygon } from '../../../core/math';
import type { Piece, PiecesState } from './types';
import {
  originalArea,
  outlineOfPieces,
  piecePoints,
  piecesOverlap,
  piecesTotalArea,
} from './outline';

function areaRatio(total: Rational, original: Rational): string {
  if (original.isZero()) return '0';
  return total.div(original).toString();
}

function pieceObservation(piece: Piece): Observation {
  return {
    id: piece.id,
    vertices: simplifyPolygon(piecePoints(piece)).length,
    area: polygonArea(piecePoints(piece)).toString(),
  };
}

export function observePieces(state: PiecesState): Observation {
  const total = piecesTotalArea(state.pieces);
  const original = originalArea(state.settings);
  const expected = original.mul(Rational.of(1 + state.copies));
  const outline = outlineOfPieces(state);
  return {
    mode: state.mode,
    shapeType: state.settings.shapeType,
    pieceCount: state.pieces.length,
    cuts: state.cuts,
    copies: state.copies,
    pieces: state.pieces.map(pieceObservation),
    originalArea: original.toString(),
    totalArea: total.toString(),
    areaRatio: areaRatio(total, original),
    areaConserved: total.equals(expected),
    overlap: piecesOverlap(state.pieces),
    outline: outline
      ? {
          kind: outline.kind,
          vertices: outline.vertices,
          area: outline.area,
          width: outline.width,
          height: outline.height,
          base: outline.base,
        }
      : null,
    toolsUsed: [...state.used],
  };
}
