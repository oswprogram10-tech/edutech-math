/** E06은 `equation`·`proportion`·`compare` 세 모드를 가진다. 엔진 정의(index.ts)가 쓰는 합친 타입. */
import type { BalanceAction, BalanceConfig, BalanceState } from './types';
import type { CompareAction, CompareConfig, CompareState } from './compare/types';
import type { ProportionAction, ProportionConfig, ProportionState } from './proportion/types';

export type E06Config = BalanceConfig | ProportionConfig | CompareConfig;
export type E06State = BalanceState | ProportionState | CompareState;
export type E06Action = BalanceAction | ProportionAction | CompareAction;
