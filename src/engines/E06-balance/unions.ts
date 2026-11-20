/** E06은 `equation`과 `proportion` 두 모드를 가진다. 엔진 정의(index.ts)가 쓰는 합친 타입. */
import type { BalanceAction, BalanceConfig, BalanceState } from './types';
import type { ProportionAction, ProportionConfig, ProportionState } from './proportion/types';

export type E06Config = BalanceConfig | ProportionConfig;
export type E06State = BalanceState | ProportionState;
export type E06Action = BalanceAction | ProportionAction;
