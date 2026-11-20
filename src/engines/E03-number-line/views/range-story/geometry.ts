/**
 * range 판의 논리 좌표. 판(RangeView)과 오버레이(boundary-rider)가 같은 값을 쓴다.
 * 가로 1000은 그대로이고 높이만 줄였다(조작 칸이 첫 화면에 보이게, T219).
 */
export const RANGE_LOGICAL_HEIGHT = 560;
export const RANGE_LINE_Y = 490;
export const RANGE_REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** 게이트 가운데 x와 바닥 y. */
export const GATE_X = 500;
export const GATE_GROUND_Y = 150;
export const GATE_HALF_WIDTH = 34;

/** 한 줄에 서는 캐릭터 수, 칸 간격(키 글 너비 약 52보다 넓게), 줄 간격. */
export const PER_ROW = 5;
export const SLOT_GAP = 64;
export const ROW_GAP = 112;

export interface Slot {
  readonly x: number;
  readonly y: number;
}

/** 줄 선 캐릭터(원래 순서 index): 왼쪽 두 줄. */
export function queueSlot(index: number): Slot {
  return {
    x: 80 + (index % PER_ROW) * SLOT_GAP,
    y: GATE_GROUND_Y + Math.floor(index / PER_ROW) * ROW_GAP,
  };
}
/** 통과한 캐릭터: 오른쪽 위 줄부터. */
export function passedSlot(order: number): Slot {
  return {
    x: 600 + (order % PER_ROW) * SLOT_GAP,
    y: GATE_GROUND_Y + Math.floor(order / PER_ROW) * ROW_GAP,
  };
}
/** 막혀 비킨 캐릭터: 오른쪽 맨 아래 줄부터 위로(통과 무리와 겹치지 않는다: 합이 10명 이하). */
export function blockedSlot(order: number): Slot {
  return {
    x: 600 + (order % PER_ROW) * SLOT_GAP,
    y: GATE_GROUND_Y + 2 * ROW_GAP - Math.floor(order / PER_ROW) * ROW_GAP,
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(RANGE_REDUCED_QUERY).matches;
}
