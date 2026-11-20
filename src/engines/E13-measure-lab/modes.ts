/**
 * E13의 모드 묶음. 설정·상태·Action 합집합과 모드별 reduce·observe·emit 분배를 한곳에 둔다.
 * 모드별 규칙은 `compare/`, `length/`, `estimate/`, `route/`(map-route), `train/`(length의 unit-train 변형) 폴더에 있고
 * 여기서는 `mode`·`variant`로 나누기만 한다.
 */
import type { EngineEvent, EnginePredicate, Observation } from '../../core/engine-sdk';
import { comparePredicates } from './compare/events';
import { estimatePredicates } from './estimate/events';
import { observeEstimate } from './estimate/observe';
import { createEstimateState, reduceEstimate } from './estimate/reduce';
import type { EstimateAction, EstimateConfig, EstimateState } from './estimate/types';
import { routePredicates } from './route/events';
import { observeRoute } from './route/observe';
import { createRouteState, reduceRoute } from './route/reduce';
import type { RouteAction, RouteConfig, RouteState } from './route/types';
import { trainPredicates } from './train/events';
import { observeTrain } from './train/observe';
import { createTrainState, reduceTrain } from './train/reduce';
import type { TrainAction, TrainConfig, TrainState } from './train/types';
import { observeCompare } from './compare/observe';
import { createCompareState, reduceCompare } from './compare/reduce';
import type { CompareAction, CompareConfig, CompareState } from './compare/types';
import { lengthPredicates } from './length/events';
import { observeLength } from './length/observe';
import { createLengthState, reduceLength } from './length/reduce';
import type { LengthAction, LengthConfig, MeasureState } from './length/types';

export type E13Config = CompareConfig | LengthConfig | TrainConfig | EstimateConfig | RouteConfig;
export type E13State = CompareState | MeasureState | TrainState | EstimateState | RouteState;
export type E13Action = CompareAction | LengthAction | TrainAction | EstimateAction | RouteAction;

export const E13_MODES = ['compare-direct', 'length', 'estimate', 'map-route'];

export const E13_EVENT_NAMES = ['measure-changed', 'merged'] as const;

export const E13_PREDICATES: Readonly<Record<string, EnginePredicate>> = {
  ...comparePredicates,
  ...lengthPredicates,
  ...estimatePredicates,
  ...trainPredicates,
  ...routePredicates,
};

/** length 모드의 unit-train 변형 상태인가(MeasureState에는 `variant`가 없다). */
export function isTrain(state: E13State): state is TrainState {
  return state.mode === 'length' && 'variant' in state;
}

export function createInitialState(config: E13Config): E13State {
  const record: { mode?: unknown; variant?: unknown } =
    typeof config === 'object' && config !== null ? config : {};
  if (record.mode === 'estimate') return createEstimateState(config as EstimateConfig);
  if (record.mode === 'map-route') return createRouteState(config as RouteConfig);
  if (record.mode === 'length') {
    // variant가 적혀 있으면 unit-train만 허용한다(그 밖의 값은 설정 오류).
    if (record.variant !== undefined) return createTrainState(config as TrainConfig);
    return createLengthState(config as LengthConfig);
  }
  return createCompareState(config as CompareConfig);
}

export function reduce(state: E13State, action: E13Action): E13State {
  if (isTrain(state)) return reduceTrain(state, action as TrainAction);
  if (state.mode === 'length') return reduceLength(state, action as LengthAction);
  if (state.mode === 'estimate') return reduceEstimate(state, action as EstimateAction);
  if (state.mode === 'map-route') return reduceRoute(state, action as RouteAction);
  return reduceCompare(state, action as CompareAction);
}

export function observe(state: E13State): Observation {
  if (isTrain(state)) return observeTrain(state);
  if (state.mode === 'length') return observeLength(state);
  if (state.mode === 'estimate') return observeEstimate(state);
  if (state.mode === 'map-route') return observeRoute(state);
  return observeCompare(state);
}

/** 상태가 바뀌었을 때만 알린다. 이벤트에는 측정 결과를 싣지 않는다(합체 횟수만 싣는다). */
export function emit(prev: E13State, next: E13State): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [{ name: 'measure-changed', payload: { moved: next.moves >= 1 } }];
  if (
    next.mode === 'length' &&
    !isTrain(next) &&
    prev.mode === 'length' &&
    !isTrain(prev) &&
    next.merges > prev.merges
  ) {
    events.push({ name: 'merged', payload: { merges: next.merges } });
  }
  return events;
}
