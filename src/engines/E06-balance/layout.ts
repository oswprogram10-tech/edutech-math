/**
 * E06 화면 배치(논리 좌표 1000×600). View와 오버레이가 같은 계산을 쓴다.
 * 저울(scale)은 접시가 가로대 끝에 매달려 움직이므로 막대는 "수평일 때 접시 기준 좌표"로 두고,
 * 접시 묶음을 `panOffsets`만큼 옮긴다(CSS transition 대상). 오버레이는 같은 옮김을 쓴다.
 */
import { Rational } from '../../core/math';
import { readBalance } from './observe';
import type { BalanceSide, BalanceState, BalanceTilt } from './types';

export const PIVOT = { x: 500, y: 170 } as const;
export const BEAM_HALF = 320;
export const PAN_HALF = 150;
export const PAN_DROP = 190;
export const BAR_HEIGHT = 44;
export const BAR_GAP = 6;
export const BAR_MAX = 280;
export const BOX_FIXED = 110;
export const MIN_BAR = 36;
export const MIN_TILT = 4;
export const MAX_TILT = 12;

/** 수평일 때 접시 가운데 x. */
export const PAN_CENTER = { left: PIVOT.x - BEAM_HALF, right: PIVOT.x + BEAM_HALF } as const;
export const PAN_SURFACE_Y = PIVOT.y + PAN_DROP;

function abs(value: Rational): Rational {
  return value.isNegative() ? value.neg() : value;
}

/** 화면 길이 계산용 근사값(수학 값 판정에는 쓰지 않는다). */
function lengthOf(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

/** 두 접시의 값으로 정하는 기울기 각도(0~12). 모르거나 같으면 0. (equation·proportion 공용) */
export function tiltDegreesOf(left: Rational | null, right: Rational | null): number {
  if (left === null || right === null || left.compareTo(right) === 0) return 0;
  const diff = lengthOf(abs(left.sub(right)));
  const biggest = Math.max(lengthOf(abs(left)), lengthOf(abs(right)), 1);
  const ratio = Math.min(1, diff / biggest);
  return Math.min(MAX_TILT, MIN_TILT + (MAX_TILT - MIN_TILT) * ratio);
}

/** 기울기 각도(0~12). level·unknown은 0. */
export function tiltDegrees(state: BalanceState): number {
  const reading = readBalance(state);
  return tiltDegreesOf(reading.left, reading.right);
}

/** 가로대 회전(CSS rotate 각도). 왼쪽이 무거우면 왼쪽 끝이 내려가도록 음수. */
export function beamRotation(tilt: BalanceTilt, degrees: number): number {
  if (tilt === 'left') return -degrees;
  if (tilt === 'right') return degrees;
  return 0;
}

export interface PanOffset {
  readonly dx: number;
  readonly dy: number;
}

/** 수평일 때 위치에서 각 접시가 옮겨 가는 양. */
export function panOffsets(
  tilt: BalanceTilt,
  degrees: number,
): { readonly left: PanOffset; readonly right: PanOffset } {
  if (tilt !== 'left' && tilt !== 'right') {
    return { left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } };
  }
  const rad = (degrees * Math.PI) / 180;
  const drop = BEAM_HALF * Math.sin(rad);
  const inward = BEAM_HALF * (1 - Math.cos(rad));
  const sign = tilt === 'left' ? 1 : -1; // left 무거움 → 왼쪽이 내려감
  return {
    left: { dx: inward, dy: sign * drop },
    right: { dx: -inward, dy: -sign * drop },
  };
}

export interface BarItem {
  readonly kind: 'const' | 'box';
  /** 막대에 쓸 글자(□는 □, 넣어 본 뒤에는 "□ = 값"). */
  readonly label: string;
  readonly width: number;
  /** const일 때 빼는 항(점선·빗금). */
  readonly negative: boolean;
  /** □를 아직 넣어 보지 않았다. */
  readonly unknown: boolean;
}

/** 한 접시에서 그릴 값(절댓값)의 후보: 수 막대와 넣어 본 □. */
function magnitudes(side: BalanceSide, tryValue: string | null): number[] {
  const values = [lengthOf(abs(Rational.parse(side.const)))];
  if (side.hasBox && tryValue !== null) values.push(Number(tryValue));
  return values;
}

export function maxMagnitude(state: BalanceState): number {
  return Math.max(
    1,
    ...magnitudes(state.left, state.tryValue),
    ...magnitudes(state.right, state.tryValue),
  );
}

/** 접시(또는 줄)에 놓는 막대. 수 막대 → □ 순서다. 길이는 `unit` 배율에 비례한다. */
export function panItems(state: BalanceState, side: BalanceSide, unit: number): BarItem[] {
  const items: BarItem[] = [];
  const value = Rational.parse(side.const);
  if (!value.isZero()) {
    items.push({
      kind: 'const',
      label: value.isNegative() ? `−${abs(value).toString()}` : value.toString(),
      width: Math.max(MIN_BAR, lengthOf(abs(value)) * unit),
      negative: value.isNegative(),
      unknown: false,
    });
  }
  if (side.hasBox) {
    const tried = state.tryValue;
    items.push({
      kind: 'box',
      label: tried === null ? '□' : `□ = ${tried}`,
      width: tried === null ? BOX_FIXED : Math.max(MIN_BAR, Number(tried) * unit),
      negative: false,
      unknown: tried === null,
    });
  }
  return items;
}

/** 저울(C): 가장 큰 값이 접시 폭(BAR_MAX)이 되는 눈금. */
export function scaleUnit(state: BalanceState): number {
  return BAR_MAX / maxMagnitude(state);
}

export const BARS = { x: 130, maxWidth: 760, leftY: 170, rightY: 380, height: 48 } as const;

/** 막대 두 줄(P): 한 줄에 수 막대 → □를 이어 붙이고, 두 줄이 같은 눈금을 쓴다. */
export function barsUnit(state: BalanceState): number {
  const fitted = [state.left, state.right].map((side) => {
    const fixed = side.hasBox && state.tryValue === null ? BOX_FIXED : 0;
    const sum =
      lengthOf(abs(Rational.parse(side.const))) +
      (side.hasBox && state.tryValue !== null ? Number(state.tryValue) : 0);
    return Math.max(0.5, (BARS.maxWidth - fixed) / Math.max(sum, 1));
  });
  return Math.min(...fitted);
}

/** 막대 두 줄의 한 줄. 수 막대가 음수면 □ 뒤에 둔다(□ − 16). */
export function rowItems(state: BalanceState, side: BalanceSide, unit: number): BarItem[] {
  const items = panItems(state, side, unit);
  const value = Rational.parse(side.const);
  return value.isNegative() ? [...items].reverse() : items;
}

/** 식(A) 한쪽 글자. 넣어 본 값이 있으면 □ 대신 그 값을 쓴다. */
export function expressionOf(side: BalanceSide, tryValue: string | null): string {
  const value = Rational.parse(side.const);
  const box = side.hasBox ? (tryValue ?? '□') : null;
  if (box === null) return value.isNegative() ? `−${abs(value).toString()}` : value.toString();
  if (value.isZero()) return box;
  return value.isNegative() ? `${box} − ${abs(value).toString()}` : `${value.toString()} + ${box}`;
}

/** □를 가진 쪽의 이름(없으면 null). */
export function boxSideOf(state: BalanceState): 'left' | 'right' | null {
  return state.left.hasBox ? 'left' : state.right.hasBox ? 'right' : null;
}

export interface BarRect {
  readonly item: BarItem;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 저울(C): 접시 위에 아래에서부터 쌓은 막대의 자리(수평일 때 좌표). 왼쪽 맞춤이라 길이를 견주기 쉽다. */
export function panBarRects(state: BalanceState, name: 'left' | 'right'): BarRect[] {
  const unit = scaleUnit(state);
  const left = PAN_CENTER[name] - BAR_MAX / 2;
  return panItems(state, state[name], unit).map((item, index) => ({
    item,
    x: left,
    y: PAN_SURFACE_Y - 2 - (index + 1) * BAR_HEIGHT - index * BAR_GAP,
    width: item.width,
    height: BAR_HEIGHT,
  }));
}

/** 막대 두 줄(P): 줄 안에서 막대를 이어 붙인 자리. */
export function rowBarRects(state: BalanceState, name: 'left' | 'right'): BarRect[] {
  const unit = barsUnit(state);
  const y = name === 'left' ? BARS.leftY : BARS.rightY;
  let x: number = BARS.x;
  return rowItems(state, state[name], unit).map((item) => {
    const rect = { item, x, y, width: item.width, height: BARS.height };
    x += item.width + 6;
    return rect;
  });
}
