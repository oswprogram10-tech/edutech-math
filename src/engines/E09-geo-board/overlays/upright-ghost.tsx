/**
 * 힌트 ②: 학생이 마지막으로 닫은 도형을 가장 긴 변이 수평이 되도록 돌린
 * 반투명 그림을 옆에 그린다(MC-SHAPE-ORIENTATION). 목표 도형은 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, pegPoint, uprightPolygon } from '../layout';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

export function UprightGhostOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'geoboard') return null;
  const last = [...state.bands].reverse().find((band) => band.closed && band.pegs.length >= 3);
  if (!last) return null;

  const [cols, rows] = state.settings.grid;
  const rect = boardRect(cols, rows);
  const points = last.pegs.map((peg) => pegPoint(rect, peg));
  const ghost = uprightPolygon(points, { x: LOGICAL_WIDTH - 190, y: 210 }, 230);
  if (ghost.length === 0) return null;
  const path = ghost
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  return (
    <CanvasAlignedOverlay
      testId="upright-ghost"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <path
        d={`${path} Z`}
        fill="#2f6fde"
        fillOpacity={0.16}
        stroke="#2f6fde"
        strokeWidth={4}
        strokeDasharray="14 9"
        strokeLinejoin="round"
      />
    </CanvasAlignedOverlay>
  );
}
