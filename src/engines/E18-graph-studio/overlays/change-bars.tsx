/**
 * 힌트 ② change-bars (MC-GRAPH-HEIGHT-NOT-CHANGE).
 *
 * 그래프 아래 띠에 구간마다 값의 변화량에 비례한 작은 막대를 둔다. 늘면 위로, 줄면 아래로 향한다.
 * 숫자는 쓰지 않는다. 점이 둘 다 있는 구간만 그린다.
 */
import { GraphOverlayFrame } from './frame';
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { laneCenter, laneWidth, ratioNumber } from '../line';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR } from './helpers';
import { lineScene } from './line-helpers';

const UP = '#2f7d4f';
const DOWN = '#b45309';
/** 띠의 가운데 줄(논리 y)과 가장 큰 변화의 막대 길이. */
const CENTER = 622;
const AMPLITUDE = 18;

export function ChangeBarsOverlay({ state }: OverlayProps<GraphConfig, GraphState>) {
  return (
    <GraphOverlayFrame
      testId="change-bars"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={1000}
      logicalHeight={700}
    >
      {(info) => {
        const scene = lineScene(state, info.width);
        if (!scene) return null;
        const { g, values } = scene;
        const changes: { readonly index: number; readonly change: Rational }[] = [];
        for (let index = 0; index + 1 < values.length; index += 1) {
          const from = values[index];
          const to = values[index + 1];
          if (from && to) changes.push({ index, change: to.sub(from) });
        }
        const biggest = changes.reduce(
          (max, item) => (item.change.abs().compareTo(max) > 0 ? item.change.abs() : max),
          Rational.of(0),
        );
        const barWidth = Math.min(46, laneWidth(g) * 0.4);
        return (
          <g>
            <rect
              data-testid="change-bars-strip"
              x={g.plot.x}
              y={CENTER - AMPLITUDE - 8}
              width={g.plot.width}
              height={AMPLITUDE * 2 + 16}
              rx={8}
              fill="#ffffff"
              fillOpacity={0.85}
              stroke="#8b96ab"
              strokeWidth={1.5}
            />
            <line
              x1={g.plot.x}
              x2={g.plot.x + g.plot.width}
              y1={CENTER}
              y2={CENTER}
              stroke="#5b6577"
              strokeWidth={2}
            />
            {changes.map(({ index, change }) => {
              const ratio = biggest.isZero() ? 0 : ratioNumber(change.abs().div(biggest));
              const height = change.isZero() ? 0 : Math.max(3, ratio * AMPLITUDE);
              const up = !change.isNegative();
              const middle = (laneCenter(g, index) + laneCenter(g, index + 1)) / 2;
              return (
                <rect
                  key={index}
                  data-change-index={index}
                  data-change-dir={change.isZero() ? 'flat' : up ? 'up' : 'down'}
                  x={middle - barWidth / 2}
                  y={up ? CENTER - height : CENTER}
                  width={barWidth}
                  height={height}
                  fill={up ? UP : DOWN}
                  stroke={up ? UP : DOWN}
                  strokeWidth={1}
                />
              );
            })}
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}
