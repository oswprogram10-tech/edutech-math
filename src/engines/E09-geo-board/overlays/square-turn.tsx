/**
 * 힌트 ②: 직각삼각자를 마지막으로 댄 각(`squareOn`)에 맞춰 돌려 볼 수 있는 두
 * 자리를 반투명하게 그린다(MC-GEO-RIGHT-ANGLE-ORIENT). `squareOn`이 없으면
 * 아무것도 그리지 않는다. 각의 실제 직각 여부는 드러내지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, pegPoint, setSquareShape } from '../layout';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

export function SquareTurnOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'construct' || state.squareOn === null) return null;
  const angle = state.settings.angles.find((candidate) => candidate.id === state.squareOn);
  if (!angle) return null;

  const { grid } = state.settings;
  const rect = boardRect(grid, grid);
  const vertex = pegPoint(rect, angle.vertex);
  const a = pegPoint(rect, angle.a);
  const b = pegPoint(rect, angle.b);
  const size = Math.max(60, Math.min(200, rect.spacing * 1.7));
  const first = setSquareShape(vertex, a, b, size, true);
  const second = setSquareShape(vertex, b, a, size, true);
  const pathOf = (shape: typeof first) =>
    `M ${shape.vertex.x.toFixed(2)} ${shape.vertex.y.toFixed(2)} L ${shape.legA.x.toFixed(2)} ${shape.legA.y.toFixed(2)} L ${shape.legB.x.toFixed(2)} ${shape.legB.y.toFixed(2)} Z`;

  return (
    <CanvasAlignedOverlay
      testId="square-turn"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <path
        d={pathOf(first)}
        fill="#2f9e6b"
        fillOpacity={0.12}
        stroke="#2f9e6b"
        strokeWidth={4}
        strokeDasharray="12 8"
        strokeLinejoin="round"
      />
      <path
        d={pathOf(second)}
        fill="none"
        stroke="#2f9e6b"
        strokeWidth={3}
        strokeOpacity={0.75}
        strokeDasharray="5 9"
        strokeLinejoin="round"
      />
      <circle cx={vertex.x} cy={vertex.y} r={6} fill="#2f9e6b" />
    </CanvasAlignedOverlay>
  );
}
