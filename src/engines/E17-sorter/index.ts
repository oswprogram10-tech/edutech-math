/** E17 분류기 엔진 정의. 도형 모드 세 개를 먼저 만든다(W6가 `sort`를 더한다). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { sorterStrings } from './strings.ko';
import type { SorterAction, SorterConfig, SorterState } from './types';
import { SorterView } from './View';
import { AnglePaintOverlay } from './overlays/angle-paint';
import { CardPropertiesOverlay } from './overlays/card-properties';
import { ConditionChecklistOverlay } from './overlays/condition-checklist';
import { IsoChecklistOverlay } from './overlays/iso-checklist';
import { UprightCardOverlay } from './overlays/upright-card';

const definition: EngineDefinition<SorterConfig, SorterState, SorterAction> = {
  id: 'E17',
  name: sorterStrings.name,
  modes: ['venn', 'secret-rule', 'hierarchy'],
  createInitialState,
  reduce,
  View: SorterView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'upright-card': UprightCardOverlay,
    'angle-paint': AnglePaintOverlay,
    'iso-checklist': IsoChecklistOverlay,
    'card-properties': CardPropertiesOverlay,
    'condition-checklist': ConditionChecklistOverlay,
  },
};

export default definition;
