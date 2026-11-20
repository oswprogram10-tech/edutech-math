/**
 * E14 time-calc Observation. big·small은 지금 줄의 칸 수(정수)다. 화면·DOM·aria에는 값을 글로 쓰지 않는다.
 * MC-TIME-BASE-100은 add에서 작은 단위가 60 이상인 동안 기록한다.
 */
import type { Observation } from '../../../core/engine-sdk';
import { BASE } from './settings';
import type { TimeCalcState } from './types';

export function observeTimeCalc(state: TimeCalcState): Observation {
  const base = { mode: 'time-calc', moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  return {
    ...base,
    op: state.op,
    units: state.units === 'hm' ? ['h', 'm'] : ['m', 's'],
    big: state.big,
    small: state.small,
    normalized: state.small < BASE,
    bundles: state.bundles,
    unbundles: state.unbundles,
    tookAway: state.tookAway,
    misconceptions: state.op === 'add' && state.small >= BASE ? ['MC-TIME-BASE-100'] : [],
  };
}
