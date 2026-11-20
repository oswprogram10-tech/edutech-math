/**
 * 힌트 ② rewind-to-hour (MC-CLOCK-HOUR-BETWEEN). 지금 시각에서 정시(floor)로 되감은 유령 바늘 둘을
 * 점선으로 그리고, 긴바늘 끝에서 12까지 거꾸로 도는 호 화살표를 그린다.
 * 유령 짧은바늘이 가리키는 숫자는 원으로 둘러싼다(숫자 글은 새로 쓰지 않는다). 분이 0이면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CLOCK, boardSize, handAngles, numeralPoint, polar } from '../layout';
import { CANVAS_SELECTOR } from '../types';
import type { ClockConfig, ClockState } from '../types';

const ORANGE = '#e8872e';
const ARC_R = 150;

export function RewindToHourOverlay({ state }: OverlayProps<ClockConfig, ClockState>) {
  if (state.error !== null || state.minutes % 60 === 0) return null;
  const { cx, cy } = CLOCK;
  const hourMinutes = Math.floor(state.minutes / 60) * 60;
  const ghost = handAngles(hourMinutes);
  const now = handAngles(state.minutes);
  const hourNumeral = Math.floor(state.minutes / 60) || 12;
  const ring = numeralPoint(hourNumeral);
  const longTip = polar(ghost.minute, CLOCK.longLength);
  const shortTip = polar(ghost.hour, CLOCK.shortLength);
  // 긴바늘 끝에서 12까지 반시계(거꾸로) 방향 호.
  const from = polar(now.minute, ARC_R);
  const to = polar(0, ARC_R);
  const large = now.minute > 180 ? 1 : 0;
  const head = [
    `${to.x - 16},${to.y}`,
    `${to.x + 2},${to.y - 11}`,
    `${to.x + 2},${to.y + 11}`,
  ].join(' ');
  return (
    <CanvasAlignedOverlay
      testId="overlay-rewind-to-hour"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={boardSize(state.unrolled).width}
      logicalHeight={boardSize(state.unrolled).height}
    >
      <path
        data-part="rewind-arc"
        d={`M ${from.x} ${from.y} A ${ARC_R} ${ARC_R} 0 ${large} 0 ${to.x} ${to.y}`}
        fill="none"
        stroke={ORANGE}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <polygon data-part="rewind-head" points={head} fill={ORANGE} />
      <g data-part="ghost-long" data-angle={ghost.minute.toFixed(2)}>
        <line
          x1={cx}
          y1={cy}
          x2={longTip.x}
          y2={longTip.y}
          stroke="#2f6fde"
          strokeWidth={5}
          strokeDasharray="9 7"
          strokeLinecap="round"
        />
      </g>
      <g data-part="ghost-short" data-angle={ghost.hour.toFixed(2)}>
        <line
          x1={cx}
          y1={cy}
          x2={shortTip.x}
          y2={shortTip.y}
          stroke="#1d2330"
          strokeWidth={12}
          strokeDasharray="9 8"
          strokeLinecap="round"
        />
      </g>
      <circle
        data-part="hour-ring"
        cx={ring.x}
        cy={ring.y}
        r={28}
        fill="none"
        stroke={ORANGE}
        strokeWidth={6}
      />
    </CanvasAlignedOverlay>
  );
}
