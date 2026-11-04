/**
 * 힌트 ②: 겹친 칸에 1, 2, 3… 번호를 찍어 센다.
 * 곱(정답)은 쓰지 않는다(T049 결정 12).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { multiplyBoard, WHOLE_GAP } from '../layout';
import { cellState, multiplySummary } from '../reduce-multiply';
import type { FractionModelConfig, FractionModelState } from '../types';

export function OverlapCountOverlay({
  state,
}: OverlayProps<FractionModelConfig, FractionModelState>) {
  if (state.mode !== 'multiply') return null;
  const summary = multiplySummary(state);
  const board = multiplyBoard(state.aParts, state.aShaded, state.bParts);
  let count = 0;
  const labels: Array<{ x: number; y: number; value: number }> = [];
  for (let square = 0; square < board.squares; square += 1) {
    const originX = board.originX + square * (board.size + WHOLE_GAP);
    for (let row = 0; row < summary.bParts; row += 1) {
      for (let column = 0; column < summary.aParts; column += 1) {
        const cell = cellState(state, square, column, row);
        if (!cell.inA || !cell.inB) continue;
        count += 1;
        labels.push({
          x: originX + (column + 0.5) * board.cellWidth,
          y: board.originY + (row + 0.5) * board.cellHeight,
          value: count,
        });
      }
    }
  }
  if (labels.length === 0) return null;
  return (
    <svg
      viewBox="0 0 1000 600"
      width="100%"
      height="100%"
      data-testid="overlay-overlap-count"
      aria-hidden="true"
    >
      {labels.map((label) => (
        <g key={`overlap-count-${label.value}`}>
          <circle cx={label.x} cy={label.y} r={13} fill="#ffffff" opacity={0.9} />
          <text
            x={label.x}
            y={label.y + 6}
            textAnchor="middle"
            fontSize={17}
            fontWeight={700}
            fill="#215c2a"
          >
            {label.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
