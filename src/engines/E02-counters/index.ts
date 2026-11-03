/** E02 셈돌·텐프레임 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { countersStrings } from './strings.ko';
import type { CountersAction, CountersConfig, CountersState } from './types';
import { CountersView } from './View';
import { BondTreeOverlay } from './overlays/bond-tree';
import { CountOnesOverlay } from './overlays/count-ones';
import { FrameGapsOverlay } from './overlays/frame-gaps';
import { PairLinesOverlay } from './overlays/pair-lines';

const definition: EngineDefinition<CountersConfig, CountersState, CountersAction> = {
  id: 'E02',
  name: countersStrings.name,
  modes: ['summon', 'ten-frame', 'part-whole', 'flash'],
  createInitialState,
  reduce,
  View: CountersView,
  observe,
  events: ['value-changed', 'frame-filled', 'split-recorded'],
  emit,
  predicates,
  overlays: {
    'count-ones': CountOnesOverlay,
    'frame-gaps': FrameGapsOverlay,
    'bond-tree': BondTreeOverlay,
    'pair-lines': PairLinesOverlay,
  },
};

export default definition;
