/** E00-demo의 관찰 결과. 묶음은 "묶음별 셈돌 개수"만 노출한다. */
import type { Observation } from '../../core/engine-sdk';
import type { DemoConfig, DemoState } from './types';

export function observe(state: DemoState, config: DemoConfig): Observation {
  void config;
  return {
    count: state.counters.length,
    groups: state.groups.map((group) => group.counterIds.length),
  };
}
