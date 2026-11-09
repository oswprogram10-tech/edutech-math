/**
 * 힌트 ②: 행마다 1, 2, 3 … 번호를 붙여 "몇 줄인지" 세게 한다.
 * 곱(전체 수)은 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { arrayRect, cellCenter } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

export function RowCountOverlay({ state }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  const { rows, cols, settings } = state;
  if (rows < 1) return null;
  const rect = arrayRect(rows, cols, settings.maxRows, settings.maxCols);

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="array-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {Array.from({ length: rows }, (_, row) => {
        const point = cellCenter(rect, row, 0);
        return (
          <g key={`row-${row}`}>
            <circle cx={rect.x - 24} cy={point.y} r={13} fill="#e8872e" fillOpacity={0.18} />
            <text
              x={rect.x - 24}
              y={point.y + 6}
              textAnchor="middle"
              fontSize={15}
              fontWeight={700}
              fill="#8a4b00"
            >
              {row + 1}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
