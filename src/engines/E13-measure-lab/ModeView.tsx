/** E13 화면. 상태의 `mode`에 따라 compare-direct·length 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import { CapacityView } from './capacity/CapacityView';
import type { CapacityAction } from './capacity/types';
import { CompareView } from './compare/CompareView';
import { WeightView } from './weight/WeightView';
import type { WeightAction } from './weight/types';
import { EstimateView } from './estimate/EstimateView';
import type { EstimateAction } from './estimate/types';
import { RouteView } from './route/RouteView';
import type { RouteAction } from './route/types';
import { TrainView } from './train/TrainView';
import type { TrainAction } from './train/types';
import type { CompareAction } from './compare/types';
import { LengthView } from './length/LengthView';
import type { LengthAction } from './length/types';
import { isTrain } from './modes';
import type { E13Action, E13Config, E13State } from './modes';

export function E13View({
  state,
  dispatch,
  targetSize,
  readOnly,
}: EngineViewProps<E13Config, E13State, E13Action>) {
  if (isTrain(state)) {
    return (
      <TrainView
        state={state}
        dispatch={(action) => dispatch(action as TrainAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  if (state.mode === 'capacity') {
    return (
      <CapacityView
        state={state}
        dispatch={(action) => dispatch(action as CapacityAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  if (state.mode === 'weight') {
    return (
      <WeightView
        state={state}
        dispatch={(action) => dispatch(action as WeightAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  if (state.mode === 'map-route') {
    return (
      <RouteView
        state={state}
        dispatch={(action) => dispatch(action as RouteAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  if (state.mode === 'estimate') {
    return (
      <EstimateView
        state={state}
        dispatch={(action) => dispatch(action as EstimateAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  if (state.mode === 'length') {
    return (
      <LengthView
        state={state}
        dispatch={(action) => dispatch(action as LengthAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  return (
    <CompareView
      state={state}
      dispatch={(action) => dispatch(action as CompareAction)}
      targetSize={targetSize}
      readOnly={readOnly}
    />
  );
}
