/**
 * 힌트 ②: 지금 도형을 좌우로 뒤집은 작은 그림과 180° 돌린 작은 그림을 나란히 보여
 * 준다. 회전 중심·정답 중심은 표시하지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { POLYGONS } from '../polygons';
import { currentPointShape } from '../modes/point-symmetry';
import { transformStrings as S } from '../strings.ko';
import type { Pt, TransformConfig, TransformState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function smallPoints(shape: ReturnType<typeof currentPointShape>): readonly Pt[] {
  if (shape === 'regular-pentagon') {
    const points: Pt[] = [];
    for (let index = 0; index < 5; index += 1) {
      const angle = (-90 + index * 72) * (Math.PI / 180);
      points.push([Math.cos(angle), Math.sin(angle)]);
    }
    return points;
  }
  const preset = POLYGONS[shape].points;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of preset) {
    if (point[0] < minX) minX = point[0];
    if (point[0] > maxX) maxX = point[0];
    if (point[1] < minY) minY = point[1];
    if (point[1] > maxY) maxY = point[1];
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = Math.max(1, Math.max(maxX - minX, maxY - minY));
  return preset.map((point) => [(point[0] - cx) / scale, (point[1] - cy) / scale]);
}

function figure(points: readonly Pt[], transform: string, label: string) {
  return (
    <g>
      <g transform={transform}>
        <polygon
          points={points.map((point) => `${point[0].toFixed(3)},${point[1].toFixed(3)}`).join(' ')}
          fill="#dbe7ff"
          stroke="#1d4fa8"
          strokeWidth={2.4}
          fillOpacity={0.85}
        />
      </g>
      <text
        x={0}
        y={88}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill="#1d4fa8"
        stroke="#ffffff"
        strokeWidth={4}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

export function FlipVsTurnOverlay({ state }: OverlayProps<TransformConfig, TransformState>) {
  if (state.mode !== 'point-symmetry') return null;
  if (!state.pin || (!state.turned && !state.flipUsed)) return null;
  const points = smallPoints(currentPointShape(state));
  const size = 68;
  return (
    <CanvasAlignedOverlay
      testId="flip-vs-turn"
      canvasSelector={'svg[data-testid="transform-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g data-flip-vs-turn transform={`translate(736 150) scale(${size})`}>
        {figure(points, 'scale(-1 1)', S.overlays.flip)}
      </g>
      <g data-flip-vs-turn transform={`translate(880 150) scale(${size})`}>
        {figure(points, 'rotate(180)', S.overlays.turn)}
      </g>
    </CanvasAlignedOverlay>
  );
}
