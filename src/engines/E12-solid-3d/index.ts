/** E12 3D 입체 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { FoldCollisionOverlay } from './overlays/fold-collision';
import { FoldPathOverlay } from './overlays/fold-path';
import { ApexGatherOverlay } from './overlays/apex-gather';
import { HiddenRevealOverlay } from './overlays/hidden-reveal';
import { PrismNetClashOverlay } from './overlays/prism-net-clash';
import { PrismPeekOverlay } from './overlays/prism-peek';
import { RowLineupOverlay } from './overlays/row-lineup';
import { SideEyeOverlay } from './overlays/side-eye';
import { StandUpOverlay } from './overlays/stand-up';
import { ViewsTwinsOverlay } from './overlays/views-twins';
import { XrayPeekOverlay } from './overlays/xray-peek';
import { createInitialState, reduce } from './reduce';
import { UnitZoomOverlay } from './overlays/unit-zoom';
import { UnpaintedBlinkOverlay } from './overlays/unpainted-blink';
import { WrapsCompareOverlay } from './overlays/wraps-compare';
import { WrapVsFillOverlay } from './overlays/wrap-vs-fill';
import { solid3dStrings } from './strings.ko';
import type { SolidAction, SolidConfig, SolidState } from './types';
import { SolidView } from './View';

const definition: EngineDefinition<SolidConfig, SolidState, SolidAction> = {
  id: 'E12',
  name: solid3dStrings.name,
  modes: ['cubes', 'net-fold', 'xray', 'prism-pyramid', 'surface-volume'],
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
    'apex-gather': ApexGatherOverlay,
    'prism-peek': PrismPeekOverlay,
    'stand-up': StandUpOverlay,
    'prism-net-clash': PrismNetClashOverlay,
    'unpainted-blink': UnpaintedBlinkOverlay,
    'wrap-vs-fill': WrapVsFillOverlay,
    'unit-zoom': UnitZoomOverlay,
    'wraps-compare': WrapsCompareOverlay,
  },
};

export default definition;
