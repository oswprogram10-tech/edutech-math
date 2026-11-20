/** E14 시계·시간 엔진 정의. 모드 넷(`clock`, `duration`, `calendar`, `time-calc`). 펼치기는 clock의 `unroll` 옵션이다. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { PlusSevenOverlay } from './calendar/overlays/plus-seven';
import { SixtyOverflowOverlay } from './timecalc/overlays/sixty-overflow';
import { Hour60SplitOverlay } from './duration/overlays/hour-60-split';
import {
  E14_EVENT_NAMES,
  E14_MODES,
  E14_PREDICATES,
  createInitialState,
  emit,
  observe,
  reduce,
} from './modes';
import type { E14Action, E14Config, E14State } from './modes';
import { E14View } from './ModeView';
import { forCalendar, forClock, forDuration, forTimeCalc } from './overlays/adapt';
import { HourHandFocusOverlay } from './overlays/hour-hand-focus';
import { NumeralMinutesOverlay } from './overlays/numeral-minutes';
import { RewindToHourOverlay } from './overlays/rewind-to-hour';
import { E14_STRINGS } from './strings.ko';

const definition: EngineDefinition<E14Config, E14State, E14Action> = {
  id: 'E14',
  name: E14_STRINGS.name,
  modes: E14_MODES,
  layout: 'fit',
  createInitialState,
  reduce,
  View: E14View,
  observe,
  events: E14_EVENT_NAMES,
  emit,
  predicates: E14_PREDICATES,
  overlays: {
    'hour-hand-focus': forClock(HourHandFocusOverlay),
    'rewind-to-hour': forClock(RewindToHourOverlay),
    'numeral-minutes': forClock(NumeralMinutesOverlay),
    'hour-60-split': forDuration(Hour60SplitOverlay),
    'plus-seven': forCalendar(PlusSevenOverlay),
    'sixty-overflow': forTimeCalc(SixtyOverflowOverlay),
  },
};

export default definition;
