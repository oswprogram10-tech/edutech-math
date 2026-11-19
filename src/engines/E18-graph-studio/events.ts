/**
 * E18의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `table-changed`, `graph-changed`, `scale-changed`, `flipped`,
 * 그림그래프 `rows-changed`·`compressed`·`expanded`·`legend-changed`, 학급 투표 `vote-changed`.
 */
import type { EngineEvent, EnginePredicate, JsonValue } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
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
  'point-changed',
  'segment-changed',
  'y-from-changed',
  'prediction-finished',
  'percent-changed',
  'band-changed',
  'curl-changed',
  'axis-changed',
  'group-changed',
  'headline-changed',
  'mark-changed',
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

  if (prev.mode === 'band-circle' && next.mode === 'band-circle') {
    for (const cat of categories) {
      if ((prev.percents[cat] ?? null) !== (next.percents[cat] ?? null)) {
        events.push({ name: 'percent-changed', payload: { cat } });
      }
      if ((prev.bandCells[cat] ?? null) !== (next.bandCells[cat] ?? null)) {
        events.push({ name: 'band-changed', payload: { cat } });
      }
    }
    if (prev.curl !== next.curl) {
      events.push({ name: 'curl-changed', payload: { value: next.curl } });
    }
  }

  if (prev.mode === 'distortion' && next.mode === 'distortion') {
    if (prev.yStart !== next.yStart || prev.yStep !== next.yStep || prev.wavy !== next.wavy) {
      events.push({
        name: 'axis-changed',
        payload: { yStart: next.yStart, yStep: next.yStep, wavy: next.wavy },
      });
    }
    if (prev.groups.join('|') !== next.groups.join('|')) {
      events.push({ name: 'group-changed', payload: { groups: [...next.groups] } });
    }
    if (prev.headline.join('|') !== next.headline.join('|')) {
      events.push({ name: 'headline-changed', payload: { length: next.headline.length } });
    }
    if (action.type === 'toggle-example-mark') {
      const before = (prev.exampleMarks[action.example] ?? []).join('|');
      const after = (next.exampleMarks[action.example] ?? []).join('|');
      if (before !== after) {
        events.push({ name: 'mark-changed', payload: { example: action.example } });
      }
    }
  }

  if (prev.mode === 'line-graph' && next.mode === 'line-graph') {
    const line = next.settings.line;
    for (const x of line?.xs ?? []) {
      const changed =
        prev.points[x] !== next.points[x] || prev.prediction[x] !== next.prediction[x];
      if (changed) events.push({ name: 'point-changed', payload: { x } });
    }
    if (JSON.stringify(prev.segments) !== JSON.stringify(next.segments)) {
      events.push({ name: 'segment-changed', payload: {} });
    }
    if (prev.yFrom !== next.yFrom) {
      events.push({ name: 'y-from-changed', payload: { value: next.yFrom } });
    }
    if (prev.phase === 'predict' && next.phase === 'actual') {
      events.push({ name: 'prediction-finished', payload: {} });
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

/** 문자열(소수·분수) 또는 정수를 `Rational`로 읽는다. 읽을 수 없으면 null. */
function rationalOf(value: JsonValue | undefined): Rational | null {
  try {
    if (typeof value === 'string') return Rational.parse(value);
    if (typeof value === 'number' && Number.isSafeInteger(value)) return Rational.of(value);
  } catch {
    return null;
  }
  return null;
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

  pointsMatch: (observation, args) =>
    recordOf(args)['source'] === 'data' && observation['pointsMatchData'] === true,

  segmentsInOrder: (observation) => observation['segmentsInOrder'] === true,

  /** 세로축 시작값이 `value` 이상이다. */
  yFromAtLeast: (observation, args) => {
    const wanted = rationalOf(recordOf(args)['value']);
    const current = rationalOf(observation['yFrom']);
    return wanted !== null && current !== null && current.compareTo(wanted) >= 0;
  },

  wavyShown: (observation) => observation['wavyShown'] === true,

  predictionDone: (observation) => observation['predictionDone'] === true,

  /** 학생이 쓴 백분율이 모두 참 백분율과 같다. */
  percentsMatch: (observation) => observation['percentsMatchData'] === true,

  /** 학생이 쓴 백분율이 모두 채워졌고 합이 `value`다. */
  percentSumIs: (observation, args) => {
    const value = recordOf(args)['value'];
    return typeof value === 'number' && observation['percentSum'] === value;
  },

  /** 띠 칸 수가 모두 참 백분율과 같다. */
  bandMatch: (observation) => observation['bandMatchesData'] === true,

  /** 원그래프로 말려 있다(curl 100). */
  circleShown: (observation) => observation['circleShown'] === true,

  /**
   * 응답 칸 `response[field].value`(Rational 문자열)를 `value`(소수 문자열 가능)와 Rational로 비교한다.
   * 값이 없거나 읽을 수 없으면 false다.
   */
  responseCompare: (observation, args) => {
    const record = recordOf(args);
    const field = record['field'];
    const op = record['op'];
    if (typeof field !== 'string' || typeof op !== 'string') return false;
    const actual = rationalOf(recordOf(recordOf(observation['response'])[field])['value']);
    const wanted = rationalOf(record['value']);
    if (actual === null || wanted === null) return false;
    const order = actual.compareTo(wanted);
    switch (op) {
      case 'lt':
        return order < 0;
      case 'le':
        return order <= 0;
      case 'eq':
        return order === 0;
      case 'ge':
        return order >= 0;
      case 'gt':
        return order > 0;
      default:
        return false;
    }
  },

  /** 세로축 시작값이 `value`보다 크다. */
  yStartAbove: (observation, args) => {
    const value = recordOf(args)['value'];
    const current = observation['yStart'];
    return typeof value === 'number' && typeof current === 'number' && current > value;
  },

  yStartIs: (observation, args) => {
    const value = recordOf(args)['value'];
    return typeof value === 'number' && observation['yStart'] === value;
  },

  /** 눈에 보이는 막대 높이의 비(가장 긴 ÷ 가장 짧은)가 `value` 이상이다. 비를 못 구하면 false. */
  visualRatioAtLeast: (observation, args) => {
    const wanted = rationalOf(recordOf(args)['value']);
    const current = rationalOf(observation['visualRatio']);
    return wanted !== null && current !== null && current.compareTo(wanted) >= 0;
  },

  /** 눈에 보이는 막대 높이의 비가 `value` 이하다. 비를 못 구하면 false. */
  visualRatioAtMost: (observation, args) => {
    const wanted = rationalOf(recordOf(args)['value']);
    const current = rationalOf(observation['visualRatio']);
    return wanted !== null && current !== null && current.compareTo(wanted) <= 0;
  },

  /** 예시 그래프에서 고른 "문제 있음" 항목이 실제 문제와 같다. `example`이 없으면 모든 예시가 그렇다. */
  marksMatch: (observation, args) => {
    const example = recordOf(args)['example'];
    if (typeof example === 'string') return recordOf(observation['marksMatch'])[example] === true;
    return observation['allMarksMatch'] === true;
  },

  hasMisconception: (observation, args) => {
    const code = recordOf(args)['code'];
    return typeof code === 'string' && stringList(observation['misconceptions']).includes(code);
  },
};
