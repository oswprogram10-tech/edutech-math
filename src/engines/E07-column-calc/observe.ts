/**
 * E07의 Observation.
 *
 * 판정·힌트는 이 값만 본다. 칸별 맞음·틀림은 화면에 내보내지 않는다.
 * 모든 수 값은 Rational의 정규 문자열(`"4.77"`은 `"477/100"`)이다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { classifyColumns, uniqueCodes } from './classify';
import { computeGrid, readResult } from './grid';
import type { ColumnCalcState } from './types';

export function observe(state: ColumnCalcState): Observation {
  const grid = computeGrid(state);
  const reading = readResult(state, grid);
  const errors = classifyColumns(state, reading.wrongColumns, grid.alignment, grid.byColumn);
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
    complete: reading.complete,
    result: reading.value,
    resultRaw: reading.raw,
    carries: { ...state.carries },
    regroups: { ...state.regroups },
    wrongColumns: [...reading.wrongColumns],
    errors: errorViews,
    misconceptions,
  };
}
