/**
 * 힌트 ②: 남은 부분 바로 옆에 자 하나를 나란히 그려, 남은 길이를 자와 견주게 한다.
 * 값 글자는 쓰지 않는다(T049 결정 12, MC-FRAC-DIV-REMAINDER-UNIT).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { screenLength } from '../fractions';
import { measureBoard } from '../layout';
import { measureSummary } from '../reduce-divide-measure';
import type { FractionModelConfig, FractionModelState } from '../types';

export function RemainderBesideOverlay({
  state,
}: OverlayProps<FractionModelConfig, FractionModelState>) {
  if (state.mode !== 'divide-measure') return null;
  const summary = measureSummary(state);
  if (summary.remaining.isZero()) return null;
  const board = measureBoard(summary.dividend, summary.divisor, state.rulersLaid);
  const measuredLength = summary.divisor.mul(summary.measured);
  const startX = board.dividendBar.x + board.unit * screenLength(measuredLength);
  const rulerWidth = Math.max(1, board.unit * screenLength(summary.divisor));
  return (
    <svg
      viewBox="0 0 1000 600"
      width="100%"
      height="100%"
      data-testid="overlay-remainder-beside"
      aria-hidden="true"
    >
      <rect
        x={startX}
        y={board.dividendBar.y - 12}
        width={rulerWidth}
        height={board.dividendBar.height + 24}
        rx={8}
        fill="none"
        stroke="#2f6fde"
        strokeWidth={3}
        strokeDasharray="10 7"
      />
      <rect
        x={startX}
        y={board.rulerBar.y}
        width={rulerWidth}
        height={board.rulerBar.height}
        rx={6}
        fill="#dbe7ff"
        opacity={0.6}
        stroke="#2f6fde"
        strokeWidth={3}
      />
    </svg>
  );
}
