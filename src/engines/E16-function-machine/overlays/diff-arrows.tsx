/**
 * 힌트 ② diff-arrows (MC-FUNC-ADD-ONLY).
 * 표에서 ○가 1씩 커지는 이웃 열 쌍마다 ○ 줄 위에 "+1", □ 줄 아래에 "+k" 화살표를 그린다.
 * 이웃 쌍이 없으면 ○ 차이가 가장 작은 쌍을 쓴다. 표에 있는 수끼리의 차이만 쓴다.
 */
import { useId } from 'react';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { arrowTop, colX, row0Top } from '../table-layout';
import type { FunctionConfig, FunctionState } from '../types';
import { RELATION_CANVAS, onGrid, neighborPairs, overlayData, signed } from './helpers';

export function DiffArrowsOverlay({ state }: OverlayProps<FunctionConfig, FunctionState>) {
  const markerId = useId();
  if (onGrid(state)) return null;
  const { columns, layout } = overlayData(state);
  const pairs = neighborPairs(columns);
  if (pairs.length === 0) return null;
  const half = layout.cellW / 2;
  const topEdge = row0Top(layout) - 3;
  const bottomEdge = arrowTop(layout) + 3;

  return (
    <CanvasAlignedOverlay
      testId="diff-arrows"
      canvasSelector={RELATION_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill="#c0731a" />
        </marker>
      </defs>
      {pairs.map((pair) => {
        const x1 = colX(layout, pair.from) + half;
        const x2 = colX(layout, pair.to) + half;
        const mid = (x1 + x2) / 2;
        return (
          <g key={pair.from} data-testid="diff-arrow">
            <path
              d={`M${x1} ${topEdge} Q${mid} ${topEdge - 26} ${x2 - 4} ${topEdge}`}
              fill="none"
              stroke="#c0731a"
              strokeWidth={4}
              markerEnd={`url(#${markerId})`}
            />
            <text
              x={mid}
              y={topEdge - 10}
              fontSize={16}
              fontWeight={800}
              textAnchor="middle"
              fill="#8a4b00"
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
              data-testid="diff-arrow-x"
            >
              {signed(pair.dx)}
            </text>
            <path
              d={`M${x1} ${bottomEdge} Q${mid} ${bottomEdge + 30} ${x2 - 4} ${bottomEdge}`}
              fill="none"
              stroke="#c0731a"
              strokeWidth={4}
              markerEnd={`url(#${markerId})`}
            />
            <text
              x={mid}
              y={bottomEdge + 22}
              fontSize={16}
              fontWeight={800}
              textAnchor="middle"
              fill="#8a4b00"
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
              data-testid="diff-arrow-y"
            >
              {signed(pair.dy)}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
