/**
 * E18의 관찰 결과. 판정·힌트는 이 값만 본다.
 *
 * 값은 모두 정수(number)다. 학생 그래프의 값은 칸 수 × scale로 계산한다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { barsOf, valueRatioOf, visualRatioOf, wavyShownOf } from './distortion';
import { adjacentPairs, isInOrder, valueOf } from './line';
import { roundPercent, rowValueOf } from './reduce';
import type {
  BandCircleState,
  DistortionState,
  GraphState,
  LineGraphState,
  PictographState,
} from './types';
import { isClassVote, voteCounts, voteViewState } from './vote';

/** 그래프가 지금 나타내는 값(칸 × scale, given이면 data 값). */
export function graphValueOf(state: GraphState, cat: string): number {
  const { settings } = state;
  if (state.mode === 'pictograph') {
    return rowValueOf(state.rows[cat] ?? { big: 0, small: 0 }, state.legendBig);
  }
  if (settings.graph === 'given') return settings.data?.[cat] ?? 0;
  return graphCellsOf(state, cat) * state.scale;
}

/** 막대 칸 수 또는 ○ 수. given이면 값 ÷ scale을 내린 값. */
export function graphCellsOf(state: GraphState, cat: string): number {
  const { settings } = state;
  if (state.mode === 'pictograph') {
    const row = state.rows[cat] ?? { big: 0, small: 0 };
    return row.big + row.small;
  }
  if (settings.graph === 'given') return Math.floor((settings.data?.[cat] ?? 0) / state.scale);
  if (settings.graphType === 'o-mark') return (state.marks[cat] ?? []).length;
  return state.bars[cat] ?? 0;
}

/** ○ 칸이 0번부터 빈틈없이 이어지지 않은 범주(학생이 그린 ○ 그래프만). */
export function gapCategoriesOf(state: GraphState): string[] {
  const { settings } = state;
  if (settings.graph !== 'student' || settings.graphType !== 'o-mark') return [];
  return settings.categories.filter((cat) => {
    const marks = state.marks[cat] ?? [];
    if (marks.length === 0) return false;
    return marks.some((cell, index) => cell !== index);
  });
}

/** data 값이 scale로 나누어떨어지지 않는 범주. */
export function offGridCategoriesOf(state: GraphState): string[] {
  const { data, categories } = state.settings;
  if (!data) return [];
  return categories.filter((cat) => (data[cat] ?? 0) % state.scale !== 0);
}

/** 그래프와 비교할 기준 표 값: 표가 student면 학생 표, 아니면 data. 없으면 null. */
export function tableReferenceOf(state: GraphState, cat: string): number | null {
  if (state.settings.table === 'student') return state.table[cat] ?? null;
  return state.settings.data?.[cat] ?? null;
}

/** 학생 그래프를 다 그렸고(모든 범주 1칸 이상) 표와 다른 범주들. 다 그리기 전에는 빈 배열. */
export function mismatchCategoriesOf(state: GraphState): string[] {
  const { settings } = state;
  if (state.mode === 'pictograph') return [];
  if (settings.graph !== 'student' || settings.categories.length === 0) return [];
  if (!settings.categories.every((cat) => graphCellsOf(state, cat) >= 1)) return [];
  return settings.categories.filter((cat) => {
    const reference = tableReferenceOf(state, cat);
    return reference !== null && reference !== graphValueOf(state, cat);
  });
}

function tableCompleteOf(state: GraphState): boolean {
  const { categories } = state.settings;
  return categories.length > 0 && categories.every((cat) => state.table[cat] !== null);
}

function tableTotalOf(state: GraphState): number {
  return state.settings.categories.reduce((sum, cat) => sum + (state.table[cat] ?? 0), 0);
}

/** 그림그래프(pictograph) 모드에만 있는 Observation 키. */
function pictographKeys(state: PictographState): Record<string, JsonValue> {
  const { settings } = state;
  const rows: Record<string, JsonValue> = {};
  const rowValues: Record<string, number> = {};
  let iconTotal = 0;
  for (const cat of settings.categories) {
    const row = state.rows[cat] ?? { big: 0, small: 0 };
    rows[cat] = { big: row.big, small: row.small };
    rowValues[cat] = rowValueOf(row, state.legendBig);
    iconTotal += row.big + row.small;
  }
  const data = settings.data;
  return {
    rows,
    rowValues,
    legendBig: state.legendBig,
    rowsMatchData:
      data !== null &&
      settings.categories.length > 0 &&
      settings.categories.every((cat) => rowValues[cat] === data[cat]),
    iconTotal,
    compressions: state.compressions,
    expansions: state.expansions,
  };
}

/** line-graph 모드의 Observation. 세로 값은 `Rational.toJSON()` 문자열이다. */
function observeLine(state: LineGraphState): Observation {
  const line = state.settings.line;
  const xs = line?.xs ?? [];
  const given = state.settings.graph === 'given';
  const linePoints: Record<string, JsonValue> = {};
  const prediction: Record<string, JsonValue> = {};
  xs.forEach((x, index) => {
    linePoints[x] = given ? (line?.values[index] ?? null) : (state.points[x] ?? null);
    prediction[x] = state.prediction[x] ?? null;
  });
  const segments: [number, number][] = given
    ? adjacentPairs(xs.length)
    : state.segments.map(([a, b]): [number, number] => [a, b]);
  const complete = xs.length > 0 && xs.every((x) => linePoints[x] !== null);
  const matchesData =
    line !== null &&
    complete &&
    xs.every((x, index) => {
      const point = valueOf(linePoints[x] as string);
      const expected = valueOf(line.values[index]);
      return point !== null && expected !== null && point.equals(expected);
    });
  const yFrom = valueOf(state.yFrom);
  const predictionCount = xs.filter((x) => prediction[x] !== null).length;
  return {
    mode: 'line-graph',
    graphSource: state.settings.graph,
    lineX: [...xs],
    linePoints,
    pointsComplete: complete,
    pointsMatchData: matchesData,
    segments,
    segmentsInOrder: isInOrder(segments, xs.length),
    yFrom: state.yFrom,
    wavyShown: yFrom !== null && !yFrom.isZero() && !yFrom.isNegative(),
    phase: state.phase,
    prediction,
    predictionCount,
    predictionDone: line?.predict === true && state.phase === 'actual',
    misconceptions: [],
  };
}

/**
 * 지금 띠가 가진 칸 수(범주별). `band: 'auto'`는 학생이 쓴 백분율(없으면 0),
 * `'given'`은 참 백분율(가까운 정수), `'student'`는 학생이 정한 칸 수(없으면 0)다.
 */
export function bandCellsOf(state: BandCircleState): Record<string, number> {
  const band = state.settings.bandCircle;
  const cells: Record<string, number> = {};
  for (const cat of state.settings.categories) {
    if (band?.band === 'given') {
      cells[cat] = roundPercent(Rational.parse(band.truePercents[cat] ?? '0'));
    } else if (band?.band === 'student') {
      cells[cat] = state.bandCells[cat] ?? 0;
    } else {
      cells[cat] = state.percents[cat] ?? 0;
    }
  }
  return cells;
}

/** band-circle 모드의 Observation. 참 백분율은 `Rational.toJSON()` 문자열이다. */
function observeBand(state: BandCircleState): Observation {
  const { settings } = state;
  const band = settings.bandCircle;
  const categories = settings.categories;
  const data = settings.data ?? {};
  const truePercents: Record<string, string> = {};
  const percents: Record<string, number | null> = {};
  for (const cat of categories) {
    truePercents[cat] = band?.truePercents[cat] ?? '0';
    percents[cat] = state.percents[cat] ?? null;
  }
  const percentsComplete =
    categories.length > 0 && categories.every((cat) => percents[cat] !== null);
  const percentSum = percentsComplete
    ? categories.reduce((sum, cat) => sum + (percents[cat] ?? 0), 0)
    : null;
  const percentsMatchData =
    percentsComplete &&
    categories.every((cat) =>
      Rational.of(percents[cat] ?? 0).equals(Rational.parse(truePercents[cat] as string)),
    );

  const cells = bandCellsOf(state);
  const bandCellSum = categories.reduce((sum, cat) => sum + (cells[cat] ?? 0), 0);
  const bandMatchesData =
    categories.length > 0 &&
    categories.every((cat) =>
      Rational.of(cells[cat] ?? 0).equals(Rational.parse(truePercents[cat] as string)),
    );

  const misconceptions = new Set<string>();
  if (
    band?.band === 'student' &&
    categories.length > 0 &&
    categories.every(
      (cat) => state.bandCells[cat] !== null && state.bandCells[cat] !== undefined,
    ) &&
    bandCellSum !== 100
  ) {
    misconceptions.add('MC-GRAPH-PERCENT-AS-COUNT');
  }
  if (
    percentsComplete &&
    percentSum !== 100 &&
    categories.every((cat) => percents[cat] === (data[cat] ?? 0))
  ) {
    misconceptions.add('MC-GRAPH-PERCENT-AS-COUNT');
  }

  const table: Record<string, number | null> = {};
  for (const cat of categories) table[cat] = settings.data?.[cat] ?? null;

  return {
    mode: 'band-circle',
    categories: [...categories],
    table,
    tableTotal: band?.total ?? 0,
    truePercents,
    percents,
    percentsComplete,
    percentsMatchData,
    percentSum,
    bandCells: cells,
    bandCellSum,
    bandMatchesData,
    curl: state.curl,
    circleShown: state.curl === 100,
    misconceptions: [...misconceptions].sort(),
  };
}

/** 학생이 "문제 있음"으로 고른 항목이 예시의 실제 문제와 같은 집합인가(정답 여부는 이 불리언으로만 나간다). */
function marksMatchOf(state: DistortionState): Record<string, boolean> {
  const examples = state.settings.distortion?.examples ?? [];
  return Object.fromEntries(
    examples.map((example) => {
      const marked = state.exampleMarks[example.id] ?? [];
      return [
        example.id,
        marked.length === example.flaws.length &&
          example.flaws.every((flaw) => marked.includes(flaw)),
      ];
    }),
  );
}

/** distortion 모드의 Observation. 비는 `Rational.toJSON()` 문자열이다. */
function observeDistortion(state: DistortionState): Observation {
  const bars = barsOf(state);
  const values = bars.map((bar) => bar.value);
  const wavyShown = wavyShownOf(state);
  const visual = visualRatioOf(values, state.yStart, state.yStep, wavyShown);
  const real = valueRatioOf(values);
  const barValues: Record<string, number> = {};
  for (const bar of bars) barValues[bar.cat] = bar.value;
  const marksMatch = marksMatchOf(state);
  const marks: Record<string, JsonValue> = {};
  for (const [id, items] of Object.entries(state.exampleMarks)) marks[id] = [...items];
  const matches = Object.values(marksMatch);
  return {
    mode: 'distortion',
    yStart: state.yStart,
    yStep: state.yStep,
    wavyShown,
    groupsOn: [...state.groups],
    barCategories: bars.map((bar) => bar.cat),
    barValues,
    visualRatio: visual === null ? null : visual.toJSON(),
    valueRatio: real === null ? null : real.toJSON(),
    history: { ...state.history },
    headline: [...state.headline],
    exampleIndex: state.exampleIndex,
    marks,
    marksMatch,
    allMarksMatch: matches.length > 0 && matches.every(Boolean),
    misconceptions: [],
  };
}

export function observe(state: GraphState): Observation {
  if (state.mode === 'distortion') return observeDistortion(state);
  if (state.mode === 'band-circle') return observeBand(state);
  if (state.mode === 'line-graph') return observeLine(state);
  if (isClassVote(state)) {
    const counts = voteCounts(state);
    const total = state.votes.length;
    // 자료가 따로 없는 투표이므로 "자료와 같은가"를 뜻하는 키는 뺀다.
    const {
      graphMatchesData: _graphMatchesData,
      graphMatchesTable: _graphMatchesTable,
      tableMatchesData: _tableMatchesData,
      ...rest
    } = observeBase(voteViewState(state));
    void [_graphMatchesData, _graphMatchesTable, _tableMatchesData];
    return { ...rest, mode: 'class-vote', voteTotal: total, voteCounts: counts };
  }
  const base = observeBase(state);
  if (state.mode !== 'pictograph') return base;
  const keys = pictographKeys(state);
  return {
    ...base,
    ...keys,
    // 그림그래프의 그래프 판정 키는 행 값으로 채운다(`graphValues`는 이미 행 값이다).
    graphType: 'pictograph',
    graphMatchesData: keys['rowsMatchData'] === true,
  };
}

function observeBase(state: GraphState): Observation {
  const { settings } = state;
  const categories = settings.categories;
  const graphValues: Record<string, number> = {};
  const graphCells: Record<string, number> = {};
  const table: Record<string, number | null> = {};
  for (const cat of categories) {
    graphValues[cat] = graphValueOf(state, cat);
    graphCells[cat] = graphCellsOf(state, cat);
    table[cat] = state.table[cat] ?? null;
  }

  const data = settings.data;
  const tableComplete = tableCompleteOf(state);
  const tableTotal = tableTotalOf(state);
  const gapCategories = gapCategoriesOf(state);
  const offGridCategories = offGridCategoriesOf(state);

  const graphMatchesData =
    data !== null &&
    categories.length > 0 &&
    categories.every((cat) => graphValues[cat] === data[cat]);
  const graphMatchesTable =
    categories.length > 0 &&
    categories.every((cat) => {
      const value = table[cat];
      return value !== null && value !== undefined && graphValues[cat] === value;
    });

  const misconceptions = new Set<string>();
  if (gapCategories.length > 0) misconceptions.add('MC-GRAPH-GAP-ORDER');
  if (mismatchCategoriesOf(state).length > 0) misconceptions.add('MC-GRAPH-TABLE-MISMATCH');
  if (
    settings.rawItems.length > 0 &&
    settings.table === 'student' &&
    tableComplete &&
    tableTotal !== settings.rawItems.length
  ) {
    misconceptions.add('MC-COUNT-ONE-TO-ONE');
  }

  const result: Record<string, JsonValue> = {
    mode: state.mode,
    graphType: settings.graphType,
    graphSource: settings.graph,
    orientation: state.orientation,
    scale: state.scale,
    flipped: state.orientation !== settings.orientation,
    table,
    tableComplete,
    tableTotal,
    talliedCount: state.tallied.length,
    rawCount: settings.rawItems.length,
    graphValues,
    graphCells,
    graphMatchesData,
    graphMatchesTable,
    gapCategories,
    offGridCategories,
    misconceptions: [...misconceptions].sort(),
  };
  if (settings.datasets.length > 0) result['datasetId'] = state.datasetId;
  if (data !== null) {
    result['tableMatchesData'] =
      categories.length > 0 && categories.every((cat) => table[cat] === data[cat]);
  }
  return result;
}
