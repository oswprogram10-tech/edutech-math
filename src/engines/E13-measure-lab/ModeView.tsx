/** E13 화면. 상태의 `mode`에 따라 compare-direct·length 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import { CompareView } from './compare/CompareView';
import type { CompareAction } from './compare/types';
import { LengthView } from './length/LengthView';
import type { LengthAction } from './length/types';
import type { E13Action, E13Config, E13State } from './modes';

export function E13View({
  state,
  dispatch,
  targetSize,
  readOnly,
}: EngineViewProps<E13Config, E13State, E13Action>) {
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
