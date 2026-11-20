/**
 * E13 length 판 좌표(논리 1000×600). 본 판과 힌트 ② 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 화면 좌표만 number다(길이는 Rational 문자열이고, 여기서 그림용 number로 바꾼다).
 */
import { num } from '../rat';
import type { MeasureState } from './types';
import { BAND_EXTRA_CM } from './types';

/** 논리 너비와 포인터 좌표 한계(높이 600). 판이 그리는 높이는 `boardHeight()`다. */
export const BOARD = { width: 1000, height: 600 } as const;
export const BAND_LEFT = 60;
export const BAND_WIDTH = 880;
export const OBJECT_H = 44;
export const BAND_H = 52;
export const SLOT_H = 56;
/** 자를 만든 뒤 눈금 칸 사이 간격(논리 px). 블록 경계에서 펼쳐 내려 눈금 칸을 크게 만든다. */
export const RULER_STEP = 88;
export const TICK_COUNT = 11;

export interface Geo {
  /** 1cm가 그려지는 논리 px. */
  readonly ppc: number;
  readonly objectTop: number;
  readonly bandTop: number;
  readonly bandBottom: number;
  readonly slotTop: number;
  readonly slotBottom: number;
}

/**
 * 뼘 시연이 있으면 판 위쪽을 시연에 내주고 나머지를 아래로 민다.
 * 합체 규칙(mergeRule)이 있으면 위쪽 120px을 1m 줄자 오버레이(meter-100) 자리로 비워 둔다.
 */
export function geoOf(state: Pick<MeasureState, 'objectCm' | 'demo' | 'mergeRule'>): Geo {
  const top = state.demo !== null ? 210 : state.mergeRule ? 120 : 40;
  const bandTop = top + 80;
  const bandBottom = bandTop + BAND_H;
  const slotTop = bandBottom + 64;
  return {
    ppc: BAND_WIDTH / (num(state.objectCm) + BAND_EXTRA_CM),
    objectTop: top,
    bandTop,
    bandBottom,
    slotTop,
    slotBottom: slotTop + SLOT_H,
  };
}

/** 판 아래 여백(논리 px). */
const BOTTOM_PAD = 30;
/**
 * 판이 너무 납작해지지 않게 하는 바닥. 두 칸 샌드박스(판 너비 약 730px)에서 짧은 변이 280px 이상이어야
 * 해서(fit-canvas) estimate 판(384)과 같은 높이 대를 쓴다.
 */
const MIN_HEIGHT = 390;

/**
 * length 판의 논리 높이(T223): 실제로 그리는 맨 아래(눈금 칸이 있으면 눈금 칸, 없으면 띠) + 여백.
 * 뼘 시연·합체 규칙의 위쪽 자리는 `geoOf`가 이미 반영한다. 390 이상 600 이하.
 */
export function boardHeight(
  state: Pick<MeasureState, 'objectCm' | 'demo' | 'mergeRule' | 'buildRuler'>,
): number {
  const geo = geoOf(state);
  const bottom = state.buildRuler ? geo.slotBottom : geo.bandBottom;
  return Math.min(BOARD.height, Math.max(MIN_HEIGHT, bottom + BOTTOM_PAD));
}

export function xOfCm(geo: Geo, cm: number): number {
  return BAND_LEFT + cm * geo.ppc;
}

/** 논리 x → cm(그림용 number). */
export function cmOfX(geo: Geo, x: number): number {
  return (x - BAND_LEFT) / geo.ppc;
}

/** 뼘 시연 좌표. 두 줄(가·나 친구). */
export const DEMO = {
  rowY: [16, 100] as readonly number[],
  rowH: 70,
  avatarX: 50,
  deskX: 110,
  deskW: 550,
  countX: 684,
  /** span-compare 오버레이가 그려질 오른쪽 빈 자리. */
  compareX: 780,
} as const;

/** 눈금 i번 칸의 가운데 x(논리 px). */
export function rulerX(tick: number): number {
  return BAND_LEFT + tick * RULER_STEP;
}

/** 논리 x에서 가장 가까운 눈금 번호(0~10). */
export function tickOfX(x: number): number {
  return Math.min(Math.max(Math.round((x - BAND_LEFT) / RULER_STEP), 0), TICK_COUNT - 1);
}
