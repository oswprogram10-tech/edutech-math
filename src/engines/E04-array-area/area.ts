/**
 * E04의 넓이·부분곱 계산. 화면 코드는 이 함수들만 쓴다(T045에서 분수·소수가
 * 들어와도 여기만 바꾸면 되도록).
 */
import { Rational } from '../../core/math';
import type {
  FractionParts,
  PuzzlePiece,
  PuzzlePlacement,
  ScalerPrediction,
  Split,
  SplitOrientation,
} from './types';

export interface Piece {
  readonly rows: number;
  readonly cols: number;
  readonly product: number;
  /** allowExtend로 늘린(빼는) 조각은 −1. */
  readonly sign: 1 | -1;
}

export function arrayTotal(rows: number, cols: number): number {
  return Math.max(0, Math.trunc(rows)) * Math.max(0, Math.trunc(cols));
}

/** 자릿값 경계 위치. 예: 312 → [300, 310], 23 → [20], 100 → []. */
export function placeValueBoundaries(value: number): number[] {
  const safe = Math.max(0, Math.trunc(value));
  if (safe < 10) return [];
  const result: number[] = [];
  let place = 10 ** Math.floor(Math.log10(safe));
  let accumulated = 0;
  while (place >= 10) {
    const digit = Math.floor(safe / place) % 10;
    accumulated += digit * place;
    if (accumulated > 0 && accumulated < safe) result.push(accumulated);
    place /= 10;
  }
  return result;
}

export function clampSplit(at: number, count: number): number | null {
  if (!Number.isFinite(at)) return null;
  const rounded = Math.round(at);
  if (rounded < 1 || rounded > count - 1) return null;
  return rounded;
}

/** 약한 자석: 가까운 힌트가 있으면 그 위치로 붙인다(반경 2). */
export function snapToHint(at: number, hints: readonly number[], count: number): number {
  for (const hint of hints) {
    const target = Math.round(hint);
    if (target >= 1 && target <= count - 1 && Math.abs(target - at) <= 2) return target;
  }
  return at;
}

export function sortSplits(splits: readonly Split[]): Split[] {
  return [...splits].sort((a, b) => {
    if (a.orientation !== b.orientation) return a.orientation === 'rows' ? -1 : 1;
    return a.at - b.at;
  });
}

export function sameSplits(a: readonly Split[], b: readonly Split[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (split, index) => split.orientation === b[index]?.orientation && split.at === b[index]?.at,
  );
}

export function boundariesFor(
  count: number,
  splits: readonly Split[],
  orientation: SplitOrientation,
): number[] {
  const cuts = splits
    .filter((split) => split.orientation === orientation)
    .map((split) => split.at)
    .filter((at) => at > 0 && at < count)
    .sort((a, b) => a - b);
  return [0, ...new Set(cuts), count];
}

/**
 * 분할로 생긴 조각들. `rows`×`cols` 배열을 자르고, allowExtend로 늘린 줄은
 * 부호 −인 조각으로 더한다(10×6 − 1×6 꼴).
 */
export function piecesOfSplit(
  rows: number,
  cols: number,
  splits: readonly Split[],
  extendedRows = 0,
): Piece[] {
  const rowBounds = boundariesFor(rows, splits, 'rows');
  const colBounds = boundariesFor(cols, splits, 'cols');
  const pieces: Piece[] = [];
  for (let rowIndex = 0; rowIndex < rowBounds.length - 1; rowIndex += 1) {
    const rowStart = rowBounds[rowIndex] ?? 0;
    const rowEnd = rowBounds[rowIndex + 1] ?? rows;
    for (let colIndex = 0; colIndex < colBounds.length - 1; colIndex += 1) {
      const colStart = colBounds[colIndex] ?? 0;
      const colEnd = colBounds[colIndex + 1] ?? cols;
      const pieceRows = rowEnd - rowStart;
      const pieceCols = colEnd - colStart;
      pieces.push({ rows: pieceRows, cols: pieceCols, product: pieceRows * pieceCols, sign: 1 });
    }
  }

  const extra = Math.max(0, Math.trunc(extendedRows));
  if (extra > 0) {
    const colCuts = boundariesFor(cols, splits, 'cols');
    if (colCuts.length > 2) {
      // 세로 분할이 있으면 늘린 줄도 같은 세로 조각으로 나눠 센다.
      for (let index = 0; index < colCuts.length - 1; index += 1) {
        const width = (colCuts[index + 1] ?? cols) - (colCuts[index] ?? 0);
        pieces.push({ rows: extra, cols: width, product: extra * width, sign: -1 });
      }
    } else {
      pieces.push({ rows: extra, cols, product: extra * cols, sign: -1 });
    }
  }
  return pieces;
}

export function partialSum(pieces: readonly Piece[]): number {
  return pieces.reduce((sum, piece) => sum + piece.sign * piece.product, 0);
}

/** a×b 직사각형을 가로·세로 분할 위치로 나눈 조각. */
export function piecesOfArea(
  a: number,
  b: number,
  splitsA: readonly number[],
  splitsB: readonly number[],
): Piece[] {
  const widthBounds = [0, ...[...splitsA].sort((x, y) => x - y), a];
  const heightBounds = [0, ...[...splitsB].sort((x, y) => x - y), b];
  const pieces: Piece[] = [];
  for (let rowIndex = 0; rowIndex < heightBounds.length - 1; rowIndex += 1) {
    const height = (heightBounds[rowIndex + 1] ?? b) - (heightBounds[rowIndex] ?? 0);
    for (let colIndex = 0; colIndex < widthBounds.length - 1; colIndex += 1) {
      const width = (widthBounds[colIndex + 1] ?? a) - (widthBounds[colIndex] ?? 0);
      pieces.push({ rows: height, cols: width, product: height * width, sign: 1 });
    }
  }
  return pieces;
}

export function tableProduct(r: number, c: number): number {
  return r * c;
}

export function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function parseCellKey(key: string): { r: number; c: number } | null {
  const [r, c] = key.split(',').map((part) => Number(part));
  if (r === undefined || c === undefined || !Number.isFinite(r) || !Number.isFinite(c)) return null;
  return { r, c };
}

/** times-table에서 학생이 쓴 값이 틀린 칸 목록. 화면에 맞음·틀림은 쓰지 않는다. */
export function wrongCellsOf(
  cells: Readonly<Record<string, number>>,
  includeZero: boolean,
  rows: number,
  cols: number,
): string[] {
  const start = includeZero ? 0 : 1;
  return Object.keys(cells).filter((key) => {
    const parsed = parseCellKey(key);
    if (!parsed) return false;
    const { r, c } = parsed;
    if (r < start || r > rows || c < start || c > cols) return false;
    return cells[key] !== tableProduct(r, c);
  });
}

// ─────────────────────────────────────────────────────────────
// T045: tiling · decimal-area · fraction-area · scaler · puzzle
// ─────────────────────────────────────────────────────────────

export interface TileFit {
  readonly size: number;
  readonly tiles: number;
  readonly leftover: number;
  readonly fits: boolean;
}

/** 한 변 `size`인 정사각형 타일을 왼쪽 위부터 온전히 깐 결과. */
export function tileFit(width: number, height: number, size: number): TileFit {
  const safeSize = Math.max(1, Math.trunc(size));
  const across = Math.floor(Math.max(0, width) / safeSize);
  const down = Math.floor(Math.max(0, height) / safeSize);
  const tiles = across * down;
  const leftover = Math.max(0, width * height - tiles * safeSize * safeSize);
  return { size: safeSize, tiles, leftover, fits: leftover === 0 };
}

/** 설정 문자열을 0.1 단위 소수 문자열로. 범위를 넘으면 자르고, 형식이 틀리면 `0`. */
export function decimalFactor(text: string | number | undefined, max: number): string {
  if (text === undefined) return '0';
  let value: Rational;
  try {
    value = Rational.parse(String(text));
  } catch {
    return '0';
  }
  if (value.isNegative()) value = Rational.of(0);
  const maximum = Rational.of(max);
  if (value.compareTo(maximum) > 0) value = maximum;
  const tenths = value.mul(Rational.of(10)).integerPart();
  return Rational.of(tenths, 10).toDecimalString();
}

export function decimalRational(text: string): Rational {
  try {
    return Rational.parse(text);
  } catch {
    return Rational.of(0);
  }
}

export interface DecimalAreaFacts {
  readonly a: Rational;
  readonly b: Rational;
  readonly product: Rational;
  /** 겹친 0.01칸 수(항상 정수). */
  readonly overlapCells: number;
  /** 그려지는 판 전체의 0.01칸 수. */
  readonly unitSquares: number;
}

export function decimalAreaOf(
  aText: string,
  bText: string,
  maxA: string,
  maxB: string,
): DecimalAreaFacts {
  const a = decimalRational(aText);
  const b = decimalRational(bText);
  const overlapCells = Number(
    a.mul(Rational.of(10)).integerPart() * b.mul(Rational.of(10)).integerPart(),
  );
  const columns = Math.max(1, Math.ceil(Number(decimalRational(maxA).toString())));
  const rows = Math.max(1, Math.ceil(Number(decimalRational(maxB).toString())));
  return {
    a,
    b,
    product: a.mul(b),
    overlapCells,
    unitSquares: columns * rows * 100,
  };
}

/** `k/n` 꼴 분수 문자열. 0은 `"0"`, 1은 `"1"`. */
export function fractionText(parts: FractionParts): string {
  if (parts.k === 0) return '0';
  if (parts.n === 1) return String(parts.k);
  return `${parts.k}/${parts.n}`;
}

export function fractionValue(parts: FractionParts): Rational {
  if (parts.n <= 0) return Rational.of(0);
  return Rational.of(parts.k, parts.n);
}

/** 설정 문자열(`"2/3"`, `"1"`, `"0"`)을 조각 수·칠한 수로. */
export function parseFractionParts(
  text: string | number | undefined,
  maxDenominator: number,
  fallback: FractionParts = { n: 1, k: 0 },
): FractionParts {
  if (text === undefined) return fallback;
  const trimmed = String(text).trim();
  if (trimmed === '0') return { n: 1, k: 0 };
  if (trimmed === '1') return { n: 1, k: 1 };
  const match = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (!match) return fallback;
  const k = Number(match[1]);
  const n = Number(match[2]);
  if (!Number.isInteger(n) || n < 1 || n > maxDenominator) return fallback;
  if (!Number.isInteger(k) || k < 0 || k > n) return fallback;
  return { n, k };
}

export interface FractionAreaFacts {
  readonly a: FractionParts;
  readonly b: FractionParts;
  readonly product: Rational;
  readonly overlapCells: number;
  readonly totalCells: number;
}

export function fractionAreaOf(a: FractionParts, b: FractionParts): FractionAreaFacts {
  return {
    a,
    b,
    product: fractionValue(a).mul(fractionValue(b)),
    overlapCells: a.k * b.k,
    totalCells: a.n * b.n,
  };
}

/** 곱하는 수가 1보다 작은지·같은지·큰지. */
export function scalerTrend(multiplier: Rational): ScalerPrediction {
  const compared = multiplier.compareTo(Rational.of(1));
  return compared < 0 ? 'smaller' : compared === 0 ? 'same' : 'larger';
}

export function scalerResult(base: number, multiplier: string): string | null {
  let value: Rational;
  try {
    value = Rational.parse(multiplier);
  } catch {
    return null;
  }
  return Rational.of(base).mul(value).toString();
}

export function sameNumberSet(actual: readonly number[], expected: readonly number[]): boolean {
  const left = [...new Set(actual)].sort((a, b) => a - b);
  const right = [...new Set(expected)].sort((a, b) => a - b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** 퍼즐 조각(폭·높이). `seed`로 섞되 같은 seed는 항상 같은 순서다. */
export function puzzlePiecesOf(
  a: number,
  b: number,
  splitsA: readonly number[],
  splitsB: readonly number[],
  seed = 0,
  idPrefix = 'p',
): PuzzlePiece[] {
  const widths = [0, ...splitsA.filter((at) => at > 0 && at < a).sort((x, y) => x - y), a];
  const heights = [0, ...splitsB.filter((at) => at > 0 && at < b).sort((x, y) => x - y), b];
  const pieces: PuzzlePiece[] = [];
  let index = 0;
  for (let row = 0; row < heights.length - 1; row += 1) {
    for (let col = 0; col < widths.length - 1; col += 1) {
      pieces.push({
        id: `${idPrefix}${index}`,
        w: (widths[col + 1] ?? a) - (widths[col] ?? 0),
        h: (heights[row + 1] ?? b) - (heights[row] ?? 0),
      });
      index += 1;
    }
  }
  let state = Math.trunc(seed) >>> 0 || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
  for (let at = pieces.length - 1; at > 0; at -= 1) {
    const swap = next() % (at + 1);
    const item = pieces[at];
    const other = pieces[swap];
    if (item !== undefined && other !== undefined) {
      pieces[at] = other;
      pieces[swap] = item;
    }
  }
  return pieces;
}

export interface PuzzleAssembly {
  readonly a: number;
  readonly b: number;
}

/** 모든 슬롯이 차고 같은 열 너비·같은 행 높이가 같으면 조립된 것. */
export function puzzleAssemblyOf(
  pieces: readonly PuzzlePiece[],
  placed: Readonly<Record<string, PuzzlePlacement>>,
): PuzzleAssembly | null {
  if (pieces.length === 0) return null;
  const columns = new Map<number, number>();
  const rows = new Map<number, number>();
  const slots = new Set<string>();
  for (const piece of pieces) {
    const spot = placed[piece.id];
    if (!spot) return null;
    const key = `${spot.col},${spot.row}`;
    if (slots.has(key)) return null;
    slots.add(key);
    const width = columns.get(spot.col);
    if (width !== undefined && width !== piece.w) return null;
    const height = rows.get(spot.row);
    if (height !== undefined && height !== piece.h) return null;
    columns.set(spot.col, piece.w);
    rows.set(spot.row, piece.h);
  }
  const columnCount = Math.max(...[...columns.keys()]) + 1;
  const rowCount = Math.max(...[...rows.keys()]) + 1;
  if (slots.size !== columnCount * rowCount) return null;
  let totalWidth = 0;
  for (let col = 0; col < columnCount; col += 1) totalWidth += columns.get(col) ?? 0;
  let totalHeight = 0;
  for (let row = 0; row < rowCount; row += 1) totalHeight += rows.get(row) ?? 0;
  return { a: totalWidth, b: totalHeight };
}
