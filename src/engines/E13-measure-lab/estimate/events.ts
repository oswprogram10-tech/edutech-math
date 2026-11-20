/** E13 estimate의 공개 판정(순수 함수). */
import type { EnginePredicate } from '../../../core/engine-sdk';

export const estimatePredicates: Readonly<Record<string, EnginePredicate>> = {
  /** 물건 왼쪽 끝이 자의 0에 맞았다. */
  zeroAligned: (observation) => observation['zeroAligned'] === true,
  /** 어림을 넣어 잠갔다. */
  estimateLocked: (observation) => observation['estimateLocked'] === true,
  /** 자를 한 번 이상 옮겼다(처음으로 누르면 다시 false). */
  rulerMoved: (observation) => observation['rulerMoved'] === true,
};
