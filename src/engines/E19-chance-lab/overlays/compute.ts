/**
 * E19 힌트 ② 오버레이가 쓰는 순수 계산(고정 seed). 본 판 상태를 바꾸지 않고, 같은 장치면 늘 같은 결과다.
 */
import { emptyCounts, sequence, tally, totalOf, weightsOf } from '../device';
import type { Device, OutcomeCounts } from '../types';

export const SMALL_BATCH_SEEDS: readonly number[] = [101, 202, 303, 404, 505];
export const SMALL_BATCH_SIZE = 10;

/** 장치로 10회씩 5묶음을 돌린 색별 횟수(같은 장치면 늘 같은 결과). */
export function smallBatchCounts(device: Device): OutcomeCounts[] {
  if (totalOf(device) < 1) return SMALL_BATCH_SEEDS.map(() => emptyCounts());
  return SMALL_BATCH_SEEDS.map((seed) => tally(device, seed, SMALL_BATCH_SIZE));
}

export const STREAK_SEED = 20241120;
export const STREAK_TRIALS = 10000;
export const STREAK_LENGTH = 5;

export interface StreakStats {
  /** 빨강이 5번 이어진 바로 다음 시행의 수. */
  readonly samples: number;
  /** 그 시행들의 색별 횟수. */
  readonly after: OutcomeCounts;
  /** 전체 시행의 색별 횟수. */
  readonly whole: OutcomeCounts;
  readonly trials: number;
}

/** 순수 함수: 같은 장치면 늘 같은 결과. 빨강이 없으면 null. */
export function afterStreakStats(device: Device): StreakStats | null {
  if (weightsOf(device).red === 0) return null;
  const draws = sequence(device, STREAK_SEED, STREAK_TRIALS);
  const after = emptyCounts();
  const whole = emptyCounts();
  let run = 0;
  let samples = 0;
  for (const outcome of draws) {
    whole[outcome] += 1;
    if (run >= STREAK_LENGTH) {
      after[outcome] += 1;
      samples += 1;
    }
    run = outcome === 'red' ? run + 1 : 0;
  }
  return { samples, after, whole, trials: draws.length };
}
