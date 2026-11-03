/** 힌트 ②: 곱셈표의 대각선(같은 두 수의 곱)을 강조한다. 값은 쓰지 않는다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { diagonalSegment, tableRect } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';

export function FoldDiagonalOverlay({ state }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  const rect = tableRect(
    state.settings.tableRows,
    state.settings.tableCols,
    state.settings.includeZero,
  );
  const line = diagonalSegment(rect);

  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="#e8872e"
        strokeWidth={5}
        strokeDasharray="12 7"
        strokeOpacity={0.85}
      />
    </svg>
  );
}
