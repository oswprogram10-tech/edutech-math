/** E18 그래프 스튜디오 엔진 정의. 모드: table-to-graph, scale(T155), pictograph, class-vote(T156), line-graph(T163). */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { graphStrings } from './strings.ko';
import type { GraphAction, GraphConfig, GraphState } from './types';
import { GraphView } from './View';
import { ExpandCompareOverlay } from './overlays/expand-compare';
import { ExpandIconsOverlay } from './overlays/expand-icons';
import { ChangeBarsOverlay } from './overlays/change-bars';
import { GapCompareOverlay } from './overlays/gap-compare';
import { InterpGuideOverlay } from './overlays/interp-guide';
import { LengthOnlyOverlay } from './overlays/length-only';
import { ScaleCountOverlay } from './overlays/scale-count';
import { TableLinkOverlay } from './overlays/table-link';
import { TallyCheckOverlay } from './overlays/tally-check';
import { UnfoldAxisOverlay } from './overlays/unfold-axis';

const definition: EngineDefinition<GraphConfig, GraphState, GraphAction> = {
  id: 'E18',
  name: graphStrings.name,
  modes: ['table-to-graph', 'scale', 'pictograph', 'class-vote', 'line-graph'],
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
    'expand-icons': ExpandIconsOverlay,
    'expand-compare': ExpandCompareOverlay,
    'change-bars': ChangeBarsOverlay,
    'unfold-axis': UnfoldAxisOverlay,
    'interp-guide': InterpGuideOverlay,
  },
};

export default definition;
