/** E10 애니메이션 도우미. 화면 좌표만 number를 쓰고 상태에는 넣지 않는다. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function easeInOut(value: number): number {
  const t = value < 0 ? 0 : value > 1 ? 1 : value;
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export const MOVE_DURATION_MS = 450;
