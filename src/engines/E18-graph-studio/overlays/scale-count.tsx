/**
 * 힌트 ② scale-count (MC-GRAPH-SCALE-ONE).
 *
 * 한 막대 옆에 첫 두 칸까지만 누적 값(예 2, 4)을 쓰고 그 위는 "…" 화살표로 둔다.
 * 끝까지 쓰면 읽을 값이 그대로 보이므로 두 칸까지만 쓴다.
 */
import { GraphOverlayFrame } from './frame';
import type { OverlayProps } from '../../../core/engine-sdk';
import { barRect, valuePosition } from '../layout';
import { graphStrings as S } from '../strings.ko';
import { formatValue, laneCenter, tickValueOf, yOfCell } from '../line';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR, overlayFrame, targetCategory } from './helpers';
import { argOf, laneIndexOf, lineScene } from './line-helpers';

/** 누적 값을 쓰는 칸 수. 이보다 위는 쓰지 않는다. */
const SHOWN_CELLS = 2;

/** 꺾은선그래프: `args.x`의 레인 옆에 시작값부터 첫 두 칸까지만 누적 값을 쓰고 그 위는 "…"로 둔다. */
function LineScaleCountOverlay({ state, args }: OverlayProps<GraphConfig, GraphState>) {
  return (
    <GraphOverlayFrame
      testId="scale-count"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={1000}
      logicalHeight={700}
    >
      {(info) => {
        const scene = lineScene(state, info.width);
        if (!scene) return null;
        const { g, line } = scene;
        const index = laneIndexOf(line, argOf(args, 'x')) ?? 0;
        if (line.xs.length === 0) return null;
        const last = index === line.xs.length - 1;
        const x = laneCenter(g, index) + (last ? -18 : 18);
        const anchor = last ? 'end' : 'start';
        const shown = Math.min(SHOWN_CELLS, g.cells);
        return (
          <g>
            {Array.from({ length: shown }, (_, offset) => {
              const k = offset + 1;
              const text = formatValue(tickValueOf(g, k));
              return (
                <text
                  key={k}
                  data-scale-count={text}
                  x={x}
                  y={yOfCell(g, k - 0.5) + 9}
                  textAnchor={anchor}
                  fontSize={34}
                  fontWeight={800}
                  fill="#b45309"
                >
                  {text}
                </text>
              );
            })}
            {g.cells > SHOWN_CELLS ? (
              <text
                data-testid="scale-count-more"
                x={x}
                y={yOfCell(g, SHOWN_CELLS + 0.5) + 9}
                textAnchor={anchor}
                fontSize={34}
                fontWeight={800}
                fill="#b45309"
              >
                {S.overlay.more}
              </text>
            ) : null}
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}

export function ScaleCountOverlay(props: OverlayProps<GraphConfig, GraphState>) {
  if (props.state.mode === 'line-graph') return <LineScaleCountOverlay {...props} />;
  return <BarScaleCountOverlay {...props} />;
}

function BarScaleCountOverlay({ state, args }: OverlayProps<GraphConfig, GraphState>) {
  const target = targetCategory(state, args, state.settings.categories[0]);
  if (!target) return null;
  const frame = overlayFrame(state);
  const vertical = frame.orientation === 'vertical';
  const box = barRect(frame, target.index, 1);
  const labelOf = (index: number) => (index + 1) * state.scale;
  const shown = Math.min(SHOWN_CELLS, frame.cells);

  return (
    <GraphOverlayFrame
      testId="scale-count"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={frame.width}
      logicalHeight={frame.height}
    >
      {Array.from({ length: shown }, (_, index) => {
        const middle = valuePosition(frame, index + 0.5);
        const x = vertical ? box.x + box.width + 14 : middle;
        const y = vertical ? middle + 9 : box.y - 14;
        return (
          <text
            key={index}
            data-scale-count={labelOf(index)}
            x={x}
            y={y}
            textAnchor={vertical ? 'start' : 'middle'}
            fontSize={26}
            fontWeight={800}
            fill="#b45309"
          >
            {labelOf(index)}
          </text>
        );
      })}
      {frame.cells > SHOWN_CELLS ? (
        <text
          data-testid="scale-count-more"
          x={vertical ? box.x + box.width + 14 : valuePosition(frame, SHOWN_CELLS + 0.5)}
          y={vertical ? valuePosition(frame, SHOWN_CELLS + 0.5) + 9 : box.y - 14}
          textAnchor={vertical ? 'start' : 'middle'}
          fontSize={26}
          fontWeight={800}
          fill="#b45309"
        >
          {vertical ? S.overlay.more : S.overlay.moreHorizontal}
        </text>
      ) : null}
    </GraphOverlayFrame>
  );
}
