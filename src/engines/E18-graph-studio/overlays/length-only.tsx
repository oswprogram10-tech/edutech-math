/**
 * 힌트 ② length-only (MC-GRAPH-BAR-WIDTH).
 *
 * 모든 막대를 같은 회색 + 같은 굵기로 덮고, 축에서 막대 끝까지 길이 괄호(⟷)를 그린다.
 * 값 글자는 쓰지 않는다. 막대그래프에서만 그린다.
 */
import { GraphOverlayFrame } from './frame';
import type { OverlayProps } from '../../../core/engine-sdk';
import { barRect, valuePosition } from '../layout';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR, overlayFrame } from './helpers';

const GRAY = '#8b96ab';
const BRACKET = '#b45309';
const OFFSET = 22;
const HEAD = 16;

export function LengthOnlyOverlay({ state }: OverlayProps<GraphConfig, GraphState>) {
  const { settings } = state;
  if (settings.graphType !== 'bar') return null;
  const frame = overlayFrame(state);
  const vertical = frame.orientation === 'vertical';
  const base = valuePosition(frame, 0);

  return (
    <GraphOverlayFrame
      testId="length-only"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={frame.width}
      logicalHeight={frame.height}
    >
      {settings.categories.map((cat, index) => {
        const exact =
          settings.graph === 'given'
            ? (settings.data?.[cat] ?? 0) / state.scale
            : (state.bars[cat] ?? 0);
        const cells = Math.min(frame.cells, exact);
        if (cells <= 0) return null;
        const rect = barRect(frame, index, cells);
        const end = valuePosition(frame, cells);
        // 길이 괄호: 축에서 막대 끝까지, 막대 바깥쪽에 나란히 그린 두 방향 화살표.
        const line = vertical
          ? { x1: rect.x - OFFSET, x2: rect.x - OFFSET, y1: base, y2: end }
          : { x1: base, x2: end, y1: rect.y - OFFSET, y2: rect.y - OFFSET };
        const heads = vertical
          ? [
              `${line.x1 - 9},${end + HEAD} ${line.x1 + 9},${end + HEAD} ${line.x1},${end}`,
              `${line.x1 - 9},${base - HEAD} ${line.x1 + 9},${base - HEAD} ${line.x1},${base}`,
            ]
          : [
              `${base},${line.y1} ${base + HEAD},${line.y1 - 9} ${base + HEAD},${line.y1 + 9}`,
              `${end},${line.y1} ${end - HEAD},${line.y1 - 9} ${end - HEAD},${line.y1 + 9}`,
            ];
        return (
          <g key={cat} data-length-cat={cat}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={GRAY}
              stroke="#5b6577"
              strokeWidth={3}
            />
            <line {...line} stroke={BRACKET} strokeWidth={4} />
            {heads.map((points) => (
              <polygon key={points} points={points} fill={BRACKET} />
            ))}
          </g>
        );
      })}
    </GraphOverlayFrame>
  );
}
