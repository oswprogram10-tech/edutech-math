/**
 * E13 unit-train Observation. m·cm는 지금 기차의 칸 수(정수)다.
 * MC-LENGTH-NO-PROMOTE는 add에서 cm가 100 이상인 동안 기록한다.
 */
import type { Observation } from '../../../core/engine-sdk';
import { cmOf } from './settings';
import type { TrainState } from './types';

export function observeTrain(state: TrainState): Observation {
  const base = { mode: 'length', variant: 'unit-train', moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  const cm = cmOf(state);
  return {
    ...base,
    op: state.op,
    m: state.m,
    cm,
    totalCm: 100 * state.m + cm,
    normalized: cm < 100,
    promotes: state.promotes,
    unpacks: state.unpacks,
    tookAway: state.tookAway,
    misconceptions: state.op === 'add' && cm >= 100 ? ['MC-LENGTH-NO-PROMOTE'] : [],
  };
}
