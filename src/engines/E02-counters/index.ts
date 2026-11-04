/** E02 셈돌·텐프레임 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { countersStrings } from './strings.ko';
import type { CountersAction, CountersConfig, CountersState } from './types';
import { CountersView } from './View';
import { BeadGroupsOverlay } from './overlays/bead-groups';
import { BondTreeOverlay } from './overlays/bond-tree';
import { BubbleFrameOverlay } from './overlays/bubble-frame';
import { CountOnesOverlay } from './overlays/count-ones';
import { FrameGapsOverlay } from './overlays/frame-gaps';
import { PairLinesOverlay } from './overlays/pair-lines';
import { PairMarchOverlay } from './overlays/pair-march';
import { PlateBarsOverlay } from './overlays/plate-bars';
import { TenGapOverlay } from './overlays/ten-gap';

const definition: EngineDefinition<CountersConfig, CountersState, CountersAction> = {
  id: 'E02',
  name: countersStrings.name,
  modes: [
    'summon',
    'ten-frame',
    'part-whole',
    'flash',
    'rekenrek',
    'pairing',
    'share',
    'measure-out',
  ],
  createInitialState,
  reduce,
  View: CountersView,
  observe,
  events: ['value-changed', 'frame-filled', 'split-recorded', 'bubble-popped', 'bagged'],
  emit,
  predicates,
  overlays: {
    'count-ones': CountOnesOverlay,
    'frame-gaps': FrameGapsOverlay,
    'bond-tree': BondTreeOverlay,
    'pair-lines': PairLinesOverlay,
    'bead-groups': BeadGroupsOverlay,
    'pair-march': PairMarchOverlay,
    'plate-bars': PlateBarsOverlay,
    'bubble-frame': BubbleFrameOverlay,
    'ten-gap': TenGapOverlay,
  },
};

export default definition;
