/**
 * 힌트 ②: 합동 포개기에서 움직이는 도형이 고정 도형 밖으로 삐져나온 부분(빨강+빗금)과
 * 고정 도형에서 덮이지 않은 부분(점 무늬)을 보여 준다. 정답 위치는 그리지 않는다.
 */
import { gp, samePolygon } from '../../../core/math';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, ptXY } from '../layout';
import { currentMoving } from '../modes/congruence';
import type { Pt, TransformConfig, TransformState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function pointsOf(points: readonly Pt[], rect: ReturnType<typeof boardRect>): string {
  return points
    .map((point) => {
      const xy = ptXY(rect, point);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(' ');
}

export function ProtrudeOverlay({ state }: OverlayProps<TransformConfig, TransformState>) {
  if (state.mode !== 'congruence') return null;
  if (state.moves.length === 0) return null;
  const moving = currentMoving(state);
  if (
    samePolygon(
      moving.outline.map((p) => gp(p[0], p[1])),
      state.fixed.map((p) => gp(p[0], p[1])),
    )
  ) {
    return null;
  }
  const rect = boardRect(state.settings.grid);
  return (
    <CanvasAlignedOverlay
      testId="protrude"
      canvasSelector={'svg[data-testid="transform-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="e10-protrude-hatch"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(40)"
        >
          <rect width="16" height="16" fill="#ffe3e0" />
          <line x1="0" y1="0" x2="0" y2="16" stroke="#b42318" strokeWidth="4" />
        </pattern>
        <pattern id="e10-protrude-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="3" fill="#2f6fde" fillOpacity={0.7} />
        </pattern>
        <mask id="e10-protrude-moving-mask">
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#ffffff" />
          <polygon points={pointsOf(state.fixed, rect)} fill="#000000" />
        </mask>
        <mask id="e10-protrude-fixed-mask">
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#ffffff" />
          <polygon points={pointsOf(moving.outline, rect)} fill="#000000" />
        </mask>
      </defs>
      <polygon
        points={pointsOf(moving.outline, rect)}
        fill="url(#e10-protrude-hatch)"
        mask="url(#e10-protrude-moving-mask)"
        stroke="#b42318"
        strokeWidth={3}
      />
      <polygon
        points={pointsOf(state.fixed, rect)}
        fill="url(#e10-protrude-dots)"
        mask="url(#e10-protrude-fixed-mask)"
        stroke="#2f6fde"
        strokeWidth={3}
        strokeDasharray="8 6"
      />
    </CanvasAlignedOverlay>
  );
}
