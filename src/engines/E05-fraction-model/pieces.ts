/**
 * 도형 하나를 지금 칼선으로 나눈 조각들.
 *
 * `partition`과 `partition` variant=share가 같은 규칙을 쓴다.
 * 조각 넓이는 화면 기하(number)다(T010 결정 2의 예외).
 */
import type { Point } from '../../core/engine-sdk';
import { circleSectors, partitionPieces, polygonArea, polygonCentroid } from './geometry';
import type { Piece } from './geometry';
import { CIRCLE_CENTER, CIRCLE_RADIUS } from './types';
import type { Cut, FractionShape } from './types';

export interface PieceSource {
  readonly shape: FractionShape;
  readonly outline: readonly Point[];
  readonly cuts: readonly Cut[];
}

export function piecesOf(source: PieceSource): Piece[] {
  if (source.shape === 'circle' && source.cuts.length > 0) {
    return circleSectors(CIRCLE_CENTER, CIRCLE_RADIUS, source.cuts);
  }
  if (source.cuts.length === 0) {
    return [
      {
        points: source.outline,
        area: polygonArea(source.outline),
        centroid: polygonCentroid(source.outline),
      },
    ];
  }
  return partitionPieces(source.outline, source.cuts, source.shape);
}
