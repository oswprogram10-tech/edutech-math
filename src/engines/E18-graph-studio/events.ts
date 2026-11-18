/**
 * E18의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `table-changed`, `graph-changed`, `scale-changed`, `flipped`,
 * 그림그래프 `rows-changed`·`compressed`·`expanded`·`legend-changed`, 학급 투표 `vote-changed`.
 */
import type { EngineEvent, EnginePredicate, JsonValue } from '../../core/engine-sdk';
import type { GraphAction, GraphState } from './types';

export const EVENT_NAMES = [
  'table-changed',
  'graph-changed',
  'scale-changed',
  'flipped',
  'rows-changed',
  'compressed',
  'expanded',
  'legend-changed',
  'vote-changed',
] as const;

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

  if (prev.mode === 'pictograph' && next.mode === 'pictograph') {
    if (action.type === 'compress' && prev.compressions !== next.compressions) {
      events.push({ name: 'compressed', payload: { cat: action.cat } });
    }
    if (action.type === 'expand' && prev.expansions !== next.expansions) {
      events.push({ name: 'expanded', payload: { cat: action.cat } });
    }
    if (action.type === 'set-legend' && prev.legendBig !== next.legendBig) {
      events.push({ name: 'legend-changed', payload: { big: next.legendBig } });
    }
    if (
      action.type === 'add-small' ||
      action.type === 'remove-small' ||
      action.type === 'remove-big' ||
      action.type === 'compress' ||
      action.type === 'expand' ||
      action.type === 'reset-rows'
    ) {
      for (const cat of categories) {
        const before = prev.rows[cat];
        const after = next.rows[cat];
        if (before?.big !== after?.big || before?.small !== after?.small) {
          events.push({ name: 'rows-changed', payload: { cat } });
        }
      }
    }
  }

  if (prev.mode === 'class-vote' && next.mode === 'class-vote') {
    if (prev.votes.length !== next.votes.length) {
      events.push({ name: 'vote-changed', payload: { total: next.votes.length } });
    }
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

  datasetPicked: (observation) => typeof observation['datasetId'] === 'string',

  rowsMatchData: (observation) => observation['rowsMatchData'] === true,

  rowValueIs: (observation, args) => {
    const record = recordOf(args);
    const cat = record['cat'];
    const value = record['value'];
    if (typeof cat !== 'string' || typeof value !== 'number') return false;
    return recordOf(observation['rowValues'])[cat] === value;
  },

  legendIs: (observation, args) => {
    const big = recordOf(args)['big'];
    return typeof big === 'number' && observation['legendBig'] === big;
  },

  /** 어떤 행도 작은 그림이 legendBig개 이상 남지 않았다(더 묶을 수 없다). */
  allRowsCompressed: (observation) => {
    const legendBig = observation['legendBig'];
    if (typeof legendBig !== 'number') return false;
    const rows = recordOf(observation['rows']);
    return Object.values(rows).every((row) => {
      const small = recordOf(row)['small'];
      return typeof small === 'number' && small < legendBig;
    });
  },

  voteTotalAtLeast: (observation, args) => {
    const n = recordOf(args)['n'];
    const total = observation['voteTotal'];
    return typeof n === 'number' && typeof total === 'number' && total >= n;
  },

  /**
   * 응답 칸 `response[field].value`가 투표 수(`voteTotal`)와 같은 정수이고 투표가 1표 이상이다.
   * 수 칸의 `value`는 `Rational.toJSON()` 문자열(정수는 "12", 분수는 "7/2")이라
   * 숫자만으로 된 문자열일 때만 정수로 읽는다.
   */
  responseEqualsVoteTotal: (observation, args) => {
    const field = recordOf(args)['field'];
    const total = observation['voteTotal'];
    if (typeof field !== 'string' || typeof total !== 'number' || total < 1) return false;
    const value = recordOf(recordOf(observation['response'])[field])['value'];
    if (typeof value === 'string') return /^\d+$/.test(value) && Number(value) === total;
    return typeof value === 'number' && Number.isInteger(value) && value === total;
  },

  hasMisconception: (observation, args) => {
    const code = recordOf(args)['code'];
    return typeof code === 'string' && stringList(observation['misconceptions']).includes(code);
  },
};
