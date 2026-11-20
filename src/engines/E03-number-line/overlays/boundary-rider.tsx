/**
 * 힌트 ②: range에서 경계값과 같은 키의 캐릭터만 게이트 앞에 크게 그리고,
 * 학생이 지금 만든 게이트로 지나가는지 막히는지를 보여 준다(MC-RANGE-BOUNDARY-INCLUSION).
 * 1초 동안 걸어오고, 움직임 줄이기면 결과만 보인다. 경계가 없거나 경계값과 같은 키가 없으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import { rangeComplete, rangeContains } from '../reduce-range';
import { numberLineStrings } from '../strings.ko';
import { parseValue } from '../ticks';
import type { NumberLineConfig, NumberLineState } from '../types';
import styles from '../View.module.css';
import { GateFigure, RiderFigure } from '../views/range-story/Figures';
import { GATE_GROUND_Y, GATE_X, RANGE_LOGICAL_HEIGHT } from '../views/range-story/geometry';

const S = numberLineStrings.range;
const BIG = 1.7;

export function BoundaryRiderOverlay({ state }: OverlayProps<NumberLineConfig, NumberLineState>) {
  const range = state.range;
  if (!range || !rangeComplete(range)) return null;
  const boundValues = range.bounds
    .map((bound) => parseValue(bound.value))
    .filter((value): value is Rational => value !== null);
  const heights = [...new Set(range.riders)].filter((height) =>
    boundValues.some((value) => value.equals(Rational.of(height))),
  );
  if (heights.length === 0) return null;

  let passedOrder = 0;
  let blockedOrder = 0;
  const figures = heights.map((height) => {
    const passes = rangeContains(range, Rational.of(height));
    const order = passes ? passedOrder : blockedOrder;
    if (passes) passedOrder += 1;
    else blockedOrder += 1;
    const x = passes ? GATE_X + 110 + order * 90 : GATE_X - 110 - order * 90;
    return { height, passes, x };
  });
  const anyBlocked = figures.some((figure) => !figure.passes);

  return (
    <CanvasAlignedOverlay
      testId="overlay-boundary-rider"
      canvasSelector={'svg[data-testid="number-line-canvas"]'}
      logicalWidth={1000}
      logicalHeight={RANGE_LOGICAL_HEIGHT}
    >
      <rect x={0} y={0} width={1000} height={GATE_GROUND_Y + 60} fill="#f7f9ff" opacity={0.96} />
      <line
        x1={60}
        y1={GATE_GROUND_Y}
        x2={940}
        y2={GATE_GROUND_Y}
        stroke="#c9d1e0"
        strokeWidth={3}
      />
      <GateFigure
        closed={anyBlocked}
        label={range.story === 'train' ? S.storyTrain : S.storyRollercoaster}
      />
      {figures.map((figure) => (
        <g
          key={figure.height}
          className={styles.overlayRider}
          data-rider-height={figure.height}
          data-result={figure.passes ? 'passed' : 'blocked'}
        >
          <RiderFigure
            x={figure.x}
            y={GATE_GROUND_Y}
            height={figure.height}
            scale={BIG}
            mark={figure.passes ? 'passed' : 'blocked'}
          />
        </g>
      ))}
    </CanvasAlignedOverlay>
  );
}
