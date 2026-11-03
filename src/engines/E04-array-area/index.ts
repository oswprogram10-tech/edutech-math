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
import { MissingStripOverlay } from './overlays/missing-strip';
import { RowCountOverlay } from './overlays/row-count';

const definition: EngineDefinition<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction> = {
  id: 'E04',
  name: arrayAreaStrings.name,
  modes: ['dot-array', 'split', 'area-model', 'times-table'],
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
  },
};

export default definition;
