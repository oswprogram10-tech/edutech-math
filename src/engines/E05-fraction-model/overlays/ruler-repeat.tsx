/**
 * 힌트 ②: 나뉨수 위에 자 윤곽을 흐린 점선으로 되풀이해 그린다.
 * 번호를 쓰지 않고, 몫도 쓰지 않는다(T049 결정 12, MC-DIV-ALWAYS-SMALLER).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { screenLength } from '../fractions';
import { measureBoard } from '../layout';
import { measureSummary } from '../reduce-divide-measure';
import type { FractionModelConfig, FractionModelState } from '../types';

export function RulerRepeatOverlay({
  state,
}: OverlayProps<FractionModelConfig, FractionModelState>) {
  if (state.mode !== 'divide-measure') return null;
  const summary = measureSummary(state);
  const board = measureBoard(summary.dividend, summary.divisor);
  const rulerWidth = Math.max(1, board.unit * screenLength(summary.divisor));
  const totalWidth = Math.max(1, board.unit * screenLength(summary.dividend));
  const count = Math.min(24, Math.ceil(totalWidth / rulerWidth));
  if (count <= 0) return null;
  return (
    <svg
      viewBox="0 0 1000 600"
      width="100%"
      height="100%"
      data-testid="overlay-ruler-repeat"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <rect
          key={`repeat-ruler-${index}`}
          x={board.dividendBar.x + index * rulerWidth}
          y={board.dividendBar.y}
          width={Math.max(1, rulerWidth)}
          height={board.dividendBar.height}
          fill="none"
          stroke="#5b6577"
          strokeWidth={2}
          strokeDasharray="8 8"
          opacity={0.65}
        />
      ))}
    </svg>
  );
}
