/**
 * E15 오버레이 공용 도우미. 정답 토큰·정답 수를 그리지 않는다.
 * 학생이 놓은 것과 과제가 준 자료(given·표의 이웃 칸 수)만 쓴다.
 */
import type {
  CalcState,
  CalcTableState,
  GearsState,
  GrowthState,
  SequenceState,
  ChartState,
  PatternState,
} from '../types';

export const PATTERN_CANVAS = 'svg[data-testid="pattern-canvas"]';
export const CHART_CANVAS = 'svg[data-testid="chart-canvas"]';
export const CALC_CANVAS = 'svg[data-testid="calc-canvas"]';

export const TABLE_CANVAS = 'svg[data-testid="calc-table-canvas"]';

export const GROWTH_CANVAS = 'svg[data-testid="growth-canvas"]';

export const GEARS_CANVAS = 'svg[data-testid="gears-canvas"]';

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

export function calcOf(state: PatternState): CalcState | null {
  return state.mode === 'calc-pattern' && state.variant !== 'table' ? state : null;
}

export function calcTableOf(state: PatternState): CalcTableState | null {
  return state.mode === 'calc-pattern' && state.variant === 'table' ? state : null;
}

export function growthOf(state: PatternState): GrowthState | null {
  return state.mode === 'growth' ? state : null;
}

export function gearsOf(state: PatternState): GearsState | null {
  return state.mode === 'gears' ? state : null;
}
