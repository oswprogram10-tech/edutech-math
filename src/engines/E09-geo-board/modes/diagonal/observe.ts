/**
 * diagonal 모드의 관찰 결과(T103).
 *
 * - `complete`(전체 대각선 수만큼 그었는지)는 Observation에만 있고 화면 글자로 쓰지 않는다.
 * - 꼭짓점 화면 좌표는 정n각형 그리기용 number다. 수학 값은 꼭짓점 번호뿐이다.
 */
import type { Observation } from '../../../../core/engine-sdk';
import type { Point } from '../../../../core/engine-sdk';
import {
  currentPolygon,
  diagonalCountOf,
  diagonalTotal,
  drawnPairs,
  polygonKey,
  sidePairs,
} from './reduce';
import type { DiagonalState } from './types';

/** 논리 좌표(1000×1000) 기준 정n각형의 중심과 외접원 반지름. */
export const DIAGONAL_CENTER: Point = { x: 500, y: 520 };
export const DIAGONAL_RADIUS = 340;

/** 0번 꼭짓점이 맨 위, 시계 방향. 화면 그리기에만 쓰는 number다. */
export function vertexPoint(n: number, index: number): Point {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
  return {
    x: DIAGONAL_CENTER.x + DIAGONAL_RADIUS * Math.cos(angle),
    y: DIAGONAL_CENTER.y + DIAGONAL_RADIUS * Math.sin(angle),
  };
}

export function observeDiagonal(state: DiagonalState): Observation {
  const polygons = state.settings.polygons.map((n) => {
    const drawn = diagonalCountOf(state, n);
    return { n, drawn, complete: drawn === diagonalTotal(n) };
  });
  const pairs: Record<string, [number, number][]> = {};
  for (const n of state.settings.polygons) {
    pairs[polygonKey(n)] = drawnPairs(state, n).map((pair) => [pair[0], pair[1]]);
  }
  const sidesDrawn = state.settings.polygons.reduce(
    (sum, n) => sum + sidePairs(state, n).length,
    0,
  );
  return {
    mode: state.mode,
    current: currentPolygon(state),
    polygons,
    pairs,
    adjacentAttempts: state.adjacentAttempts,
    duplicateAttempts: state.duplicateAttempts,
    sidesDrawn,
  };
}
