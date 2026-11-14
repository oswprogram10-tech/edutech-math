/** E12 3D 입체 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { HiddenRevealOverlay } from './overlays/hidden-reveal';
import { RowLineupOverlay } from './overlays/row-lineup';
import { SideEyeOverlay } from './overlays/side-eye';
import { ViewsTwinsOverlay } from './overlays/views-twins';
import { createInitialState, reduce } from './reduce';
import { solid3dStrings } from './strings.ko';
import type { SolidAction, SolidConfig, SolidState } from './types';
import { SolidView } from './View';

const definition: EngineDefinition<SolidConfig, SolidState, SolidAction> = {
  id: 'E12',
  name: solid3dStrings.name,
  modes: ['cubes'],
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
  },
};

export default definition;
