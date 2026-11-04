/**
 * E04의 관찰 결과. 판정·힌트는 이 값만 본다.
 * 전체 곱은 `total`·`partialSum`에만 있고, 화면 표시 여부는 View가 정한다.
 */
import type { Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import {
  decimalAreaOf,
  fractionAreaOf,
  fractionText,
  puzzleAssemblyOf,
  scalerResult,
  scalerTrend,
  tileFit,
  wrongCellsOf,
} from './area';
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
  const tiling = state.mode === 'tiling';
  const decimal = state.decimal;
  const fraction = state.fraction;
  const scaler = state.scaler;
  const puzzle = state.puzzle;

  const rooms =
    state.settings.compare === null
      ? [{ width: state.settings.width, height: state.settings.height }]
      : [
          { width: state.settings.width, height: state.settings.height },
          {
            width: state.settings.compare.width,
            height: state.settings.compare.height,
          },
        ];
  const fits =
    tiling && state.tileSize !== null
      ? rooms.map((room) => tileFit(room.width, room.height, state.tileSize ?? 1))
      : [];

  const decimalFacts =
    decimal !== null
      ? decimalAreaOf(decimal.a, decimal.b, state.settings.maxA, state.settings.maxB)
      : null;
  const fractionFacts = fraction !== null ? fractionAreaOf(fraction.a, fraction.b) : null;

  const multiplier =
    scaler !== null && scaler.index !== null
      ? (state.settings.multipliers[scaler.index] ?? null)
      : null;
  const result = multiplier !== null ? scalerResult(state.settings.base, multiplier) : null;
  let predictionFits: boolean | null = null;
  if (scaler !== null && scaler.prediction !== null && multiplier !== null) {
    try {
      predictionFits = scalerTrend(Rational.parse(multiplier)) === scaler.prediction;
    } catch {
      predictionFits = false;
    }
  }
  const assembly = puzzle !== null ? puzzleAssemblyOf(puzzle.pieces, puzzle.placed) : null;

  const factors = new Set<number>();
  for (const item of state.recorded) {
    factors.add(item.rows);
    factors.add(item.cols);
  }

  return {
    mode: state.mode,
    rows: state.rows,
    cols: state.cols,
    total:
      state.mode === 'area-model'
        ? state.settings.a * state.settings.b
        : state.mode === 'times-table' ||
            state.mode === 'tiling' ||
            state.mode === 'decimal-area' ||
            state.mode === 'fraction-area'
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

    a:
      decimalFacts !== null
        ? decimalFacts.a.toDecimalString()
        : fraction !== null
          ? fractionText(fraction.a)
          : state.mode === 'area-model'
            ? state.settings.a
            : null,
    b:
      decimalFacts !== null
        ? decimalFacts.b.toDecimalString()
        : fraction !== null
          ? fractionText(fraction.b)
          : state.mode === 'area-model'
            ? state.settings.b
            : null,
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

    factorsFound: [...factors].sort((a, b) => a - b),

    // T045 확장
    width: tiling ? state.settings.width : null,
    height: tiling ? state.settings.height : null,
    tileSize: tiling ? state.tileSize : null,
    fitsAll: tiling ? fits.length > 0 && fits.every((item) => item.fits) : null,
    leftoverCells: tiling ? fits.map((item) => item.leftover) : null,
    tilesUsed: tiling ? fits.map((item) => item.tiles) : null,
    recordedSizes: tiling ? [...state.recordedSizes] : null,

    product:
      decimalFacts !== null
        ? decimalFacts.product.toDecimalString()
        : fractionFacts !== null
          ? fractionFacts.product.toString()
          : null,
    overlapCells: decimalFacts?.overlapCells ?? fractionFacts?.overlapCells ?? null,
    unitSquares: decimalFacts?.unitSquares ?? null,
    totalCells: fractionFacts?.totalCells ?? null,

    prediction: scaler?.prediction ?? null,
    multiplier,
    result,
    tried: scaler !== null ? [...scaler.tried] : null,
    predictionFits,

    puzzleAssembled: puzzle !== null ? assembly !== null : null,
    assembledDims: assembly !== null ? { a: assembly.a, b: assembly.b } : null,
    placedPieces: puzzle !== null ? Object.keys(puzzle.placed).length : null,
  };
}
