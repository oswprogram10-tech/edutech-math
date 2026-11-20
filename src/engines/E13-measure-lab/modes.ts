/**
 * E13의 모드 묶음. 설정·상태·Action 합집합과 모드별 reduce·observe·emit 분배를 한곳에 둔다.
 * 모드별 규칙은 `compare/`, `length/` 폴더에 있고 여기서는 `mode`로 나누기만 한다.
 */
import type { EngineEvent, EnginePredicate, Observation } from '../../core/engine-sdk';
import { comparePredicates } from './compare/events';
import { observeCompare } from './compare/observe';
import { createCompareState, reduceCompare } from './compare/reduce';
import type { CompareAction, CompareConfig, CompareState } from './compare/types';
import { lengthPredicates } from './length/events';
import { observeLength } from './length/observe';
import { createLengthState, reduceLength } from './length/reduce';
import type { LengthAction, LengthConfig, MeasureState } from './length/types';

export type E13Config = CompareConfig | LengthConfig;
export type E13State = CompareState | MeasureState;
export type E13Action = CompareAction | LengthAction;

export const E13_MODES = ['compare-direct', 'length'];

export const E13_EVENT_NAMES = ['measure-changed'] as const;

export const E13_PREDICATES: Readonly<Record<string, EnginePredicate>> = {
  ...comparePredicates,
  ...lengthPredicates,
};

export function createInitialState(config: E13Config): E13State {
  const mode = typeof config === 'object' && config !== null ? config.mode : undefined;
  if (mode === 'length') return createLengthState(config as LengthConfig);
  return createCompareState(config as CompareConfig);
}

export function reduce(state: E13State, action: E13Action): E13State {
  if (state.mode === 'length') return reduceLength(state, action as LengthAction);
  return reduceCompare(state, action as CompareAction);
}

export function observe(state: E13State): Observation {
  return state.mode === 'length' ? observeLength(state) : observeCompare(state);
}

/** 상태가 바뀌었을 때만 알린다. 이벤트에는 측정 결과를 싣지 않는다. */
export function emit(prev: E13State, next: E13State): EngineEvent[] {
  if (prev === next) return [];
  return [{ name: 'measure-changed', payload: { moved: next.moves >= 1 } }];
}
