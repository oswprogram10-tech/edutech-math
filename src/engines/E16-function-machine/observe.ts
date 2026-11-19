/**
 * E16 Observation. 판정 전용 값(`matchesHidden`, `cellsCorrect`, 오개념)은 여기에만 둔다.
 * View는 이 값을 읽지 않는다. 숨은 규칙·빈칸 정답 문자열 자체는 넣지 않는다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { blankStatus, columnsOf, judge } from './relation-check';
import type { FunctionState } from './types';

export function observe(state: FunctionState): Observation {
  const j = judge(state);
  const columns = columnsOf(state);
  const common: Record<string, JsonValue> = {
    mode: state.mode,
    pairs: j.pairs.map(([x, y]) => [x, y]),
    columns: columns.map((column) => ({
      col: column.id,
      x: column.x.value,
      y: column.y.value,
    })),
    ruleText: state.ruleText,
    testedText: state.tested === null ? null : state.tested.text,
    ruleValid: j.ruleValid,
    ruleFormatted: j.formatted,
    ruleInfo: j.info === null ? null : { ...j.info },
    holdsAll: j.holdsAll,
    holdsCount: j.holdsCount,
    matchesHidden: j.matchesHidden,
    ruleHistory: state.ruleHistory,
    misconceptions: j.misconceptions,
  };
  if (state.mode === 'black-box') {
    return {
      ...common,
      trials: state.trials.map(([x, y]) => [x, y]),
      trialCount: state.trials.length,
    };
  }
  const blanks = blankStatus(state);
  const withCells: Record<string, JsonValue> = {
    ...common,
    cells: { ...state.cells },
    cellsComplete: blanks.total > 0 && blanks.filled === blanks.total,
    cellsCorrect: blanks.total > 0 && blanks.correct === blanks.total,
  };
  if (state.mode === 'covary') {
    return { ...withCells, x: state.x, visited: state.visited };
  }
  return withCells;
}
