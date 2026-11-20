/**
 * E13 map-route 판 좌표(논리 1000×480). 위쪽은 지도, 아래쪽은 목표 막대(0 ~ targetM × 1.2)다.
 * 오버레이가 없어 본 판만 이 식을 쓴다. 화면 좌표만 number다.
 */
import type { RouteState } from './types';

export const BOARD = { width: 1000, height: 480 } as const;

/** 목표 막대: 가로 800px가 0 ~ targetM × 1.2를 나타낸다. */
export const GOAL_BAR = { x: 100, width: 800, top: 392, height: 36, overshoot: 1.2 } as const;

/** map-route 판의 논리 높이: 막대 이름표 아래 + 여백. 설정과 무관하게 일정하다(600 이하). */
export function boardHeight(): number {
  return BOARD.height;
}

/** 칠한 길이(px). 합이 막대 끝(targetM × 1.2)을 넘으면 막대 끝에서 멈춘다. */
export function fillWidth(totalM: number, targetM: number): number {
  const max = targetM * GOAL_BAR.overshoot;
  return (Math.min(Math.max(totalM, 0), max) / max) * GOAL_BAR.width;
}

/** 목표 눈금의 x. */
export function targetX(): number {
  return GOAL_BAR.x + GOAL_BAR.width / GOAL_BAR.overshoot;
}

/** 합이 막대 끝을 넘었는가(넘치는 화살표를 그린다). */
export function overflows(state: Pick<RouteState, 'targetM'>, totalM: number): boolean {
  return totalM > state.targetM * GOAL_BAR.overshoot;
}

/** 그림 좌표는 소수점 둘째 자리까지만 쓴다. */
export function r2(value: number): number {
  return Math.round(value * 100) / 100;
}
