/**
 * 힌트 ②: decimal-area·fraction-area에서 겹친 칸에 1, 2, 3 … 번호를 붙인다.
 * 곱은 쓰지 않고 학생이 만든 칸을 세어 보게 한다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { decimalTenthsOf } from '../area';
import { decimalBoardRect, fractionSquareRect } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';

export function OverlapCountOverlay({ state }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  if (state.mode === 'decimal-area' && state.decimal !== null) {
    const board = decimalBoardRect(state.settings.maxA, state.settings.maxB);
    const aCells = decimalTenthsOf(state.decimal.a);
    const bCells = decimalTenthsOf(state.decimal.b);
    return (
      <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
        {Array.from({ length: aCells }, (_, col) =>
          Array.from({ length: bCells }, (_, row) => {
            const number = col * bCells + row + 1;
            return (
              <text
                key={`overlap-${col}-${row}`}
                x={board.x + (col + 0.5) * board.cell}
                y={board.y + (row + 0.5) * board.cell + 3}
                textAnchor="middle"
                fontSize={Math.min(13, board.cell * 0.56)}
                fontWeight={700}
                fill="#215c2a"
              >
                {number}
              </text>
            );
          }),
        )}
      </svg>
    );
  }

  if (state.mode === 'fraction-area' && state.fraction !== null) {
    const fraction = state.fraction;
    const square = fractionSquareRect();
    const cellWidth = square.width / fraction.a.n;
    const cellHeight = square.height / fraction.b.n;
    return (
      <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
        {Array.from({ length: fraction.a.k }, (_, col) =>
          Array.from({ length: fraction.b.k }, (_, row) => {
            const number = col * fraction.b.k + row + 1;
            return (
              <text
                key={`overlap-frac-${col}-${row}`}
                x={square.x + (col + 0.5) * cellWidth}
                y={square.y + (row + 0.5) * cellHeight + 5}
                textAnchor="middle"
                fontSize={Math.min(16, cellWidth * 0.42)}
                fontWeight={700}
                fill="#215c2a"
              >
                {number}
              </text>
            );
          }),
        )}
      </svg>
    );
  }

  return null;
}
