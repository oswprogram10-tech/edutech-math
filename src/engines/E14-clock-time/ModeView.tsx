/** E14 화면. 상태의 `mode`에 따라 clock·duration·calendar 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import { CalendarView } from './calendar/CalendarView';
import type { CalendarAction } from './calendar/types';
import { DurationView } from './duration/DurationView';
import type { DurationAction } from './duration/types';
import type { E14Action, E14Config, E14State } from './modes';
import { TimeCalcView } from './timecalc/TimeCalcView';
import type { TimeCalcAction } from './timecalc/types';
import type { ClockAction, ClockConfig } from './types';
import { ClockView } from './View';

export function E14View(props: EngineViewProps<E14Config, E14State, E14Action>) {
  const { state, dispatch, targetSize, readOnly } = props;
  if (state.mode === 'duration') {
    return (
      <DurationView
        state={state}
        dispatch={(action) => dispatch(action as DurationAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  if (state.mode === 'time-calc') {
    return (
      <TimeCalcView
        state={state}
        dispatch={(action) => dispatch(action as TimeCalcAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  if (state.mode === 'calendar') {
    return (
      <CalendarView
        state={state}
        dispatch={(action) => dispatch(action as CalendarAction)}
        targetSize={targetSize}
        readOnly={readOnly}
      />
    );
  }
  return (
    <ClockView
      {...props}
      config={props.config as ClockConfig}
      state={state}
      dispatch={(action: ClockAction) => dispatch(action)}
    />
  );
}
