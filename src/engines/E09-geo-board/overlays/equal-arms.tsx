/**
 * 힌트 ②: 설정 각이 2개 이상일 때 처음 두 각의 변 길이를 같게 잘라
 * 같은 꼭짓점에 겹쳐 그린다. 두 색과 다른 선 무늬만 쓰고 숫자는 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { armDirections } from '../modes/angle/observe';
import { ANGLE_VIEW, pointAtDirection } from '../views/Protractor';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

const LENGTH = 300;
const COLORS = ['#2f6fde', '#2f9e6b'] as const;
const DASHES = ['', '12 8'] as const;

export function EqualArmsOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'angle' || state.settings.angles.length < 2) return null;
  const first = state.settings.angles[0];
  const second = state.settings.angles[1];
  if (!first || !second) return null;
  const vertex = ANGLE_VIEW.vertex;
  const angles = [first, second];
  return (
    <CanvasAlignedOverlay
      testId="equal-arms"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g strokeLinecap="round" fill="none">
        {angles.map((angle, index) => {
          const [a, b] = armDirections(angle);
          const firstEnd = pointAtDirection(vertex, LENGTH, a);
          const secondEnd = pointAtDirection(vertex, LENGTH, b);
          const color = COLORS[index] ?? COLORS[0];
          const dash = DASHES[index] ?? '';
          return (
            <g key={`equal-arms-${index}`} stroke={color} strokeOpacity={0.7} strokeWidth={7}>
              <line
                x1={vertex.x}
                y1={vertex.y}
                x2={firstEnd.x}
                y2={firstEnd.y}
                strokeDasharray={dash || undefined}
              />
              <line
                x1={vertex.x}
                y1={vertex.y}
                x2={secondEnd.x}
                y2={secondEnd.y}
                strokeDasharray={dash || undefined}
              />
            </g>
          );
        })}
        <circle cx={vertex.x} cy={vertex.y} r={8} fill="#1d2330" stroke="none" />
      </g>
    </CanvasAlignedOverlay>
  );
}
