/**
 * 힌트 ②(MC-PERIMETER-AREA-SAME): 지금 직사각형 안에 단위 정사각형을 점 무늬로
 * 깔고, 기록표의 마지막 기록(지금과 다른 것)은 같은 `[0,0]` 기준 점선 외곽과
 * 빗금 단위 정사각형으로 겹쳐 그린다. 개수 숫자는 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, pegPoint } from '../layout';
import { currentRect } from '../modes/perimeter/reduce';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState, GeoboardState } from '../types';

function rectBox(
  rect: ReturnType<typeof boardRect>,
  width: number,
  height: number,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const topLeft = pegPoint(rect, [0, 0]);
  const bottomRight = pegPoint(rect, [width, height]);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

function lastDifferentLog(
  state: GeoboardState,
  width: number,
  height: number,
): { readonly width: number; readonly height: number } | null {
  const area = width * height;
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const entry = state.log[index];
    if (!entry) continue;
    // 같은 둘레에서 넓이가 같은 직사각형은 가로·세로만 바뀐 합동이다. 다른 넓이만 겹친다.
    if (entry.width * entry.height === area) continue;
    return entry;
  }
  return null;
}

export function UnitSquaresOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'geoboard' || !state.settings.constraint) return null;
  const size = currentRect(state);
  if (!size) return null;

  const rect = boardRect(state.settings.grid[0], state.settings.grid[1]);
  const spacing = rect.spacing;
  const current = rectBox(rect, size.width, size.height);
  const logged = lastDifferentLog(state, size.width, size.height);
  const loggedBox = logged ? rectBox(rect, logged.width, logged.height) : null;

  return (
    <CanvasAlignedOverlay
      testId="unit-squares"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="unit-squares-dots"
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${rect.x} ${rect.y})`}
        >
          <circle cx={spacing / 2} cy={spacing / 2} r={2.4} fill="#2f6fde" />
        </pattern>
        <pattern
          id="unit-squares-hatch"
          width={14}
          height={14}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={14} stroke="#c2410c" strokeWidth={3} />
        </pattern>
      </defs>

      <rect
        x={current.x}
        y={current.y}
        width={current.width}
        height={current.height}
        fill="url(#unit-squares-dots)"
      />

      {loggedBox ? (
        <g>
          <rect
            x={loggedBox.x}
            y={loggedBox.y}
            width={loggedBox.width}
            height={loggedBox.height}
            fill="url(#unit-squares-hatch)"
            fillOpacity={0.35}
            stroke="#c2410c"
            strokeWidth={3}
            strokeDasharray="10 7"
          />
        </g>
      ) : null}
    </CanvasAlignedOverlay>
  );
}
