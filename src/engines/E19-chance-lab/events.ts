/** E19의 공개 이벤트·판정(순수 함수). 연동은 이번 카드에서 쓰지 않는다. */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { observe } from './observe';
import type { ChanceAction, ChanceState } from './types';

export const EVENT_NAMES = ['chance-changed'] as const;

/** 상태가 바뀔 때 지금 상태의 판정 사실을 알린다(평균 값은 싣지 않는다). */
export function emit(prev: ChanceState, next: ChanceState, action: ChanceAction): EngineEvent[] {
  void action;
  if (prev === next) return [];
  const o = observe(next);
  if (next.mode === 'leveling') {
    return [{ name: 'chance-changed', payload: { leveled: o['leveled'] ?? false } }];
  }
  if (next.mode === 'seesaw') {
    return [{ name: 'chance-changed', payload: { tilt: o['tilt'] ?? 'level' } }];
  }
  if (next.mode === 'words') {
    return [{ name: 'chance-changed', payload: { allPlaced: o['allPlaced'] ?? false } }];
  }
  if (next.mode === 'spinner') {
    return [{ name: 'chance-changed', payload: { trials: o['trials'] ?? 0 } }];
  }
  if (next.mode === 'simulate') {
    return [{ name: 'chance-changed', payload: { runs: o['runs'] ?? 0 } }];
  }
  return [{ name: 'chance-changed', payload: { dragged: o['dragged'] ?? false } }];
}

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function rationalOf(value: JsonValue | undefined): Rational | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  try {
    return Rational.parse(String(value));
  } catch {
    return null;
  }
}

function sameRational(actual: JsonValue | undefined, wanted: JsonValue | undefined): boolean {
  const a = rationalOf(actual);
  const b = rationalOf(wanted);
  return a !== null && b !== null && a.equals(b);
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  /** leveling: 모든 기둥 높이가 같은가. */
  leveled: (observation: Observation) => observation['leveled'] === true,
  /** leveling, args `{ value }`: 고르게 된 높이가 이 수인가. */
  levelIs: (observation, args) =>
    observation['leveled'] === true && sameRational(observation['level'], record(args)?.['value']),
  /** leveling, args `{ n }`: 옮긴 횟수가 n 이하인가. */
  movesAtMost: (observation, args) => {
    const n = record(args)?.['n'];
    const moves = observation['moves'];
    return typeof n === 'number' && typeof moves === 'number' && moves <= n;
  },
  /** seesaw: 판자가 수평인가. */
  balanced: (observation) => observation['balanced'] === true,
  /** seesaw, args `{ value }`: 받침점이 이 위치인가. */
  fulcrumIs: (observation, args) => sameRational(observation['fulcrum'], record(args)?.['value']),
  /** outlier, args `{ index, value }`: 그 자리 점의 값. */
  valueAt: (observation, args) => {
    const wanted = record(args);
    const values = observation['values'];
    const index = wanted?.['index'];
    if (!Array.isArray(values) || typeof index !== 'number') return false;
    return values[index] === wanted?.['value'];
  },
  /** words, args `{ card, value }`: 그 카드가 이 칸 위치(0·1/4·1/2…)에 놓였는가. */
  placementIs: (observation, args) => {
    const placements = observation['placements'];
    const wanted = record(args);
    const card = wanted?.['card'];
    if (typeof card !== 'string' || record(placements as JsonValue) === null) return false;
    const placed = record(placements as JsonValue)?.[card];
    return placed !== null && placed !== undefined && sameRational(placed, wanted?.['value']);
  },
  /** words: 모든 카드를 놓았는가. */
  allPlaced: (observation) => observation['allPlaced'] === true,
  /** spinner·simulate, args `{ outcome, value }`: 장치의 그 색 가능성이 이 수인가. */
  probabilityIs: (observation, args) => {
    const wanted = record(args);
    const outcome = wanted?.['outcome'];
    const probabilities = record(observation['probabilities']);
    if (typeof outcome !== 'string' || probabilities === null) return false;
    return sameRational(probabilities[outcome], wanted?.['value']);
  },
  /** spinner, args `{ n }`: 돌린 횟수가 n 이상인가. */
  trialsAtLeast: (observation, args) => {
    const n = record(args)?.['n'];
    const trials = observation['trials'];
    return typeof n === 'number' && typeof trials === 'number' && trials >= n;
  },
  /** spinner·simulate, args `{ outcome, count }`: 주머니 개수 또는 회전판 칸 크기 합이 count인가. */
  deviceHas: (observation, args) => {
    const wanted = record(args);
    const outcome = wanted?.['outcome'];
    const device = record(observation['device']);
    if (typeof outcome !== 'string' || device === null) return false;
    const list = device['type'] === 'bag' ? device['marbles'] : device['sectors'];
    if (!Array.isArray(list)) return false;
    let sum = 0;
    for (const entry of list) {
      const item = record(entry);
      if (item?.['color'] !== outcome) continue;
      const amount = item['count'] ?? item['size'];
      if (typeof amount === 'number') sum += amount;
    }
    return sum === wanted?.['count'];
  },
  /** simulate, args `{ batch }`: 그 칸을 돌렸는가. */
  batchRun: (observation, args) => {
    const batch = record(args)?.['batch'];
    const results = observation['results'];
    return (
      Array.isArray(results) && results.some((r) => record(r as JsonValue)?.['batch'] === batch)
    );
  },
  /** simulate: 모든 칸을 돌렸는가. */
  allBatchesRun: (observation) => observation['allBatchesRun'] === true,
  /** args `{ value }`: 평균이 이 수인가("10.6"과 "53/5" 표기 차이 무시). */
  meanIs: (observation, args) => sameRational(observation['mean'], record(args)?.['value']),
  /** outlier: 점을 한 번이라도 끌었는가. */
  dragged: (observation) => observation['dragged'] === true,
  /** outlier: 예측을 잠갔는가. */
  predictionLocked: (observation) => observation['predictionLocked'] === true,
  /** outlier, args `{ value }`: 잠근 예측이 이 수인가. */
  predictionIs: (observation, args) =>
    observation['predictionLocked'] === true &&
    sameRational(observation['prediction'], record(args)?.['value']),
};
