/** E06의 공개 이벤트·판정(순수 함수). 연동은 이번 카드에서 쓰지 않는다. */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { readBalance } from './observe';
import { readProportion } from './proportion/read';
import type { E06Action, E06State } from './unions';

export const EVENT_NAMES = ['balance-changed'] as const;

/** 상태가 바뀔 때 저울 상태(수평 여부·기울기)를 알린다. */
export function emit(prev: E06State, next: E06State, action: E06Action): EngineEvent[] {
  void action;
  if (prev === next) return [];
  const reading = next.mode === 'proportion' ? readProportion(next) : readBalance(next);
  return [{ name: 'balance-changed', payload: { balanced: reading.balanced, tilt: reading.tilt } }];
}

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function count(args: JsonValue | undefined): number | null {
  const n = record(args)?.['n'];
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function rationalOf(value: JsonValue | undefined): Rational | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  try {
    return Rational.parse(String(value));
  } catch {
    return null;
  }
}

function number(observation: Observation, key: string): number {
  const value = observation[key];
  return typeof value === 'number' ? value : 0;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  balanced: (observation) => observation['balanced'] === true,
  /** args `{ value }`: 구해진 □의 값이 이 수와 같은가("18"과 "18/1" 표기 차이 무시). */
  boxValueIs: (observation, args) => {
    const wanted = rationalOf(record(args)?.['value']);
    const actual = rationalOf(observation['boxValue']);
    return wanted !== null && actual !== null && wanted.equals(actual);
  },
  boxIsolated: (observation) => observation['boxIsolated'] === true,
  bothSidesOpsAtLeast: (observation, args) => {
    const n = count(args);
    return n !== null && number(observation, 'bothSidesOps') >= n;
  },
  oneSideOpsAtLeast: (observation, args) => {
    const n = count(args);
    return n !== null && number(observation, 'oneSideOps') >= n;
  },
  predictionIs: (observation, args) => {
    const value = record(args)?.['value'];
    return (value === 'yes' || value === 'no') && observation['prediction'] === value;
  },
  predictionLocked: (observation) => observation['predictionLocked'] === true,
  triesAtMost: (observation, args) => {
    const n = count(args);
    const tries = observation['tries'];
    return n !== null && Array.isArray(tries) && tries.length <= n;
  },
  /** proportion: 네 항이 정해졌고 외항의 곱 = 내항의 곱이다(올린 카드, 또는 □에 넣어 본 값). */
  isProportion: (observation) => observation['isProportion'] === true,
  /** proportion 카드 모드: args `{ index }`번 카드를 저울에 올렸는가. */
  cardIs: (observation, args) => {
    const index = record(args)?.['index'];
    return typeof index === 'number' && observation['cardIndex'] === index;
  },
  /** proportion pairSelect: 고른 두 항이 외항 짝 또는 내항 짝이다. */
  pairingCorrect: (observation) => observation['pairing'] === 'extremes-means',
  hasMisconception: (observation, args) => {
    const code = record(args)?.['code'];
    const list = observation['misconceptions'];
    return typeof code === 'string' && Array.isArray(list) && list.includes(code);
  },
};
