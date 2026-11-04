/**
 * E01의 수 계산을 한 곳에 모은 파일.
 *
 * 카드 T043 결정 2: 블록 모양 값(`BlockValue` 1·10·100·1000)은 그대로 두고
 * `interpretation`에 따라 해석만 바꾼다.
 * - whole: 1000=1000, 100=100, 10=10, 1=1
 * - decimal: 100=1, 10=0.1, 1=0.01 (1000은 쓰지 않는다)
 *
 * 소수 계산은 모두 `Rational`로 한다. 0.1·0.01을 number로 더하거나 곱하지 않는다.
 */
import { Rational } from '../../core/math';
import type { BaseTenSettings, BaseTenState, BlockValue, ChartName, Zone } from './types';
import { CHART_NAME_COLUMN } from './types';

export interface PlaceCounts {
  readonly thousands: number;
  readonly hundreds: number;
  readonly tens: number;
  readonly ones: number;
}

export const ZERO_COUNTS: PlaceCounts = { thousands: 0, hundreds: 0, tens: 0, ones: 0 };

/** 블록 모양이 놓이는 화면 띠(0=낱개 … 3=천). 해석과 무관하다. */
export function columnOf(value: BlockValue): number {
  switch (value) {
    case 1:
      return 0;
    case 10:
      return 1;
    case 100:
      return 2;
    case 1000:
      return 3;
  }
}

export function placeValueOf(column: number): BlockValue | null {
  switch (column) {
    case 0:
      return 1;
    case 1:
      return 10;
    case 2:
      return 100;
    case 3:
      return 1000;
    default:
      return null;
  }
}

/** 자릿값 지수 → 열 이름. 소수 자리는 음수다. */
export function columnNameOf(column: number): ChartName | null {
  switch (column) {
    case 0:
      return 'ones';
    case 1:
      return 'tens';
    case 2:
      return 'hundreds';
    case 3:
      return 'thousands';
    case -1:
      return 'tenths';
    case -2:
      return 'hundredths';
    default:
      return null;
  }
}

/** 블록 모양 띠 → 자릿값 지수. decimal에서 100→0, 10→−1, 1→−2. */
export function exponentOfShapeColumn(column: number, interpretation: 'whole' | 'decimal'): number {
  if (interpretation === 'whole') return column;
  switch (column) {
    case 2:
      return 0;
    case 1:
      return -1;
    case 0:
      return -2;
    default:
      return column;
  }
}

/** 자릿값 지수 → 블록 모양 띠. decimal에서 0→2, −1→1, −2→0. */
export function shapeColumnOfExponent(index: number, interpretation: 'whole' | 'decimal'): number {
  if (interpretation === 'whole') return index;
  switch (index) {
    case 0:
      return 2;
    case -1:
      return 1;
    case -2:
      return 0;
    default:
      return index;
  }
}

/** 블록 하나가 나타내는 수(모양 값). */
export function placeExponentOf(value: BlockValue, interpretation: 'whole' | 'decimal'): number {
  return exponentOfShapeColumn(columnOf(value), interpretation);
}

/** 모양 값 → 그 모양이 나타내는 수. */
export function rationalOfShape(value: BlockValue, interpretation: 'whole' | 'decimal'): Rational {
  if (interpretation === 'whole') return Rational.of(value);
  switch (value) {
    case 100:
      return Rational.of(1);
    case 10:
      return Rational.of(1, 10);
    case 1:
      return Rational.of(1, 100);
    case 1000:
      return Rational.of(10);
  }
}

/** 블록 모양 한 칸의 값. whole은 1, decimal은 1/100. */
export function scaleOf(settings: Pick<BaseTenSettings, 'interpretation'>): Rational {
  return settings.interpretation === 'decimal' ? Rational.of(1, 100) : Rational.of(1);
}

/** `maxValue`가 나타낼 수 있는 자리 수. 최소 2(십·일), 최대 4(천·백·십·일). */
export function placeCountOf(maxValue: number): number {
  const safe = Math.max(0, Math.trunc(maxValue));
  if (safe >= 1000) return 4;
  if (safe >= 100) return 3;
  return 2;
}

/** 높은 자리부터의 자릿값 지수 목록. 예: 3 → [2, 1, 0]. */
export function columnsOf(placeCount: number): number[] {
  const count = Math.max(2, Math.min(4, Math.trunc(placeCount)));
  return Array.from({ length: count }, (_, index) => count - 1 - index);
}

export function countsToValue(counts: PlaceCounts): number {
  return counts.thousands * 1000 + counts.hundreds * 100 + counts.tens * 10 + counts.ones;
}

/** 설정이 소수 해석인가. */
export function isDecimal(settings: Pick<BaseTenSettings, 'interpretation'>): boolean {
  return settings.interpretation === 'decimal';
}

/**
 * `"52"`·`"6.24"` 같은 수를 정규형 블록 개수로 바꾼다.
 * 잘못된 문자열·음수·너무 큰 수·소수 셋째 자리 이상이면 null(빈 판).
 * decimal은 판·막대·낱개가 각각 0~9개인 정규형만 받는다.
 */
export function countsFromValue(
  text: string,
  interpretation: 'whole' | 'decimal',
): PlaceCounts | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.startsWith('-')) return null;

  if (interpretation === 'whole') {
    const match = /^(\d{1,4})$/.exec(trimmed);
    if (match === null) return null;
    const digits = (match[1] as string).padStart(4, '0');
    return {
      thousands: Number(digits[0]),
      hundreds: Number(digits[1]),
      tens: Number(digits[2]),
      ones: Number(digits[3]),
    };
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (match === null) return null;
  const wholePart = (match[1] as string).replace(/^0+(?=\d)/, '');
  if (wholePart.length > 1) return null;
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return {
    thousands: 0,
    hundreds: Number(wholePart),
    tens: Number(fraction[0]),
    ones: Number(fraction[1]),
  };
}

/** 정규형 블록 개수를 해석에 맞는 수 문자열로. */
export function valueStringOf(counts: PlaceCounts, interpretation: 'whole' | 'decimal'): string {
  const total = Rational.of(countsToValue(counts)).mul(
    interpretation === 'decimal' ? Rational.of(1, 100) : Rational.of(1),
  );
  return interpretation === 'decimal' ? total.toDecimalString() : Number(total.n).toString();
}

export function isCanonicalCounts(counts: PlaceCounts): boolean {
  return [counts.thousands, counts.hundreds, counts.tens, counts.ones].every(
    (count) => count >= 0 && count <= 9,
  );
}

/** decimal 정규형: 100(판) 0~9, 10(막대) 0~9, 1(낱개) 0~9, 1000 없음. */
export function isCanonicalDecimalCounts(counts: PlaceCounts): boolean {
  return (
    counts.thousands === 0 &&
    counts.hundreds >= 0 &&
    counts.hundreds <= 9 &&
    counts.tens >= 0 &&
    counts.tens <= 9 &&
    counts.ones >= 0 &&
    counts.ones <= 9
  );
}

/** 그 자리의 숫자(0~9). 범위를 벗어나면 0. */
export function digitAt(number: number, column: number): number {
  const place = placeValueOf(column);
  if (place === null) return 0;
  const safe = Math.max(0, Math.trunc(number));
  return Math.floor(safe / place) % 10;
}

/** add-sub에서 값으로 세는 블록만 고른다. */
export function countedBlocks(state: BaseTenState): BaseTenState['blocks'] {
  if (state.mode !== 'add-sub') return state.blocks;
  if (state.settings.op === 'add') {
    return state.blocks.filter((block) => block.zone === 'sum');
  }
  return state.blocks.filter((block) => block.zone === 'a');
}

export function countsOfBlocks(blocks: BaseTenState['blocks'], zone?: Zone): PlaceCounts {
  let thousands = 0;
  let hundreds = 0;
  let tens = 0;
  let ones = 0;
  for (const block of blocks) {
    if (zone !== undefined && block.zone !== zone) continue;
    switch (block.value) {
      case 1000:
        thousands += 1;
        break;
      case 100:
        hundreds += 1;
        break;
      case 10:
        tens += 1;
        break;
      case 1:
        ones += 1;
        break;
    }
  }
  return { thousands, hundreds, tens, ones };
}

export function countsOf(state: BaseTenState): PlaceCounts {
  if (state.mode !== 'add-sub') return countsOfBlocks(state.blocks);
  if (state.settings.op === 'add') return countsOfBlocks(state.blocks, 'sum');

  // sub: 처음 수 무더기에서 빼기 접시로 옮긴 블록은 이미 무더기에서 빠졌다.
  // 그러므로 남은 값은 `a` 구역만 세면 되고, 접시 값은 `takenValueOf`로 따로 읽는다.
  return countsOfBlocks(state.blocks, 'a');
}

/** 모양 값의 합(whole에서 지금 나타내는 수). decimal에서는 자릿값 단위 수다. */
export function valueOf(state: BaseTenState): number {
  return countsToValue(countsOf(state));
}

/** 지금 나타내는 수를 정확한 유리수로. decimal에서도 부동소수 없이 계산한다. */
export function rationalValueOf(state: BaseTenState): Rational {
  return Rational.of(valueOf(state)).mul(scaleOf(state.settings));
}

/** decimal이면 소수 문자열, whole이면 정수 number로 Observation·이벤트에 쓴다. */
export function jsonValueOf(state: BaseTenState): number | string {
  const value = rationalValueOf(state);
  return state.settings.interpretation === 'decimal' ? value.toDecimalString() : Number(value.n);
}

/** 자릿값과 상관없이 캔버스에 있는 모든 블록의 모양 값 합(최대값 검사용). */
export function totalBlockValue(state: BaseTenState): number {
  return state.blocks.reduce((sum, block) => sum + block.value, 0);
}

export function takenValueOf(state: BaseTenState): number | null {
  if (state.mode !== 'add-sub' || state.settings.op !== 'sub') return null;
  return countsToValue(countsOfBlocks(state.blocks, 'take'));
}

/** sub에서 그 자리에 놓을 수 있는 최대 개수(b의 그 자리 숫자). */
export function takeLimitOf(state: BaseTenState, value: BlockValue): number {
  return digitAt(state.settings.b, columnOf(value));
}

/** `no-negative-take`에서 이 블록을 빼기 접시에 더 놓을 수 있는가. */
export function canTake(state: BaseTenState, value: BlockValue, movingId?: string): boolean {
  if (state.settings.constraint !== 'no-negative-take') return true;
  const inTake = state.blocks.filter(
    (block) => block.zone === 'take' && block.value === value && block.id !== movingId,
  ).length;
  return inTake + 1 <= takeLimitOf(state, value);
}

/** 그 자릿값 지수에 놓인 블록 수. decimal은 음수 지수를 받는다. */
export function countsForColumn(state: BaseTenState, column: number): number {
  const counts = countsOf(state);
  if (state.settings.interpretation === 'decimal') {
    switch (column) {
      case 0:
        return counts.hundreds;
      case -1:
        return counts.tens;
      case -2:
        return counts.ones;
      default:
        return 0;
    }
  }
  switch (column) {
    case 3:
      return counts.thousands;
    case 2:
      return counts.hundreds;
    case 1:
      return counts.tens;
    case 0:
      return counts.ones;
    default:
      return 0;
  }
}

function placeRationalOf(column: number): Rational {
  return column >= 0 ? Rational.of(10 ** column) : Rational.of(1, 10 ** -column);
}

/**
 * 표가 가리키는 수.
 * - student: 모든 칸이 한 자리 숫자일 때만.
 * - auto: 블록 개수를 그대로 읽으므로 10 이상·음수인 칸이 있으면 null(정규형 아님).
 * decimal이면 소수 문자열을 돌려준다.
 */
export function chartValueOf(state: BaseTenState): number | string | null {
  const columns = state.settings.chartColumns;
  if (state.chart === null || columns.length === 0) return null;
  const decimal = state.settings.interpretation === 'decimal';

  let total = Rational.of(0);
  if (state.settings.chartFill === 'auto') {
    for (const column of columns) {
      const count = countsForColumn(state, column);
      if (count < 0 || count > 9) return null;
      total = total.add(Rational.of(count).mul(placeRationalOf(column)));
    }
  } else {
    if (state.chart.length === 0) return null;
    for (let index = 0; index < state.chart.length; index += 1) {
      const cell = state.chart[index];
      const column = columns[index];
      if (cell === null || cell === undefined || !/^[0-9]$/.test(cell) || column === undefined) {
        return null;
      }
      total = total.add(Rational.of(Number(cell)).mul(placeRationalOf(column)));
    }
  }
  return decimal ? total.toDecimalString() : Number(total.n);
}

/** 위치가 그 자리의 칸 안에 있는지 판정할 때 쓰는 지수. */
export function chartColumnOfName(name: ChartName): number {
  return CHART_NAME_COLUMN[name];
}
