/**
 * range 판의 논리 좌표. 판(RangeView)과 오버레이(boundary-rider)가 같은 값을 쓴다.
 * 가로 1000은 그대로이고 높이만 줄였다(조작 칸이 첫 화면에 보이게, T219).
 */
export const RANGE_LOGICAL_HEIGHT = 460;
export const RANGE_LINE_Y = 385;
export const RANGE_REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** 게이트 가운데 x와 바닥 y. */
export const GATE_X = 500;
export const GATE_GROUND_Y = 190;
export const GATE_HALF_WIDTH = 34;

/** 줄 선 캐릭터 칸 x(원래 순서 index) · 통과한 캐릭터 칸 x · 막혀 비킨 캐릭터 칸 x. */
export const QUEUE_X = (index: number): number => 70 + index * 40;
export const PASSED_X = (order: number): number => 562 + order * 40;
export const BLOCKED_X = (order: number): number => 430 - order * 40;
export const BLOCKED_GROUND_Y = 292;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(RANGE_REDUCED_QUERY).matches;
}
