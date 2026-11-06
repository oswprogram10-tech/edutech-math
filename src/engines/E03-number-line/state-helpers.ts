/**
 * E03 새 모드(T048)가 함께 쓰는 초기 상태·설정 읽기 도우미.
 *
 * 설정 값은 `number | string`을 받아 `String(value)`로 만든 뒤 `Rational.parse`한다.
 * `"1e4"` 같은 지수 표기는 parse가 실패하므로 기본값으로 떨어진다(카드 2번).
 * 상태에는 언제나 `Rational.toJSON()` 문자열만 넣는다.
 */
import { Rational } from '../../core/math/rational';
import { parseValue } from './ticks';
import { EMPTY_COUNTS } from './types';
import type { NumberLineConfig, NumberLineMode, NumberLineState } from './types';

export const ZERO = Rational.of(0);
export const ONE = Rational.of(1);

/** 모드별 기본 최댓값. 기존 3개 모드의 값은 T011 그대로다. */
export const DEFAULT_MAX: Record<NumberLineMode, string> = {
  integer: '9',
  fraction: '1',
  decimal: '1',
  'skip-count': '30',
  rounding: '100',
  'log-zoom': '10',
  double: '1',
};

export function modeOf(config: NumberLineConfig): NumberLineMode {
  switch (config.mode) {
    case 'fraction':
    case 'decimal':
    case 'skip-count':
    case 'rounding':
    case 'log-zoom':
    case 'double':
      return config.mode;
    default:
      return 'integer';
  }
}

/** 설정의 `number | string`을 Rational로. 지수 표기·잘못된 값은 null. */
export function configRational(value: number | string | undefined): Rational | null {
  if (value === undefined) return null;
  return parseValue(String(value));
}

export function configRationals(values: readonly (number | string)[] | undefined): Rational[] {
  const result: Rational[] = [];
  for (const value of values ?? []) {
    const parsed = configRational(value);
    if (parsed) result.push(parsed);
  }
  return result;
}

/** 양의 정수 배수(2, 3, 4 …)만 받는다. `number`는 세는 값이라 정수다. */
export function integerFactor(value: number | string | undefined): number | null {
  const parsed = configRational(value);
  if (!parsed || !parsed.isInteger() || parsed.isNegative() || parsed.isZero()) return null;
  if (parsed.n > 1000n) return null;
  return Number(parsed.n);
}

export function clampRational(value: Rational, min: Rational, max: Rational): Rational {
  if (value.compareTo(min) < 0) return min;
  if (value.compareTo(max) > 0) return max;
  return value;
}

export function normalizeCards(value: readonly (number | string)[] | undefined): string[] {
  const cards: string[] = [];
  for (const raw of value ?? []) {
    const text = String(raw).trim();
    if (text.length === 0 || parseValue(text) === null) continue;
    if (!cards.includes(text)) cards.push(text);
  }
  return cards;
}

export interface BaseStateInput {
  readonly mode: NumberLineMode;
  readonly min: Rational;
  readonly max: Rational;
  readonly unit: Rational;
  readonly subdivisions?: readonly number[];
  readonly viewMin?: Rational;
  readonly viewMax?: Rational;
  readonly cards?: readonly string[];
  readonly skip?: NumberLineState['skip'];
  readonly rounding?: NumberLineState['rounding'];
  readonly logZoom?: NumberLineState['logZoom'];
  readonly double?: NumberLineState['double'];
}

/** 새 모드의 공통 상태. 기존 3개 모드의 createInitialState는 손대지 않았다. */
export function makeBaseState(input: BaseStateInput): NumberLineState {
  const viewMin = input.viewMin ?? input.min;
  const viewMax = input.viewMax ?? input.max;
  const cards = input.cards ?? [];
  const cardValues: Record<string, string | null> = {};
  for (const card of cards) cardValues[card] = null;
  return {
    mode: input.mode,
    min: input.min.toJSON(),
    max: input.max.toJSON(),
    unit: input.unit.toJSON(),
    subdivisions: [...(input.subdivisions ?? [1])],
    zoomLevel: 0,
    zoomMin: 0,
    zoomMax: 0,
    viewMin: viewMin.toJSON(),
    viewMax: viewMax.toJSON(),
    points: [],
    jumps: [],
    selectedPointId: null,
    selectedCard: null,
    cursor: input.min.toJSON(),
    cardCursor: null,
    cards,
    cardValues,
    linkedValue: null,
    lastValue: null,
    nextPointId: 1,
    counts: EMPTY_COUNTS,
    skip: input.skip ?? null,
    rounding: input.rounding ?? null,
    logZoom: input.logZoom ?? null,
    double: input.double ?? null,
    frog: null,
  };
}
