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
import type { ChartSettings, Look, PatternConfig, SequenceSettings } from './types';

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
