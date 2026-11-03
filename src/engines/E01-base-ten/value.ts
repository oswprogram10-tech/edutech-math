/**
 * E01의 수 계산을 한 곳에 모은 파일.
 *
 * 카드 결정 2: 블록 값은 지금 number지만, T043에서 0.1·0.01이 들어와도
 * `valueOf`·`countsOf`만 고치면 되도록 다른 파일은 이 함수들만 쓴다.
 */
import type { BaseTenState, BlockValue, ChartName, Zone } from './types';
import { CHART_NAME_COLUMN } from './types';

export interface PlaceCounts {
  readonly thousands: number;
  readonly hundreds: number;
  readonly tens: number;
  readonly ones: number;
}

export const ZERO_COUNTS: PlaceCounts = { thousands: 0, hundreds: 0, tens: 0, ones: 0 };

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
    default:
      return null;
  }
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

export function isCanonicalCounts(counts: PlaceCounts): boolean {
  return [counts.thousands, counts.hundreds, counts.tens, counts.ones].every(
    (count) => count >= 0 && count <= 9,
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

function countsOfBlocks(blocks: BaseTenState['blocks'], zone?: Zone): PlaceCounts {
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

/** 지금 나타내는 수. add는 모으기 칸, sub는 남은 값. */
export function valueOf(state: BaseTenState): number {
  return countsToValue(countsOf(state));
}

/** 자릿값과 상관없이 캔버스에 있는 모든 블록의 값(최대값 검사용). */
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

export function countsForColumn(state: BaseTenState, column: number): number {
  const counts = countsOf(state);
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

/**
 * 표가 가리키는 수.
 * - student: 모든 칸이 한 자리 숫자일 때만.
 * - auto: 블록 개수를 그대로 읽으므로 10 이상·음수인 칸이 있으면 null(정규형 아님).
 */
export function chartValueOf(state: BaseTenState): number | null {
  const columns = state.settings.chartColumns;
  if (state.chart === null || columns.length === 0) return null;

  if (state.settings.chartFill === 'auto') {
    let value = 0;
    for (const column of columns) {
      const count = countsForColumn(state, column);
      if (count < 0 || count > 9) return null;
      const place = placeValueOf(column);
      if (place === null) return null;
      value += count * place;
    }
    return value;
  }

  const digits: number[] = [];
  for (const cell of state.chart) {
    if (cell === null || !/^[0-9]$/.test(cell)) return null;
    digits.push(Number(cell));
  }
  if (digits.length === 0) return null;
  return Number(digits.join(''));
}

/** 위치가 그 자리의 칸 안에 있는지 판정할 때 쓰는 지수. */
export function chartColumnOfName(name: ChartName): number {
  return CHART_NAME_COLUMN[name];
}
