/** E14 시계·시간 엔진 정의. 이 카드에서는 `clock` 모드 하나만 등록한다(펼치기는 `unroll` 옵션). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { HourHandFocusOverlay } from './overlays/hour-hand-focus';
import { NumeralMinutesOverlay } from './overlays/numeral-minutes';
import { RewindToHourOverlay } from './overlays/rewind-to-hour';
import { createInitialState, reduce } from './reduce';
import { E14_STRINGS } from './strings.ko';
import type { ClockAction, ClockConfig, ClockState } from './types';
import { ClockView } from './View';

const definition: EngineDefinition<ClockConfig, ClockState, ClockAction> = {
  id: 'E14',
  name: E14_STRINGS.name,
  modes: ['clock'],
  layout: 'fit',
  createInitialState,
  reduce,
  View: ClockView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'hour-hand-focus': HourHandFocusOverlay,
    'rewind-to-hour': RewindToHourOverlay,
    'numeral-minutes': NumeralMinutesOverlay,
  },
};

export default definition;
