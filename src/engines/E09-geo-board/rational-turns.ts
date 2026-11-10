/**
 * 화면 방향을 정확히 유지하는 유리 회전 표(T101).
 *
 * `T_HALF[k]`는 `tan(3.75°·k)`를 분모 48로 반올림한 값이다. 회전각은
 * `2·atan(t)`이므로 한 칸이 7.5°다. 실행할 때 `Math.tan`을 쓰지 않고 리터럴로
 * 적어 기기마다 반올림이 달라지지 않게 한다. 0번(0°)과 12번(90°)은 정확하다.
 *
 * T102도 이 표를 쓴다.
 */
import { gp, rationalRotate } from '../../core/math';
import type { GPoint } from '../../core/math';
import { Rational } from '../../core/math';

/** `[분자, 분모]` 24개. k번째는 `tan(3.75°k)`다. */
export const T_HALF: readonly (readonly [number, number])[] = [
  [0, 1],
  [3, 48],
  [6, 48],
  [10, 48],
  [13, 48],
  [16, 48],
  [20, 48],
  [24, 48],
  [28, 48],
  [32, 48],
  [37, 48],
  [42, 48],
  [1, 1],
  [55, 48],
  [63, 48],
  [72, 48],
  [83, 48],
  [97, 48],
  [116, 48],
  [141, 48],
  [179, 48],
  [241, 48],
  [365, 48],
  [732, 48],
] as const;

export const T_INDEX_90 = 12;

/** 표 인덱스(0~23)를 유리수로. 범위를 벗어나면 0으로 되돌린다. */
export function turnT(index: number): Rational {
  const safe = Number.isFinite(index) ? Math.round(index) : 0;
  const wrapped = ((safe % T_HALF.length) + T_HALF.length) % T_HALF.length;
  const entry = T_HALF[wrapped] ?? T_HALF[0] ?? [0, 1];
  return Rational.of(entry[0], entry[1]);
}

/** 비율 표 `1/4, 2/4, …, 12/4`. 인덱스 3이 1이다. */
export const S_TABLE: readonly Rational[] = [
  Rational.of(1, 4),
  Rational.of(2, 4),
  Rational.of(3, 4),
  Rational.of(1, 1),
  Rational.of(5, 4),
  Rational.of(6, 4),
  Rational.of(7, 4),
  Rational.of(8, 4),
  Rational.of(9, 4),
  Rational.of(10, 4),
  Rational.of(11, 4),
  Rational.of(12, 4),
];

/** 비율 표 인덱스(0~11)를 유리수로. 범위를 벗어나면 0으로 되돌린다. */
export function tableRatio(index: number): Rational {
  const safe = Number.isFinite(index) ? Math.round(index) : 0;
  return S_TABLE[Math.min(S_TABLE.length - 1, Math.max(0, safe))] ?? Rational.of(1);
}

/**
 * 원 위의 자리. `pos` 0~47이고 0~23은 반시계, 24~47은 정확히 지름의 반대쪽이다.
 * 회전 벡터는 `radiusVector`(중심→원 위의 한 점)다.
 */
export function circlePoint(center: GPoint, radiusVector: GPoint, pos: number): GPoint {
  const safe = Number.isFinite(pos) ? Math.round(pos) : 0;
  const wrapped = ((safe % 48) + 48) % 48;
  const half = wrapped % 24;
  const rotated = rationalRotate(radiusVector, turnT(half));
  if (wrapped < 24) {
    return { x: center.x.add(rotated.x), y: center.y.add(rotated.y) };
  }
  return { x: center.x.sub(rotated.x), y: center.y.sub(rotated.y) };
}

/** 중심과 반지름 벡터를 정수 격자점으로 만들 때 쓴다. */
export function circlePointAt(
  center: readonly [number, number],
  radius: readonly [number, number],
  pos: number,
): GPoint {
  return circlePoint(gp(center[0], center[1]), gp(radius[0], radius[1]), pos);
}
