/**
 * 힌트 ② numeral-minutes (MC-CLOCK-MINUTE-NUMERAL). args `{ numeral }`(1~11): 시계 숫자 바깥에
 * "numeral × 5분" 이름표를 달고, 펼친 상태면 띠의 그 자리에도 같은 이름표를 둔다.
 * numeral이 없거나 범위 밖이면 그리지 않는다. 어떤 숫자를 넘길지는 콘텐츠가 정한다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CLOCK, STRIP, polar, stripX } from '../layout';
import { E14_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { ClockConfig, ClockState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';

function numeralOf(args: unknown): number | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { numeral?: unknown }).numeral;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 11
    ? value
    : null;
}

export function NumeralMinutesOverlay({ state, args }: OverlayProps<ClockConfig, ClockState>) {
  const numeral = numeralOf(args);
  if (state.error !== null || numeral === null) return null;
  const label = S.overlay.numeralMinutes(numeral);
  const spot = polar(numeral * 30, CLOCK.labelR);
  const x = stripX(numeral * 5);
  const textProps = {
    fontSize: 24,
    fontWeight: 800,
    fill: INK,
    stroke: '#fffdf6',
    strokeWidth: 5,
    paintOrder: 'stroke',
    textAnchor: 'middle' as const,
  };
  return (
    <CanvasAlignedOverlay
      testId="overlay-numeral-minutes"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g data-part="clock-label" data-numeral={numeral}>
        <circle cx={spot.x} cy={spot.y} r={4} fill={ORANGE} />
        <text x={spot.x} y={spot.y + (spot.y < CLOCK.cy ? -12 : 26)} {...textProps}>
          {label}
        </text>
      </g>
      {state.unrolled ? (
        <g data-part="strip-label" data-x={x.toFixed(2)}>
          <line
            x1={x}
            y1={STRIP.labelY + 6}
            x2={x}
            y2={STRIP.barTop - 4}
            stroke={ORANGE}
            strokeWidth={3}
          />
          <text x={x} y={STRIP.labelY} {...textProps}>
            {label}
          </text>
        </g>
      ) : null}
    </CanvasAlignedOverlay>
  );
}
