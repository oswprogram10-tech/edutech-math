/** E20의 공개 이벤트·판정(순수 함수). 연동은 이번 카드에서 쓰지 않는다. */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { readMix, readResize } from './observe';
import type { RatioAction, RatioState } from './types';

export const EVENT_NAMES = ['ratio-changed'] as const;

/** 상태가 바뀔 때 지금 비의 상태를 알린다. */
export function emit(prev: RatioState, next: RatioState, action: RatioAction): EngineEvent[] {
  void action;
  if (prev === next) return [];
  if (next.mode === 'mix') {
    const reading = readMix(next);
    return [
      {
        name: 'ratio-changed',
        payload: { value: reading.cup.value, sameAsReference: reading.sameAsReference },
      },
    ];
  }
  return [{ name: 'ratio-changed', payload: { distorted: readResize(next).distorted } }];
}

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function integer(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function rationalOf(value: JsonValue | undefined): Rational | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  try {
    return Rational.parse(String(value));
  } catch {
    return null;
  }
}

function pairIs(
  actual: JsonValue | undefined,
  a: [string, number | null],
  b: [string, number | null],
) {
  const object = record(actual);
  if (object === null || a[1] === null || b[1] === null) return false;
  return object[a[0]] === a[1] && object[b[0]] === b[1];
}

function count(observation: Observation, key: string): number {
  const value = observation[key];
  return typeof value === 'number' ? value : 0;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ milk, syrup }`: 학생 컵이 이 양과 같은가(비가 같은 다른 양은 아니다). */
  cupIs: (observation, args) => {
    const wanted = record(args);
    return (
      observation['mode'] === 'mix' &&
      pairIs(
        observation['cup'],
        ['milk', integer(wanted?.['milk'])],
        ['syrup', integer(wanted?.['syrup'])],
      )
    );
  },
  sameAsReference: (observation) => observation['sameAsReference'] === true,
  /** args `{ value }`: 학생 컵의 시럽÷우유가 이 수와 같은가("1/4"와 "2/8" 표기 차이 무시). */
  cupValueIs: (observation, args) => {
    const wanted = rationalOf(record(args)?.['value']);
    const cup = record(observation['cup']);
    const actual = rationalOf(cup?.['value']);
    return (
      observation['mode'] === 'mix' && wanted !== null && actual !== null && wanted.equals(actual)
    );
  },
  scaleUsed: (observation) => count(observation, 'scaleOps') >= 1,
  savedEquivalentAtLeast: (observation, args) => {
    const n = integer(record(args)?.['n']);
    return n !== null && count(observation, 'savedEquivalentCount') >= n;
  },
  allSavedEquivalent: (observation) => {
    const saved = observation['saved'];
    return (
      Array.isArray(saved) &&
      saved.length >= 1 &&
      saved.every((s) => record(s)?.['equivalent'] === true)
    );
  },
  /** args `{ w, h }`: 지금 사진 크기가 이 크기인가. */
  sizeIs: (observation, args) => {
    const wanted = record(args);
    return (
      observation['mode'] === 'resize' &&
      pairIs(observation['size'], ['w', integer(wanted?.['w'])], ['h', integer(wanted?.['h'])])
    );
  },
  distorted: (observation) => observation['distorted'] === true,
  hasMisconception: (observation, args) => {
    const code = record(args)?.['code'];
    const list = observation['misconceptions'];
    return typeof code === 'string' && Array.isArray(list) && list.includes(code);
  },
};
