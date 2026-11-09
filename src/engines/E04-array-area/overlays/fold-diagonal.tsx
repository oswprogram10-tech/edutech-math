/** 힌트 ②: 곱셈표의 대각선(같은 두 수의 곱)을 강조한다. 값은 쓰지 않는다. */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { diagonalSegment, tableRect } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

export function FoldDiagonalOverlay({ state }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  const rect = tableRect(
    state.settings.tableRows,
    state.settings.tableCols,
    state.settings.includeZero,
  );
  const line = diagonalSegment(rect);

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="array-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
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
    </CanvasAlignedOverlay>
  );
}
