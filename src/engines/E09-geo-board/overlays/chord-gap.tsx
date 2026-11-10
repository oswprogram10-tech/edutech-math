/**
 * 힌트 ②: 학생의 현에서 중심까지의 거리를 보여 준다.
 * 중심을 강조하고, 중심에서 현에 내린 수선을 점선으로 그린다.
 * 명세의 "중심을 지나는 선분을 겹쳐 비교"는 지름 자리(정답)를 보여 주므로 하지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { GPoint } from '../../../core/math';
import { boardRect, pegPoint, ratToScreen } from '../layout';
import { pointAt, chordThroughCenter } from '../modes/circle/observe';
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

export function ChordGapOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'circle' || !state.chord) return null;
  // 현이 중심을 지나면 "중심에서 떨어져 있어요"를 보이지 않는다.
  if (chordThroughCenter(state)) return null;
  const rect = boardRect(state.settings.grid, state.settings.grid);
  const center = pegPoint(rect, state.settings.stake);
  const first = screenOf(rect, pointAt(state.settings, state.chord[0]));
  const second = screenOf(rect, pointAt(state.settings, state.chord[1]));
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  const foot =
    lengthSquared === 0
      ? first
      : {
          x:
            first.x +
            ((center.x - first.x) * dx + (center.y - first.y) * dy) * (dx / lengthSquared),
          y:
            first.y +
            ((center.x - first.x) * dx + (center.y - first.y) * dy) * (dy / lengthSquared),
        };
  const middle = { x: (center.x + foot.x) / 2, y: (center.y + foot.y) / 2 };

  return (
    <CanvasAlignedOverlay
      testId="chord-gap"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <circle cx={center.x} cy={center.y} r={11} fill="#e8872e" stroke="#1d2330" strokeWidth={2} />
      <line
        x1={center.x}
        y1={center.y}
        x2={foot.x}
        y2={foot.y}
        stroke="#c2410c"
        strokeWidth={4}
        strokeDasharray="9 7"
        strokeLinecap="round"
      />
      <circle cx={foot.x} cy={foot.y} r={6} fill="#c2410c" />
      <text
        x={middle.x}
        y={middle.y - 12}
        textAnchor="middle"
        fontSize={19}
        fontWeight={800}
        fill="#c2410c"
      >
        {S.circle.chordGapText}
      </text>
    </CanvasAlignedOverlay>
  );
}
