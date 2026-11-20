/**
 * E13의 모드 묶음. 설정·상태·Action 합집합과 모드별 reduce·observe·emit 분배를 한곳에 둔다.
 * 모드별 규칙은 `compare/`, `length/`, `estimate/`, `route/`(map-route), `train/`(length의 unit-train 변형), `length/roll-circle/`(length의 roll-circle 변형) 폴더에 있고
 * 여기서는 `mode`·`variant`로 나누기만 한다.
 */
import type { EngineEvent, EnginePredicate, Observation } from '../../core/engine-sdk';
import { capacityPredicates } from './capacity/events';
import { observeCapacity } from './capacity/observe';
import { createCapacityState, reduceCapacity } from './capacity/reduce';
import type { CapacityAction, CapacityConfig, CapacityState } from './capacity/types';
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
import { weightPredicates } from './weight/events';
import { observeWeight } from './weight/observe';
import { createWeightState, reduceWeight } from './weight/reduce';
import type { WeightAction, WeightConfig, WeightState } from './weight/types';
import { lengthPredicates } from './length/events';
import { observeLength } from './length/observe';
import { createLengthState, reduceLength } from './length/reduce';
import type { LengthAction, LengthConfig, MeasureState } from './length/types';
import { rollPredicates } from './length/roll-circle/events';
import { observeRoll } from './length/roll-circle/observe';
import { createRollState, reduceRoll } from './length/roll-circle/reduce';
import type { RollAction, RollConfig, RollState } from './length/roll-circle/types';

export type E13Config =
  | CompareConfig
  | LengthConfig
  | TrainConfig
  | RollConfig
  | EstimateConfig
  | RouteConfig
  | CapacityConfig
  | WeightConfig;
export type E13State =
  | CompareState
  | MeasureState
  | TrainState
  | RollState
  | EstimateState
  | RouteState
  | CapacityState
  | WeightState;
export type E13Action =
  | CompareAction
  | LengthAction
  | TrainAction
  | RollAction
  | EstimateAction
  | RouteAction
  | CapacityAction
  | WeightAction;

export const E13_MODES = [
  'compare-direct',
  'length',
  'estimate',
  'map-route',
  'capacity',
  'weight',
];

export const E13_EVENT_NAMES = ['measure-changed', 'merged'] as const;

/**
 * 모든 모드 공용: 엔진 관찰 `misconceptions`에 그 오개념 코드가 들어 있는가. args `{ code }`.
 * (모드가 오개념을 기록하지 않으면 늘 거짓이다.)
 */
const hasMisconception: EnginePredicate = (observation, args) => {
  const code =
    typeof args === 'object' && args !== null && !Array.isArray(args) ? args['code'] : undefined;
  const list = observation['misconceptions'];
  return typeof code === 'string' && Array.isArray(list) && list.includes(code);
};

export const E13_PREDICATES: Readonly<Record<string, EnginePredicate>> = {
  hasMisconception,
  ...comparePredicates,
  ...lengthPredicates,
  ...estimatePredicates,
  ...trainPredicates,
  ...rollPredicates,
  ...routePredicates,
  ...capacityPredicates,
  ...weightPredicates,
};

/** length 모드의 unit-train 변형 상태인가(MeasureState에는 `variant`가 없다). */
export function isTrain(state: E13State): state is TrainState {
  return state.mode === 'length' && 'variant' in state && state.variant === 'unit-train';
}

/** length 모드의 roll-circle 변형(굴렁쇠 굴리기) 상태인가. */
export function isRoll(state: E13State): state is RollState {
  return state.mode === 'length' && 'variant' in state && state.variant === 'roll-circle';
}

/** variant가 없는 기본 length 상태인가(T205·T208 mergeRule). */
export function isPlainLength(state: E13State): state is MeasureState {
  return state.mode === 'length' && !('variant' in state);
}

export function createInitialState(config: E13Config): E13State {
  const record: { mode?: unknown; variant?: unknown } =
    typeof config === 'object' && config !== null ? config : {};
  if (record.mode === 'estimate') return createEstimateState(config as EstimateConfig);
  if (record.mode === 'map-route') return createRouteState(config as RouteConfig);
  if (record.mode === 'capacity') return createCapacityState(config as CapacityConfig);
  if (record.mode === 'weight') return createWeightState(config as WeightConfig);
  if (record.mode === 'length') {
    if (record.variant === 'roll-circle') return createRollState(config as RollConfig);
    // 그 밖에 variant가 적혀 있으면 unit-train만 허용한다(그 밖의 값은 설정 오류).
    if (record.variant !== undefined) return createTrainState(config as TrainConfig);
    return createLengthState(config as LengthConfig);
  }
  return createCompareState(config as CompareConfig);
}

export function reduce(state: E13State, action: E13Action): E13State {
  if (isTrain(state)) return reduceTrain(state, action as TrainAction);
  if (isRoll(state)) return reduceRoll(state, action as RollAction);
  if (state.mode === 'length') return reduceLength(state, action as LengthAction);
  if (state.mode === 'estimate') return reduceEstimate(state, action as EstimateAction);
  if (state.mode === 'map-route') return reduceRoute(state, action as RouteAction);
  if (state.mode === 'capacity') return reduceCapacity(state, action as CapacityAction);
  if (state.mode === 'weight') return reduceWeight(state, action as WeightAction);
  return reduceCompare(state, action as CompareAction);
}

export function observe(state: E13State): Observation {
  if (isTrain(state)) return observeTrain(state);
  if (isRoll(state)) return observeRoll(state);
  if (state.mode === 'length') return observeLength(state);
  if (state.mode === 'estimate') return observeEstimate(state);
  if (state.mode === 'map-route') return observeRoute(state);
  if (state.mode === 'capacity') return observeCapacity(state);
  if (state.mode === 'weight') return observeWeight(state);
  return observeCompare(state);
}

/** 상태가 바뀌었을 때만 알린다. 이벤트에는 측정 결과를 싣지 않는다(합체 횟수만 싣는다). */
export function emit(prev: E13State, next: E13State): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [{ name: 'measure-changed', payload: { moved: next.moves >= 1 } }];
  if (isPlainLength(next) && isPlainLength(prev) && next.merges > prev.merges) {
    events.push({ name: 'merged', payload: { merges: next.merges } });
  }
  return events;
}
