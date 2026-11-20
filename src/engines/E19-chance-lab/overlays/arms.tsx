/**
 * 힌트 ② arms (seesaw 일반). 받침점에서 각 추까지 거리를 막대로 그린다(왼쪽은 꽉 찬 막대, 오른쪽은 빗금 막대).
 * 아래에 왼쪽 막대 길이의 합과 오른쪽 막대 길이의 합을 두 줄로 나란히 그린다. 길이 글은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { AXIS, axisX, toNumber } from '../layout';
import { E19_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { ChanceConfig, ChanceState } from '../types';

const INK = '#1d2330';
const ROW0 = 470;
const ROW_STEP = 9;
const SUM_LEFT_Y = 558;
const SUM_RIGHT_Y = 576;
const SUM_X = 130;
const SUM_MAX_W = 740;

interface Arm {
  readonly value: number;
  readonly side: -1 | 0 | 1;
  /** 받침점까지의 거리(값 단위) */
  readonly units: number;
}

export function ArmsOverlay({ state }: OverlayProps<ChanceConfig, ChanceState>) {
  if (state.mode !== 'seesaw' || state.error !== null) return null;
  const fulcrum = Rational.parse(state.fulcrum);
  const fx = axisX(state.min, state.max, fulcrum);
  const pxPerUnit = (AXIS.right - AXIS.left) / (state.max - state.min);
  // 거리는 Rational로 구하고 화면 길이로만 number를 쓴다.
  const arms: Arm[] = state.data.map((value) => {
    const distance = Rational.of(value).sub(fulcrum);
    const side = distance.isZero() ? 0 : distance.isNegative() ? -1 : 1;
    return { value, side, units: toNumber(distance.abs()) };
  });
  const left = arms.filter((a) => a.side < 0);
  const right = arms.filter((a) => a.side > 0);
  const sum = (list: readonly Arm[]) => list.reduce((acc, a) => acc + a.units, 0);
  const longest = Math.max(sum(left), sum(right));
  const k = longest * pxPerUnit > SUM_MAX_W ? SUM_MAX_W / (longest * pxPerUnit) : 1;

  const sumRow = (list: readonly Arm[], y: number, hatch: boolean, key: string) => {
    let x = SUM_X;
    return (
      <g data-part={`sum-${key}`} data-length={(sum(list) * pxPerUnit * k).toFixed(2)}>
        {list.map((a, i) => {
          const w = a.units * pxPerUnit * k;
          const rect = (
            <rect
              key={i}
              data-part="sum-segment"
              x={x}
              y={y}
              width={w}
              height={12}
              fill={hatch ? 'url(#e19-arms-hatch)' : '#2f6fde'}
              stroke={INK}
              strokeWidth={1.5}
            />
          );
          x += w;
          return rect;
        })}
      </g>
    );
  };

  return (
    <CanvasAlignedOverlay
      testId="overlay-arms"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern id="e19-arms-hatch" width={8} height={8} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill="#fffdf6" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke={INK} strokeWidth={2} />
        </pattern>
      </defs>
      <line
        x1={fx}
        y1={ROW0 - 6}
        x2={fx}
        y2={ROW0 + arms.length * ROW_STEP + 2}
        stroke={INK}
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      {arms.map((a, i) => {
        if (a.side === 0) return null;
        const x = axisX(state.min, state.max, a.value);
        return (
          <rect
            key={i}
            data-part={a.side < 0 ? 'arm-left' : 'arm-right'}
            data-units={a.units}
            x={Math.min(x, fx)}
            y={ROW0 + i * ROW_STEP}
            width={Math.abs(x - fx)}
            height={6}
            fill={a.side < 0 ? '#2f6fde' : 'url(#e19-arms-hatch)'}
            stroke={INK}
            strokeWidth={1.2}
          />
        );
      })}
      <text x={16} y={SUM_LEFT_Y + 11} fontSize={16} fontWeight={800} fill={INK}>
        {S.seesaw.overlay.left}
      </text>
      <text x={16} y={SUM_RIGHT_Y + 11} fontSize={16} fontWeight={800} fill={INK}>
        {S.seesaw.overlay.right}
      </text>
      {sumRow(left, SUM_LEFT_Y, false, 'left')}
      {sumRow(right, SUM_RIGHT_Y, true, 'right')}
    </CanvasAlignedOverlay>
  );
}
