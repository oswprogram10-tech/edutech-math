/** compare의 이벤트·판정(순수 함수). `balanced`·`hasMisconception`은 E06 공용 판정을 그대로 쓴다. */
import type { EngineEvent, EnginePredicate, JsonValue } from '../../../core/engine-sdk';
import { readCompare } from './reduce';
import type { CompareAction, CompareState } from './types';

export function emitCompare(
  prev: CompareState,
  next: CompareState,
  action: CompareAction,
): EngineEvent[] {
  void action;
  if (prev === next) return [];
  const reading = readCompare(next);
  return [{ name: 'balance-changed', payload: { balanced: reading.balanced, tilt: reading.tilt } }];
}

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function ids(value: JsonValue | undefined): string[] | null {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return null;
  return value as string[];
}

function stringList(observation: Readonly<Record<string, unknown>>, key: string): string[] {
  const value = observation[key];
  return Array.isArray(value)
    ? (value as unknown[]).filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export const comparePredicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ left?, right? }`: 준 쪽의 접시 물건 집합이 같다(순서 무관). 둘 다 없으면 거짓. */
  onPans: (observation, args) => {
    const rec = record(args);
    const left = ids(rec?.['left']);
    const right = ids(rec?.['right']);
    if (left === null && right === null) return false;
    if (left !== null && !sameSet(left, stringList(observation, 'left'))) return false;
    if (right !== null && !sameSet(right, stringList(observation, 'right'))) return false;
    return true;
  },
  bothPansUsed: (observation) =>
    stringList(observation, 'left').length > 0 && stringList(observation, 'right').length > 0,
  weighingsAtLeast: (observation, args) => {
    const n = record(args)?.['n'];
    const count = observation['weighings'];
    return typeof n === 'number' && typeof count === 'number' && count >= n;
  },
  /** args `{ a, b }`: 한 번이라도 a와 b를 서로 반대 접시에 하나씩 올렸다. */
  compared: (observation, args) => {
    const a = record(args)?.['a'];
    const b = record(args)?.['b'];
    if (typeof a !== 'string' || typeof b !== 'string' || a === b) return false;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    return stringList(observation, 'pairsCompared').includes(key);
  },
};
