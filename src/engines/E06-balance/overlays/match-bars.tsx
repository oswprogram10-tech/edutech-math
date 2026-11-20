/**
 * 힌트 ② match-bars.
 * □가 없는 쪽 막대 아래에, □가 있는 쪽 수 막대와 같은 길이의 점선 구간을 맞춰 그린다.
 * 남는 구간에는 "?"만 쓴다(값을 쓰지 않는다). □가 없거나 □ 쪽 수가 0 이하면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import {
  BARS,
  BAR_MAX,
  PAN_CENTER,
  PAN_SURFACE_Y,
  barsUnit,
  boxSideOf,
  panOffsets,
  scaleUnit,
  tiltDegrees,
} from '../layout';
import { readBalance } from '../observe';
import { balanceStrings as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { E06Config, E06State } from '../unions';

function lengthOf(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

export function MatchBarsOverlay({ state }: OverlayProps<E06Config, E06State>) {
  // proportion 모드에는 없는 힌트다(막대가 아니라 격자를 쓴다).
  if (state.mode === 'proportion') return null;
  if (state.error !== null || state.settings.look === 'symbols') return null;
  const boxName = boxSideOf(state);
  if (boxName === null) return null;
  const otherName = boxName === 'left' ? 'right' : 'left';
  const boxConst = Rational.parse(state[boxName].const);
  const otherConst = Rational.parse(state[otherName].const);
  if (boxConst.compareTo(Rational.of(0)) <= 0 || otherConst.compareTo(Rational.of(0)) <= 0) {
    return null;
  }
  const look = state.settings.look;
  const unit = look === 'scale' ? scaleUnit(state) : barsUnit(state);
  const segment = lengthOf(boxConst) * unit;
  const whole = lengthOf(otherConst) * unit;
  const rest = Math.max(0, whole - segment);

  let x: number;
  let y: number;
  let height: number;
  let shift = { dx: 0, dy: 0 };
  if (look === 'scale') {
    const reading = readBalance(state);
    shift = panOffsets(reading.tilt, tiltDegrees(state))[otherName];
    x = PAN_CENTER[otherName] - BAR_MAX / 2;
    y = PAN_SURFACE_Y + 8;
    height = 24;
  } else {
    x = BARS.x;
    y = (otherName === 'left' ? BARS.leftY : BARS.rightY) + BARS.height + 8;
    height = 20;
  }

  return (
    <CanvasAlignedOverlay
      testId="overlay-match-bars"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g transform={`translate(${shift.dx} ${shift.dy})`}>
        <rect
          x={x}
          y={y}
          width={segment}
          height={height}
          rx={4}
          fill="#fff3d6"
          fillOpacity={0.9}
          stroke="#8a4b00"
          strokeWidth={3}
          strokeDasharray="8 5"
          data-part="match-segment"
        />
        {rest > 0 ? (
          <g data-part="rest-segment">
            <rect
              x={x + segment}
              y={y}
              width={rest}
              height={height}
              rx={4}
              fill="#ffffff"
              fillOpacity={0.9}
              stroke="#8a4b00"
              strokeWidth={3}
              strokeDasharray="8 5"
            />
            <text
              x={x + segment + rest / 2}
              y={y + height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={20}
              fontWeight={800}
              fill="#8a4b00"
            >
              {S.overlay.unknownPart}
            </text>
          </g>
        ) : null}
      </g>
    </CanvasAlignedOverlay>
  );
}
