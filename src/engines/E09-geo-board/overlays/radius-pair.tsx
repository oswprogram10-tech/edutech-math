/**
 * 힌트 ②: 학생이 그은 반지름과 같은 방향의 반지름 두 개를 중심 양쪽에 이어 붙인다.
 * 숫자는 쓰지 않는다. 그은 반지름·현이 없으면 아무것도 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { GPoint } from '../../../core/math';
import { boardRect, pegPoint, ratToScreen } from '../layout';
import { pointAt } from '../modes/circle/observe';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

function screenOf(
  rect: ReturnType<typeof boardRect>,
  point: GPoint,
): { readonly x: number; readonly y: number } {
  return {
    x: rect.x + ratToScreen(point.x) * rect.spacing,
    y: rect.y + ratToScreen(point.y) * rect.spacing,
  };
}

export function RadiusPairOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'circle') return null;
  const pos =
    state.radii.length > 0
      ? state.radii[state.radii.length - 1]
      : state.chord
        ? state.chord[0]
        : null;
  if (pos === null || pos === undefined) return null;
  const rect = boardRect(state.settings.grid, state.settings.grid);
  const center = pegPoint(rect, state.settings.stake);
  const first = screenOf(rect, pointAt(state.settings, pos));
  const second = screenOf(rect, pointAt(state.settings, pos + 24));

  const label = (from: { x: number; y: number }, to: { x: number; y: number }, key: string) => (
    <text
      key={key}
      x={(from.x + to.x) / 2}
      y={(from.y + to.y) / 2 - 14}
      textAnchor="middle"
      fontSize={19}
      fontWeight={800}
      fill="#2f9e6b"
    >
      {S.circle.radiusLabel}
    </text>
  );

  return (
    <CanvasAlignedOverlay
      testId="radius-pair"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <line
        x1={center.x}
        y1={center.y}
        x2={first.x}
        y2={first.y}
        stroke="#2f9e6b"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={center.x}
        y1={center.y}
        x2={second.x}
        y2={second.y}
        stroke="#2f9e6b"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={center.x} cy={center.y} r={8} fill="#1d2330" />
      {label(center, first, 'radius-label-first')}
      {label(center, second, 'radius-label-second')}
    </CanvasAlignedOverlay>
  );
}
