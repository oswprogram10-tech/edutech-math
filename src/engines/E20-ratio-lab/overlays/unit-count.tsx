/**
 * 힌트 ② unit-count (MC-PROPORTION-DIVIDE-BY-RATIO-TERM).
 * 막대의 모든 칸에 1부터 번호를 매기고, 전체 괄호 위에 "모두 n칸"을 쓴다. n은 비의 합, 곧 막대의 칸 수다.
 * 한 칸 크기(답)는 쓰지 않는다. symbols look에서는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { barLayout } from '../barLayout';
import { E20_STRINGS as S } from '../strings.ko';
import { BAR_LOGICAL_HEIGHT, CANVAS_SELECTOR, LOGICAL_WIDTH } from '../types';
import type { RatioConfig, RatioState } from '../types';

const INK = '#1d2330';
const BLUE = '#2f6fde';

export function UnitCountOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  if (state.mode !== 'bar-model' || state.error !== null || state.settings.look === 'symbols') {
    return null;
  }
  const layout = barLayout(state.settings);
  return (
    <CanvasAlignedOverlay
      testId="overlay-unit-count"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={BAR_LOGICAL_HEIGHT}
    >
      {layout.rows.flatMap((row, rowIndex) =>
        row.cells.map((cell, cellIndex) => {
          // 앞 줄들의 칸 수를 이어서 1부터 센다.
          const n =
            layout.rows.slice(0, rowIndex).reduce((sum, r) => sum + r.terms, 0) + cellIndex + 1;
          return (
            <text
              key={`n-${n}`}
              x={cell.x + 8}
              y={cell.y + 22}
              fontSize={20}
              fontWeight={800}
              fill={BLUE}
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
              data-part="cell-number"
              data-number={n}
            >
              {n}
            </text>
          );
        }),
      )}
      <text
        x={layout.total.x + layout.total.w / 2}
        y={layout.total.y - 26}
        textAnchor="middle"
        fontSize={28}
        fontWeight={800}
        fill={INK}
        data-part="all-cells"
        data-count={layout.sum}
      >
        {S.bar.overlay.allCells(layout.sum)}
      </text>
    </CanvasAlignedOverlay>
  );
}
