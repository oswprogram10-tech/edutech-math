/**
 * E17 seed 난수. E01의 `seededRandom`과 같은 식이지만 엔진끼리 import하지 않으므로
 * 복사한다. 난수는 `createInitialState`와 `new-round`의 reduce 안에서만 쓰고,
 * 결과 카드 id는 상태에 저장한다(되감기·미러링에서 같은 비밀 카드).
 */
import type { CardId } from './types';

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

export function secretFor(seed: number, round: number, deckIds: readonly CardId[]): CardId {
  if (deckIds.length === 0) return '';
  const random = mulberry32((seed >>> 0) ^ Math.imul(round, 0x9e3779b9));
  const index = Math.floor(random() * deckIds.length);
  return deckIds[Math.min(deckIds.length - 1, Math.max(0, index))] ?? '';
}
