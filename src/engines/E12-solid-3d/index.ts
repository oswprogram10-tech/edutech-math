/** E12 3D 입체 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { FoldCollisionOverlay } from './overlays/fold-collision';
import { FoldPathOverlay } from './overlays/fold-path';
import { HiddenRevealOverlay } from './overlays/hidden-reveal';
import { RowLineupOverlay } from './overlays/row-lineup';
import { SideEyeOverlay } from './overlays/side-eye';
import { ViewsTwinsOverlay } from './overlays/views-twins';
import { XrayPeekOverlay } from './overlays/xray-peek';
import { createInitialState, reduce } from './reduce';
import { solid3dStrings } from './strings.ko';
import type { SolidAction, SolidConfig, SolidState } from './types';
import { SolidView } from './View';

const definition: EngineDefinition<SolidConfig, SolidState, SolidAction> = {
  id: 'E12',
  name: solid3dStrings.name,
  modes: ['cubes', 'net-fold', 'xray'],
  createInitialState,
  reduce,
  View: SolidView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'hidden-reveal': HiddenRevealOverlay,
    'side-eye': SideEyeOverlay,
    'row-lineup': RowLineupOverlay,
    'views-twins': ViewsTwinsOverlay,
    'fold-collision': FoldCollisionOverlay,
    'fold-path': FoldPathOverlay,
    'xray-peek': XrayPeekOverlay,
  },
};

export default definition;
