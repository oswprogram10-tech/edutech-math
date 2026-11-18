/**
 * E18의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `table-changed`, `graph-changed`, `scale-changed`, `flipped`.
 */
import type { EngineEvent, EnginePredicate, JsonValue } from '../../core/engine-sdk';
import type { GraphAction, GraphState } from './types';

export const EVENT_NAMES = ['table-changed', 'graph-changed', 'scale-changed', 'flipped'] as const;

export function emit(prev: GraphState, next: GraphState, action: GraphAction): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];
  const categories = next.settings.categories;

  if (action.type === 'set-table' && prev.table[action.cat] !== next.table[action.cat]) {
    events.push({ name: 'table-changed', payload: { cat: action.cat } });
  }

  if (
    action.type === 'toggle-mark' ||
    action.type === 'set-bar' ||
    action.type === 'reset-graph' ||
    action.type === 'set-scale'
  ) {
    for (const cat of categories) {
      const marksChanged = (prev.marks[cat] ?? []).join(',') !== (next.marks[cat] ?? []).join(',');
      const barChanged = (prev.bars[cat] ?? 0) !== (next.bars[cat] ?? 0);
      if (marksChanged || barChanged) {
        events.push({ name: 'graph-changed', payload: { cat } });
      }
    }
  }

  if (action.type === 'set-scale' && prev.scale !== next.scale) {
    events.push({ name: 'scale-changed', payload: { scale: next.scale } });
  }

  if (action.type === 'flip' && prev.orientation !== next.orientation) {
    events.push({ name: 'flipped', payload: { orientation: next.orientation } });
  }

  return events;
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function stringList(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  tableMatchesData: (observation) => observation['tableMatchesData'] === true,

  tableTotalIs: (observation, args) => {
    const total = recordOf(args)['total'];
    return typeof total === 'number' && observation['tableTotal'] === total;
  },

  graphMatches: (observation, args) => {
    const source = recordOf(args)['source'];
    if (source === 'data') return observation['graphMatchesData'] === true;
    if (source === 'table') return observation['graphMatchesTable'] === true;
    return false;
  },

  marksFromBottom: (observation) => {
    if (observation['graphType'] !== 'o-mark') return false;
    if (stringList(observation['gapCategories']).length > 0) return false;
    const cells = recordOf(observation['graphCells']);
    return Object.values(cells).some((count) => typeof count === 'number' && count >= 1);
  },

  orientationIs: (observation, args) => {
    const orientation = recordOf(args)['orientation'];
    return typeof orientation === 'string' && observation['orientation'] === orientation;
  },

  scaleIs: (observation, args) => {
    const scale = recordOf(args)['scale'];
    return typeof scale === 'number' && observation['scale'] === scale;
  },

  barCellsIs: (observation, args) => {
    const record = recordOf(args);
    const cat = record['cat'];
    const cells = record['cells'];
    if (typeof cat !== 'string' || typeof cells !== 'number') return false;
    return recordOf(observation['graphCells'])[cat] === cells;
  },

  hasMisconception: (observation, args) => {
    const code = recordOf(args)['code'];
    return typeof code === 'string' && stringList(observation['misconceptions']).includes(code);
  },
};
