/**
 * 힌트 ② unfold-axis (MC-GRAPH-WAVY-LINE).
 *
 * 그래프 옆(그림판 오른쪽 위)에 세로축을 0부터 다 펼친 작은 그림을 같은 선·낮은 불투명도로 그린다.
 * 물결선 자리(0부터 시작값까지)는 같은 색 괄호로 그림과 작은 그림에 나란히 표시한다. 값 글자는 쓰지 않는다.
 */
import { GraphOverlayFrame } from './frame';
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { plotBottom, ratioNumber } from '../line';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR } from './helpers';
import { lineScene } from './line-helpers';

const BRACKET = '#b45309';
const LINE = '#1d4fa8';
const BOX_WIDTH = 230;
const BOX_HEIGHT = 200;

export function UnfoldAxisOverlay({ state }: OverlayProps<GraphConfig, GraphState>) {
  return (
    <GraphOverlayFrame
      testId="unfold-axis"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={1000}
      logicalHeight={700}
    >
      {(info) => {
        const scene = lineScene(state, info.width);
        if (!scene) return null;
        const { g, values } = scene;
        const box = { x: g.plot.x + g.plot.width - BOX_WIDTH - 6, y: g.plot.y + 6 };
        const axisX = box.x + 36;
        const top = box.y + 16;
        const base = box.y + BOX_HEIGHT - 16;
        const toMini = (value: Rational) =>
          base - Math.min(1, ratioNumber(value.div(g.max))) * (base - top);
        const count = values.length;
        const right = box.x + BOX_WIDTH - 12;
        const miniX = (index: number) =>
          axisX + 14 + ((right - (axisX + 14)) * (index + 0.5)) / Math.max(1, count);
        const wavyTop = g.wavy ? toMini(g.from) : base;
        const miniPoints = values
          .map((value, index) => (value ? `${miniX(index)},${toMini(value)}` : null))
          .filter((point): point is string => point !== null);
        const mainBase = plotBottom(g);
        const mainTop = mainBase - g.unit;
        return (
          <g>
            <rect
              data-testid="unfold-axis-box"
              x={box.x}
              y={box.y}
              width={BOX_WIDTH}
              height={BOX_HEIGHT}
              rx={10}
              fill="#ffffff"
              fillOpacity={0.9}
              stroke="#8b96ab"
              strokeWidth={1.5}
            />
            <line x1={axisX} x2={axisX} y1={top} y2={base} stroke="#5b6577" strokeWidth={2.5} />
            <line
              x1={axisX}
              x2={box.x + BOX_WIDTH - 10}
              y1={base}
              y2={base}
              stroke="#5b6577"
              strokeWidth={2.5}
            />
            {miniPoints.length > 1 ? (
              <polyline
                points={miniPoints.join(' ')}
                fill="none"
                stroke={LINE}
                strokeWidth={4}
                opacity={0.5}
              />
            ) : null}
            {values.map((value, index) =>
              value ? (
                <circle
                  key={index}
                  cx={miniX(index)}
                  cy={toMini(value)}
                  r={5}
                  fill={LINE}
                  opacity={0.5}
                />
              ) : null,
            )}
            {g.wavy ? (
              <>
                <path
                  data-testid="unfold-axis-bracket"
                  d={`M ${axisX - 6} ${base} h -8 V ${wavyTop} h 8`}
                  fill="none"
                  stroke={BRACKET}
                  strokeWidth={4}
                />
                <path
                  data-testid="unfold-axis-bracket-main"
                  d={`M ${g.plot.x + 14} ${mainBase} h 10 V ${mainTop} h -10`}
                  fill="none"
                  stroke={BRACKET}
                  strokeWidth={4}
                />
                <line
                  x1={g.plot.x + 24}
                  y1={(mainBase + mainTop) / 2}
                  x2={axisX - 14}
                  y2={(base + wavyTop) / 2}
                  stroke={BRACKET}
                  strokeWidth={2.5}
                  strokeDasharray="7 6"
                  opacity={0.7}
                />
              </>
            ) : null}
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}
