/**
 * 자석 스냅. 끈 거리(number, 격자 단위)에서 가장 가까운 정확한 꼭짓점 차이를 고른다.
 *
 * 스냅 결과는 언제나 `RPoint`다. raw가 어떤 후보와도 tolerance 안에서 맞지 않으면
 * 정수로 반올림한다.
 */
import { Rational } from '../../../core/math';
import { fromG, rp, toG } from '../rpoint';
import type { RPoint } from '../rpoint';
import type { PiecesState } from './types';

export const DEFAULT_SNAP_TOLERANCE = 0.4;

function toNumber(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

export function snapTranslation(
  state: PiecesState,
  piece: string,
  raw: { readonly x: number; readonly y: number },
  tolerance = DEFAULT_SNAP_TOLERANCE,
): RPoint {
  const moving = state.pieces.find((candidate) => candidate.id === piece);
  if (moving) {
    let best: RPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const vertex of moving.vertices) {
      const point = toG(vertex);
      for (const other of state.pieces) {
        if (other.id === piece) continue;
        for (const target of other.vertices) {
          const goal = toG(target);
          const dx = goal.x.sub(point.x);
          const dy = goal.y.sub(point.y);
          const distance = Math.hypot(toNumber(dx) - raw.x, toNumber(dy) - raw.y);
          if (distance <= tolerance && distance < bestDistance) {
            best = fromG({ x: dx, y: dy });
            bestDistance = distance;
          }
        }
      }
    }
    if (best) return best;
  }
  return rp(Math.round(raw.x), Math.round(raw.y));
}
