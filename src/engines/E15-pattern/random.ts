/**
 * E15 seed 난수. E17의 `mulberry32`와 같은 식이지만 엔진끼리 import하지 않으므로 복사한다.
 * 난수는 `createInitialState`에서 가린 칸을 고를 때만 쓰고, 결과는 상태에 저장한다
 * (되감기·미러링에서 같은 칸).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
