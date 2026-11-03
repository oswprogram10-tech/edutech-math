/**
 * E04의 넓이·부분곱 계산. 화면 코드는 이 함수들만 쓴다(T045에서 분수·소수가
 * 들어와도 여기만 바꾸면 되도록).
 */
import type { Split, SplitOrientation } from './types';

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
