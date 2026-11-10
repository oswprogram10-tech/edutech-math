/**
 * 힌트 ②: 컴퍼스 침에서 연필까지의 폭을 굵게 보여 주고 같은 선분을 원의
 * 반지름 자리에 겹쳐 그린다. 숫자는 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect } from '../layout';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

export function CompassWidthOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'circle') return null;
  const last = state.circles[state.circles.length - 1] ?? null;
  if (!last && !state.settings.compass.enabled) return null;
  const centerHalf = last ? last.center : state.compass.center;
  const radiusHalf = last ? last.radius : state.compass.width;
  const rect = boardRect(state.settings.grid, state.settings.grid);
  const center = {
    x: rect.x + (centerHalf[0] * rect.spacing) / 2,
    y: rect.y + (centerHalf[1] * rect.spacing) / 2,
  };
  const radius = (radiusHalf * rect.spacing) / 2;
  const pencil = { x: center.x + radius, y: center.y };

  return (
    <CanvasAlignedOverlay
      testId="compass-width"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="#2f6fde"
        strokeWidth={2}
        strokeDasharray="8 6"
      />
      <line
        x1={center.x}
        y1={center.y}
        x2={pencil.x}
        y2={pencil.y}
        stroke="#2f6fde"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <circle cx={center.x} cy={center.y} r={9} fill="#1d2330" />
      <circle cx={pencil.x} cy={pencil.y} r={9} fill="#e8872e" stroke="#1d2330" strokeWidth={2} />
      <text
        x={(center.x + pencil.x) / 2}
        y={center.y - 18}
        textAnchor="middle"
        fontSize={19}
        fontWeight={800}
        fill="#1d4fa8"
      >
        {S.circle.compassWidthLabel}
      </text>
    </CanvasAlignedOverlay>
  );
}
