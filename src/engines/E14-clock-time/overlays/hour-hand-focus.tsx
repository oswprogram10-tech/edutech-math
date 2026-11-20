/**
 * 힌트 ② hour-hand-focus (MC-CLOCK-HANDS). 긴바늘을 흐리게(점선 윤곽) 다시 그리고
 * 짧은바늘을 굵은 윤곽으로 강조한다. "몇 시는 짧은바늘이 알려 줘요" 이름표를 단다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CLOCK, SIDE, handAngles } from '../layout';
import { E14_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { ClockConfig, ClockState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';

export function HourHandFocusOverlay({ state }: OverlayProps<ClockConfig, ClockState>) {
  if (state.error !== null) return null;
  const { cx, cy } = CLOCK;
  const angles = handAngles(state.minutes);
  const short = [
    `${cx - 9},${cy + 22}`,
    `${cx - 9},${cy - CLOCK.shortLength + 26}`,
    `${cx},${cy - CLOCK.shortLength}`,
    `${cx + 9},${cy - CLOCK.shortLength + 26}`,
    `${cx + 9},${cy + 22}`,
  ].join(' ');
  return (
    <CanvasAlignedOverlay
      testId="overlay-hour-hand-focus"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g
        data-part="long-ghost"
        data-angle={angles.minute.toFixed(2)}
        transform={`rotate(${angles.minute} ${cx} ${cy})`}
      >
        <rect
          x={cx - 5}
          y={cy - CLOCK.longLength}
          width={10}
          height={CLOCK.longLength + 28}
          rx={5}
          fill="rgba(255,255,255,0.7)"
          stroke="#7a8497"
          strokeWidth={2.5}
          strokeDasharray="6 5"
        />
      </g>
      <g
        data-part="short-focus"
        data-angle={angles.hour.toFixed(2)}
        transform={`rotate(${angles.hour} ${cx} ${cy})`}
      >
        <polygon
          points={short}
          fill="none"
          stroke={ORANGE}
          strokeWidth={9}
          strokeLinejoin="round"
        />
      </g>
      <text
        data-part="label"
        x={SIDE.x}
        y={230}
        fontSize={26}
        fontWeight={800}
        fill={INK}
        stroke="#fffdf6"
        strokeWidth={5}
        paintOrder="stroke"
      >
        {S.overlay.hourHandFocus}
      </text>
    </CanvasAlignedOverlay>
  );
}
