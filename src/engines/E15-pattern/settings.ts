/**
 * E15 설정 정규화. 모르는 키는 받기만 하고 무시한다(스키마 실패 없음).
 * 잘못된 값은 throw하지 않고 기본값으로 돌린다.
 */
import {
  DEFAULT_RANGE,
  defaultCenter,
  inRange,
  lastOf,
  normalizeRange,
  randomHidden,
  rowsOf,
} from './chart';
import type { ChartRange, ChartView } from './chart';
import { REPUNIT, SYMMETRIC } from './calc';
import type {
  CalcLook,
  CalcPatternName,
  CalcSettings,
  ChartSettings,
  GearsSettings,
  GrowthLook,
  GrowthSettings,
  GrowthShape,
  Look,
  PatternConfig,
  SequenceSettings,
} from './types';

export function recordOf(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item !== '');
}

function unique(list: readonly string[]): string[] {
  return [...new Set(list)];
}

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export const DEFAULT_ITEMS: readonly string[] = ['circle', 'triangle', 'square'];
export const DEFAULT_SOURCE: readonly string[] = ['apple', 'banana', 'banana'];
export const DEFAULT_ALPHABET: readonly string[] = ['1', '2', '3'];

function devWarn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[E15] ${message}`);
}

export function sequenceSettings(config: PatternConfig | undefined): SequenceSettings {
  const record = recordOf(config);
  const variant = record['variant'] === 'translate' ? 'translate' : 'extend';
  const mapping = recordOf(record['mapping']);
  const look: Look =
    record['look'] === 'plain' || record['look'] === 'symbol' ? record['look'] : 'color';
  const symbols: Record<string, string> = {};
  for (const [key, value] of Object.entries(recordOf(record['symbols']))) {
    if (typeof value === 'string' && value !== '') symbols[key] = value;
  }
  const notes: Record<string, number> = {};
  for (const [key, value] of Object.entries(recordOf(record['notes']))) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 14) {
      notes[key] = value;
    }
  }
  const itemsRaw = unique(stringList(record['items']));
  const items = itemsRaw.length > 0 ? itemsRaw : [...DEFAULT_ITEMS];
  const base = {
    givenDisplay:
      record['givenDisplay'] === 'sound-only' ? ('sound-only' as const) : ('show' as const),
    look,
    symbols,
    sound: mapping['sound'] === 'none' ? ('none' as const) : ('pentatonic' as const),
    motion: mapping['motion'] === true,
    notes,
    items,
  };

  if (variant === 'translate') {
    const sourceRaw = stringList(record['source']);
    const source = sourceRaw.length > 0 ? sourceRaw : [...DEFAULT_SOURCE];
    const repeat = intIn(record['repeat'], 1, 6, 2);
    const given: string[] = [];
    for (let i = 0; i < repeat; i += 1) given.push(...source);
    const alphabetRaw = unique(stringList(record['targetAlphabet']));
    return {
      ...base,
      variant,
      palette: alphabetRaw.length > 0 ? alphabetRaw : [...DEFAULT_ALPHABET],
      given,
      blanks: given.length,
      source,
      repeat,
    };
  }

  const given = stringList(record['given']);
  if (given.some((token) => !items.includes(token))) {
    devWarn('given에 items에 없는 토큰이 있습니다. 그대로 그립니다.');
  }
  return {
    ...base,
    variant,
    palette: items,
    given,
    blanks: intIn(record['blanks'], 1, 16, 3),
    source: [],
    repeat: 1,
  };
}

const CHART_VIEWS: readonly ChartView[] = ['full', 'cross-only', 'row', 'column'];

function intList(value: unknown, range: ChartRange): number[] {
  if (!Array.isArray(value)) return [];
  const result = value.filter(
    (item): item is number => typeof item === 'number' && inRange(range, item),
  );
  return [...new Set(result)].sort((a, b) => a - b);
}

function withinOf(value: unknown): ChartRange | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [from, to] = value as unknown[];
  if (
    typeof from !== 'number' ||
    typeof to !== 'number' ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    to < from
  ) {
    return null;
  }
  return { from, count: to - from + 1 };
}

export interface ResolvedChart {
  readonly settings: ChartSettings;
  readonly hidden: number[];
}

export function chartSettings(config: PatternConfig | undefined): ResolvedChart {
  const record = recordOf(config);
  const range = normalizeRange(record['range'] ?? [DEFAULT_RANGE.from, lastOf(DEFAULT_RANGE)]);
  const view: ChartView = CHART_VIEWS.includes(record['view'] as ChartView)
    ? (record['view'] as ChartView)
    : 'full';
  const center = defaultCenter(range, record['center']);
  const focusRaw = record['focus'];
  const focus = typeof focusRaw === 'number' && inRange(range, focusRaw) ? focusRaw : center;
  const hiddenRaw = record['hidden'];
  let seed = 0;
  let hidden: number[] = [];
  const randomSpec = recordOf(hiddenRaw);
  if (hiddenRaw === 'cross') {
    hidden = [center];
  } else if (Array.isArray(hiddenRaw)) {
    hidden = intList(hiddenRaw, range);
  } else if (typeof randomSpec['random'] === 'number') {
    const seedRaw = randomSpec['seed'];
    // seed가 없으면 한 번 정해 상태에 저장한다(되감기·미러링에서 같은 칸).
    seed =
      typeof seedRaw === 'number' && Number.isFinite(seedRaw)
        ? Math.trunc(seedRaw)
        : Math.floor(Math.random() * 0x7fffffff);
    const count = intIn(randomSpec['random'], 0, rowsOf(range) * 10, 0);
    hidden = randomHidden(range, count, seed, withinOf(randomSpec['within']));
  }
  const prepainted = intList(record['prepainted'], range).filter((cell) => !hidden.includes(cell));
  return {
    hidden,
    settings: {
      from: range.from,
      count: range.count,
      view,
      focus,
      center,
      select: record['select'] === true,
      paint: record['paint'] === true,
      prepainted,
      seed,
    },
  };
}

const CALC_LOOKS: readonly CalcLook[] = ['blocks', 'picture', 'none'];

/** 설정 정수. 값이 없으면 기본값, 있는데 정수가 아니거나 범위 밖이면 `null`. */
function strictInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return null;
  }
  return value;
}

/**
 * calc-pattern 설정 정규화. 모르는 pattern이거나 단계 수가 범위 밖이면 `error`를 켠다
 * (throw하지 않는다. 화면은 설정 오류 판을 그린다). `pattern`이 없으면 symmetric이다.
 */
export function calcSettings(config: PatternConfig | undefined): CalcSettings {
  const record = recordOf(config);
  let error: string | null = null;
  const patternRaw = record['pattern'];
  let pattern: CalcPatternName = SYMMETRIC;
  if (patternRaw === REPUNIT || patternRaw === SYMMETRIC) {
    pattern = patternRaw as CalcPatternName;
  } else if (patternRaw !== undefined) {
    error = 'pattern';
  }

  let stepsShown = 3;
  if (record['stepsShown'] !== undefined) {
    const value = strictInt(record['stepsShown'], 1, 8);
    if (value === null) error = error ?? 'stepsShown';
    else stepsShown = value;
  }
  let workStep = stepsShown + 1;
  if (record['workStep'] !== undefined) {
    const value = strictInt(record['workStep'], 1, 9);
    if (value === null) error = error ?? 'workStep';
    else workStep = value;
  }
  if (error !== null) devWarn(`calc-pattern 설정을 읽을 수 없습니다(${error}).`);

  const look: CalcLook = CALC_LOOKS.includes(record['look'] as CalcLook)
    ? (record['look'] as CalcLook)
    : 'blocks';
  const symmetric = pattern === SYMMETRIC;
  return {
    pattern,
    stepsShown,
    workStep,
    // 쌓기는 symmetric에서 look이 blocks이고 build가 꺼지지 않았을 때만 있다.
    build: symmetric && look === 'blocks' && record['build'] !== false,
    expression: record['expression'] !== false,
    linkHighlight: symmetric && look !== 'none' && record['linkHighlight'] !== false,
    look,
    error,
  };
}

const GROWTH_SHAPES: readonly GrowthShape[] = ['L', 'stairs', 'tower2'];
const GROWTH_LOOKS: readonly GrowthLook[] = ['cubes', 'flat', 'none'];

/**
 * growth 설정 정규화. 잘못된 값은 throw하지 않고 기본값으로 돌리고, 범위 밖 정수는 범위로 맞춘다.
 * 표 마지막 단계(upTo)는 stepsShown~8이다.
 */
export function growthSettings(config: PatternConfig | undefined): GrowthSettings {
  const record = recordOf(config);
  const shape = GROWTH_SHAPES.includes(record['shape'] as GrowthShape)
    ? (record['shape'] as GrowthShape)
    : 'L';
  const stepsShown = intIn(record['stepsShown'], 1, 5, 3);
  const look = GROWTH_LOOKS.includes(record['look'] as GrowthLook)
    ? (record['look'] as GrowthLook)
    : 'cubes';
  let table: GrowthSettings['table'] = null;
  if (record['table'] !== false) {
    const t = recordOf(record['table']);
    table = {
      upTo: intIn(t['upTo'], stepsShown, 8, Math.min(8, stepsShown + 2)),
      counts: t['counts'] === 'blank' ? 'blank' : 'given',
      increments: t['increments'] === 'off' ? 'off' : 'blank',
    };
  }
  return {
    shape,
    stepsShown,
    highlightIncrement: record['highlightIncrement'] !== false,
    table,
    look,
  };
}

export const GEARS_TEETH_MIN = 3;
export const GEARS_TEETH_MAX = 12;
export const GEARS_STEPS_MIN = 12;
export const GEARS_STEPS_MAX = 120;

/** gears 설정 정규화. 잘못된 값은 throw하지 않고 기본값으로 돌리고, 범위 밖 정수는 범위로 맞춘다. */
export function gearsSettings(config: PatternConfig | undefined): GearsSettings {
  const record = recordOf(config);
  return {
    teethA: intIn(record['teethA'], GEARS_TEETH_MIN, GEARS_TEETH_MAX, 4),
    teethB: intIn(record['teethB'], GEARS_TEETH_MIN, GEARS_TEETH_MAX, 6),
    maxSteps: intIn(record['maxSteps'], GEARS_STEPS_MIN, GEARS_STEPS_MAX, 60),
    predict: record['predict'] === true,
    showLaps: record['showLaps'] !== false,
  };
}
