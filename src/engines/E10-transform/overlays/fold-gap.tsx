/**
 * 힌트 ②: 학생이 마지막으로 접은 그림과 빈틈을 크게 강조한다.
 * 접기 기록이 없으면 아무것도 그리지 않는다(정답 축을 미리 보여 주지 않는다).
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, ptXY, triBoardRect, triPtXY } from '../layout';
import { POLYGONS } from '../polygons';
import type { Pt, TransformConfig, TransformState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

function reflect(point: ScreenPoint, a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const squared = dx * dx + dy * dy;
  if (squared < 1e-9) return point;
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared;
  const foot = { x: a.x + t * dx, y: a.y + t * dy };
  return { x: foot.x * 2 - point.x, y: foot.y * 2 - point.y };
}

function pathOf(points: readonly ScreenPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
    .concat(' Z');
}

export function FoldGapOverlay({ state }: OverlayProps<TransformConfig, TransformState>) {
  if (state.mode !== 'line-symmetry') return null;
  if (state.task !== 'find-axis') return null;
  if (state.folds.length === 0) return null;
  const record =
    state.showing !== null ? state.folds[state.showing] : state.folds[state.folds.length - 1];
  if (!record || record.ok) return null;

  const preset = POLYGONS[record.shape];
  const tri = preset.board === 'tri';
  const toScreen = (point: Pt): ScreenPoint => {
    if (tri) return triPtXY(triBoardRect(-3, 7, -1, 7), point);
    return ptXY(boardRect(9), point);
  };
  const axisA = toScreen(record.from);
  const axisB = toScreen(record.to);
  const original = preset.points.map(toScreen);
  const mirror = original.map((point) => reflect(point, axisA, axisB));
  const path = `${pathOf(original)} ${pathOf(mirror)}`;

  return (
    <CanvasAlignedOverlay
      testId="fold-gap"
      canvasSelector={'svg[data-testid="transform-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="e10-fold-gap-hatch"
          width="18"
          height="18"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="18" height="18" fill="#ffe3e0" />
          <line x1="0" y1="0" x2="0" y2="18" stroke="#b42318" strokeWidth="5" />
        </pattern>
      </defs>
      <path
        d={path}
        fill="url(#e10-fold-gap-hatch)"
        fillRule="evenodd"
        fillOpacity={0.75}
        stroke="#b42318"
        strokeWidth={3}
      />
      {mirror.map((point, index) => (
        <circle key={`mirror-${index}`} cx={point.x} cy={point.y} r={6} fill="#b42318" />
      ))}
    </CanvasAlignedOverlay>
  );
}
