/**
 * 힌트 ②(MC-GEO-POLYGON-CURVE): geoboard 그림의 `curvedShapes` 곡선 변을 빨강
 * 물결 무늬로, `openShapes`의 열린 두 끝 사이를 점선 원으로 강조한다.
 * 콘텐츠가 그 카드를 따로 띄운 E09 슬롯에서 쓴다. 학생이 만든 것이 아니므로
 * 읽기 전용 그림만 덧그린다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, pegPoint } from '../layout';
import type { BoardRect } from '../layout';
import { givenCurvedEdgeGeometry } from '../views/GeoboardView';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState, Peg } from '../types';

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

function quadraticAt(
  from: ScreenPoint,
  control: ScreenPoint,
  to: ScreenPoint,
  t: number,
): ScreenPoint {
  const mt = 1 - t;
  return {
    x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
    y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
  };
}

/** 2차 베지어를 따라 물결이 흔들리는 polyline. 그림 계산만 number다. */
function wavePath(
  from: ScreenPoint,
  control: ScreenPoint,
  to: ScreenPoint,
  spacing: number,
): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const amplitude = Math.max(5, Math.min(13, length * 0.06));
  const cycles = Math.max(2, Math.round((length / Math.max(1, spacing)) * 0.9));
  const steps = 40;
  const points: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const point = quadraticAt(from, control, to, t);
    const tangent = {
      x: 2 * (1 - t) * (control.x - from.x) + 2 * t * (to.x - control.x),
      y: 2 * (1 - t) * (control.y - from.y) + 2 * t * (to.y - control.y),
    };
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const normal = { x: -tangent.y / tangentLength, y: tangent.x / tangentLength };
    const offset = Math.sin(t * Math.PI * 2 * cycles) * amplitude;
    const x = point.x + normal.x * offset;
    const y = point.y + normal.y * offset;
    points.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
}

function openGap(
  rect: BoardRect,
  pegs: readonly Peg[],
): { readonly center: ScreenPoint; readonly radius: number } | null {
  const first = pegs[0];
  const last = pegs[pegs.length - 1];
  if (!first || !last) return null;
  const a = pegPoint(rect, first);
  const b = pegPoint(rect, last);
  const radius = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  if (radius < 1) return null;
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, radius };
}

export function CurveGapOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'geoboard') return null;
  const openShapes = state.settings.openShapes ?? [];
  const curvedShapes = state.settings.curvedShapes ?? [];
  if (openShapes.length === 0 && curvedShapes.length === 0) return null;

  const rect = boardRect(state.settings.grid[0], state.settings.grid[1]);

  return (
    <CanvasAlignedOverlay
      testId="curve-gap"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {curvedShapes.map((shape, shapeIndex) =>
        shape.curved.map((edge) => {
          const geometry = givenCurvedEdgeGeometry(rect, shape.pegs, edge);
          if (!geometry) return null;
          const { from, control, to } = geometry;
          const curve = [
            `M ${from.x.toFixed(2)} ${from.y.toFixed(2)}`,
            `Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
          ].join(' ');
          return (
            <g key={`curved-${shapeIndex}-${edge}`} pointerEvents="none">
              <path
                d={curve}
                fill="none"
                stroke="#c2410c"
                strokeWidth={12}
                strokeOpacity={0.18}
                strokeLinecap="round"
              />
              <path
                d={wavePath(from, control, to, rect.spacing)}
                fill="none"
                stroke="#c2410c"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        }),
      )}

      {openShapes.map((pegs, index) => {
        const gap = openGap(rect, pegs);
        if (!gap) return null;
        const first = pegPoint(rect, pegs[0] as Peg);
        const last = pegPoint(rect, pegs[pegs.length - 1] as Peg);
        return (
          <g key={`open-${index}`} pointerEvents="none">
            <circle
              cx={gap.center.x}
              cy={gap.center.y}
              r={gap.radius}
              fill="none"
              stroke="#2f6fde"
              strokeWidth={4}
              strokeDasharray="12 8"
            />
            <circle cx={first.x} cy={first.y} r={7} fill="#2f6fde" />
            <circle cx={last.x} cy={last.y} r={7} fill="#2f6fde" />
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
