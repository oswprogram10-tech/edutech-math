/**
 * E15 hundred-chart 모드의 순수 계산: 배열표 좌표·가린 칸.
 * 칸 값은 정수 칸 번호라 number를 쓴다(소수·분수는 없다). 학생 입력은 숫자 문자열이다.
 */
import { mulberry32 } from './random';

export const CHART_COLS = 10;
export const MAX_CELLS = 200;

export interface ChartRange {
  /** 첫 칸 번호. 10으로 나눈 나머지가 0 또는 1. */
  readonly from: number;
  /** 칸 수(10의 배수, 최대 200). */
  readonly count: number;
}

export type ChartView = 'full' | 'cross-only' | 'row' | 'column';

export const DEFAULT_RANGE: ChartRange = { from: 1, count: 100 };

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** `[from, to]`(둘 다 포함)를 검사한다. 맞지 않으면 기본 [1, 100]. */
export function normalizeRange(value: unknown): ChartRange {
  if (!Array.isArray(value) || value.length !== 2) return DEFAULT_RANGE;
  const [from, to] = value as unknown[];
  if (!isInt(from) || !isInt(to) || from < 0 || to < from) return DEFAULT_RANGE;
  const count = to - from + 1;
  if (from % 10 > 1 || count % 10 !== 0 || count > MAX_CELLS) return DEFAULT_RANGE;
  return { from, count };
}

export function rowsOf(range: ChartRange): number {
  return range.count / CHART_COLS;
}

export function lastOf(range: ChartRange): number {
  return range.from + range.count - 1;
}

export function inRange(range: ChartRange, cell: number): boolean {
  return isInt(cell) && cell >= range.from && cell <= lastOf(range);
}

export function colOf(range: ChartRange, cell: number): number {
  return (cell - range.from) % CHART_COLS;
}

export function rowOf(range: ChartRange, cell: number): number {
  return Math.floor((cell - range.from) / CHART_COLS);
}

/** 위(−10)·아래(+10)·왼(−1)·오른(+1) 이웃 칸. 범위 밖(또는 줄 밖)이면 null. */
export function neighborsOf(
  range: ChartRange,
  cell: number,
): { up: number | null; down: number | null; left: number | null; right: number | null } {
  const pick = (value: number, ok: boolean) => (ok && inRange(range, value) ? value : null);
  const col = colOf(range, cell);
  return {
    up: pick(cell - CHART_COLS, true),
    down: pick(cell + CHART_COLS, true),
    left: pick(cell - 1, col > 0),
    right: pick(cell + 1, col < CHART_COLS - 1),
  };
}

/** 가운데(center)로 쓸 칸. 위·아래·왼·오른이 모두 범위 안이 되게 안쪽으로 당긴다. */
export function defaultCenter(range: ChartRange, requested: unknown): number {
  const rows = rowsOf(range);
  let row = Math.floor((rows - 1) / 2);
  let col = 5;
  if (isInt(requested) && inRange(range, requested)) {
    row = rowOf(range, requested);
    col = colOf(range, requested);
  }
  row = Math.min(Math.max(row, Math.min(1, rows - 1)), Math.max(rows - 2, 0));
  col = Math.min(Math.max(col, 1), CHART_COLS - 2);
  return range.from + row * CHART_COLS + col;
}

/** 지금 화면에 그리는 칸 번호(오름차순). */
export function drawnCells(
  range: ChartRange,
  view: ChartView,
  center: number,
  focus: number,
): number[] {
  const all: number[] = [];
  for (let n = range.from; n <= lastOf(range); n += 1) all.push(n);
  if (view === 'full') return all;
  if (view === 'cross-only') {
    const near = neighborsOf(range, center);
    return [near.up, near.left, center, near.right, near.down].filter(
      (cell): cell is number => cell !== null,
    );
  }
  if (view === 'row') {
    const row = rowOf(range, focus);
    return all.filter((cell) => rowOf(range, cell) === row);
  }
  const col = colOf(range, focus);
  return all.filter((cell) => colOf(range, cell) === col);
}

export interface RandomHidden {
  readonly random: number;
  readonly within?: unknown;
}

function touching(a: number, b: number, range: ChartRange): boolean {
  if (Math.abs(a - b) === CHART_COLS) return true;
  return Math.abs(a - b) === 1 && rowOf(range, a) === rowOf(range, b);
}

/**
 * `{random: n}` 가린 칸. seed로 되풀이할 수 있고, 가로·세로로 맞닿은 두 칸은 함께 가리지 않는다.
 * 칸이 모자라면 고를 수 있는 만큼만 돌려준다.
 */
export function randomHidden(
  range: ChartRange,
  count: number,
  seed: number,
  within: ChartRange | null,
): number[] {
  const lo = within ? Math.max(within.from, range.from) : range.from;
  const hi = within ? Math.min(lastOf(within), lastOf(range)) : lastOf(range);
  const candidates: number[] = [];
  for (let n = lo; n <= hi; n += 1) candidates.push(n);
  const random = mulberry32(seed);
  // Fisher-Yates
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = candidates[i];
    const b = candidates[j];
    if (a !== undefined && b !== undefined) {
      candidates[i] = b;
      candidates[j] = a;
    }
  }
  const chosen: number[] = [];
  for (const cell of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some((other) => touching(cell, other, range))) continue;
    chosen.push(cell);
  }
  return chosen.sort((a, b) => a - b);
}

/** 입력 문자열을 정수로. 비었거나 숫자가 아니면 null. */
export function entryValue(text: string | undefined): number | null {
  if (text === undefined || !/^\d{1,3}$/.test(text)) return null;
  return Number.parseInt(text, 10);
}

/**
 * MC-CHART-ROW-COL: 입력이 칸 번호와 다르고, 바로 위나 아래 칸 수에서 ±1이다
 * (예: 33 아래 칸에 34). 해당하는 가린 칸 번호를 돌려준다.
 */
export function rowColCells(
  range: ChartRange,
  hidden: readonly number[],
  entries: Readonly<Record<string, string>>,
): number[] {
  const found: number[] = [];
  for (const cell of hidden) {
    const value = entryValue(entries[String(cell)]);
    if (value === null || value === cell) continue;
    const near = neighborsOf(range, cell);
    const hit = [near.up, near.down].some(
      (other) => other !== null && Math.abs(value - other) === 1,
    );
    if (hit) found.push(cell);
  }
  return found;
}
