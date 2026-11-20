/**
 * 힌트 ② mean-pull (outlier). 처음 평균에서 지금 평균까지 화살표, 끈 점에서 처음 자리까지 화살표를 그린다.
 * "점이 움직인 거리"와 "평균이 움직인 거리" 글만 쓰고 값은 쓰지 않는다. 예측을 잠그기 전에는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { AXIS, anchorAt, axisX } from '../layout';
import { meanOf } from '../observe';
import { E19_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { ChanceConfig, ChanceState } from '../types';

interface ArrowProps {
  readonly part: string;
  readonly from: number;
  readonly to: number;
  readonly y: number;
  readonly color: string;
  readonly dash?: string;
  readonly label: string;
}

function Arrow({ part, from, to, y, color, dash, label }: ArrowProps) {
  const dir = to >= from ? 1 : -1;
  const mid = (from + to) / 2;
  return (
    <g data-part={part} data-from={from.toFixed(2)} data-to={to.toFixed(2)}>
      <line
        x1={from}
        y1={y - 22}
        x2={from}
        y2={y + 8}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="3 4"
      />
      <line
        x1={from}
        y1={y}
        x2={to - dir * 14}
        y2={y}
        stroke={color}
        strokeWidth={5}
        strokeDasharray={dash}
      />
      <polygon
        points={`${to},${y} ${to - dir * 20},${y - 10} ${to - dir * 20},${y + 10}`}
        fill={color}
      />
      <text
        data-part="label"
        x={mid}
        y={y + 32}
        textAnchor={anchorAt(mid)}
        fontSize={20}
        fontWeight={800}
        fill={color}
        stroke="#fffdf6"
        strokeWidth={5}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

export function MeanPullOverlay({ state }: OverlayProps<ChanceConfig, ChanceState>) {
  if (state.mode !== 'outlier' || state.error !== null) return null;
  if (state.requirePrediction && state.prediction === null) return null;
  if (state.values[state.dragIndex] === state.data[state.dragIndex]) return null;
  const initial = axisX(state.min, state.max, meanOf(state.data));
  const now = axisX(state.min, state.max, meanOf(state.values));
  const pointFrom = axisX(state.min, state.max, state.values[state.dragIndex] ?? 0);
  const pointTo = axisX(state.min, state.max, state.data[state.dragIndex] ?? 0);
  return (
    <CanvasAlignedOverlay
      testId="overlay-mean-pull"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <Arrow
        part="point-arrow"
        from={pointFrom}
        to={pointTo}
        y={AXIS.y + 128}
        color="#8a4b00"
        label={S.outlier.overlay.pointMoved}
      />
      <Arrow
        part="mean-arrow"
        from={initial}
        to={now}
        y={AXIS.y + 200}
        color="#8f2a1f"
        dash="14 6"
        label={S.outlier.overlay.meanMoved}
      />
    </CanvasAlignedOverlay>
  );
}
