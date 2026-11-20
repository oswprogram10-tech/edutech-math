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
