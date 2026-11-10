/**
 * 힌트 ②: 돌리기 방향을 보는 12눈금 시계판. 바늘이 시계 방향으로 한 바퀴(2초) 돌아
 * 답의 각을 알려 주지 않는다. 줄인 움직임이면 멈춘 그림과 시계 방향 화살표 호를 그린다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, clockTicks, clockwiseArrow, ptXY } from '../layout';
import { currentFigure } from '../modes/slide-flip-turn';
import type { Pt, TransformConfig, TransformState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';
import { prefersReducedMotion } from '../views/parts/motion';

function clockCenter(state: TransformState): Pt | null {
  if (state.mode === 'slide-flip-turn') {
    const figure = currentFigure(state);
    return figure.outline[state.center] ?? figure.outline[0] ?? null;
  }
  if (state.mode !== 'predict') return null;
  const turn = state.operations.find((move) => move.kind === 'turn');
  return turn && turn.kind === 'turn' ? turn.center : null;
}

export function ClockHandOverlay({ state }: OverlayProps<TransformConfig, TransformState>) {
  if (state.mode !== 'slide-flip-turn' && state.mode !== 'predict') return null;
  const center = clockCenter(state);
  if (!center) return null;
  const rect = boardRect(state.settings.grid);
  const point = ptXY(rect, center);
  const radius = Math.max(64, rect.cell * 1.5);
  const ticks = clockTicks(point, radius);
  const reduced = prefersReducedMotion();
  const arrow = clockwiseArrow(point, radius * 0.62);
  const hand = (
    <line
      x1={point.x}
      y1={point.y}
      x2={point.x}
      y2={point.y - radius * 0.72}
      stroke="#7c3aed"
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
  return (
    <CanvasAlignedOverlay
      testId="clock-hand"
      canvasSelector={'svg[data-testid="transform-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <circle
        cx={point.x}
        cy={point.y}
        r={radius}
        fill="#ffffff"
        fillOpacity={0.35}
        stroke="#7c3aed"
        strokeWidth={2}
        strokeDasharray="7 6"
      />
      {ticks.map((tick, index) => (
        <line
          key={`tick-${index}`}
          x1={tick.from.x}
          y1={tick.from.y}
          x2={tick.to.x}
          y2={tick.to.y}
          stroke="#7c3aed"
          strokeWidth={index % 3 === 0 ? 3.5 : 2}
          strokeOpacity={index % 3 === 0 ? 0.9 : 0.55}
        />
      ))}
      {reduced ? (
        <>
          <path
            d={arrow.path}
            fill="none"
            stroke="#7c3aed"
            strokeWidth={3}
            strokeDasharray="8 6"
            strokeOpacity={0.8}
          />
          <polygon points={arrow.head} fill="#7c3aed" fillOpacity={0.8} />
          {hand}
        </>
      ) : (
        <g className={styles.clockHand} style={{ transformOrigin: `${point.x}px ${point.y}px` }}>
          {hand}
        </g>
      )}
      <circle cx={point.x} cy={point.y} r={5} fill="#7c3aed" />
    </CanvasAlignedOverlay>
  );
}
