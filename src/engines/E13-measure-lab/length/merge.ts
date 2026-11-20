/**
 * E13 length `mergeRule`(T208). 0부터 틈 없이 이어진 10cm 막대 열 개가 생기면 1m 줄자 하나로 바꾼다.
 * 합체는 `add`/`move`의 결과로 reduce 안에서 일어난다(Action 하나). 계산은 Rational로만 한다.
 */
import { Rational } from '../../../core/math';
import { toNumber } from '../rat';
import { unitLength } from '../units';
import { bandLength, pieceLength, pieceStart } from './settings';
import type { MeasureState, Piece } from './types';

export const ROD = 'cm-10-rod';
export const TAPE = 'm-tape';
const ROD_COUNT = 10;
const TEN = Rational.of(10);
const HUNDRED = Rational.of(100);

function indexesAt(pieces: readonly Piece[], at: Rational): number[] {
  const found: number[] = [];
  pieces.forEach((piece, index) => {
    if (pieceStart(piece).equals(at)) found.push(index);
  });
  return found;
}

/** 합체 규칙을 끝까지 적용한다(200cm에서 두 번째 합체처럼 이어지는 합체도 한 Action 안에서 일어난다). */
export function applyMerge(state: MeasureState): MeasureState {
  if (!state.mergeRule) return state;
  let pieces = [...state.pieces];
  let merges = state.merges;
  let cursor = Rational.of(0);
  for (;;) {
    const here = indexesAt(pieces, cursor);
    if (here.length !== 1) break;
    const first = pieces[here[0] as number] as Piece;
    if (first.unit === TAPE) {
      cursor = cursor.add(HUNDRED);
      continue;
    }
    if (first.unit !== ROD) break;
    const group: number[] = [];
    for (let k = 0; k < ROD_COUNT; k += 1) {
      const at = indexesAt(pieces, cursor.add(TEN.mul(Rational.of(k))));
      const index = at[0];
      if (at.length !== 1 || index === undefined || (pieces[index] as Piece).unit !== ROD) break;
      group.push(index);
    }
    if (group.length < ROD_COUNT) break;
    const insertAt = Math.min(...group);
    const tape: Piece = { unit: TAPE, start: cursor.toString() };
    const rest: Piece[] = [];
    let position = 0;
    pieces.forEach((piece, index) => {
      if (group.includes(index)) return;
      if (index < insertAt) position += 1;
      rest.push(piece);
    });
    pieces = [...rest.slice(0, position), tape, ...rest.slice(position)];
    merges += 1;
    cursor = cursor.add(HUNDRED);
  }
  if (merges === state.merges) return state;
  return { ...state, pieces, merges };
}

/** 1m 줄자 조각 수. */
export function meterCount(state: Pick<MeasureState, 'pieces'>): number {
  return state.pieces.filter((piece) => piece.unit === TAPE).length;
}

/** 1m 줄자가 아닌 조각의 길이 합(cm, Rational). */
export function restLength(state: Pick<MeasureState, 'pieces'>): Rational {
  return state.pieces
    .filter((piece) => piece.unit !== TAPE)
    .reduce((sum, piece) => sum.add(pieceLength(piece)), Rational.of(0));
}

/**
 * 끌어 놓을 때 쓰는 10cm 격자 자석. raw(cm)를 10cm 격자로 맞추고 띠 안으로 당긴다.
 * (판 배율이 작아서 0.5cm 격자는 쓸 수 없다.)
 */
export function snapStartGrid(
  state: Pick<MeasureState, 'objectCm'>,
  unit: string,
  raw: number,
): Rational {
  const length = unitLength(unit) ?? Rational.of(0);
  const maxCells = Math.floor(toNumber(bandLength(state).sub(length)) / 10);
  const cells = Math.min(Math.max(Math.round(raw / 10), 0), Math.max(maxCells, 0));
  return TEN.mul(Rational.of(cells));
}
