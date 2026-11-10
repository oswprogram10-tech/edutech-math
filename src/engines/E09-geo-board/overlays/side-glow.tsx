/**
 * 힌트 ②(MC-GEO-DIAGONAL-ADJACENT): 학생이 이웃한 꼭짓점을 이으려 한 변을
 * 굵게 빛나게 하고 "변" 이름표를 붙인다. 학생이 만든 `lastRejected`만 쓰고,
 * 전체 대각선 수·규칙은 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { DIAGONAL_CENTER, vertexPoint } from '../modes/diagonal/observe';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

export function SideGlowOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'diagonal') return null;
  const rejected = state.lastRejected;
  if (!rejected || rejected.reason !== 'adjacent') return null;

  const from = vertexPoint(rejected.n, rejected.pair[0]);
  const to = vertexPoint(rejected.n, rejected.pair[1]);
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const outX = middle.x - DIAGONAL_CENTER.x;
  const outY = middle.y - DIAGONAL_CENTER.y;
  const length = Math.hypot(outX, outY) || 1;
  const label = { x: middle.x + (outX / length) * 34, y: middle.y + (outY / length) * 34 };

  return (
    <CanvasAlignedOverlay
      testId="side-glow"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#e8872e"
        strokeWidth={22}
        strokeOpacity={0.4}
        strokeLinecap="round"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#c2410c"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray="16 9"
      />
      <text
        x={label.x}
        y={label.y + 8}
        textAnchor="middle"
        fontSize={30}
        fontWeight={800}
        fill="#c2410c"
      >
        {S.diagonal.sideLabel}
      </text>
    </CanvasAlignedOverlay>
  );
}
