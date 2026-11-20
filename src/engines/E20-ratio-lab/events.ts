/** E20의 공개 이벤트·판정(순수 함수). 연동은 이번 카드에서 쓰지 않는다. */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { readBar } from './bar';
import { readMix, readResize } from './observe';
import type { RatioAction, RatioState } from './types';

export const EVENT_NAMES = ['ratio-changed'] as const;

/** 상태가 바뀔 때 지금 비의 상태를 알린다. */
export function emit(prev: RatioState, next: RatioState, action: RatioAction): EngineEvent[] {
  void action;
  if (prev === next) return [];
  switch (next.mode) {
    case 'mix': {
      const reading = readMix(next);
      return [
        {
          name: 'ratio-changed',
          payload: { value: reading.cup.value, sameAsReference: reading.sameAsReference },
        },
      ];
    }
    case 'resize':
      return [{ name: 'ratio-changed', payload: { distorted: readResize(next).distorted } }];
    case 'rate':
      return [{ name: 'ratio-changed', payload: { ran: next.runs > 0 } }];
    case 'percent':
      return [{ name: 'ratio-changed', payload: { shaded: next.cells.length } }];
    case 'bar-model':
      return [
        { name: 'ratio-changed', payload: { highlightCorrect: readBar(next).highlightCorrect } },
      ];
  }
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
  /** args `{ value }`: 학생이 예측한 쪽(캐릭터 id 또는 'same'). */
  predictionIs: (observation, args) => {
    const value = record(args)?.['value'];
    return (
      observation['mode'] === 'rate' &&
      typeof value === 'string' &&
      observation['prediction'] === value
    );
  },
  /** 예측이 실제 더 빠른 쪽과 같다(속력이 같으면 'same'). */
  predictionCorrect: (observation) => {
    if (observation['mode'] !== 'rate' || typeof observation['prediction'] !== 'string') {
      return false;
    }
    if (observation['sameSpeed'] === true) return observation['prediction'] === 'same';
    const fastest = observation['fastestId'];
    return typeof fastest === 'string' && observation['prediction'] === fastest;
  },
  ran: (observation) => observation['mode'] === 'rate' && count(observation, 'runs') >= 1,
  sameSpeed: (observation) => observation['sameSpeed'] === true,
  /** args `{ id, distance, time }`: 이 캐릭터의 거리·시간이 이 값인가. */
  racerIs: (observation, args) => {
    const wanted = record(args);
    const list = observation['racers'];
    if (!Array.isArray(list) || wanted === null) return false;
    const id = wanted['id'];
    const distance = integer(wanted['distance']);
    const time = integer(wanted['time']);
    if (typeof id !== 'string' || distance === null || time === null) return false;
    return list.some((r) => {
      const item = record(r);
      return item?.['id'] === id && item['distance'] === distance && item['time'] === time;
    });
  },
  /** 두 캐릭터의 거리·시간 쌍이 모두 들어 있고 서로 다르다. */
  racersDiffer: (observation) => {
    const list = observation['racers'];
    if (!Array.isArray(list) || list.length !== 2) return false;
    const [a, b] = list.map(record);
    if (!a || !b) return false;
    const values = [a['distance'], a['time'], b['distance'], b['time']];
    if (!values.every((v) => typeof v === 'number')) return false;
    return a['distance'] !== b['distance'] || a['time'] !== b['time'];
  },
  /** args `{ n }`: 칠한 칸 수가 n인가. */
  shadedIs: (observation, args) => {
    const n = integer(record(args)?.['n']);
    return observation['mode'] === 'percent' && n !== null && observation['shaded'] === n;
  },
  /** args `{ value }`: 칠한 칸 ÷ 100이 이 수와 같은가("1/4"와 "25/100" 표기 차이 무시). */
  fractionIs: (observation, args) => {
    const wanted = rationalOf(record(args)?.['value']);
    const actual = rationalOf(observation['fraction']);
    return (
      observation['mode'] === 'percent' &&
      wanted !== null &&
      actual !== null &&
      wanted.equals(actual)
    );
  },
  highlightCorrect: (observation) => observation['highlightCorrect'] === true,
  unitCorrect: (observation) => observation['unitCorrect'] === true,
  /** args `{ index }`: 이 사람(parts 번호)의 몫이 맞는가. */
  partCorrect: (observation, args) => {
    const index = integer(record(args)?.['index']);
    const list = observation['partsCorrect'];
    return index !== null && Array.isArray(list) && list[index] === true;
  },
  allPartsCorrect: (observation) => {
    const list = observation['partsCorrect'];
    return Array.isArray(list) && list.length > 0 && list.every((v) => v === true);
  },
  totalCorrect: (observation) => observation['totalCorrect'] === true,
  /** args `{ index }`: 식 칸의 값이 이 사람(parts 번호)의 몫과 같은가. */
  exprMatchesPart: (observation, args) => {
    const index = integer(record(args)?.['index']);
    return index !== null && observation['exprMatchesPart'] === index;
  },
  hasMisconception: (observation, args) => {
    const code = record(args)?.['code'];
    const list = observation['misconceptions'];
    return typeof code === 'string' && Array.isArray(list) && list.includes(code);
  },
};
