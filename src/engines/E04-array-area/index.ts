/** E04 배열판(배열·넓이 모델) 엔진 정의. */
import type { EngineDefinition } from '../../core/engine-sdk';
import { EVENT_NAMES, emit, predicates } from './events';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { arrayAreaStrings } from './strings.ko';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from './types';
import { ArrayAreaView } from './View';
import { FoldDiagonalOverlay } from './overlays/fold-diagonal';
import { KnownFactOverlay } from './overlays/known-fact';
import { LeftoverStripOverlay } from './overlays/leftover-strip';
import { MissingStripOverlay } from './overlays/missing-strip';
import { OverlapCountOverlay } from './overlays/overlap-count';
import { RibbonCutOverlay } from './overlays/ribbon-cut';
import { RowCountOverlay } from './overlays/row-count';
import { SlotMismatchOverlay } from './overlays/slot-mismatch';

const definition: EngineDefinition<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction> = {
  id: 'E04',
  name: arrayAreaStrings.name,
  modes: [
    'dot-array',
    'split',
    'area-model',
    'times-table',
    'tiling',
    'decimal-area',
    'fraction-area',
  ],
  createInitialState,
  reduce,
  View: ArrayAreaView,
  observe,
  events: EVENT_NAMES,
  emit,
  predicates,
  overlays: {
    'row-count': RowCountOverlay,
    'known-fact': KnownFactOverlay,
    'fold-diagonal': FoldDiagonalOverlay,
    'missing-strip': MissingStripOverlay,
    'leftover-strip': LeftoverStripOverlay,
    'overlap-count': OverlapCountOverlay,
    'ribbon-cut': RibbonCutOverlay,
    'slot-mismatch': SlotMismatchOverlay,
  },
};

export default definition;
