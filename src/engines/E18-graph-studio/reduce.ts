/**
 * E18 그래프 스튜디오의 순수 reducer.
 *
 * - 설정은 `normalizeSettings`로 정리해 상태에 복사한다(reduce가 config를 받지 않는다).
 * - 정수가 아니거나 0~100 밖인 자료 값은 그 범주를 0으로 본다.
 * - 정답 높이를 저장하지 않는다. 학생이 그린 칸 수(`bars`·`marks`)·그림 수(`rows`)와 표 값만 둔다.
 * - T156: `pictograph`(그림 놓기·묶기·펼치기·범례)와 `class-vote`(투표 쌓기)를 더했다.
 */
import {
  CHECKLIST_ITEMS,
  DATA_MAX,
  HEADLINE_MAX,
  DEFAULT_LEGEND_BIG,
  DEFAULT_LEGEND_OPTIONS,
  DEFAULT_SCALE_OPTIONS,
  DEFAULT_VOTE_AXIS_MAX,
} from './types';
import { Rational } from '../../core/math';
import { canToggleGroupOn, normalizeDistortion, toLargeCount } from './distortion';
import { autoSegments, normalizeLine, normalizePair, snapValue, valueOf } from './line';
import type {
  BandCircleSettings,
  BandCircleState,
  BandSource,
  BuildSource,
  ClassVoteState,
  CompareSettings,
  DatasetOption,
  DistortionState,
  GraphAction,
  GraphConfig,
  GraphMode,
  GraphSettings,
  GraphSource,
  GraphState,
  GraphType,
  IconKind,
  LegendChange,
  LineGraphState,
  MorphSetting,
  Orientation,
  PercentEntry,
  PictographRow,
  PictographState,
  SliceLabels,
  TableSource,
  TooltipSetting,
} from './types';

/** 같은 상한을 쓰는 눈금 칸 수(안전 장치). */
const MAX_AXIS_CELLS = 200;

const ICONS: readonly IconKind[] = ['apple', 'person', 'box', 'star'];

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 0 이상 100 이하 정수만 값으로 인정하고, 나머지는 0으로 본다. */
export function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= DATA_MAX
    ? value
    : 0;
}

function toPositiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/** 큰 그림이 나타내는 수는 2 이상의 정수여야 한다(1이면 묶을 수 없다). */
function toLegendInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 2 ? value : null;
}

export function inferMode(config: GraphConfig | undefined): GraphMode {
  const mode = recordOf(config)['mode'];
  return mode === 'scale' ||
    mode === 'pictograph' ||
    mode === 'class-vote' ||
    mode === 'line-graph' ||
    mode === 'band-circle' ||
    mode === 'distortion'
    ? mode
    : 'table-to-graph';
}

/** 값을 (큰 그림, 작은 그림)으로 가른다. */
export function splitValue(value: number, legendBig: number): PictographRow {
  const safe = Math.max(0, Math.floor(value));
  return { big: Math.floor(safe / legendBig), small: safe % legendBig };
}

/** 행 하나가 나타내는 값: 큰 그림 × legendBig + 작은 그림. */
export function rowValueOf(row: PictographRow, legendBig: number): number {
  return row.big * legendBig + row.small;
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const item of values) {
    if (typeof item === 'string' && !result.includes(item)) result.push(item);
  }
  return result;
}

/** 자료 묶음 목록을 정리한다. id·title이 문자열이 아니거나 겹치면 그 묶음은 뺀다. */
function normalizeDatasets(
  raw: unknown,
  record: Readonly<Record<string, unknown>>,
): DatasetOption[] {
  if (!Array.isArray(raw)) return [];
  const result: DatasetOption[] = [];
  for (const item of raw as unknown[]) {
    const entry = recordOf(item);
    const id = entry['id'];
    const title = entry['title'];
    const data = entry['data'];
    if (typeof id !== 'string' || id === '' || typeof title !== 'string') continue;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) continue;
    if (result.some((option) => option.id === id)) continue;
    const dataRecord = data as Readonly<Record<string, unknown>>;
    const categories = Object.keys(dataRecord);
    result.push({
      id,
      title,
      categories,
      data: Object.fromEntries(categories.map((cat) => [cat, toCount(dataRecord[cat])])),
      valueLabel: stringOf(entry['valueLabel']) || stringOf(record['valueLabel']),
      categoryAxisTitle:
        stringOf(entry['categoryAxisTitle']) || stringOf(record['categoryAxisTitle']),
      valueAxisTitle: stringOf(entry['valueAxisTitle']) || stringOf(record['valueAxisTitle']),
      source: stringOf(entry['source']),
    });
  }
  return result;
}

/** 명세의 `[[이름, 값], …]` 배열 모양 자료를 객체로 바꾼다. 객체는 그대로, 그 밖은 null. */
function pairsToRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (Array.isArray(value)) {
    const result: Record<string, unknown> = {};
    for (const item of value as unknown[]) {
      if (Array.isArray(item) && typeof item[0] === 'string') result[item[0]] = item[1];
    }
    return result;
  }
  if (value !== null && typeof value === 'object') {
    return value as Readonly<Record<string, unknown>>;
  }
  return null;
}

/** 개수 × 100 / 전체. 전체가 0이면 0. */
export function truePercentOf(count: number, total: number): Rational {
  return total > 0 ? Rational.of(count * 100, total) : Rational.of(0);
}

/** 0 이상 유리수를 가장 가까운 정수로(0.5는 올림). */
export function roundPercent(value: Rational): number {
  return Number((2n * value.n + value.d) / (2n * value.d));
}

function normalizeCompare(value: unknown): CompareSettings | null {
  const record = recordOf(value);
  const data = pairsToRecord(record['data']);
  if (data === null) return null;
  const categories = Object.keys(data);
  if (categories.length === 0) return null;
  const counts = Object.fromEntries(categories.map((cat) => [cat, toCount(data[cat])]));
  return {
    title: stringOf(record['title']),
    categories,
    data: counts,
    total: categories.reduce((sum, cat) => sum + (counts[cat] ?? 0), 0),
  };
}

function normalizeBandCircle(
  record: Readonly<Record<string, unknown>>,
  categories: readonly string[],
  data: Readonly<Record<string, number>> | null,
): BandCircleSettings {
  const entryRaw = record['percentEntry'];
  const percentEntry: PercentEntry =
    entryRaw === 'student' || entryRaw === 'given' || entryRaw === 'hidden'
      ? entryRaw
      : record['requirePercentEntry'] === true
        ? 'student'
        : 'given';
  const bandRaw = record['band'];
  const band: BandSource =
    bandRaw === 'student' || bandRaw === 'given' || bandRaw === 'auto' ? bandRaw : 'auto';
  const morphRaw = record['morph'];
  const morph: MorphSetting =
    morphRaw === 'button' || morphRaw === 'none' || morphRaw === 'drag' ? morphRaw : 'drag';
  const total = categories.reduce((sum, cat) => sum + (data?.[cat] ?? 0), 0);
  const sliceLabels: SliceLabels = record['sliceLabels'] === 'name' ? 'name' : 'name-percent';
  return {
    percentEntry,
    band,
    morph,
    startAs: record['startAs'] === 'circle' ? 'circle' : 'band',
    sliceLabels,
    circleTitle: stringOf(record['circleTitle']) || stringOf(record['title']),
    compare: normalizeCompare(record['compare']),
    total,
    truePercents: Object.fromEntries(
      categories.map((cat) => [cat, truePercentOf(data?.[cat] ?? 0, total).toJSON()]),
    ),
  };
}

export function normalizeSettings(config: GraphConfig | undefined, mode: GraphMode): GraphSettings {
  const record = recordOf(config);

  const rawData =
    mode === 'band-circle' || mode === 'distortion'
      ? pairsToRecord(record['data'])
      : record['data'];
  const dataRecord =
    rawData !== null && typeof rawData === 'object' && !Array.isArray(rawData)
      ? (rawData as Readonly<Record<string, unknown>>)
      : null;
  const rawItems = Array.isArray(record['rawItems'])
    ? (record['rawItems'] as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];

  const datasets =
    mode === 'class-vote' ||
    mode === 'line-graph' ||
    mode === 'band-circle' ||
    mode === 'distortion'
      ? []
      : normalizeDatasets(record['datasets'], record);
  const line = mode === 'line-graph' ? normalizeLine(record) : null;

  let categories: string[];
  let data: Record<string, number> | null = null;
  if (line !== null) {
    // 꺾은선그래프의 가로축 이름이 범주다. 세로 값은 Rational이라 `data`(정수)에는 넣지 않는다.
    categories = [...line.xs];
  } else if (datasets.length > 0) {
    // 묶음을 고르기 전에는 범주가 없다.
    categories = [];
  } else if (mode === 'class-vote') {
    categories = uniqueStrings(record['options']);
    if (categories.length === 0) categories = uniqueStrings(record['categories']);
  } else if (dataRecord) {
    categories = Object.keys(dataRecord);
    data = Object.fromEntries(
      categories.map((cat) => [
        cat,
        mode === 'distortion' ? toLargeCount(dataRecord[cat]) : toCount(dataRecord[cat]),
      ]),
    );
  } else {
    categories = uniqueStrings(record['categories']);
    if (categories.length === 0) categories = uniqueStrings(rawItems);
  }

  // 별칭: 명시한 키가 우선한다.
  const tableRaw = record['table'];
  let table: TableSource =
    tableRaw === 'student' || tableRaw === 'hidden' || tableRaw === 'given' ? tableRaw : 'given';
  if (tableRaw === undefined && record['showTable'] === 'sync') table = 'given';

  const graphRaw = record['graph'];
  let graph: GraphSource =
    graphRaw === 'student' || graphRaw === 'none' || graphRaw === 'given' ? graphRaw : 'given';
  if (graphRaw === undefined && record['studentDraw'] === true) graph = 'student';

  const build: BuildSource = record['build'] === 'given' ? 'given' : 'student';
  if (mode === 'pictograph') graph = build === 'student' ? 'student' : 'given';
  if (mode === 'class-vote') {
    graph = 'given';
    if (table !== 'hidden') table = 'given';
  }
  if (mode === 'line-graph') {
    if (graph === 'none') graph = 'given';
    if (table !== 'hidden') table = 'given';
  }
  if (mode === 'band-circle') {
    graph = 'given';
    if (table !== 'hidden') table = 'given';
  }
  if (mode === 'distortion') {
    graph = 'given';
    table = 'hidden';
  }

  const graphType: GraphType =
    mode === 'class-vote' || (record['graphType'] === 'o-mark' && mode !== 'pictograph')
      ? 'o-mark'
      : 'bar';
  const orientation: Orientation =
    record['orientation'] === 'horizontal' ? 'horizontal' : 'vertical';
  const scale = mode === 'class-vote' ? 1 : (toPositiveInt(record['scale']) ?? 1);

  const optionsRaw = Array.isArray(record['scaleOptions'])
    ? (record['scaleOptions'] as unknown[])
    : null;
  const optionList = optionsRaw
    ? [...new Set(optionsRaw.map(toPositiveInt).filter((v): v is number => v !== null))].sort(
        (a, b) => a - b,
      )
    : [];
  const scaleOptions =
    optionList.length > 0 ? optionList : mode === 'scale' ? [...DEFAULT_SCALE_OPTIONS] : [];

  const tooltipsRaw = record['tooltips'];
  const tooltips: TooltipSetting =
    tooltipsRaw === 'show' || tooltipsRaw === 'hide' ? tooltipsRaw : 'auto';

  const viewsRaw = record['views'];
  const views = Array.isArray(viewsRaw)
    ? viewsRaw
    : mode === 'pictograph'
      ? ['table', 'pictograph']
      : ['table', 'graph'];

  // 그림그래프: `legend`가 `compressGroup`보다 우선한다.
  const legendRecord = recordOf(record['legend']);
  const legendBig =
    toLegendInt(legendRecord['big']) ?? toLegendInt(record['compressGroup']) ?? DEFAULT_LEGEND_BIG;
  const legendOptionList = Array.isArray(record['legendOptions'])
    ? [...new Set((record['legendOptions'] as unknown[]).map(toLegendInt))].filter(
        (value): value is number => value !== null,
      )
    : [];
  const iconRaw = record['icon'];
  const icon: IconKind = ICONS.find((kind) => kind === iconRaw) ?? 'apple';
  const legendChange: LegendChange =
    record['legendChange'] === 'recalculate' ? 'recalculate' : 'keep-icons';

  return {
    categories,
    data,
    rawItems,
    table,
    graph,
    graphType,
    orientation,
    orientationFlip: record['orientationFlip'] === true,
    scale,
    scaleOptions: mode === 'class-vote' ? [] : scaleOptions,
    axisMax:
      toPositiveInt(record['axisMax']) ?? (mode === 'class-vote' ? DEFAULT_VOTE_AXIS_MAX : null),
    valueLabel: stringOf(record['valueLabel']),
    categoryAxisTitle: stringOf(record['categoryAxisTitle']),
    valueAxisTitle: stringOf(record['valueAxisTitle']),
    title: stringOf(record['title']),
    tooltips: mode === 'class-vote' ? 'hide' : tooltips,
    showTable: table !== 'hidden' && views.includes('table'),
    showGraph: mode !== 'pictograph' && graph !== 'none' && views.includes('graph'),
    showPictograph:
      (mode === 'pictograph' || mode === 'table-to-graph') && views.includes('pictograph'),
    icon,
    legendBig,
    legendEditable: record['legendEditable'] === true,
    legendOptions: legendOptionList.length > 0 ? legendOptionList : [...DEFAULT_LEGEND_OPTIONS],
    legendChange,
    build,
    question: stringOf(record['question']),
    datasets,
    source: '',
    line,
    bandCircle: mode === 'band-circle' ? normalizeBandCircle(record, categories, data) : null,
    distortion: mode === 'distortion' ? normalizeDistortion(record, data, categories) : null,
  };
}

/**
 * 값 축의 칸 수. 기본 끝 값은 "자료 최댓값을 scale 배수로 올린 다음 한 칸을 더한 값"이다.
 * 자료가 없으면 최댓값을 10으로 본다.
 */
export function axisCells(settings: GraphSettings, scale: number): number {
  const values = settings.data ? Object.values(settings.data) : [];
  const base = settings.data ? Math.max(0, ...values) : 10;
  const end = settings.axisMax ?? Math.ceil(base / scale) * scale + scale;
  return Math.max(1, Math.min(MAX_AXIS_CELLS, Math.ceil(end / scale)));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/** 그림그래프 행의 처음 모양. `fromData`면 자료 값으로 채우고, 아니면 비운다. */
function rowsFromData(
  settings: GraphSettings,
  legendBig: number,
  fromData: boolean,
): Record<string, PictographRow> {
  const rows: Record<string, PictographRow> = {};
  for (const cat of settings.categories) {
    rows[cat] = fromData ? splitValue(settings.data?.[cat] ?? 0, legendBig) : { big: 0, small: 0 };
  }
  return rows;
}

/** 학급 투표에서 선택지 하나가 쌓을 수 있는 ○의 수. */
export function voteLimit(settings: GraphSettings): number {
  return settings.axisMax ?? DEFAULT_VOTE_AXIS_MAX;
}

export function voteCountOf(votes: readonly string[], option: string): number {
  return votes.filter((vote) => vote === option).length;
}

/** 처음 말기 정도: `startAs: 'circle'`이면 원그래프, 아니면 곧은 띠다. */
export function initialCurl(band: BandCircleSettings): number {
  return band.startAs === 'circle' ? 100 : 0;
}

export function createInitialState(config: GraphConfig | undefined): GraphState {
  const mode = inferMode(config);
  const settings = normalizeSettings(config, mode);
  const table: Record<string, number | null> = {};
  const marks: Record<string, readonly number[]> = {};
  const bars: Record<string, number> = {};
  for (const cat of settings.categories) {
    table[cat] = settings.table === 'student' ? null : (settings.data?.[cat] ?? null);
    marks[cat] = [];
    bars[cat] = 0;
  }
  const base = {
    settings,
    table,
    tallied: [] as number[],
    marks,
    bars,
    scale: settings.scale,
    orientation: settings.orientation,
    datasetId: null,
  };
  if (mode === 'pictograph') {
    return {
      ...base,
      mode,
      rows: rowsFromData(settings, settings.legendBig, settings.build === 'given'),
      legendBig: settings.legendBig,
      compressions: 0,
      expansions: 0,
    };
  }
  if (mode === 'class-vote') return { ...base, mode, votes: [] };
  if (mode === 'distortion' && settings.distortion !== null) {
    const distortion = settings.distortion;
    return {
      ...base,
      mode,
      yStart: distortion.yStart,
      yStep: distortion.yStep,
      wavy: distortion.wavy,
      groups: [],
      headline: [],
      exampleMarks: Object.fromEntries(distortion.examples.map((example) => [example.id, []])),
      exampleIndex: 0,
      history: { yStartChanged: false, yStepChanged: false, grouped: false },
    };
  }
  if (mode === 'band-circle' && settings.bandCircle !== null) {
    const band = settings.bandCircle;
    const percents: Record<string, number | null> = {};
    const bandCells: Record<string, number | null> = {};
    for (const cat of settings.categories) {
      percents[cat] =
        band.percentEntry === 'given'
          ? roundPercent(Rational.parse(band.truePercents[cat] ?? '0'))
          : null;
      bandCells[cat] = null;
    }
    return { ...base, mode, percents, bandCells, curl: initialCurl(band) };
  }
  if (mode === 'line-graph' && settings.line !== null) {
    const empty = Object.fromEntries(settings.line.xs.map((x) => [x, null]));
    return {
      ...base,
      mode,
      points: empty,
      segments: [],
      yFrom: settings.line.yFrom,
      phase: settings.line.predict ? 'predict' : 'actual',
      prediction: { ...empty },
    };
  }
  return { ...base, mode: mode === 'scale' ? 'scale' : 'table-to-graph' };
}

type LineAction = Extract<
  GraphAction,
  {
    readonly type:
      'set-point' | 'clear-point' | 'connect' | 'disconnect' | 'set-y-from' | 'finish-predict';
  }
>;

function withSegments(
  state: LineGraphState,
  points: Readonly<Record<string, string | null>>,
): LineGraphState {
  const line = state.settings.line;
  if (line === null) return state;
  const segments =
    line.connect === 'auto'
      ? autoSegments(line.xs, points)
      : state.segments.filter(
          ([a, b]) =>
            (points[line.xs[a] as string] ?? null) !== null &&
            (points[line.xs[b] as string] ?? null) !== null,
        );
  return { ...state, points, segments };
}

/** 학생이 점을 찍을 수 있는 때: 예측 단계는 늘, 실제 단계는 학생이 그리는 그래프만. */
function canEditPoints(state: LineGraphState): boolean {
  return state.phase === 'predict' || state.settings.graph === 'student';
}

function reduceLine(state: LineGraphState, action: LineAction): LineGraphState {
  const line = state.settings.line;
  if (line === null) return state;
  const key = state.phase === 'predict' ? 'prediction' : 'points';

  switch (action.type) {
    case 'set-point': {
      if (!canEditPoints(state) || !line.xs.includes(action.x)) return state;
      const raw = valueOf(action.y);
      if (raw === null) return state;
      const snapped = snapValue(line, state.yFrom, raw);
      if (snapped === null) return state;
      const text = snapped.toJSON();
      if (state[key][action.x] === text) return state;
      const next = { ...state[key], [action.x]: text };
      return key === 'prediction' ? { ...state, prediction: next } : withSegments(state, next);
    }

    case 'clear-point': {
      if (!canEditPoints(state) || !line.xs.includes(action.x)) return state;
      if ((state[key][action.x] ?? null) === null) return state;
      const next = { ...state[key], [action.x]: null };
      return key === 'prediction' ? { ...state, prediction: next } : withSegments(state, next);
    }

    case 'connect':
    case 'disconnect': {
      if (state.phase !== 'actual' || state.settings.graph !== 'student') return state;
      if (line.connect !== 'student') return state;
      const pair = normalizePair(action.a, action.b, line.xs.length);
      if (pair === null) return state;
      const exists = state.segments.some((s) => s[0] === pair[0] && s[1] === pair[1]);
      if (action.type === 'disconnect') {
        if (!exists) return state;
        return {
          ...state,
          segments: state.segments.filter((s) => !(s[0] === pair[0] && s[1] === pair[1])),
        };
      }
      const hasBoth =
        (state.points[line.xs[pair[0]] as string] ?? null) !== null &&
        (state.points[line.xs[pair[1]] as string] ?? null) !== null;
      if (!hasBoth || exists) return state;
      return { ...state, segments: [...state.segments, pair] };
    }

    case 'set-y-from': {
      const wanted = valueOf(action.value);
      if (wanted === null) return state;
      const option = line.yFromOptions.find((item) => valueOf(item)?.equals(wanted) === true);
      if (option === undefined || valueOf(state.yFrom)?.equals(wanted) === true) return state;
      const lower = (points: Readonly<Record<string, string | null>>) =>
        Object.fromEntries(
          Object.entries(points).map(([x, value]) => {
            const point = valueOf(value);
            return [x, point !== null && point.compareTo(wanted) < 0 ? null : value];
          }),
        );
      return withSegments(
        { ...state, yFrom: option, prediction: lower(state.prediction) },
        lower(state.points),
      );
    }

    case 'finish-predict': {
      if (state.phase !== 'predict') return state;
      if (!line.xs.some((x) => (state.prediction[x] ?? null) !== null)) return state;
      return { ...state, phase: 'actual' };
    }
  }
}

type BandAction = Extract<GraphAction, { readonly type: 'set-percent' | 'set-band' | 'set-curl' }>;

function reduceBand(state: BandCircleState, action: BandAction): BandCircleState {
  const band = state.settings.bandCircle;
  if (band === null) return state;
  switch (action.type) {
    case 'set-percent': {
      if (band.percentEntry !== 'student' || !state.settings.categories.includes(action.cat)) {
        return state;
      }
      let value: number | null;
      if (action.value === null) value = null;
      else if (Number.isFinite(action.value)) value = clampInt(Math.round(action.value), 0, 100);
      else return state;
      if (value === (state.percents[action.cat] ?? null)) return state;
      return { ...state, percents: { ...state.percents, [action.cat]: value } };
    }
    case 'set-band': {
      if (band.band !== 'student' || !state.settings.categories.includes(action.cat)) return state;
      if (!Number.isFinite(action.cells)) return state;
      const cells = clampInt(Math.round(action.cells), 0, 100);
      if (cells === (state.bandCells[action.cat] ?? null)) return state;
      return { ...state, bandCells: { ...state.bandCells, [action.cat]: cells } };
    }
    case 'set-curl': {
      if (!Number.isFinite(action.value)) return state;
      const curl = clampInt(Math.round(action.value), 0, 100);
      return curl === state.curl ? state : { ...state, curl };
    }
  }
}

type DistortionAction = Extract<
  GraphAction,
  {
    readonly type:
      | 'set-y-start'
      | 'set-y-step'
      | 'toggle-wavy'
      | 'toggle-group'
      | 'add-headline'
      | 'clear-headline'
      | 'toggle-example-mark'
      | 'show-example';
  }
>;

function reduceDistortion(state: DistortionState, action: DistortionAction): DistortionState {
  const distortion = state.settings.distortion;
  if (distortion === null) return state;
  switch (action.type) {
    case 'set-y-start': {
      if (!distortion.yStartOptions.includes(action.value) || action.value === state.yStart) {
        return state;
      }
      return {
        ...state,
        yStart: action.value,
        history: { ...state.history, yStartChanged: true },
      };
    }
    case 'set-y-step': {
      if (!distortion.yStepOptions.includes(action.value) || action.value === state.yStep) {
        return state;
      }
      return { ...state, yStep: action.value, history: { ...state.history, yStepChanged: true } };
    }
    case 'toggle-wavy':
      return { ...state, wavy: !state.wavy };
    case 'toggle-group': {
      if (state.groups.includes(action.label)) {
        return { ...state, groups: state.groups.filter((label) => label !== action.label) };
      }
      if (!canToggleGroupOn(distortion.groupOptions, state.groups, action.label)) return state;
      return {
        ...state,
        groups: [...state.groups, action.label],
        history: { ...state.history, grouped: true },
      };
    }
    case 'add-headline': {
      if (!distortion.headlineCards.includes(action.card)) return state;
      if (state.headline.length >= HEADLINE_MAX) return state;
      return { ...state, headline: [...state.headline, action.card] };
    }
    case 'clear-headline':
      return state.headline.length === 0 ? state : { ...state, headline: [] };
    case 'toggle-example-mark': {
      const item = CHECKLIST_ITEMS.find((candidate) => candidate === action.item);
      if (
        item === undefined ||
        !distortion.checklist.includes(item) ||
        !distortion.examples.some((example) => example.id === action.example)
      ) {
        return state;
      }
      const current = state.exampleMarks[action.example] ?? [];
      const next = current.includes(item)
        ? current.filter((candidate) => candidate !== item)
        : CHECKLIST_ITEMS.filter((candidate) => candidate === item || current.includes(candidate));
      return { ...state, exampleMarks: { ...state.exampleMarks, [action.example]: next } };
    }
    case 'show-example': {
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index > distortion.examples.length ||
        action.index === state.exampleIndex
      ) {
        return state;
      }
      return { ...state, exampleIndex: action.index };
    }
  }
}

type PictographAction = Extract<
  GraphAction,
  {
    readonly type:
      | 'add-small'
      | 'remove-small'
      | 'remove-big'
      | 'compress'
      | 'expand'
      | 'set-legend'
      | 'reset-rows';
  }
>;

function reducePictograph(state: PictographState, action: PictographAction): PictographState {
  const { settings } = state;
  const withRow = (cat: string, row: PictographRow): PictographState => ({
    ...state,
    rows: { ...state.rows, [cat]: row },
  });

  if (action.type === 'reset-rows') {
    if (settings.build !== 'student') return state;
    return { ...state, rows: rowsFromData(settings, state.legendBig, false) };
  }

  if (action.type === 'set-legend') {
    if (!settings.legendOptions.includes(action.big) || action.big === state.legendBig) {
      return state;
    }
    // 주어진 그림그래프는 늘 자료 값으로 다시 그린다. 학생이 만드는 쪽은 `legendChange`를 따른다.
    const recalculate = settings.build === 'given' || settings.legendChange === 'recalculate';
    let rows = state.rows;
    if (recalculate) {
      const next: Record<string, PictographRow> = {};
      for (const cat of settings.categories) {
        const value = settings.data
          ? (settings.data[cat] ?? 0)
          : rowValueOf(state.rows[cat] ?? { big: 0, small: 0 }, state.legendBig);
        next[cat] = splitValue(value, action.big);
      }
      rows = next;
    }
    return { ...state, rows, legendBig: action.big };
  }

  // 그림을 놓고 빼고 묶는 조작은 학생이 만드는 그림그래프에서만 한다.
  if (settings.build !== 'student' || !settings.categories.includes(action.cat)) return state;
  const row = state.rows[action.cat] ?? { big: 0, small: 0 };

  switch (action.type) {
    case 'add-small':
      if (rowValueOf(row, state.legendBig) + 1 > DATA_MAX) return state;
      return withRow(action.cat, { big: row.big, small: row.small + 1 });
    case 'remove-small':
      if (row.small < 1) return state;
      return withRow(action.cat, { big: row.big, small: row.small - 1 });
    case 'remove-big':
      if (row.big < 1) return state;
      return withRow(action.cat, { big: row.big - 1, small: row.small });
    case 'compress':
      if (row.small < state.legendBig) return state;
      return {
        ...withRow(action.cat, { big: row.big + 1, small: row.small - state.legendBig }),
        compressions: state.compressions + 1,
      };
    case 'expand':
      if (row.big < 1) return state;
      return {
        ...withRow(action.cat, { big: row.big - 1, small: row.small + state.legendBig }),
        expansions: state.expansions + 1,
      };
  }
}

type VoteAction = Extract<GraphAction, { readonly type: 'vote' | 'undo-vote' | 'reset-votes' }>;

function reduceVote(state: ClassVoteState, action: VoteAction): ClassVoteState {
  switch (action.type) {
    case 'vote': {
      if (!state.settings.categories.includes(action.option)) return state;
      if (voteCountOf(state.votes, action.option) >= voteLimit(state.settings)) return state;
      return { ...state, votes: [...state.votes, action.option] };
    }
    case 'undo-vote':
      return state.votes.length === 0 ? state : { ...state, votes: state.votes.slice(0, -1) };
    case 'reset-votes':
      return state.votes.length === 0 ? state : { ...state, votes: [] };
  }
}

export function reduce(state: GraphState, action: GraphAction): GraphState {
  const { settings } = state;
  const hasCategory = (cat: string) => settings.categories.includes(cat);

  switch (action.type) {
    case 'set-table': {
      if (settings.table !== 'student' || !hasCategory(action.cat)) return state;
      const value =
        action.value === null
          ? null
          : Number.isFinite(action.value)
            ? clampInt(Math.round(action.value), 0, DATA_MAX)
            : state.table[action.cat];
      if (value === undefined || value === state.table[action.cat]) return state;
      return { ...state, table: { ...state.table, [action.cat]: value } };
    }

    case 'toggle-tally': {
      const { index } = action;
      if (!Number.isInteger(index) || index < 0 || index >= settings.rawItems.length) return state;
      const tallied = state.tallied.includes(index)
        ? state.tallied.filter((item) => item !== index)
        : sortedUnique([...state.tallied, index]);
      return { ...state, tallied };
    }

    case 'toggle-mark': {
      if (settings.graph !== 'student' || settings.graphType !== 'o-mark') return state;
      if (!hasCategory(action.cat)) return state;
      const cells = axisCells(settings, state.scale);
      if (!Number.isInteger(action.cell) || action.cell < 0 || action.cell >= cells) return state;
      const current = state.marks[action.cat] ?? [];
      const next = current.includes(action.cell)
        ? current.filter((cell) => cell !== action.cell)
        : sortedUnique([...current, action.cell]);
      return { ...state, marks: { ...state.marks, [action.cat]: next } };
    }

    case 'set-bar': {
      if (settings.graph !== 'student' || settings.graphType !== 'bar') return state;
      if (state.mode === 'pictograph') return state;
      if (!hasCategory(action.cat) || !Number.isFinite(action.cells)) return state;
      const cells = clampInt(Math.round(action.cells), 0, axisCells(settings, state.scale));
      if (cells === (state.bars[action.cat] ?? 0)) return state;
      return { ...state, bars: { ...state.bars, [action.cat]: cells } };
    }

    case 'set-scale': {
      if (!settings.scaleOptions.includes(action.scale) || action.scale === state.scale) {
        return state;
      }
      // 학생 막대는 값(칸 × 이전 scale)을 유지하도록 칸 수를 다시 계산한다. 나누어떨어지지 않으면 내림.
      const limit = axisCells(settings, action.scale);
      const bars: Record<string, number> = {};
      for (const cat of settings.categories) {
        const value = (state.bars[cat] ?? 0) * state.scale;
        bars[cat] = Math.min(limit, Math.floor(value / action.scale));
      }
      const marks: Record<string, readonly number[]> = {};
      for (const cat of settings.categories) {
        marks[cat] = (state.marks[cat] ?? []).filter((cell) => cell < limit);
      }
      return { ...state, scale: action.scale, bars, marks };
    }

    case 'flip': {
      if (!settings.orientationFlip) return state;
      return {
        ...state,
        orientation: state.orientation === 'vertical' ? 'horizontal' : 'vertical',
      };
    }

    case 'add-small':
    case 'remove-small':
    case 'remove-big':
    case 'compress':
    case 'expand':
    case 'set-legend':
    case 'reset-rows':
      return state.mode === 'pictograph' ? reducePictograph(state, action) : state;

    case 'vote':
    case 'undo-vote':
    case 'reset-votes':
      return state.mode === 'class-vote' ? reduceVote(state, action) : state;

    case 'set-percent':
    case 'set-band':
    case 'set-curl':
      return state.mode === 'band-circle' ? reduceBand(state, action) : state;

    case 'set-y-start':
    case 'set-y-step':
    case 'toggle-wavy':
    case 'toggle-group':
    case 'add-headline':
    case 'clear-headline':
    case 'toggle-example-mark':
    case 'show-example':
      return state.mode === 'distortion' ? reduceDistortion(state, action) : state;

    case 'pick-dataset': {
      const option = settings.datasets.find((item) => item.id === action.id);
      if (!option || state.datasetId === option.id) return state;
      const next: GraphSettings = {
        ...settings,
        categories: option.categories,
        data: option.data,
        valueLabel: option.valueLabel,
        categoryAxisTitle: option.categoryAxisTitle,
        valueAxisTitle: option.valueAxisTitle,
        source: option.source,
      };
      const table: Record<string, number | null> = {};
      const marks: Record<string, readonly number[]> = {};
      const bars: Record<string, number> = {};
      for (const cat of next.categories) {
        table[cat] = next.table === 'student' ? null : (next.data?.[cat] ?? null);
        marks[cat] = [];
        bars[cat] = 0;
      }
      const base = { ...state, settings: next, datasetId: option.id, table, marks, bars };
      if (base.mode === 'pictograph') {
        return { ...base, rows: rowsFromData(next, base.legendBig, next.build === 'given') };
      }
      return base;
    }

    case 'set-point':
    case 'clear-point':
    case 'connect':
    case 'disconnect':
    case 'set-y-from':
    case 'finish-predict':
      return state.mode === 'line-graph' ? reduceLine(state, action) : state;

    case 'reset-graph': {
      if (state.mode === 'distortion') {
        const distortion = state.settings.distortion;
        if (distortion === null) return state;
        return {
          ...state,
          yStart: distortion.yStart,
          yStep: distortion.yStep,
          wavy: distortion.wavy,
          groups: [],
        };
      }
      if (state.mode === 'band-circle') {
        const band = state.settings.bandCircle;
        if (band === null) return state;
        const cleared = Object.fromEntries(state.settings.categories.map((cat) => [cat, null]));
        return { ...state, bandCells: cleared, curl: initialCurl(band) };
      }
      if (state.mode === 'line-graph') {
        const line = state.settings.line;
        if (line === null) return state;
        const empty = Object.fromEntries(line.xs.map((x) => [x, null]));
        return state.phase === 'predict'
          ? { ...state, prediction: empty }
          : { ...state, points: empty, segments: [] };
      }
      const marks: Record<string, readonly number[]> = {};
      const bars: Record<string, number> = {};
      for (const cat of settings.categories) {
        marks[cat] = [];
        bars[cat] = 0;
      }
      return { ...state, marks, bars };
    }
  }
}
