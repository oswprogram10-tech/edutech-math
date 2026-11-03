/**
 * E04의 관찰 결과. 판정·힌트는 이 값만 본다.
 * 전체 곱은 `total`·`partialSum`에만 있고, 화면 표시 여부는 View가 정한다.
 */
import type { Observation } from '../../core/engine-sdk';
import { wrongCellsOf } from './area';
import { distinctArrangementsOf, piecesOf } from './reduce';
import type { ArrayAreaState } from './types';

export function observe(state: ArrayAreaState): Observation {
  const pieces = piecesOf(state);
  const partials = pieces.map((piece) => ({
    rows: piece.rows,
    cols: piece.cols,
    product: piece.product,
    sign: piece.sign,
  }));
  const partialSum = pieces.reduce((sum, piece) => sum + piece.sign * piece.product, 0);
  const table = state.mode === 'times-table';

  return {
    mode: state.mode,
    rows: state.rows,
    cols: state.cols,
    total:
      state.mode === 'area-model'
        ? state.settings.a * state.settings.b
        : state.mode === 'times-table'
          ? null
          : state.rows * state.cols,
    rotations: state.rotations,
    recorded: state.recorded.map((item) => ({ rows: item.rows, cols: item.cols })),
    distinctArrangements: distinctArrangementsOf(state.recorded),
    splitLine: state.splitLine
      ? { orientation: state.splitLine.orientation, at: state.splitLine.at }
      : null,

    splits: state.splits.map((split) => ({ orientation: split.orientation, at: split.at })),
    partials,
    partialSum,
    recordedSplits: state.recordedSplits.map((splits) =>
      splits.map((split) => ({ orientation: split.orientation, at: split.at })),
    ),
    distinctSplits: state.recordedSplits.length,
    extendedRows: state.extendedRows,

    a: state.mode === 'area-model' ? state.settings.a : null,
    b: state.mode === 'area-model' ? state.settings.b : null,
    splitsA: state.mode === 'area-model' ? [...state.areaSplitsA] : null,
    splitsB: state.mode === 'area-model' ? [...state.areaSplitsB] : null,
    pieces: state.mode === 'area-model' ? partials : null,

    cells: table ? { ...state.cells } : null,
    wrongCells: table
      ? wrongCellsOf(
          state.cells,
          state.settings.includeZero,
          state.settings.tableRows,
          state.settings.tableCols,
        )
      : null,
    selected: table ? [...state.selected] : null,
    painted: table ? { ...state.painted } : null,
  };
}
