/**
 * E07의 오류 유형 분류(순수 함수).
 *
 * 틀린 결과 칸마다 T014 구현 결정 9의 순서대로 코드를 하나 붙인다.
 * 정답 칸은 분류하지 않는다. 화면은 이 코드를 칸 색으로 보여 주지 않는다
 * (AGENTS 절대 규칙 3, T014 결정 7).
 */
import type { ColumnComputation, AlignmentResult } from './grid';
import type { ColumnCalcState, ColumnMode, ColumnOp } from './types';

export type MisconceptionCode =
  | 'MC-DEC-ALIGN-RIGHT'
  | 'MC-SUB-SMALLER-FROM-LARGER'
  | 'MC-PV-BORROW-NO-DECREMENT'
  | 'MC-PV-NO-CARRY'
  | 'unknown';

export interface ClassifyInput {
  readonly mode: ColumnMode;
  readonly op: ColumnOp;
  readonly alignment: AlignmentResult;
  readonly computation: ColumnComputation;
  /** 학생이 그 칸에 쓴 숫자 한 글자. */
  readonly studentDigit: string;
}

/** 한 칸의 오류 코드. 카드의 ①→②→③→④ 순서를 지킨다. */
export function classifyColumn(input: ClassifyInput): MisconceptionCode {
  const { mode, op, alignment, computation, studentDigit } = input;
  const student = Number(studentDigit);

  // ① 소수점을 오른쪽 끝에 맞춰 수를 놓았다.
  if (mode === 'decimal' && alignment.alignment === 'right-edge') {
    return 'MC-DEC-ALIGN-RIGHT';
  }

  // ② 작은 수에서 큰 수를 거꾸로 뺀 값.
  if (
    op === 'sub' &&
    computation.top < computation.bottom &&
    student === computation.bottom - computation.top
  ) {
    return 'MC-SUB-SMALLER-FROM-LARGER';
  }

  // ③ 오른쪽 열에 받아내림을 해 주고 이 열의 윗수를 그대로 계산한 값.
  if (
    op === 'sub' &&
    computation.decrement > 0 &&
    computation.originalTopDigit !== null &&
    computation.originalTopDigit !== computation.expected &&
    student === computation.originalTopDigit
  ) {
    return 'MC-PV-BORROW-NO-DECREMENT';
  }

  // ④ 아래 열의 합이 10 이상인데 받아올림을 더하지 않고 계산한 값.
  if (op === 'add' && computation.carryIn > 0) {
    if (
      computation.noCarryDigit !== null &&
      computation.noCarryDigit !== computation.expected &&
      student === computation.noCarryDigit
    ) {
      return 'MC-PV-NO-CARRY';
    }
    // 받아올림 수를 결과 칸에 그대로 쓴 경우.
    if (student === computation.carryIn && student !== computation.expected) {
      return 'MC-PV-NO-CARRY';
    }
  }

  return 'unknown';
}

export interface ColumnError {
  readonly column: number;
  readonly code: MisconceptionCode;
}

export function classifyColumns(
  state: ColumnCalcState,
  wrongColumns: readonly number[],
  alignment: AlignmentResult,
  byColumn: ReadonlyMap<number, ColumnComputation>,
): ColumnError[] {
  const errors: ColumnError[] = [];
  for (const column of wrongColumns) {
    const computation = byColumn.get(column);
    const studentDigit = state.result[String(column)];
    if (!computation || studentDigit === undefined) continue;
    errors.push({
      column,
      code: classifyColumn({
        mode: state.mode,
        op: state.op,
        alignment,
        computation,
        studentDigit,
      }),
    });
  }
  return errors;
}

/** 오류 코드를 처음 나온 순서대로 중복 없이 모은다. */
export function uniqueCodes(errors: readonly ColumnError[]): MisconceptionCode[] {
  const seen = new Set<MisconceptionCode>();
  const codes: MisconceptionCode[] = [];
  for (const error of errors) {
    if (seen.has(error.code)) continue;
    seen.add(error.code);
    codes.push(error.code);
  }
  return codes;
}
