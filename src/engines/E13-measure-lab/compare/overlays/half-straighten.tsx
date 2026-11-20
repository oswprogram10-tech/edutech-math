/**
 * 힌트 ② half-straighten {id} (MC-MEASURE-CURVE). 곡선 밧줄의 앞쪽 절반을 곧게 편 미리보기를 점선으로
 * 그린다. 나머지 반은 곡선 그대로다. id가 없거나 이미 폈거나 곡선이 아니면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { num } from '../../rat';
import { BASE_X, BOARD, LENGTH_CELL, halfStraightPoints, pathOf } from '../geometry';
import { COMPARE_CANVAS_SELECTOR } from '../types';
import type { CompareConfig, CompareState } from '../types';

const ORANGE = '#e8872e';

function idOf(args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null;
  const id = (args as Record<string, unknown>)['id'];
  return typeof id === 'string' ? id : null;
}

export function HalfStraightenOverlay({ state, args }: OverlayProps<CompareConfig, CompareState>) {
  if (state.error !== null || state.attribute !== 'length') return null;
  const id = idOf(args);
  const item = id === null ? undefined : state.items.find((candidate) => candidate.id === id);
  if (!item || item.shape !== 'curvy' || state.straightened.includes(item.id)) return null;
  const points = halfStraightPoints(num(item.length));
  const x = BASE_X + num(item.x) * LENGTH_CELL;
  const y = num(item.y) * LENGTH_CELL + 30;
  return (
    <CanvasAlignedOverlay
      testId="overlay-half-straighten"
      canvasSelector={COMPARE_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={BOARD.height}
    >
      <g data-part="half-preview" data-id={item.id}>
        <path
          d={pathOf(points, x, y)}
          fill="none"
          stroke={ORANGE}
          strokeWidth={7}
          strokeDasharray="12 9"
          strokeLinejoin="round"
        />
      </g>
    </CanvasAlignedOverlay>
  );
}
