/**
 * E01의 관찰 결과.
 *
 * 판정·힌트는 이 값만 본다. 화면 좌표나 블록 목록은 내보내지 않는다.
 * 수는 정수(number) 하나로 표현한다(카드 결정 2).
 */
import type { Observation } from '../../core/engine-sdk';
import type { BaseTenConfig, BaseTenState } from './types';
import { chartValueOf, countsOf, isCanonicalCounts, takenValueOf, valueOf } from './value';

export function observe(state: BaseTenState, config: BaseTenConfig): Observation {
  const counts = countsOf(state);
  const log = state.log.map((entry) => ({ kind: entry.kind, from: entry.from }));

  return {
    mode: state.mode,
    value: valueOf(state),
    counts: {
      thousands: counts.thousands,
      hundreds: counts.hundreds,
      tens: counts.tens,
      ones: counts.ones,
    },
    canonical: isCanonicalCounts(counts),
    groups: state.log.filter((entry) => entry.kind === 'group').length,
    breaks: state.log.filter((entry) => entry.kind === 'break').length,
    log,
    lastAttempt: state.lastAttempt
      ? {
          count: state.lastAttempt.count,
          value: state.lastAttempt.value,
          ok: state.lastAttempt.ok,
        }
      : null,
    chartDigits: state.settings.chartFill === 'auto' ? null : state.chart ? [...state.chart] : null,
    chartValue: chartValueOf(state),
    taken: takenValueOf(state),
    reachedHundred: config.allowHundredReveal === true ? state.reachedHundred : null,
  };
}
