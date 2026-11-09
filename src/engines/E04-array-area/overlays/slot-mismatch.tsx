/**
 * 힌트 ②: 퍼즐에서 같은 열/행의 이웃 조각 너비·높이가 맞지 않는 경계를
 * 빨강 + 빗금으로 보여 준다. 곱이나 변 길이 합은 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { puzzleRects } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function SlotMismatchOverlay({ state }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  if (state.mode !== 'area-model' || state.puzzle === null) return null;
  const { pieces, placed } = state.puzzle;
  if (pieces.length === 0) return null;
  const widths = uniqueSorted(pieces.map((piece) => piece.w));
  const heights = uniqueSorted(pieces.map((piece) => piece.h));
  const cols = Math.max(1, widths.length);
  const rows = Math.max(1, heights.length);
  const rects = puzzleRects();
  const boardScale = Math.min(
    rects.board.width / Math.max(1, state.settings.a),
    rects.board.height / Math.max(1, state.settings.b),
  );
  const columnWidths = Array.from({ length: cols }, (_, col) => {
    const piece = pieces.find((item) => placed[item.id]?.col === col);
    return piece?.w ?? state.settings.a / cols;
  });
  const rowHeights = Array.from({ length: rows }, (_, row) => {
    const piece = pieces.find((item) => placed[item.id]?.row === row);
    return piece?.h ?? state.settings.b / rows;
  });
  const columnX: number[] = [rects.board.x];
  for (let col = 0; col < cols; col += 1) {
    columnX.push((columnX[col] ?? rects.board.x) + (columnWidths[col] ?? 0) * boardScale);
  }
  const rowY: number[] = [rects.board.y];
  for (let row = 0; row < rows; row += 1) {
    rowY.push((rowY[row] ?? rects.board.y) + (rowHeights[row] ?? 0) * boardScale);
  }

  const badColumns = Array.from({ length: cols }, (_, col) => {
    const values = new Set(
      pieces.filter((piece) => placed[piece.id]?.col === col).map((piece) => piece.w),
    );
    return values.size > 1;
  });
  const badRows = Array.from({ length: rows }, (_, row) => {
    const values = new Set(
      pieces.filter((piece) => placed[piece.id]?.row === row).map((piece) => piece.h),
    );
    return values.size > 1;
  });
  if (!badColumns.some(Boolean) && !badRows.some(Boolean)) return null;

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="array-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="e04-slot-mismatch"
          width={9}
          height={9}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={9} stroke="#c2410c" strokeWidth={2.6} />
        </pattern>
      </defs>
      {badColumns.map((bad, col) =>
        bad ? (
          <rect
            key={`bad-col-${col}`}
            x={columnX[col] ?? rects.board.x}
            y={rects.board.y}
            width={Math.max(2, (columnX[col + 1] ?? rects.board.x) - (columnX[col] ?? 0))}
            height={(rowY[rows] ?? rects.board.y) - rects.board.y}
            fill="url(#e04-slot-mismatch)"
            fillOpacity={0.24}
            stroke="#c2410c"
            strokeWidth={3}
            strokeDasharray="8 5"
          />
        ) : null,
      )}
      {badRows.map((bad, row) =>
        bad ? (
          <rect
            key={`bad-row-${row}`}
            x={rects.board.x}
            y={rowY[row] ?? rects.board.y}
            width={(columnX[cols] ?? rects.board.x) - rects.board.x}
            height={Math.max(2, (rowY[row + 1] ?? rects.board.y) - (rowY[row] ?? 0))}
            fill="url(#e04-slot-mismatch)"
            fillOpacity={0.24}
            stroke="#c2410c"
            strokeWidth={3}
            strokeDasharray="8 5"
          />
        ) : null,
      )}
    </CanvasAlignedOverlay>
  );
}
