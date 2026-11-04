/**
 * E07의 Observation.
 *
 * 판정·힌트는 이 값만 본다. 칸별 맞음·틀림은 화면에 내보내지 않는다.
 * 모든 수 값은 Rational의 정규 문자열(`"4.77"`은 `"477/100"`)이다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { classifyColumns, uniqueCodes } from './classify';
import type { ColumnError } from './classify';
import { classifyMul } from './classify-mul';
import { estimateIsMultiple, estimateSignal } from './estimate';
import { computeGrid, readResult } from './grid';
import { computeMulPlan, partialValues, rowsComplete } from './grid-mul';
import type { CellRef, ColumnCalcState } from './types';

function flaggedCellJson(cell: CellRef): JsonValue {
  return cell.index === undefined
    ? { row: cell.row, column: cell.column }
    : { row: cell.row, column: cell.column, index: cell.index };
}

export function observe(state: ColumnCalcState): Observation {
  const grid = computeGrid(state);
  const reading = readResult(state, grid);
  const plan = state.op === 'mul' ? computeMulPlan(state) : null;
  const partialRowsComplete = plan === null ? true : rowsComplete(state, plan);
  const complete = reading.complete && partialRowsComplete;

  let errors: ColumnError[];
  if (plan) {
    const mulError = classifyMul(state, plan);
    if (mulError) {
      errors = [mulError];
    } else if (reading.wrongColumns.length > 0) {
      errors = reading.wrongColumns.map((column) => ({ column, code: 'unknown' }));
    } else {
      errors = [];
    }
  } else {
    errors = classifyColumns(state, reading.wrongColumns, grid.alignment, grid.byColumn);
  }
  const misconceptions = uniqueCodes(errors);

  const errorViews: JsonValue[] = errors.map((error) => ({
    column: error.column,
    code: error.code,
  }));

  return {
    mode: state.mode,
    op: state.op,
    a: state.aText,
    b: state.bText,
    aligned: grid.alignment.aligned,
    alignment: grid.alignment.alignment,
    complete,
    result: complete ? reading.value : null,
    resultRaw: reading.raw,
    carries: { ...state.carries },
    regroups: { ...state.regroups },
    wrongColumns: [...reading.wrongColumns],
    errors: errorViews,
    misconceptions,
    // ── mul ─────────────────────────────────────────────────
    style: plan ? plan.style : null,
    partials: plan ? partialValues(state, plan) : null,
    expectedRowCount: plan ? plan.rows.length : null,
    rowsComplete: plan ? partialRowsComplete : null,
    flaggedCells: plan ? state.flagged.map(flaggedCellJson) : null,
    rowColors: plan ? { ...state.rowColors } : null,
    // ── 연결 ────────────────────────────────────────────────
    linkHighlights: [...state.linkHighlights],
    // ── estimate ────────────────────────────────────────────
    phase: state.mode === 'estimate' ? state.phase : null,
    estimate: state.mode === 'estimate' ? state.estimate : null,
    estimateIsMultiple: state.mode === 'estimate' ? estimateIsMultiple(state) : null,
    signal: state.mode === 'estimate' ? estimateSignal(state) : null,
    rechecked: state.mode === 'estimate' ? state.rechecked : null,
  };
}
