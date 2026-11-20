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

/** estimate 판의 논리 높이: 자 아래 끝 + 여백. 물건과 자가 모두 위쪽에 있어 설정과 무관하다. */
export function boardHeight(): number {
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
