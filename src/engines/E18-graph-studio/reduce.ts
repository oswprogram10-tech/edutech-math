/**
 * E18 그래프 스튜디오의 순수 reducer.
 *
 * - 설정은 `normalizeSettings`로 정리해 상태에 복사한다(reduce가 config를 받지 않는다).
 * - 정수가 아니거나 0~100 밖인 자료 값은 그 범주를 0으로 본다.
 * - 정답 높이를 저장하지 않는다. 학생이 그린 칸 수(`bars`·`marks`)와 표 값만 둔다.
 */
import { DATA_MAX, DEFAULT_SCALE_OPTIONS } from './types';
import type {
  GraphAction,
  GraphConfig,
  GraphMode,
  GraphSettings,
  GraphSource,
  GraphState,
  GraphType,
  Orientation,
  TableSource,
  TooltipSetting,
} from './types';

/** 같은 상한을 쓰는 눈금 칸 수(안전 장치). */
const MAX_AXIS_CELLS = 200;

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

export function inferMode(config: GraphConfig | undefined): GraphMode {
  return recordOf(config)['mode'] === 'scale' ? 'scale' : 'table-to-graph';
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const item of values) {
    if (typeof item === 'string' && !result.includes(item)) result.push(item);
  }
  return result;
}

export function normalizeSettings(config: GraphConfig | undefined, mode: GraphMode): GraphSettings {
  const record = recordOf(config);

  const rawData = record['data'];
  const dataRecord =
    rawData !== null && typeof rawData === 'object' && !Array.isArray(rawData)
      ? (rawData as Readonly<Record<string, unknown>>)
      : null;
  const rawItems = Array.isArray(record['rawItems'])
    ? (record['rawItems'] as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];

  let categories: string[];
  let data: Record<string, number> | null = null;
  if (dataRecord) {
    categories = Object.keys(dataRecord);
    data = Object.fromEntries(categories.map((cat) => [cat, toCount(dataRecord[cat])]));
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

  const graphType: GraphType = record['graphType'] === 'o-mark' ? 'o-mark' : 'bar';
  const orientation: Orientation =
    record['orientation'] === 'horizontal' ? 'horizontal' : 'vertical';
  const scale = toPositiveInt(record['scale']) ?? 1;

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
  const views = Array.isArray(viewsRaw) ? viewsRaw : ['table', 'graph'];

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
    scaleOptions,
    axisMax: toPositiveInt(record['axisMax']),
    valueLabel: stringOf(record['valueLabel']),
    categoryAxisTitle: stringOf(record['categoryAxisTitle']),
    valueAxisTitle: stringOf(record['valueAxisTitle']),
    title: stringOf(record['title']),
    tooltips,
    showTable: table !== 'hidden' && views.includes('table'),
    showGraph: graph !== 'none' && views.includes('graph'),
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
  return {
    mode,
    settings,
    table,
    tallied: [],
    marks,
    bars,
    scale: settings.scale,
    orientation: settings.orientation,
  };
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

    case 'reset-graph': {
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
