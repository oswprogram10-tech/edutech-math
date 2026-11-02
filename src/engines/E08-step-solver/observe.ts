/**
 * E08의 Observation.
 *
 * `lines[].equivalentToPrev`는 "앞 줄과 값이 같은가"만 담는다. 정답 값은 넣지 않는다.
 * 미완성·□ 줄은 `valid=false`, `equivalentToPrev=null`로 중립이다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { analyzeState } from './analyze';
import type { StateAnalysis } from './analyze';
import type { StepSolverConfig, StepSolverState } from './types';

function linesPayload(analysis: StateAnalysis): JsonValue {
  return analysis.lines.map((line) => ({
    expr: line.expr,
    value: line.value?.toString() ?? null,
    valid: line.valid,
    equivalentToPrev: line.equivalentToPrev,
    label: line.label,
  }));
}

export function observe(state: StepSolverState, config?: StepSolverConfig): Observation {
  void config;
  const analysis = analyzeState(state);
  const base: Record<string, JsonValue> = {
    mode: state.mode,
    lines: linesPayload(analysis),
    firstBrokenLine: analysis.firstBrokenLine,
    allEquivalent: analysis.allEquivalent,
    finalValue: analysis.finalValue,
    finalRaw: analysis.finalRaw,
    finalIrreducible: analysis.finalIrreducible,
    finalIsMixed: analysis.finalIsMixed,
    lineCount: analysis.lines.length,
    misconceptions: analysis.misconceptions.map((entry) => ({
      line: entry.line,
      code: entry.code,
    })),
  };

  if (state.mode === 'debug') {
    base['selectedLine'] = state.selectedLine;
    base['fixedValue'] = analysis.finalValue;
  }
  return base;
}
