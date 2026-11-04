/**
 * 힌트 ②: divisor 줄 가로 점선만 미리 보여 준다.
 * 남길 줄이나 값을 정해 주지 않는다(T049 결정 12, MC-FRAC-DIV-WHOLE-NUMERATOR).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { divideWholeBoard, WHOLE_GAP } from '../layout';
import type { FractionModelConfig, FractionModelState } from '../types';

export function RowPreviewOverlay({
  state,
}: OverlayProps<FractionModelConfig, FractionModelState>) {
  if (state.mode !== 'partition' || !('variant' in state)) return null;
  if (state.variant !== 'divide-whole') return null;
  const board = divideWholeBoard(state.dividendParts, state.dividendShaded);
  const rows = Math.max(1, state.divisor);
  const lines: Array<{ x1: number; x2: number; y: number }> = [];
  for (let square = 0; square < board.squares; square += 1) {
    const originX = board.originX + square * (board.size + WHOLE_GAP);
    for (let row = 1; row < rows; row += 1) {
      const y = board.originY + (board.size * row) / rows;
      lines.push({ x1: originX, x2: originX + board.size, y });
    }
  }
  if (lines.length === 0) return null;
  return (
    <svg
      viewBox="0 0 1000 600"
      width="100%"
      height="100%"
      data-testid="overlay-row-preview"
      aria-hidden="true"
    >
      {lines.map((line, index) => (
        <line
          key={`row-preview-${index}`}
          x1={line.x1}
          y1={line.y}
          x2={line.x2}
          y2={line.y}
          stroke="#2f6fde"
          strokeWidth={3}
          strokeDasharray="9 7"
        />
      ))}
    </svg>
  );
}
