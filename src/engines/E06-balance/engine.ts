/**
 * E06 모드 전환: 상태의 `mode`(equation·proportion)에 맞는 생성·전이·관찰 함수를 고른다.
 * 설정에 `mode: 'proportion'`이 아니면 equation이다(g2s1u3 콘텐츠처럼 mode를 안 써도 된다).
 */
import type { Observation } from '../../core/engine-sdk';
import { observe as observeEquation } from './observe';
import { observeProportion } from './proportion/observe';
import { createProportionState, reduceProportion } from './proportion/reduce';
import type { ProportionAction } from './proportion/types';
import { createInitialState as createEquationState, reduce as reduceEquation } from './reduce';
import type { BalanceAction, BalanceConfig } from './types';
import type { E06Action, E06Config, E06State } from './unions';

export function createState(config: E06Config): E06State {
  return config?.mode === 'proportion'
    ? createProportionState(config)
    : createEquationState(config as BalanceConfig);
}

const PROPORTION_ACTIONS: ReadonlySet<string> = new Set([
  'try',
  'select-card',
  'pick-pair',
  'reset',
]);
const EQUATION_ACTIONS: ReadonlySet<string> = new Set(['try', 'both', 'one', 'predict', 'reset']);

export function reduceState(state: E06State, action: E06Action): E06State {
  if (state.mode === 'proportion') {
    return PROPORTION_ACTIONS.has(action.type)
      ? reduceProportion(state, action as ProportionAction)
      : state;
  }
  return EQUATION_ACTIONS.has(action.type) ? reduceEquation(state, action as BalanceAction) : state;
}

export function observeState(state: E06State, config: E06Config): Observation {
  return state.mode === 'proportion'
    ? observeProportion(state)
    : observeEquation(state, config as BalanceConfig);
}
