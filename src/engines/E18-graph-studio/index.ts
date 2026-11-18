/** E18 그래프 스튜디오 엔진 정의. 기본 두 모드(`table-to-graph`, `scale`)를 먼저 만든다. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { graphStrings } from './strings.ko';
import type { GraphAction, GraphConfig, GraphState } from './types';
import { GraphView } from './View';
import { GapCompareOverlay } from './overlays/gap-compare';
import { LengthOnlyOverlay } from './overlays/length-only';
import { ScaleCountOverlay } from './overlays/scale-count';
import { TableLinkOverlay } from './overlays/table-link';
import { TallyCheckOverlay } from './overlays/tally-check';

const definition: EngineDefinition<GraphConfig, GraphState, GraphAction> = {
  id: 'E18',
  name: graphStrings.name,
  modes: ['table-to-graph', 'scale'],
  layout: 'fit',
  createInitialState,
  reduce,
  View: GraphView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'gap-compare': GapCompareOverlay,
    'table-link': TableLinkOverlay,
    'scale-count': ScaleCountOverlay,
    'length-only': LengthOnlyOverlay,
    'tally-check': TallyCheckOverlay,
  },
};

export default definition;
