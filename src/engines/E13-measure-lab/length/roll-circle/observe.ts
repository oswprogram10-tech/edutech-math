/**
 * E13 roll-circle Observation. 측정 원주·비는 학생이 굴리거나 기록한 뒤에만 값이 생긴다
 * (굴리기 전 `measuredCm`은 null, `log`는 기록한 줄만). 오개념 코드는 아직 엔진이 기록하지 않는다.
 */
import type { Observation } from '../../../../core/engine-sdk';
import type { RollState } from './types';

export function observeRoll(state: RollState): Observation {
  const base = { mode: 'length', variant: 'roll-circle', moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  return {
    ...base,
    diameter: state.diameter,
    rolled: state.rolled,
    measuredCm: state.measuredCm,
    sticks: state.sticks,
    sticksFit: Math.min(state.sticks, 3),
    log: state.log.map((row) => ({ d: row.d, c: row.c, ratio: row.ratio })),
    logCount: state.log.length,
    misconceptions: [],
  };
}
