/**
 * E12 `cylinder-net` 치수 계산·맞음 판정(순수 함수).
 *
 * 수학 값(원주·길이 차이·맞음)은 모두 `Rational`이다. 상태에는 정수만 있고(0.1cm·0.5cm 단위),
 * 여기서 `Rational`로 바꿔 계산한다. 화면 좌표(number)로 바꾸는 일은 `layout.ts`에서만 한다.
 */
import { Rational } from '../../../core/math';

export const CYL_PI_OPTIONS = ['3.14', '3.1', '3'] as const;
export type CylPi = (typeof CYL_PI_OPTIONS)[number];
export const CYL_DEFAULT_PI: CylPi = '3.14';

/** 옆면 가로가 원주와 이만큼(0.1cm)까지 다르면 맞는 것으로 본다. */
export const WIDTH_TOLERANCE: Rational = Rational.of(1, 10);

export const ROLL_FULL = 8;
export const WIDTH_MIN_TENTHS = 10;
export const WIDTH_MAX_TENTHS = 400;
export const PIECE_RADIUS_MIN_HALVES = 1;
export const PIECE_RADIUS_MAX_HALVES = 10;
export const PIECE_HEIGHT_MIN_HALVES = 2;
export const PIECE_HEIGHT_MAX_HALVES = 20;

export function isCylPi(value: unknown): value is CylPi {
  return CYL_PI_OPTIONS.some((option) => option === value);
}

export function parsePi(pi: string): Rational {
  return Rational.parse(isCylPi(pi) ? pi : CYL_DEFAULT_PI);
}

export function tenths(n: number): Rational {
  return Rational.of(n, 10);
}

export function halves(n: number): Rational {
  return Rational.of(n, 2);
}

/** 원주 = 2 × 원주율 × 반지름. */
export function circumference(radius: Rational, pi: Rational): Rational {
  return Rational.of(2).mul(pi).mul(radius);
}

/** 옆면 가로가 원주와 허용 오차 안에서 같은가. */
export function widthFits(width: Rational, circ: Rational): boolean {
  return width.sub(circ).abs().compareTo(WIDTH_TOLERANCE) <= 0;
}

export type Seam = 'gap' | 'overlap' | 'closed';

/** 가로만 보고 정한다. 맞으면 closed, 모자라면 gap, 남으면 overlap. */
export function seamOf(width: Rational, circ: Rational): Seam {
  if (widthFits(width, circ)) return 'closed';
  return width.compareTo(circ) < 0 ? 'gap' : 'overlap';
}

export interface NetMeasure {
  readonly width: Rational;
  readonly radius: Rational;
  readonly height: Rational;
  readonly widthFits: boolean;
  readonly radiusMatches: boolean;
  readonly heightMatches: boolean;
  readonly valid: boolean;
  readonly seam: Seam;
}

/** 학생이 만든 조각이 설정한 원기둥(반지름·높이·원주율)에 맞는지 잰다. */
export function measureNet(
  pieces: { readonly width: Rational; readonly radius: Rational; readonly height: Rational },
  target: { readonly radius: Rational; readonly height: Rational; readonly pi: Rational },
): NetMeasure {
  const circ = circumference(pieces.radius, target.pi);
  const fits = widthFits(pieces.width, circ);
  const radiusMatches = pieces.radius.equals(target.radius);
  const heightMatches = pieces.height.equals(target.height);
  return {
    ...pieces,
    widthFits: fits,
    radiusMatches,
    heightMatches,
    valid: fits && radiusMatches && heightMatches,
    seam: seamOf(pieces.width, circ),
  };
}
