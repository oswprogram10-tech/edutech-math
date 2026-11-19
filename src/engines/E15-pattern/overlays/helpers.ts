/**
 * E15 오버레이 공용 도우미. 정답 토큰·정답 수를 그리지 않는다.
 * 학생이 놓은 것과 과제가 준 자료(given·표의 이웃 칸 수)만 쓴다.
 */
import type { SequenceState, ChartState, PatternState } from '../types';

export const PATTERN_CANVAS = 'svg[data-testid="pattern-canvas"]';
export const CHART_CANVAS = 'svg[data-testid="chart-canvas"]';

export function argsOf(args: unknown): Readonly<Record<string, unknown>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args as Readonly<Record<string, unknown>>;
}

export function sequenceOf(state: PatternState): SequenceState | null {
  return state.mode === 'sequence' ? state : null;
}

export function chartOf(state: PatternState): ChartState | null {
  return state.mode === 'hundred-chart' ? state : null;
}
