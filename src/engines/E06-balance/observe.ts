/**
 * E06 equation 관찰 결과. 엔진은 □의 정답을 모른다.
 * 기울기·수평은 학생이 넣은 값과 양쪽 연산으로 바뀐 두 접시의 수로만 계산한다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import type { BalanceConfig, BalanceSide, BalanceState, BalanceTilt } from './types';

export const MC_EQUAL_ANSWER = 'MC-EQUAL-ANSWER';

/** 접시의 값. □가 있는데 아직 넣어 보지 않았으면 null. */
export function sideValue(side: BalanceSide, tryValue: string | null): Rational | null {
  const base = Rational.parse(side.const);
  if (!side.hasBox) return base;
  return tryValue === null ? null : base.add(Rational.parse(tryValue));
}

export interface BalanceReading {
  readonly left: Rational | null;
  readonly right: Rational | null;
  readonly balanced: boolean;
  readonly tilt: BalanceTilt;
}

export function readBalance(state: BalanceState): BalanceReading {
  const left = sideValue(state.left, state.tryValue);
  const right = sideValue(state.right, state.tryValue);
  if (left === null || right === null) return { left, right, balanced: false, tilt: 'unknown' };
  const order = left.compareTo(right);
  const tilt: BalanceTilt = order > 0 ? 'left' : order < 0 ? 'right' : 'level';
  return { left, right, balanced: order === 0, tilt };
}

/** □가 한쪽에 홀로 남았는가(그쪽 수가 0이고 다른 쪽에는 □가 없다). */
export function isBoxIsolated(state: BalanceState): boolean {
  const boxSide = state.left.hasBox ? state.left : state.right.hasBox ? state.right : null;
  if (boxSide === null) return false;
  const other = boxSide === state.left ? state.right : state.left;
  return !other.hasBox && Rational.parse(boxSide.const).isZero();
}

function boxValueOf(state: BalanceState, reading: BalanceReading): string | null {
  if (reading.balanced) return state.tryValue;
  if (!isBoxIsolated(state)) return null;
  const other = state.left.hasBox ? state.right : state.left;
  return other.const;
}

export function equalAnswerTried(state: BalanceState): boolean {
  if (state.initialSum === null) return false;
  const sum = Rational.parse(state.initialSum);
  return state.tries.some((value) => Rational.parse(value).equals(sum));
}

export function observe(state: BalanceState, config: BalanceConfig): Observation {
  void config;
  const reading = readBalance(state);
  const misconceptions: string[] = equalAnswerTried(state) ? [MC_EQUAL_ANSWER] : [];
  return {
    mode: 'equation',
    leftValue: reading.left === null ? null : reading.left.toString(),
    rightValue: reading.right === null ? null : reading.right.toString(),
    balanced: reading.balanced,
    tilt: reading.tilt,
    tryValue: state.tryValue,
    tries: [...state.tries],
    boxIsolated: isBoxIsolated(state),
    boxValue: boxValueOf(state, reading),
    bothSidesOps: state.ops.filter((op) => op.kind.startsWith('both')).length,
    oneSideOps: state.ops.filter((op) => op.kind.startsWith('one')).length,
    ops: state.ops.map((op): JsonValue => ({ ...op })),
    prediction: state.prediction,
    // 예측을 잠갔는가(E15 gears의 predictionLocked와 같은 뜻). 예측 전 조작 막힘은 reduce의 isLocked.
    predictionLocked: state.prediction !== null,
    misconceptions,
  };
}
