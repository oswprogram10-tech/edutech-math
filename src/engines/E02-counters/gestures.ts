/**
 * part-whole의 두 손가락(핀치) 합치기 판정.
 * View는 SDK `usePinch`의 축소 배율을 이 함수에 넘겨 `merge`를 보낼지 정한다.
 */

/** 손가락 사이 거리가 처음의 이 비율 이하로 줄면 합치기로 본다. */
export const PINCH_MERGE_SCALE = 0.7;

export interface PinchMerge {
  /** 옮겨질 접시(번호가 큰 쪽). */
  readonly from: number;
  /** 남는 접시(번호가 작은 쪽). */
  readonly to: number;
}

/**
 * 두 포인터가 각각 다른 접시 위에서 시작했고, 배율이 임계값 이하로 줄었을 때만
 * 합칠 접시 쌍을 돌려준다. 그 밖에는 null.
 */
export function pinchMergeTarget(
  plateA: number | null,
  plateB: number | null,
  scale: number,
): PinchMerge | null {
  if (plateA === null || plateB === null) return null;
  if (plateA === plateB) return null;
  if (!Number.isFinite(scale) || scale > PINCH_MERGE_SCALE) return null;
  return { from: Math.max(plateA, plateB), to: Math.min(plateA, plateB) };
}
