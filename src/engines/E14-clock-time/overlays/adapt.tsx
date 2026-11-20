/**
 * 모드별 오버레이를 E14 합집합 타입에 맞춰 주는 어댑터. 상태의 `mode`가 그 모드일 때만 그린다.
 * (오버레이는 실제로 `config`를 읽지 않는다.)
 */
import type { ComponentType } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { CalendarConfig, CalendarState } from '../calendar/types';
import type { DurationConfig, DurationState } from '../duration/types';
import type { E14Config, E14State } from '../modes';
import type { TimeCalcConfig, TimeCalcState } from '../timecalc/types';
import type { ClockConfig, ClockState } from '../types';

export function forClock(
  Overlay: ComponentType<OverlayProps<ClockConfig, ClockState>>,
): ComponentType<OverlayProps<E14Config, E14State>> {
  return function ClockOverlay(props) {
    const { state } = props;
    if (state.mode !== 'clock') return null;
    return <Overlay {...props} config={props.config as ClockConfig} state={state} />;
  };
}

export function forDuration(
  Overlay: ComponentType<OverlayProps<DurationConfig, DurationState>>,
): ComponentType<OverlayProps<E14Config, E14State>> {
  return function DurationOverlay(props) {
    const { state } = props;
    if (state.mode !== 'duration') return null;
    return <Overlay {...props} config={props.config as DurationConfig} state={state} />;
  };
}

export function forCalendar(
  Overlay: ComponentType<OverlayProps<CalendarConfig, CalendarState>>,
): ComponentType<OverlayProps<E14Config, E14State>> {
  return function CalendarOverlay(props) {
    const { state } = props;
    if (state.mode !== 'calendar') return null;
    return <Overlay {...props} config={props.config as CalendarConfig} state={state} />;
  };
}

export function forTimeCalc(
  Overlay: ComponentType<OverlayProps<TimeCalcConfig, TimeCalcState>>,
): ComponentType<OverlayProps<E14Config, E14State>> {
  return function TimeCalcOverlay(props) {
    const { state } = props;
    if (state.mode !== 'time-calc') return null;
    return <Overlay {...props} config={props.config as TimeCalcConfig} state={state} />;
  };
}
