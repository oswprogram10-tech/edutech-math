/**
 * E13 weight 판 좌표(논리 너비 1000). 본 판과 힌트 ② 오버레이가 같은 식을 쓴다.
 * 저울이 하나면 가운데에, 둘이면 윗접시저울은 왼쪽 600, 용수철저울은 오른쪽에 나눠 놓는다.
 * 기울기 각도·눈금 길이처럼 화면 그림용 값만 number다(수학 값은 Rational 문자열).
 */
import { Rational } from '../../../core/math';
import { leftGrams, placeOf, rightGrams } from './settings';
import type { Tilt } from './settings';
import type { Pan, VisualSize, WeightState } from './types';

export const BOARD = { width: 1000 } as const;

export interface BalanceGeo {
  readonly cx: number;
  readonly pivotY: number;
  readonly beamHalf: number;
  readonly panHalf: number;
  /** 수평일 때 접시 윗면 y. */
  readonly surfaceY: number;
  readonly standBase: number;
  /** 물건 그림 배율(저울이 둘이면 작다). */
  readonly itemScale: number;
}

export interface SpringGeo {
  /** 용수철·고리 가운데 x. */
  readonly x: number;
  /** 윗걸이 y. */
  readonly top: number;
  /** 눈금 0의 y(고리가 비었을 때 고리 자리). */
  readonly zeroY: number;
  /** 눈금 0 ~ 끝의 길이. */
  readonly len: number;
  /** 눈금 막대 x. */
  readonly rulerX: number;
  readonly itemScale: number;
}

export interface WeightGeo {
  readonly height: number;
  /** 선반 윗면 y. */
  readonly shelfTop: number;
  readonly balance: BalanceGeo | null;
  readonly spring: SpringGeo | null;
}

export const SIZE_PX: Readonly<Record<VisualSize, number>> = { small: 52, medium: 74, large: 96 };
export const SIZE_RANK: Readonly<Record<VisualSize, number>> = { small: 1, medium: 2, large: 3 };
/** 눌러 잡는 영역의 최소 변(논리). 0.6배로 줄어도 48px 안팎이 되게 한다. */
export const MIN_HIT = 80;
const SHELF_H = 100;

const MAX_TILT = 12;
const MIN_TILT = 4;

function has(state: Pick<WeightState, 'tools'>, tool: 'pan-balance' | 'spring-scale'): boolean {
  return state.tools.includes(tool);
}

/** 설정(저울 종류)에 따른 판 배치. */
/** 10g 간격 목표(논리 px)와 용수철 눈금 위쪽 자리. 눈금 길이 = 10g 칸 수 × 간격(판 아래 끝 안에서 가능한 최대). */
export const TEN_GAP = 8;
const SPRING_TOP = 44;
const SPRING_ZERO = 76;
const HOOK_DROP = 16;
const HUNG_MAX = 96 * 0.7;

/** 용수철 눈금 길이(논리 px): springMaxG의 10g 칸 수 × 8, 판(높이 600) 안에 걸린 큰 물건이 들어오는 만큼까지. */
export function springLength(maxG: string | undefined): number {
  const tens = Math.max(1, Number(maxG ?? '1000') / 10);
  const room = 600 - 8 - SPRING_ZERO - HOOK_DROP - HUNG_MAX;
  return Math.min(tens * TEN_GAP, room);
}

export function geoOf(
  state: Pick<WeightState, 'tools'> & { readonly springMaxG?: string },
): WeightGeo {
  const pan = has(state, 'pan-balance');
  const spring = has(state, 'spring-scale');
  // 둘 다 있거나 용수철저울이면 눈금 자리가 필요해 600, 윗접시저울만이면 560이다.
  const height = spring ? 600 : 560;
  const shelfTop = height - SHELF_H - 10;
  const balance: BalanceGeo | null = !pan
    ? null
    : spring
      ? {
          cx: 290,
          pivotY: 120,
          beamHalf: 190,
          panHalf: 85,
          surfaceY: 290,
          standBase: 420,
          itemScale: 0.7,
        }
      : {
          cx: 500,
          pivotY: 120,
          beamHalf: 300,
          panHalf: 130,
          surfaceY: 300,
          standBase: 410,
          itemScale: 1,
        };
  const springGeo: SpringGeo | null = !spring
    ? null
    : pan
      ? {
          x: 770,
          top: SPRING_TOP,
          zeroY: SPRING_ZERO,
          len: springLength(state.springMaxG),
          rulerX: 820,
          itemScale: 0.7,
        }
      : {
          x: 440,
          top: SPRING_TOP,
          zeroY: SPRING_ZERO,
          len: springLength(state.springMaxG),
          rulerX: 500,
          itemScale: 0.7,
        };
  return { height, shelfTop, balance, spring: springGeo };
}

/** 이 설정에서 판이 쓰는 논리 높이(600 이하). */
export function boardHeight(state: Pick<WeightState, 'tools'>): number {
  return geoOf(state).height;
}

function ratio(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

/** 두 접시의 무게로 정하는 기울기 각도(0~12). 같으면 0. 화면 그림용이다. */
export function tiltDegrees(state: WeightState): number {
  const left = leftGrams(state);
  const right = rightGrams(state);
  if (left.compareTo(right) === 0) return 0;
  const a = ratio(left);
  const b = ratio(right);
  const share = Math.min(1, Math.abs(a - b) / Math.max(a, b, 1));
  return Math.min(MAX_TILT, MIN_TILT + (MAX_TILT - MIN_TILT) * share);
}

/** 가로대 회전(CSS rotate 각도). 왼쪽이 무거우면 왼쪽 끝이 내려가도록 음수. */
export function beamRotation(tilt: Tilt, degrees: number): number {
  return tilt === 'left' ? -degrees : tilt === 'right' ? degrees : 0;
}

export interface PanOffset {
  readonly dx: number;
  readonly dy: number;
}

/** 수평일 때 위치에서 각 접시가 옮겨 가는 양. */
export function panOffsets(
  beamHalf: number,
  tilt: Tilt,
  degrees: number,
): { readonly left: PanOffset; readonly right: PanOffset } {
  if (tilt === 'level') return { left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } };
  const rad = (degrees * Math.PI) / 180;
  const drop = beamHalf * Math.sin(rad);
  const inward = beamHalf * (1 - Math.cos(rad));
  const sign = tilt === 'left' ? 1 : -1;
  return {
    left: { dx: inward, dy: sign * drop },
    right: { dx: -inward, dy: -sign * drop },
  };
}

/** 접시 가운데 x(수평일 때). */
export function panCenter(balance: BalanceGeo, pan: 'left' | 'right'): number {
  return pan === 'left' ? balance.cx - balance.beamHalf : balance.cx + balance.beamHalf;
}

/** 용수철저울: 걸린 g에 비례해 늘어난 고리 y. g가 null이면 눈금 0 자리. */
export function hookY(spring: SpringGeo, g: Rational | null, maxG: Rational): number {
  if (g === null) return spring.zeroY;
  return spring.zeroY + spring.len * Math.min(1, ratio(g) / ratio(maxG));
}

export interface Placement {
  /** 그림 아래 가운데. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

const SHELF_X0 = 90;
const SHELF_X1 = 910;

/** 물건 하나의 지금 자리(접시 물건은 접시 기울기를, 걸린 물건은 늘어난 길이를 따른다). */
export function placementOf(state: WeightState, id: string): Placement {
  const geo = geoOf(state);
  const where = placeOf(state, id);
  const item = state.objects.find((candidate) => candidate.id === id);
  const size = SIZE_PX[item?.visualSize ?? 'medium'];
  if (where === 'left' || where === 'right') {
    const balance = geo.balance;
    if (balance !== null) {
      const tilt = tiltOf(state);
      const offsets = panOffsets(balance.beamHalf, tilt, tiltDegrees(state));
      const off = offsets[where];
      return {
        x: panCenter(balance, where) + off.dx,
        y: balance.surfaceY - 2 + off.dy,
        scale: balance.itemScale,
      };
    }
  }
  if (where === 'spring' && geo.spring !== null) {
    const hook = hookY(
      geo.spring,
      Rational.parse(item?.g ?? '0'),
      Rational.parse(state.springMaxG),
    );
    return {
      x: geo.spring.x,
      y: hook + HOOK_DROP + size * geo.spring.itemScale,
      scale: geo.spring.itemScale,
    };
  }
  const index = state.objects.findIndex((candidate) => candidate.id === id);
  const count = state.objects.length;
  const step = count > 1 ? Math.min(180, (SHELF_X1 - SHELF_X0) / (count - 1)) : 0;
  return {
    x: 500 + (index - (count - 1) / 2) * step,
    y: geo.shelfTop + SHELF_H - 22,
    scale: 1,
  };
}

function tiltOf(state: WeightState): Tilt {
  const order = leftGrams(state).compareTo(rightGrams(state));
  return order > 0 ? 'left' : order < 0 ? 'right' : 'level';
}

/** 놓은 자리(논리 좌표)가 어느 곳인지. 어디도 아니면 null. */
export function dropTarget(
  state: Pick<WeightState, 'tools'>,
  x: number,
  y: number,
): Pan | 'spring' | null {
  const geo = geoOf(state);
  if (y >= geo.shelfTop - 10) return 'shelf';
  const balance = geo.balance;
  if (balance !== null) {
    const reach = balance.panHalf + 40;
    if (y < balance.standBase) {
      if (Math.abs(x - panCenter(balance, 'left')) <= reach) return 'left';
      if (Math.abs(x - panCenter(balance, 'right')) <= reach) return 'right';
    }
  }
  if (geo.spring !== null && Math.abs(x - geo.spring.x) <= 110 && y < geo.shelfTop - 10) {
    return 'spring';
  }
  return null;
}

/** 그림 좌표는 소수점 둘째 자리까지만 쓴다. */
export function r2(value: number): number {
  return Math.round(value * 100) / 100;
}
