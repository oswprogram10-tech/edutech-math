/**
 * 힌트 ②: 학생이 만든 분할 조각 중 하나를 강조하고, 그 조각의 크기(행×열)를
 * 다시 보여 준다. 전체 곱은 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { boundariesFor } from '../area';
import { areaPieceRects, areaRect, arrayRect, splitPieceRects } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function pieceIndex(args: unknown): number {
  if (args !== null && typeof args === 'object' && 'index' in args) {
    const index = (args as { readonly index?: unknown }).index;
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0) return index;
  }
  return 0;
}

export function KnownFactOverlay({ state, args }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  if (state.mode !== 'split' && state.mode !== 'area-model') return null;

  const pieces =
    state.mode === 'split'
      ? splitPieceRects(
          arrayRect(state.rows, state.cols, state.settings.maxRows, state.settings.maxCols),
          state.rows,
          state.cols,
          boundariesFor(state.rows, state.splits, 'rows'),
          boundariesFor(state.cols, state.splits, 'cols'),
          state.extendedRows,
        )
      : areaPieceRects(
          areaRect(state.settings.a, state.settings.b),
          state.settings.a,
          state.settings.b,
          state.areaSplitsA,
          state.areaSplitsB,
        );

  const piece = pieces[pieceIndex(args) % Math.max(1, pieces.length)];
  if (!piece) return null;

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="array-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <rect
        x={piece.x + 3}
        y={piece.y + 3}
        width={Math.max(0, piece.width - 6)}
        height={Math.max(0, piece.height - 6)}
        rx={8}
        fill="#e8872e"
        fillOpacity={0.18}
        stroke="#e8872e"
        strokeWidth={4}
      />
      <text
        x={piece.x + piece.width / 2}
        y={piece.y + piece.height / 2 + 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight={700}
        fill="#8a4b00"
      >
        {state.mode === 'area-model'
          ? `${piece.cols}×${piece.rows}`
          : `${piece.rows}×${piece.cols}`}
      </text>
    </CanvasAlignedOverlay>
  );
}
