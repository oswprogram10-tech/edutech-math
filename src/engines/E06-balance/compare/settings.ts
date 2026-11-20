/** compare 설정 검사·정리. 어긋나면 throw하지 않고 `error`를 켠다(화면이 오류 문구를 보인다). */
import { balanceStrings } from '../strings.ko';
import { COMPARE_KINDS, MAX_ITEMS, MAX_PER_PAN, MAX_WEIGHT, MIN_ITEMS } from './types';
import type { CompareConfig, CompareItem, CompareKind, CompareState, VisualSize } from './types';

/** kind별 기본 크기. 큰 스펀지·작은 쇠공처럼 다르게 하려면 콘텐츠가 `visualSize`를 준다. */
export const DEFAULT_SIZE: Readonly<Record<CompareKind, VisualSize>> = {
  apple: 'medium',
  feather: 'medium',
  balloon: 'large',
  stone: 'medium',
  sponge: 'medium',
  'iron-ball': 'small',
  book: 'medium',
  eraser: 'small',
};

const SIZES: readonly VisualSize[] = ['small', 'medium', 'large'];
const ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

/** 샌드박스 기본: 큰 스펀지(2)·작은 쇠공(9)·사과(3). */
export function sandboxDefault(): CompareConfig {
  return {
    mode: 'compare',
    items: [
      { id: 'sponge', kind: 'sponge', weight: 2, visualSize: 'large' },
      { id: 'iron-ball', kind: 'iron-ball', weight: 9, visualSize: 'small' },
      { id: 'apple', kind: 'apple', weight: 3 },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure(): CompareState {
  return {
    mode: 'compare',
    error: balanceStrings.configError,
    items: [],
    showValues: false,
    maxPerPan: 1,
    left: [],
    right: [],
    seen: [],
    pairs: [],
  };
}

function parseItem(raw: unknown): CompareItem | null {
  if (!isRecord(raw)) return null;
  const { id, kind, weight, visualSize } = raw;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  if (typeof kind !== 'string' || !(COMPARE_KINDS as readonly string[]).includes(kind)) {
    return null;
  }
  if (!Number.isInteger(weight) || (weight as number) < 1 || (weight as number) > MAX_WEIGHT) {
    return null;
  }
  if (visualSize !== undefined && !SIZES.includes(visualSize as VisualSize)) return null;
  const compareKind = kind as CompareKind;
  return {
    id,
    kind: compareKind,
    weight: weight as number,
    size: (visualSize as VisualSize | undefined) ?? DEFAULT_SIZE[compareKind],
  };
}

export function normalizeCompare(config: CompareConfig | undefined): CompareState {
  const source: Partial<CompareConfig> = config ?? {};
  const rawItems: unknown = source.items === undefined ? sandboxDefault().items : source.items;
  if (!Array.isArray(rawItems)) return failure();
  if (rawItems.length < MIN_ITEMS || rawItems.length > MAX_ITEMS) return failure();
  const items: CompareItem[] = [];
  for (const raw of rawItems as unknown[]) {
    const item = parseItem(raw);
    if (item === null || items.some((other) => other.id === item.id)) return failure();
    items.push(item);
  }
  const { showValues, maxPerPan } = source as { showValues?: unknown; maxPerPan?: unknown };
  if (showValues !== undefined && typeof showValues !== 'boolean') return failure();
  if (
    maxPerPan !== undefined &&
    (!Number.isInteger(maxPerPan) ||
      (maxPerPan as number) < 1 ||
      (maxPerPan as number) > MAX_PER_PAN)
  ) {
    return failure();
  }
  return {
    mode: 'compare',
    error: null,
    items,
    showValues: showValues === true,
    maxPerPan: (maxPerPan as number | undefined) ?? 1,
    left: [],
    right: [],
    seen: [],
    pairs: [],
  };
}
