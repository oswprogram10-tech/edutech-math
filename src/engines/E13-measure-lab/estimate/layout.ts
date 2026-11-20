/**
 * E13 estimate 판 좌표(논리 1000×600). 본 판과 힌트 ② 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 화면 좌표만 number다. 자 눈금은 1cm = 30px이고 물건 왼쪽 끝은 항상 같은 x에 있다(자가 움직인다).
 */
import { num } from '../rat';
import { RULER_CM } from './types';
import type { EstimateState } from './types';

/** 논리 너비와 포인터 좌표 한계(높이 600). 판이 그리는 높이는 `boardHeight()`다. */
export const BOARD = { width: 1000, height: 600 } as const;
/** 1cm가 그려지는 논리 px. */
export const PPC = 30;
/** 물건 왼쪽 끝 x. 자 눈금 0~5 어디서 시작해도 자(25cm)가 판 안에 들어온다. */
export const OBJECT_LEFT = 200;
export const OBJECT_TOP = 150;
export const OBJECT_H = 44;
export const ESTIMATE_BAR = { top: 80, height: 28 } as const;
/** count-cells 오버레이가 칠하는 줄(물건 바로 아래). */
export const CELLS = { top: OBJECT_TOP + OBJECT_H + 8, height: 30 } as const;
export const RULER = { top: 262, height: 92, tickH: 40, numberY: 322 } as const;
export const RULER_WIDTH = RULER_CM * PPC;

/** 판 아래 여백(논리 px). */
const BOTTOM_PAD = 30;

/**
 * mm 확대 칸(zoomLevels가 ['cm','mm']일 때만 판 아래에 더한다, T211). 자 아래 끝에서 이어지는 선으로
 * 확대 구간을 보여 주고, 1cm = 240px(8배)다. 확대 구간의 중심은 물건 오른쪽 끝이고 2cm 폭이다.
 * 확대를 켜고 끄는 것과 무관하게 높이가 같아 판이 늘었다 줄지 않는다(힌트 mm-count 자리도 여기다).
 */
export const ZOOM_PPC = 240;
export const ZOOM = {
  /** 확대 구간 중심 x(물건 오른쪽 끝이 놓인다). */
  centerX: 540,
  frameTop: 376,
  frameHeight: 146,
  objectTop: 384,
  objectHeight: 24,
  stripTop: 414,
  stripHeight: 100,
} as const;
export const ZOOM_LEFT = ZOOM.centerX - ZOOM_PPC;
export const ZOOM_RIGHT = ZOOM.centerX + ZOOM_PPC;
export const ZOOM_BOTTOM = ZOOM.frameTop + ZOOM.frameHeight;

/** estimate 판의 논리 높이: 자 아래 끝 + 여백. mm 확대 칸이 있으면 그 칸 아래 끝 + 여백이다(600 이하). */
export function boardHeight(state?: Pick<EstimateState, 'zoomMm'>): number {
  if (state?.zoomMm) return ZOOM_BOTTOM + 28;
  return RULER.top + RULER.height + BOTTOM_PAD;
}

/** 자 왼쪽 끝(영점) x. 물건 왼쪽 끝이 자의 offset 눈금에 놓이도록 한다. */
export function rulerLeft(state: Pick<EstimateState, 'rulerOffset'>): number {
  return OBJECT_LEFT - num(state.rulerOffset) * PPC;
}

/** 그림 좌표는 소수점 둘째 자리까지만 쓴다(DOM에 부동소수 찌꺼기가 남지 않게). */
export function r2(value: number): number {
  return Math.round(value * 100) / 100;
}
